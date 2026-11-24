import path from 'path'
import fs from 'fs'

export interface DeviceRecord {
  deviceId: string
  deviceName: string
  status: string
  lastSeen: string
  data: string
  updatedAt: string
}

export interface HistoryRecord {
  id: number
  deviceId: string
  latitude: number
  longitude: number
  altitude: number
  speed: number
  heading: number
  accuracy: number
  satellites: number
  batteryPercentage: number
  batteryVoltage: number
  signalQuality: number
  rssi: number
  timestamp: string
}

export interface AlertRecord {
  id: string
  deviceId: string
  type: string
  message: string
  severity: string
  timestamp: string
  acknowledged: number
}

const DEMO_DEVICE_IDS = new Set(['867509082945058', '861185084200101'])

export class GpsStore {
  private devices = new Map<string, DeviceRecord>()
  private history: HistoryRecord[] = []
  private alerts: AlertRecord[] = []
  private filePath: string | null = null

  constructor(filePath?: string) {
    if (filePath) {
      this.filePath = filePath
      this.loadFromFile()
    }
  }

  private loadFromFile() {
    if (!this.filePath || !fs.existsSync(this.filePath)) return
    try {
      const content = fs.readFileSync(this.filePath, 'utf-8')
      const parsed = JSON.parse(content)
      if (Array.isArray(parsed.devices)) {
        for (const d of parsed.devices) {
          if (d.deviceId && !DEMO_DEVICE_IDS.has(d.deviceId)) {
            this.devices.set(d.deviceId, d)
          }
        }
      }
      if (Array.isArray(parsed.history)) {
        this.history = parsed.history.filter((h: any) => !DEMO_DEVICE_IDS.has(h.deviceId))
      }
      if (Array.isArray(parsed.alerts)) {
        this.alerts = parsed.alerts.filter((a: any) => !DEMO_DEVICE_IDS.has(a.deviceId))
      }
      console.log(`[Database] Loaded ${this.devices.size} devices and ${this.history.length} telemetry points from ${this.filePath}`)
    } catch (err: any) {
      console.warn('[Database] Could not parse existing store file:', err.message)
    }
  }

  private saveToFile() {
    if (!this.filePath) return
    try {
      const dir = path.dirname(this.filePath)
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true })
      }
      const data = {
        devices: Array.from(this.devices.values()),
        history: this.history.slice(-2000), // Keep recent history
        alerts: this.alerts.slice(-200),
      }
      fs.writeFileSync(this.filePath, JSON.stringify(data, null, 2), 'utf-8')
    } catch (err: any) {
      // In serverless read-only filesystems, fail silently
    }
  }

  pragma(_stmt: string) {}
  exec(_sql: string) {}

  prepare(sql: string) {
    const s = sql.trim().toLowerCase()

    // INSERT INTO devices
    if (s.startsWith('insert into devices') || s.includes('on conflict(deviceid)')) {
      return {
        run: (...params: any[]) => {
          const [deviceId, deviceName, status, lastSeen, data, updatedAt] = params
          if (!DEMO_DEVICE_IDS.has(deviceId)) {
            this.devices.set(deviceId, { deviceId, deviceName, status, lastSeen, data, updatedAt })
            this.saveToFile()
          }
          return { changes: 1 }
        },
      }
    }

    // INSERT INTO device_history
    if (s.startsWith('insert into device_history')) {
      return {
        run: (...params: any[]) => {
          const [
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
          ] = params
          if (!DEMO_DEVICE_IDS.has(deviceId)) {
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
            })
            // Cap history in memory
            if (this.history.length > 5000) {
              this.history = this.history.slice(-3000)
            }
            this.saveToFile()
          }
          return { changes: 1 }
        },
      }
    }

    // INSERT INTO alerts
    if (s.startsWith('insert into alerts')) {
      return {
        run: (...params: any[]) => {
          const [id, deviceId, type, message, severity, timestamp, acknowledged] = params
          if (!DEMO_DEVICE_IDS.has(deviceId)) {
            this.alerts.push({
              id,
              deviceId,
              type,
              message,
              severity,
              timestamp,
              acknowledged: Number(acknowledged) || 0,
            })
            this.saveToFile()
          }
          return { changes: 1 }
        },
      }
    }

    // SELECT * FROM devices WHERE deviceId = ?
    if (s.startsWith('select * from devices where deviceid =')) {
      return {
        get: (deviceId: string) => {
          if (DEMO_DEVICE_IDS.has(deviceId)) return null
          return this.devices.get(deviceId) || null
        },
      }
    }

    // SELECT * FROM devices
    if (s.startsWith('select * from devices')) {
      return {
        all: () => {
          return Array.from(this.devices.values())
            .filter((d) => !DEMO_DEVICE_IDS.has(d.deviceId))
            .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
        },
      }
    }

    // DELETE FROM devices
    if (s.startsWith('delete from devices')) {
      return {
        run: (...params: any[]) => {
          if (s.includes('where deviceid in')) {
            DEMO_DEVICE_IDS.forEach((id) => this.devices.delete(id))
          } else if (params[0]) {
            this.devices.delete(params[0])
          }
          this.saveToFile()
          return { changes: 1 }
        },
      }
    }

    // DELETE FROM device_history
    if (s.startsWith('delete from device_history')) {
      return {
        run: (...params: any[]) => {
          if (s.includes('where deviceid in')) {
            this.history = this.history.filter((h) => !DEMO_DEVICE_IDS.has(h.deviceId))
          } else if (params[0]) {
            this.history = this.history.filter((h) => h.deviceId !== params[0])
          }
          this.saveToFile()
          return { changes: 1 }
        },
      }
    }

    // SELECT * FROM device_history
    if (s.startsWith('select * from device_history')) {
      return {
        all: (...params: any[]) => {
          const deviceId = params[0]
          if (!deviceId || DEMO_DEVICE_IDS.has(deviceId)) return []
          return this.history
            .filter((h) => h.deviceId === deviceId)
            .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
            .slice(-500)
        },
      }
    }

    // SELECT * FROM alerts
    if (s.startsWith('select * from alerts')) {
      return {
        all: () => {
          return [...this.alerts]
            .filter((a) => !DEMO_DEVICE_IDS.has(a.deviceId))
            .reverse()
            .slice(0, 50)
        },
      }
    }

    // UPDATE alerts
    if (s.startsWith('update alerts')) {
      return {
        run: (id: string) => {
          const alert = this.alerts.find((a) => a.id === id)
          if (alert) alert.acknowledged = 1
          this.saveToFile()
          return { changes: 1 }
        },
      }
    }

    return {
      run: () => ({ changes: 0 }),
      get: () => null,
      all: () => [],
    }
  }
}

let storeInstance: GpsStore | null = null

export function getDb(): any {
  if (!storeInstance) {
    throw new Error('Database not initialized. Call initDatabase() first.')
  }
  return storeInstance
}

export async function initDatabase(): Promise<any> {
  if (storeInstance) return storeInstance
  try {
    const storePath = process.env.DATA_STORE_PATH || path.resolve(process.cwd(), './data/gps-store.json')
    storeInstance = new GpsStore(storePath)
    console.log(`[Database] File-backed JSON store initialized at ${storePath}`)
  } catch (err: any) {
    console.warn('[Database] Falling back to pure in-memory store:', err.message)
    storeInstance = new GpsStore()
  }
  return storeInstance
}
