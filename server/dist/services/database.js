"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDb = getDb;
exports.initDatabase = initDatabase;
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
let db = null;
// In-memory fallback if better-sqlite3 native addon cannot compile
class InMemoryDatabase {
    devices = new Map();
    history = [];
    alerts = [];
    pragma(_stmt) { }
    exec(_sql) { }
    prepare(sql) {
        const s = sql.trim().toLowerCase();
        if (s.startsWith('insert into devices') || s.includes('on conflict(deviceid)')) {
            return {
                run: (...params) => {
                    const [deviceId, deviceName, status, lastSeen, data, updatedAt] = params;
                    this.devices.set(deviceId, { deviceId, deviceName, status, lastSeen, data, updatedAt });
                    return { changes: 1 };
                },
            };
        }
        if (s.startsWith('insert into device_history')) {
            return {
                run: (...params) => {
                    const [deviceId, latitude, longitude, altitude, speed, heading, accuracy, satellites, batteryPercentage, batteryVoltage, signalQuality, rssi, timestamp] = params;
                    this.history.push({
                        id: this.history.length + 1,
                        deviceId,
                        latitude,
                        longitude,
                        altitude,
                        speed,
                        heading,
                        accuracy,
                        satellites,
                        batteryPercentage,
                        batteryVoltage,
                        signalQuality,
                        rssi,
                        timestamp,
                    });
                    return { changes: 1 };
                },
            };
        }
        if (s.startsWith('select * from devices where deviceid =')) {
            return {
                get: (deviceId) => this.devices.get(deviceId) || null,
            };
        }
        if (s.startsWith('select * from devices')) {
            return {
                all: () => Array.from(this.devices.values()),
            };
        }
        if (s.startsWith('select * from device_history')) {
            return {
                all: (...params) => {
                    const deviceId = params[0];
                    return this.history.filter((h) => h.deviceId === deviceId).slice(-500);
                },
            };
        }
        if (s.startsWith('select * from alerts')) {
            return {
                all: () => [...this.alerts].reverse().slice(0, 50),
            };
        }
        if (s.startsWith('update alerts')) {
            return {
                run: (id) => {
                    const alert = this.alerts.find((a) => a.id === id);
                    if (alert)
                        alert.acknowledged = 1;
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
function getDb() {
    if (!db) {
        throw new Error('Database not initialized. Call initDatabase() first.');
    }
    return db;
}
async function initDatabase() {
    try {
        const DatabaseModule = await import('better-sqlite3');
        const DatabaseConstructor = DatabaseModule.default || DatabaseModule;
        const dbPath = process.env.DATABASE_PATH || './data/gps.db';
        const resolvedPath = path_1.default.resolve(process.cwd(), dbPath);
        const dir = path_1.default.dirname(resolvedPath);
        if (!fs_1.default.existsSync(dir)) {
            fs_1.default.mkdirSync(dir, { recursive: true });
        }
        db = new DatabaseConstructor(resolvedPath);
        db.pragma('journal_mode = WAL');
        db.exec(`
      CREATE TABLE IF NOT EXISTS devices (
        deviceId TEXT PRIMARY KEY,
        deviceName TEXT NOT NULL,
        status TEXT NOT NULL,
        lastSeen TEXT NOT NULL,
        data TEXT NOT NULL,
        updatedAt TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS device_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        deviceId TEXT NOT NULL,
        latitude REAL NOT NULL,
        longitude REAL NOT NULL,
        altitude REAL NOT NULL,
        speed REAL NOT NULL,
        heading REAL NOT NULL,
        accuracy REAL NOT NULL,
        satellites INTEGER DEFAULT 0,
        batteryPercentage REAL NOT NULL,
        batteryVoltage REAL NOT NULL,
        signalQuality INTEGER NOT NULL,
        rssi REAL NOT NULL,
        timestamp TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS alerts (
        id TEXT PRIMARY KEY,
        deviceId TEXT NOT NULL,
        type TEXT NOT NULL,
        message TEXT NOT NULL,
        severity TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        acknowledged INTEGER DEFAULT 0
      );

      CREATE INDEX IF NOT EXISTS idx_history_deviceId_timestamp ON device_history(deviceId, timestamp);
      CREATE INDEX IF NOT EXISTS idx_alerts_deviceId ON alerts(deviceId);
    `);
        console.log(`[Database] SQLite database initialized at ${resolvedPath}`);
        return db;
    }
    catch (err) {
        console.warn('[Database] Native SQLite unavailable, activated in-memory store:', err.message);
        db = new InMemoryDatabase();
        return db;
    }
}
