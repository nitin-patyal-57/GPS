"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDb = getDb;
exports.initDatabase = initDatabase;
const better_sqlite3_1 = __importDefault(require("better-sqlite3"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
let db = null;
function getDb() {
    if (!db) {
        throw new Error('Database not initialized. Call initDatabase() first.');
    }
    return db;
}
async function initDatabase() {
    const dbPath = process.env.DATABASE_PATH || './data/gps.db';
    const resolvedPath = path_1.default.resolve(process.cwd(), dbPath);
    const dir = path_1.default.dirname(resolvedPath);
    if (!fs_1.default.existsSync(dir)) {
        fs_1.default.mkdirSync(dir, { recursive: true });
    }
    db = new better_sqlite3_1.default(resolvedPath);
    db.pragma('journal_mode = WAL');
    // Create tables for devices and telemetry history
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
