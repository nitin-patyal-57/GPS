import Database from 'better-sqlite3'
import path from 'path'
import fs from 'fs'

let db: Database.Database | null = null

export function getDb(): Database.Database {
  if (!db) {
    throw new Error('Database not initialized. Call initDatabase() first.')
  }
  return db
}

export async function initDatabase(): Promise<Database.Database> {
  const dbPath = process.env.DATABASE_PATH || './data/gps.db'
  const resolvedPath = path.resolve(process.cwd(), dbPath)
  const dir = path.dirname(resolvedPath)

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }

  db = new Database(resolvedPath)
  db.pragma('journal_mode = WAL')

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
  `)

  console.log(`[Database] SQLite database initialized at ${resolvedPath}`)
  return db
}
