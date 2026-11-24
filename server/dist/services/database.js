"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GpsStore = void 0;
exports.getDb = getDb;
exports.initDatabase = initDatabase;
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const DEMO_DEVICE_IDS = new Set(['867509082945058', '861185084200101']);
function isIgnoredId(id) {
    if (!id)
        return true;
    const clean = id.trim();
    return clean.startsWith('86750908') || clean === '861185084200101' || DEMO_DEVICE_IDS.has(clean);
}
class GpsStore {
    devices = new Map();
    history = [];
    alerts = [];
    filePath = null;
    constructor(filePath) {
        if (filePath) {
            this.filePath = filePath;
            this.loadFromFile();
        }
    }
    loadFromFile() {
        if (!this.filePath || !fs_1.default.existsSync(this.filePath))
            return;
        try {
            const content = fs_1.default.readFileSync(this.filePath, 'utf-8');
            const parsed = JSON.parse(content);
            if (Array.isArray(parsed.devices)) {
                for (const d of parsed.devices) {
                    if (d.deviceId && !isIgnoredId(d.deviceId)) {
                        this.devices.set(d.deviceId, d);
                    }
                }
            }
            if (Array.isArray(parsed.history)) {
                this.history = parsed.history.filter((h) => !isIgnoredId(h.deviceId));
            }
            if (Array.isArray(parsed.alerts)) {
                this.alerts = parsed.alerts.filter((a) => !isIgnoredId(a.deviceId));
            }
            console.log(`[Database] Loaded ${this.devices.size} devices and ${this.history.length} telemetry points from ${this.filePath}`);
        }
        catch (err) {
            console.warn('[Database] Could not parse existing store file:', err.message);
        }
    }
    saveToFile() {
        if (!this.filePath)
            return;
        try {
            const dir = path_1.default.dirname(this.filePath);
            if (!fs_1.default.existsSync(dir)) {
                fs_1.default.mkdirSync(dir, { recursive: true });
            }
            const data = {
                devices: Array.from(this.devices.values()).filter((d) => !isIgnoredId(d.deviceId)),
                history: this.history.filter((h) => !isIgnoredId(h.deviceId)).slice(-2000),
                alerts: this.alerts.filter((a) => !isIgnoredId(a.deviceId)).slice(-200),
            };
            fs_1.default.writeFileSync(this.filePath, JSON.stringify(data, null, 2), 'utf-8');
        }
        catch (err) {
            // In serverless read-only filesystems, fail silently
        }
    }
    pragma(_stmt) { }
    exec(_sql) { }
    prepare(sql) {
        const s = sql.trim().toLowerCase();
        // INSERT INTO devices
        if (s.startsWith('insert into devices') || s.includes('on conflict(deviceid)')) {
            return {
                run: (...params) => {
                    const [deviceId, deviceName, status, lastSeen, data, updatedAt] = params;
                    if (!isIgnoredId(deviceId)) {
                        this.devices.set(deviceId, { deviceId, deviceName, status, lastSeen, data, updatedAt });
                        this.saveToFile();
                    }
                    return { changes: 1 };
                },
            };
        }
        // INSERT INTO device_history
        if (s.startsWith('insert into device_history')) {
            return {
                run: (...params) => {
                    const [deviceId, latitude, longitude, altitude, speed, heading, accuracy, satellites, batteryPercentage, batteryVoltage, signalQuality, rssi, timestamp,] = params;
                    if (!isIgnoredId(deviceId)) {
                        this.history.push({
                            id: this.history.length + 1,
                            deviceId,
                            latitude: Number(latitude) || 0,
                            longitude: Number(longitude) || 0,
                            altitude: Number(altitude) || 0,
                            speed: Number(speed) || 0,
                            heading: Number(heading) || 0,
                            accuracy: Number(accuracy) || 2.5,
                            satellites: Number(satellites) || 0,
                            batteryPercentage: Number(batteryPercentage) || 0,
                            batteryVoltage: Number(batteryVoltage) || 0,
                            signalQuality: Number(signalQuality) || 0,
                            rssi: Number(rssi) || 0,
                            timestamp: String(timestamp),
                        });
                        if (this.history.length > 5000) {
                            this.history = this.history.slice(-3000);
                        }
                        this.saveToFile();
                    }
                    return { changes: 1 };
                },
            };
        }
        // INSERT INTO alerts
        if (s.startsWith('insert into alerts')) {
            return {
                run: (...params) => {
                    const [id, deviceId, type, message, severity, timestamp, acknowledged] = params;
                    if (!isIgnoredId(deviceId)) {
                        this.alerts.push({
                            id,
                            deviceId,
                            type,
                            message,
                            severity,
                            timestamp,
                            acknowledged: Number(acknowledged) || 0,
                        });
                        this.saveToFile();
                    }
                    return { changes: 1 };
                },
            };
        }
        // SELECT * FROM devices WHERE deviceId = ?
        if (s.startsWith('select * from devices where deviceid =')) {
            return {
                get: (deviceId) => {
                    if (isIgnoredId(deviceId))
                        return null;
                    return this.devices.get(deviceId) || null;
                },
            };
        }
        // SELECT * FROM devices
        if (s.startsWith('select * from devices')) {
            return {
                all: () => {
                    return Array.from(this.devices.values())
                        .filter((d) => !isIgnoredId(d.deviceId))
                        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
                },
            };
        }
        // DELETE FROM devices
        if (s.startsWith('delete from devices')) {
            return {
                run: (...params) => {
                    if (s.includes('like') || s.includes('where deviceid in')) {
                        for (const key of Array.from(this.devices.keys())) {
                            if (isIgnoredId(key)) {
                                this.devices.delete(key);
                            }
                        }
                    }
                    else if (params[0]) {
                        this.devices.delete(params[0]);
                    }
                    this.saveToFile();
                    return { changes: 1 };
                },
            };
        }
        // DELETE FROM device_history
        if (s.startsWith('delete from device_history')) {
            return {
                run: (...params) => {
                    if (s.includes('like') || s.includes('where deviceid in')) {
                        this.history = this.history.filter((h) => !isIgnoredId(h.deviceId));
                    }
                    else if (params[0]) {
                        this.history = this.history.filter((h) => h.deviceId !== params[0]);
                    }
                    this.saveToFile();
                    return { changes: 1 };
                },
            };
        }
        // SELECT * FROM device_history
        if (s.startsWith('select * from device_history')) {
            return {
                all: (...params) => {
                    const deviceId = params[0];
                    if (!deviceId || isIgnoredId(deviceId))
                        return [];
                    return this.history
                        .filter((h) => h.deviceId === deviceId)
                        .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
                        .slice(-500);
                },
            };
        }
        // SELECT * FROM alerts
        if (s.startsWith('select * from alerts')) {
            return {
                all: () => {
                    return [...this.alerts]
                        .filter((a) => !isIgnoredId(a.deviceId))
                        .reverse()
                        .slice(0, 50);
                },
            };
        }
        // UPDATE alerts
        if (s.startsWith('update alerts')) {
            return {
                run: (id) => {
                    const alert = this.alerts.find((a) => a.id === id);
                    if (alert)
                        alert.acknowledged = 1;
                    this.saveToFile();
                    return { changes: 1 };
                },
            };
        }
        return {
            run: () => ({ changes: 0 }),
            get: () => null,
            all: () => [],
        };
    }
}
exports.GpsStore = GpsStore;
let storeInstance = null;
function getDb() {
    if (!storeInstance) {
        throw new Error('Database not initialized. Call initDatabase() first.');
    }
    return storeInstance;
}
async function initDatabase() {
    if (storeInstance)
        return storeInstance;
    try {
        const storePath = process.env.DATA_STORE_PATH || path_1.default.resolve(process.cwd(), './data/gps-store.json');
        storeInstance = new GpsStore(storePath);
        console.log(`[Database] File-backed JSON store initialized at ${storePath}`);
    }
    catch (err) {
        console.warn('[Database] Falling back to pure in-memory store:', err.message);
        storeInstance = new GpsStore();
    }
    return storeInstance;
}
