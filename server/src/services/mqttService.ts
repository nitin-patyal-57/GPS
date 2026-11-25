import mqtt from 'mqtt'
import { getDb } from './database'
import { MQTT_CA, MQTT_CERT, MQTT_KEY } from './mqttCerts'

const AWS_IOT_ENDPOINT = process.env.MQTT_BROKER_URL || 'mqtts://avj249ldc7joq-ats.iot.ap-south-1.amazonaws.com:8883'

// Production topics
const TOPIC_SOUNDBOX_METRICS = 'soundbox_dev/+/metrics'
const TOPIC_SOUNDBOX_ACK = 'soundbox_dev/+/ack'
const TOPIC_SOUNDBOX_OTA_ACK = 'soundbox_dev/+/ota/ack'
const TOPIC_WEGW_ACK = 'wegw/+/ack'
const TOPIC_WEGW_OTA_ACK = 'wegw/+/ota/ack'
const TOPIC_ROOT_ACK = '/ack'
const TOPIC_PLUS_ACK = '+/ack'
const TOPIC_SOUNDBOX_CMD_PREFIX = 'soundbox_dev/'
const TOPIC_LEGACY_GPS_UPLINK = 'wegw/+/gps/nmea'

let mqttClient: mqtt.MqttClient | null = null
let broadcastFn: ((event: string, data: unknown) => void) | null = null

function parseNmeaCoord(val: string, dir: string): number {
  if (!val || !dir) return 0
  const dotIndex = val.indexOf('.')
  if (dotIndex < 2) return 0
  const degDigits = dir === 'N' || dir === 'S' ? 2 : 3
  const degrees = parseFloat(val.substring(0, degDigits))
  const minutes = parseFloat(val.substring(degDigits))
  if (isNaN(degrees) || isNaN(minutes)) return 0
  let decimal = degrees + minutes / 60.0
  if (dir === 'S' || dir === 'W') decimal = -decimal
  return parseFloat(decimal.toFixed(6))
}

function parseNmeaPayload(rawPayload: string): { latitude: number; longitude: number; speed: number; heading: number; satellites: number; altitude: number; isFixed: boolean } | null {
  const lines = rawPayload.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.startsWith('$'))
  if (lines.length === 0) return null

  let latitude = 0
  let longitude = 0
  let altitude = 0
  let speed = 0
  let heading = 0
  let satellites = 0
  let fixQuality = 0
  let rmcValid = false

  for (const line of lines) {
    const cleanLine = line.split('*')[0]
    const parts = cleanLine.split(',')
    const sentenceType = parts[0].substring(3)

    if (sentenceType === 'GGA') {
      if (parts[2] && parts[3] && parts[4] && parts[5]) {
        latitude = parseNmeaCoord(parts[2], parts[3])
        longitude = parseNmeaCoord(parts[4], parts[5])
      }
      fixQuality = parseInt(parts[6] || '0', 10)
      satellites = parseInt(parts[7] || '0', 10)
      altitude = parseFloat(parts[9] || '0')
    } else if (sentenceType === 'RMC') {
      if (parts[2] === 'A') rmcValid = true
      if (parts[3] && parts[4] && parts[5] && parts[6]) {
        latitude = parseNmeaCoord(parts[3], parts[4])
        longitude = parseNmeaCoord(parts[5], parts[6])
      }
      const speedKnots = parseFloat(parts[7] || '0')
      if (!isNaN(speedKnots)) speed = parseFloat((speedKnots * 1.852).toFixed(2))
      const cog = parseFloat(parts[8] || '0')
      if (!isNaN(cog)) heading = parseFloat(cog.toFixed(1))
    }
  }

  const isFixed = fixQuality > 0 || rmcValid
  return { latitude, longitude, speed, heading, satellites, altitude, isFixed }
}

function parseNum(v: any, fallback = 0): number {
  if (v === '' || v === undefined || v === null) return fallback
  const n = Number(v)
  return isNaN(n) ? fallback : n
}

function parseBool(v: any): boolean {
  if (typeof v === 'boolean') return v
  if (typeof v === 'number') return v === 1
  if (typeof v === 'string') {
    const s = v.toLowerCase().trim()
    return s === 'y' || s === 'yes' || s === 'true' || s === '1' || s === 'fixed'
  }
  return false
}

/**
 * Parses GPS Metrics packet directly conforming to user payload
 */
export function parseGpsMetrics(json: any, imei: string, now: string): any {
  const g = json.gps || {}
  const lat = parseNum(g.latitude, 0)
  const lon = parseNum(g.longitude, 0)
  const isFixed = g.status === 'FIXED' || (lat !== 0 && lon !== 0)
  const speed = parseNum(g.speed_kmph, 0)

  const p = json.power || {}
  const batMv = parseNum(p.bat_v, 4222)
  const batPercentage = parseNum(p.bat_lvl, 100)
  const isLowBat = typeof p.low_battery === 'boolean' ? p.low_battery : (batMv < 3400)

  const c = json.cellular || {}
  const acc = json.accelerometer || {}
  const dev = json.device || {}

  const isMoving = speed > 1.5 || parseBool(acc.motion)

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
  }
}

function handleMqttMessage(topic: string, messageBuffer: Buffer) {
  try {
    const rawPayload = messageBuffer.toString('utf-8').trim()
    const now = new Date().toISOString()
    const db = getDb()

    // Handle ACK messages (e.g. soundbox_dev/<imei>/ack, wegw/<imei>/ack, /ack, etc.)
    const isAckTopic = topic.endsWith('/ack') || topic === '/ack' || topic.includes('/ack')
    if (isAckTopic) {
      console.log(`[MQTT ACK] Received ACK on topic ${topic}: ${rawPayload}`)
      let ackJson: any = null
      try {
        ackJson = JSON.parse(rawPayload)
      } catch {
        ackJson = { raw: rawPayload }
      }

      let imeiFromTopic: string | undefined
      const match = topic.match(/^(?:soundbox_dev|wegw)\/([^/]+)\/(?:ota\/)?ack$/)
      if (match) imeiFromTopic = match[1]

      const deviceId = ackJson.imei || ackJson.deviceId || imeiFromTopic
      const jobId = ackJson.jobId || ackJson.job_id || ackJson.id

      try {
        if (typeof db.updateOtaJobAck === 'function') {
          db.updateOtaJobAck(jobId, deviceId, ackJson)
        }
      } catch (err: any) {
        console.error('[MQTT ACK] DB update error:', err.message)
      }

      if (broadcastFn) {
        broadcastFn('ota_ack', {
          topic,
          deviceId,
          jobId,
          payload: ackJson,
          raw: rawPayload,
          timestamp: now,
        })
      }
      return
    }

    const metricsMatch = topic.match(/^soundbox_dev\/([^/]+)\/metrics$/)
    if (metricsMatch) {
      const imei = metricsMatch[1]
      // Ignore known stale soundbox/demo devices
      if (imei.startsWith('86750908') || imei === '867509082945058' || imei === '861185084200101') {
        return
      }

      try {
        const json = JSON.parse(rawPayload)
        const deviceData = parseGpsMetrics(json, imei, now)

        console.log(`[MQTT Telemetry] ${imei}: Lat=${deviceData.gps.latitude}, Lon=${deviceData.gps.longitude}, Speed=${deviceData.gps.speedKmph} km/h, Satellites=${deviceData.gps.satellites}`)

        // Upsert device into SQLite
        db.prepare(`
          INSERT INTO devices (deviceId, deviceName, status, lastSeen, data, updatedAt)
          VALUES (?, ?, ?, ?, ?, ?)
          ON CONFLICT(deviceId) DO UPDATE SET
            status = excluded.status,
            lastSeen = excluded.lastSeen,
            data = excluded.data,
            updatedAt = excluded.updatedAt
        `).run(imei, deviceData.deviceName, deviceData.status, now, JSON.stringify(deviceData), now)

        // Store in location history
        if (deviceData.gps.latitude !== 0 && deviceData.gps.longitude !== 0) {
          db.prepare(`
            INSERT INTO device_history 
            (deviceId, latitude, longitude, altitude, speed, heading, accuracy, satellites,
             batteryPercentage, batteryVoltage, signalQuality, rssi, timestamp)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).run(
            imei,
            deviceData.gps.latitude,
            deviceData.gps.longitude,
            deviceData.gps.altitudeM,
            deviceData.gps.speedKmph,
            deviceData.gps.headingDeg,
            deviceData.gps.accuracyM,
            deviceData.gps.satellites,
            deviceData.power.batteryPercentage,
            deviceData.power.batteryVoltage,
            deviceData.cellular.signalQuality,
            deviceData.cellular.rssi,
            now
          )
        }

        // Broadcast to WebSocket clients
        if (broadcastFn) {
          broadcastFn('device_update', {
            deviceId: imei,
            data: deviceData,
            timestamp: now,
          })
        }
      } catch (e) {
        console.error(`[MQTT] Failed to parse metrics JSON from ${imei}:`, e)
      }
    }

    const nmeaMatch = topic.match(/^wegw\/([^/]+)\/gps\/nmea$/)
    if (nmeaMatch) {
      const imei = nmeaMatch[1]
      if (imei.startsWith('86750908') || imei === '867509082945058' || imei === '861185084200101') return
      const existing = db.prepare('SELECT * FROM devices WHERE deviceId = ?').get(imei) as any

      try {
        const parsed = parseNmeaPayload(rawPayload)
        if (parsed && (parsed.latitude !== 0 || parsed.longitude !== 0 || parsed.isFixed)) {
          let currentData: any = null
          try {
            if (existing) currentData = JSON.parse(existing.data)
          } catch {}

          const updated = currentData || {
            deviceId: imei,
            deviceName: `GW1NS-4 (${imei})`,
            status: 'online',
            motionState: parsed.speed > 1.5 ? 'moving' : 'stationary',
            lastSeen: now,
            device: { imei, modelId: 'GW1NS-4' },
            power: { batteryVoltage: 4.2, batteryPercentage: 100 },
            cellular: { operator: 'Cellular', signal: 'GOOD', signalQuality: 4, rssi: 25 },
            accelerometer: { status: 'OK', motion: parsed.speed > 1.5 },
          }

          updated.gps = {
            status: parsed.isFixed ? 'FIXED' : 'SEARCHING',
            isFixed: parsed.isFixed,
            latitude: parsed.latitude,
            longitude: parsed.longitude,
            altitudeM: parsed.altitude,
            speedKmph: parsed.speed,
            headingDeg: parsed.heading,
            satellites: parsed.satellites,
            accuracyM: 3.0,
            fixType: '3D',
            lastFix: now,
            location: `${parsed.latitude.toFixed(5)}, ${parsed.longitude.toFixed(5)}`,
          }
          updated.lastSeen = now
          updated.motionState = parsed.speed > 1.5 ? 'moving' : 'stationary'

          db.prepare(`
            INSERT INTO devices (deviceId, deviceName, status, lastSeen, data, updatedAt)
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(deviceId) DO UPDATE SET
              status = excluded.status,
              lastSeen = excluded.lastSeen,
              data = excluded.data,
              updatedAt = excluded.updatedAt
          `).run(imei, updated.deviceName, 'online', now, JSON.stringify(updated), now)

          if (parsed.latitude !== 0 && parsed.longitude !== 0) {
            db.prepare(`
              INSERT INTO device_history 
              (deviceId, latitude, longitude, altitude, speed, heading, accuracy, satellites,
               batteryPercentage, batteryVoltage, signalQuality, rssi, timestamp)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).run(
              imei,
              parsed.latitude,
              parsed.longitude,
              parsed.altitude,
              parsed.speed,
              parsed.heading,
              3.0,
              parsed.satellites,
              updated.power?.batteryPercentage || 100,
              updated.power?.batteryVoltage || 4.2,
              4,
              25,
              now
            )
          }

          if (broadcastFn) {
            broadcastFn('device_update', {
              deviceId: imei,
              data: updated,
              timestamp: now,
            })
          }
        }
      } catch (err: any) {
        console.error('[MQTT] NMEA error:', err.message)
      }
    }
  } catch (err) {
    console.error('[MQTT] Message error:', err)
  }
}

function seedBaselineDevice() {
  try {
    const db = getDb()
    // Remove stale demo and soundbox devices
    try {
      db.prepare("DELETE FROM devices WHERE deviceId LIKE '86750908%'").run()
      db.prepare("DELETE FROM device_history WHERE deviceId LIKE '86750908%'").run()
    } catch {}

    const imei = '861185084122719'
    const now = '2026-11-23T10:32:44Z'
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
    }

    const baseline = parseGpsMetrics(samplePayload, imei, now)

    db.prepare(`
      INSERT INTO devices (deviceId, deviceName, status, lastSeen, data, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(deviceId) DO UPDATE SET
        data = excluded.data,
        status = excluded.status,
        updatedAt = excluded.updatedAt
    `).run(imei, baseline.deviceName, 'online', now, JSON.stringify(baseline), now)

    // Seed active transmitting tracker 861185084122693 as well
    const activeImei = '861185084122693'
    const activeNow = new Date().toISOString()
    const activePayload = {
      device: {
        imei: activeImei,
        model_id: 'GW1NS-4',
        serial_no: '',
        app_v: 'WMZ_DEV_1.0.2',
        sdk_v: 'WM_SDK_C_261008',
        hw_v: 'Z636_V1',
        boot_reason: 'power-off charging',
        uptime_sec: 120,
      },
      power: {
        bat_v: 4200,
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
        ip6: '',
      },
      gps: {
        status: 'FIXED',
        latitude: 30.65708,
        longitude: 76.72965,
        altitude_m: 302,
        speed_kmph: 0,
        heading_deg: 180,
        satellites: 21,
        hdop: 0.7,
        accuracy_m: 3.0,
        fix_type: '3D',
        last_fix: activeNow,
        location: '30.65708, 76.72965',
      },
      accelerometer: {
        status: 'OK',
        motion: false,
        x_g: 0,
        y_g: 0,
        z_g: -1,
        harsh_braking_count: 0,
        harsh_acceleration_count: 0,
        sharp_turn_count: 0,
        impact_count: 0,
        driving_score: '',
      },
      rtc: activeNow,
    }

    const activeTracker = parseGpsMetrics(activePayload, activeImei, activeNow)
    db.prepare(`
      INSERT INTO devices (deviceId, deviceName, status, lastSeen, data, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(deviceId) DO UPDATE SET
        data = excluded.data,
        status = excluded.status,
        updatedAt = excluded.updatedAt
    `).run(activeImei, activeTracker.deviceName, 'online', activeNow, JSON.stringify(activeTracker), activeNow)

    console.log(`[MQTT] Seeded baseline GPS device ${imei} into database`)
  } catch (err) {
    console.error('[MQTT] Seed error:', err)
  }
}

export function initMqttService(broadcast: (event: string, data: unknown) => void) {
  broadcastFn = broadcast
  seedBaselineDevice()

  if (mqttClient) return mqttClient

  const clientId = `gps_dashboard_${Math.random().toString(16).substring(2, 10)}`
  console.log(`[MQTT] Connecting to AWS IoT Core (${AWS_IOT_ENDPOINT}) Client ID: ${clientId}`)

  try {
    mqttClient = mqtt.connect(AWS_IOT_ENDPOINT, {
      clientId,
      ca: MQTT_CA,
      cert: MQTT_CERT,
      key: MQTT_KEY,
      rejectUnauthorized: true,
      protocol: 'mqtts',
      keepalive: 60,
      reconnectPeriod: 5000,
      clean: true,
    })

    mqttClient.on('connect', () => {
      console.log(`[MQTT] Connected successfully to AWS IoT Core broker!`)
      const topicsToSubscribe = [
        TOPIC_SOUNDBOX_METRICS,
        TOPIC_SOUNDBOX_ACK,
        TOPIC_SOUNDBOX_OTA_ACK,
        TOPIC_WEGW_ACK,
        TOPIC_WEGW_OTA_ACK,
        TOPIC_LEGACY_GPS_UPLINK,
        TOPIC_ROOT_ACK,
        TOPIC_PLUS_ACK,
      ]
      mqttClient?.subscribe(topicsToSubscribe, { qos: 1 }, (err) => {
        if (err) console.error('[MQTT] Subscription error:', err)
        else console.log(`[MQTT] Subscribed to telemetry and ACK topics: ${topicsToSubscribe.join(', ')}`)
      })
    })

    mqttClient.on('message', (topic, payload) => {
      handleMqttMessage(topic, payload)
    })

    mqttClient.on('error', (err) => {
      console.error('[MQTT] Connection error:', err.message)
    })
  } catch (err) {
    console.error('[MQTT] Initialization error:', err)
  }

  return mqttClient
}

export async function publishOtaPayload(imei: string, otaPayload: any): Promise<boolean> {
  return new Promise((resolve) => {
    if (!mqttClient || !mqttClient.connected) {
      console.warn(`[MQTT] Cannot dispatch OTA: broker not connected`)
      resolve(false)
      return
    }

    const jsonStr = typeof otaPayload === 'string' ? otaPayload : JSON.stringify(otaPayload)

    // Publish to downlink topics
    const topics = [
      `${TOPIC_SOUNDBOX_CMD_PREFIX}${imei}/command`,
      `${TOPIC_SOUNDBOX_CMD_PREFIX}${imei}/ota`,
      `wegw/${imei}/ota`,
    ]

    let completed = 0
    let anySuccess = false

    for (const t of topics) {
      mqttClient.publish(t, jsonStr, { qos: 1, retain: false }, (err) => {
        completed++
        if (!err) anySuccess = true
        if (completed === topics.length) {
          console.log(`[MQTT OTA] Sent payload to ${topics.join(', ')}: ${jsonStr}`)
          resolve(anySuccess)
        }
      })
    }
  })
}

export async function publishLedCommand(
  imei: string,
  led: 'red' | 'green' | 'blue' | 'all',
  state: 'on' | 'off' | 'blink' | 'auto',
  durationS = 0
): Promise<boolean> {
  const id = `cmd_${Date.now()}`
  const obj: any = { id, cmd: 'led', led, state }
  if (durationS > 0) obj.duration_s = durationS
  return publishCommand(imei, JSON.stringify(obj))
}

export async function publishStatusCommand(imei: string): Promise<boolean> {
  const id = `cmd_${Date.now()}`
  return publishCommand(imei, JSON.stringify({ id, cmd: 'status' }))
}

async function publishCommand(imei: string, jsonPayload: string): Promise<boolean> {
  return new Promise((resolve) => {
    if (!mqttClient || !mqttClient.connected) {
      resolve(false)
      return
    }

    const topic = `${TOPIC_SOUNDBOX_CMD_PREFIX}${imei}/command`
    mqttClient.publish(topic, jsonPayload, { qos: 1, retain: false }, (err) => {
      if (err) {
        console.error(`[MQTT] Failed to publish command:`, err)
        resolve(false)
      } else {
        console.log(`[MQTT] Command sent to ${topic}: ${jsonPayload}`)
        resolve(true)
      }
    })
  })
}

export function getMqttStatus() {
  return {
    connected: Boolean(mqttClient && mqttClient.connected),
    endpoint: AWS_IOT_ENDPOINT,
    topic: TOPIC_SOUNDBOX_METRICS,
  }
}
