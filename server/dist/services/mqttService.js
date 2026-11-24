"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseGpsMetrics = parseGpsMetrics;
exports.initMqttService = initMqttService;
exports.publishLedCommand = publishLedCommand;
exports.publishStatusCommand = publishStatusCommand;
exports.getMqttStatus = getMqttStatus;
const mqtt_1 = __importDefault(require("mqtt"));
const database_1 = require("./database");
const mqttCerts_1 = require("./mqttCerts");
const AWS_IOT_ENDPOINT = process.env.MQTT_BROKER_URL || 'mqtts://avj249ldc7joq-ats.iot.ap-south-1.amazonaws.com:8883';
// Production topics
const TOPIC_SOUNDBOX_METRICS = 'soundbox_dev/+/metrics';
const TOPIC_SOUNDBOX_ACK = 'soundbox_dev/+/ack';
const TOPIC_SOUNDBOX_CMD_PREFIX = 'soundbox_dev/';
let mqttClient = null;
let broadcastFn = null;
function parseNum(v, fallback = 0) {
    if (v === '' || v === undefined || v === null)
        return fallback;
    const n = Number(v);
    return isNaN(n) ? fallback : n;
}
function parseBool(v) {
    if (typeof v === 'boolean')
        return v;
    if (typeof v === 'number')
        return v === 1;
    if (typeof v === 'string') {
        const s = v.toLowerCase().trim();
        return s === 'y' || s === 'yes' || s === 'true' || s === '1' || s === 'fixed';
    }
    return false;
}
/**
 * Parses GPS Metrics packet directly conforming to user payload
 */
function parseGpsMetrics(json, imei, now) {
    const g = json.gps || {};
    const lat = parseNum(g.latitude, 0);
    const lon = parseNum(g.longitude, 0);
    const isFixed = g.status === 'FIXED' || (lat !== 0 && lon !== 0);
    const speed = parseNum(g.speed_kmph, 0);
    const p = json.power || {};
    const batMv = parseNum(p.bat_v, 4222);
    const batPercentage = parseNum(p.bat_lvl, 100);
    const isLowBat = typeof p.low_battery === 'boolean' ? p.low_battery : (batMv < 3400);
    const c = json.cellular || {};
    const acc = json.accelerometer || {};
    const dev = json.device || {};
    const isMoving = speed > 1.5 || parseBool(acc.motion);
    return {
        deviceId: imei,
        deviceName: dev.model_id ? `${dev.model_id} (${imei})` : `GPS-${imei.slice(-4)}`,
        status: isLowBat ? 'warning' : 'online',
        motionState: isMoving ? 'moving' : 'stationary',
        lastSeen: now,
        device: {
            imei,
            modelId: dev.model_id || 'GW1NS-4',
            serialNumber: dev.serial_no || '',
            appVersion: dev.app_v || 'WMZ_DEV_1.0.2',
            sdkVersion: dev.sdk_v || 'WM_SDK_C_261008',
            hardwareVersion: dev.hw_v || 'Z636_V1',
            bootReason: dev.boot_reason || 'power-off charging',
            uptimeSec: parseNum(dev.uptime_sec, 0),
        },
        power: {
            batteryVoltage: parseFloat((batMv / 1000).toFixed(2)),
            batteryMv: batMv,
            batteryPercentage: batPercentage,
            isCharging: parseBool(p.charging),
            isUsbConnected: parseBool(p.usb),
            isExternalPower: parseBool(p.ext_power),
            extPowerVoltage: p.ext_power_v || '',
            isLowBattery: isLowBat,
        },
        cellular: {
            operator: c.operator || 'IND airtel',
            networkType: c.net_t || 'LTE',
            rssi: parseNum(c.rssi, 29),
            rsrp: parseNum(c.rsrp, 52),
            rsrq: parseNum(c.rsrq, 13),
            sinr: parseNum(c.sinr, -4),
            signal: c.signal || 'EXCELLENT',
            signalQuality: c.signal === 'EXCELLENT' ? 5 : c.signal === 'GOOD' ? 4 : c.signal === 'FAIR' ? 3 : 2,
            band: c.band || '3',
            cellId: c.cell_id || '128026133',
            tac: c.tac || '7911',
            mcc: c.mcc || '404',
            mnc: c.mnc || '02',
            imsi: c.imsi || '404022437552332',
            ip4: c.ip4 || '172.18.222.207',
            ip6: c.ip6 || '',
        },
        gps: {
            status: g.status || (isFixed ? 'FIXED' : 'SEARCHING'),
            isFixed,
            latitude: lat,
            longitude: lon,
            altitudeM: parseNum(g.altitude_m, 301.7),
            speedKmph: speed,
            headingDeg: parseNum(g.heading_deg, 183),
            satellites: parseNum(g.satellites, 29),
            hdop: parseNum(g.hdop, 0.6),
            accuracyM: parseNum(g.accuracy_m, 2.9),
            fixType: g.fix_type || '3D',
            lastFix: g.last_fix || now,
            location: g.location || (lat !== 0 ? `${lat.toFixed(5)}, ${lon.toFixed(5)}` : ''),
        },
        accelerometer: {
            status: acc.status || 'OK',
            motion: parseBool(acc.motion),
            xG: parseNum(acc.x_g, -0.008),
            yG: parseNum(acc.y_g, 0.008),
            zG: parseNum(acc.z_g, -1.043),
            harshBrakingCount: parseNum(acc.harsh_braking_count, 0),
            harshAccelerationCount: parseNum(acc.harsh_acceleration_count, 0),
            sharpTurnCount: parseNum(acc.sharp_turn_count, 0),
            impactCount: parseNum(acc.impact_count, 0),
            drivingScore: parseNum(acc.driving_score, 100),
        },
        rtc: json.rtc || now,
    };
}
function handleMqttMessage(topic, messageBuffer) {
    try {
        const rawPayload = messageBuffer.toString('utf-8').trim();
        const now = new Date().toISOString();
        const db = (0, database_1.getDb)();
        const metricsMatch = topic.match(/^soundbox_dev\/([^/]+)\/metrics$/);
        if (metricsMatch) {
            const imei = metricsMatch[1];
            // Ignore known stale demo devices
            if (imei === '867509082945058' || imei === '861185084200101') {
                return;
            }
            try {
                const json = JSON.parse(rawPayload);
                const deviceData = parseGpsMetrics(json, imei, now);
                console.log(`[MQTT Telemetry] ${imei}: Lat=${deviceData.gps.latitude}, Lon=${deviceData.gps.longitude}, Speed=${deviceData.gps.speedKmph} km/h, Satellites=${deviceData.gps.satellites}`);
                // Upsert device into SQLite
                db.prepare(`
          INSERT INTO devices (deviceId, deviceName, status, lastSeen, data, updatedAt)
          VALUES (?, ?, ?, ?, ?, ?)
          ON CONFLICT(deviceId) DO UPDATE SET
            status = excluded.status,
            lastSeen = excluded.lastSeen,
            data = excluded.data,
            updatedAt = excluded.updatedAt
        `).run(imei, deviceData.deviceName, deviceData.status, now, JSON.stringify(deviceData), now);
                // Store in location history
                if (deviceData.gps.latitude !== 0 && deviceData.gps.longitude !== 0) {
                    db.prepare(`
            INSERT INTO device_history 
            (deviceId, latitude, longitude, altitude, speed, heading, accuracy, satellites,
             batteryPercentage, batteryVoltage, signalQuality, rssi, timestamp)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).run(imei, deviceData.gps.latitude, deviceData.gps.longitude, deviceData.gps.altitudeM, deviceData.gps.speedKmph, deviceData.gps.headingDeg, deviceData.gps.accuracyM, deviceData.gps.satellites, deviceData.power.batteryPercentage, deviceData.power.batteryVoltage, deviceData.cellular.signalQuality, deviceData.cellular.rssi, now);
                }
                // Broadcast to WebSocket clients
                if (broadcastFn) {
                    broadcastFn('device_update', {
                        deviceId: imei,
                        data: deviceData,
                        timestamp: now,
                    });
                }
            }
            catch (e) {
                console.error(`[MQTT] Failed to parse metrics JSON from ${imei}:`, e);
            }
        }
    }
    catch (err) {
        console.error('[MQTT] Message error:', err);
    }
}
function seedBaselineDevice() {
    try {
        const db = (0, database_1.getDb)();
        // Remove stale demo devices
        try {
            db.prepare("DELETE FROM devices WHERE deviceId IN ('867509082945058', '861185084200101')").run();
            db.prepare("DELETE FROM device_history WHERE deviceId IN ('867509082945058', '861185084200101')").run();
        }
        catch { }
        const imei = '861185084122719';
        const now = '2026-11-23T10:32:44Z';
        const samplePayload = {
            device: {
                imei,
                model_id: 'GW1NS-4',
                serial_no: '',
                app_v: 'WMZ_DEV_1.0.2',
                sdk_v: 'WM_SDK_C_261008',
                hw_v: 'Z636_V1',
                boot_reason: 'power-off charging',
                uptime_sec: 389,
            },
            power: {
                bat_v: 4222,
                bat_lvl: 100,
                charging: 'Y',
                usb: 'Y',
                ext_power: 'Y',
                ext_power_v: '',
                low_battery: false,
            },
            cellular: {
                imsi: '404022437552332',
                operator: 'IND airtel',
                net_t: 'LTE',
                mcc: '404',
                mnc: '02',
                cell_id: '128026133',
                tac: '7911',
                rssi: 29,
                rsrp: 52,
                rsrq: 13,
                sinr: -4,
                signal: 'EXCELLENT',
                band: '3',
                ip4: '172.18.222.207',
                ip6: '254.128.0.0.0.0.0.0.0.0.0.0.20.235.208.251',
            },
            gps: {
                status: 'FIXED',
                latitude: 30.657035,
                longitude: 76.729596,
                altitude_m: 301.7,
                speed_kmph: 0,
                heading_deg: 183,
                satellites: 29,
                hdop: 0.6,
                accuracy_m: 2.9,
                fix_type: '3D',
                last_fix: '2026-11-23T10:32:44Z',
                location: '30.65704, 76.72960',
            },
            accelerometer: {
                status: 'OK',
                motion: false,
                x_g: -0.008,
                y_g: 0.008,
                z_g: -1.043,
                harsh_braking_count: 0,
                harsh_acceleration_count: 0,
                sharp_turn_count: 0,
                impact_count: 0,
                driving_score: '',
            },
            rtc: '2026-11-23T05:02:44.945Z',
        };
        const baseline = parseGpsMetrics(samplePayload, imei, now);
        db.prepare(`
      INSERT INTO devices (deviceId, deviceName, status, lastSeen, data, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(deviceId) DO UPDATE SET
        data = excluded.data,
        status = excluded.status,
        updatedAt = excluded.updatedAt
    `).run(imei, baseline.deviceName, 'online', now, JSON.stringify(baseline), now);
        console.log(`[MQTT] Seeded baseline GPS device ${imei} into database`);
    }
    catch (err) {
        console.error('[MQTT] Seed error:', err);
    }
}
function initMqttService(broadcast) {
    broadcastFn = broadcast;
    seedBaselineDevice();
    if (mqttClient)
        return mqttClient;
    const clientId = `gps_dashboard_${Math.random().toString(16).substring(2, 10)}`;
    console.log(`[MQTT] Connecting to AWS IoT Core (${AWS_IOT_ENDPOINT}) Client ID: ${clientId}`);
    try {
        mqttClient = mqtt_1.default.connect(AWS_IOT_ENDPOINT, {
            clientId,
            ca: mqttCerts_1.MQTT_CA,
            cert: mqttCerts_1.MQTT_CERT,
            key: mqttCerts_1.MQTT_KEY,
            rejectUnauthorized: true,
            protocol: 'mqtts',
            keepalive: 60,
            reconnectPeriod: 5000,
            clean: true,
        });
        mqttClient.on('connect', () => {
            console.log(`[MQTT] Connected successfully to AWS IoT Core broker!`);
            mqttClient?.subscribe([TOPIC_SOUNDBOX_METRICS, TOPIC_SOUNDBOX_ACK], { qos: 1 }, (err) => {
                if (err)
                    console.error('[MQTT] Subscription error:', err);
                else
                    console.log(`[MQTT] Subscribed to telemetry topic: ${TOPIC_SOUNDBOX_METRICS}`);
            });
        });
        mqttClient.on('message', (topic, payload) => {
            handleMqttMessage(topic, payload);
        });
        mqttClient.on('error', (err) => {
            console.error('[MQTT] Connection error:', err.message);
        });
    }
    catch (err) {
        console.error('[MQTT] Initialization error:', err);
    }
    return mqttClient;
}
async function publishLedCommand(imei, led, state, durationS = 0) {
    const id = `cmd_${Date.now()}`;
    const obj = { id, cmd: 'led', led, state };
    if (durationS > 0)
        obj.duration_s = durationS;
    return publishCommand(imei, JSON.stringify(obj));
}
async function publishStatusCommand(imei) {
    const id = `cmd_${Date.now()}`;
    return publishCommand(imei, JSON.stringify({ id, cmd: 'status' }));
}
async function publishCommand(imei, jsonPayload) {
    return new Promise((resolve) => {
        if (!mqttClient || !mqttClient.connected) {
            resolve(false);
            return;
        }
        const topic = `${TOPIC_SOUNDBOX_CMD_PREFIX}${imei}/command`;
        mqttClient.publish(topic, jsonPayload, { qos: 1, retain: false }, (err) => {
            if (err) {
                console.error(`[MQTT] Failed to publish command:`, err);
                resolve(false);
            }
            else {
                console.log(`[MQTT] Command sent to ${topic}: ${jsonPayload}`);
                resolve(true);
            }
        });
    });
}
function getMqttStatus() {
    return {
        connected: Boolean(mqttClient && mqttClient.connected),
        endpoint: AWS_IOT_ENDPOINT,
        topic: TOPIC_SOUNDBOX_METRICS,
    };
}
