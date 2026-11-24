import { Router } from 'express'
import { getDb } from '../services/database'
import { publishLedCommand, publishStatusCommand } from '../services/mqttService'

const router = Router()

const DEMO_DEVICE_IDS = new Set(['867509082945058', '861185084200101'])

// GET /api/devices - Get all devices (filters out stale demo devices)
router.get('/devices', (req, res) => {
  try {
    const db = getDb()
    const rows = db.prepare('SELECT * FROM devices ORDER BY updatedAt DESC').all() as any[]
    const devices = rows
      .map((r) => {
        try {
          return JSON.parse(r.data)
        } catch {
          return null
        }
      })
      .filter((d) => d && !DEMO_DEVICE_IDS.has(d.deviceId))
    res.json(devices)
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/devices - Add a new GPS Tracker by IMEI
router.post('/devices', (req, res) => {
  try {
    const { imei, deviceName, modelId } = req.body
    if (!imei || typeof imei !== 'string' || !imei.trim()) {
      return res.status(400).json({ error: 'Valid IMEI is required' })
    }

    const cleanImei = imei.trim()
    if (DEMO_DEVICE_IDS.has(cleanImei)) {
      return res.status(400).json({ error: 'Cannot register demo IMEI' })
    }

    const now = new Date().toISOString()
    const newDevice = {
      deviceId: cleanImei,
      deviceName: deviceName?.trim() || `${modelId?.trim() || 'GPS'}-${cleanImei.slice(-4)}`,
      status: 'online',
      motionState: 'stationary',
      lastSeen: now,
      device: {
        imei: cleanImei,
        modelId: modelId?.trim() || 'GW1NS-4',
        serialNumber: '',
        appVersion: 'WMZ_DEV_1.0.2',
        sdkVersion: 'WM_SDK_C_261008',
        hardwareVersion: 'Z636_V1',
        bootReason: 'registered',
        uptimeSec: 0,
      },
      power: {
        batteryVoltage: 4.22,
        batteryMv: 4222,
        batteryPercentage: 100,
        isCharging: false,
        isUsbConnected: false,
        isExternalPower: false,
        extPowerVoltage: '',
        isLowBattery: false,
      },
      cellular: {
        operator: 'IND airtel',
        networkType: 'LTE',
        rssi: 29,
        rsrp: 52,
        rsrq: 13,
        sinr: -4,
        signal: 'EXCELLENT',
        signalQuality: 5,
        band: '3',
        cellId: '',
        tac: '',
        mcc: '404',
        mnc: '02',
        imsi: '',
        ip4: '',
        ip6: '',
      },
      gps: {
        status: 'AWAITING_FIX',
        isFixed: false,
        latitude: 30.657035,
        longitude: 76.729596,
        altitudeM: 301.7,
        speedKmph: 0,
        headingDeg: 0,
        satellites: 0,
        hdop: 1.0,
        accuracyM: 5.0,
        fixType: 'NONE',
        lastFix: now,
        location: '',
      },
      accelerometer: {
        status: 'OK',
        motion: false,
        xG: 0,
        yG: 0,
        zG: -1.0,
        harshBrakingCount: 0,
        harshAccelerationCount: 0,
        sharpTurnCount: 0,
        impactCount: 0,
        drivingScore: 100,
      },
      rtc: now,
    }

    const db = getDb()
    db.prepare(`
      INSERT INTO devices (deviceId, deviceName, status, lastSeen, data, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(deviceId) DO UPDATE SET
        deviceName = excluded.deviceName,
        updatedAt = excluded.updatedAt
    `).run(cleanImei, newDevice.deviceName, 'online', now, JSON.stringify(newDevice), now)

    console.log(`[API] Registered new tracker IMEI: ${cleanImei} (${newDevice.deviceName})`)
    res.json({ success: true, device: newDevice })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/devices/:id
router.get('/devices/:id', (req, res) => {
  try {
    if (DEMO_DEVICE_IDS.has(req.params.id)) {
      return res.status(404).json({ error: 'Device not found' })
    }
    const db = getDb()
    const row = db.prepare('SELECT * FROM devices WHERE deviceId = ?').get(req.params.id) as any
    if (!row) {
      return res.status(404).json({ error: 'Device not found' })
    }
    res.json(JSON.parse(row.data))
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// DELETE /api/devices/:id - Remove tracker from dashboard
router.delete('/devices/:id', (req, res) => {
  try {
    const db = getDb()
    db.prepare('DELETE FROM devices WHERE deviceId = ?').run(req.params.id)
    db.prepare('DELETE FROM device_history WHERE deviceId = ?').run(req.params.id)
    console.log(`[API] Removed tracker: ${req.params.id}`)
    res.json({ success: true })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/devices/:id/history
router.get('/devices/:id/history', (req, res) => {
  try {
    const db = getDb()
    const { from, to } = req.query
    let query = 'SELECT * FROM device_history WHERE deviceId = ?'
    const params: any[] = [req.params.id]

    if (from) {
      query += ' AND timestamp >= ?'
      params.push(from)
    }
    if (to) {
      query += ' AND timestamp <= ?'
      params.push(to)
    }

    query += ' ORDER BY timestamp ASC LIMIT 500'
    const rows = db.prepare(query).all(...params)
    res.json(rows)
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/devices/:id/led
router.post('/devices/:id/led', async (req, res) => {
  try {
    const { led, state, duration_s } = req.body
    const success = await publishLedCommand(req.params.id, led, state, duration_s)
    res.json({ success })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
})

// POST /api/devices/:id/status-cmd
router.post('/devices/:id/status-cmd', async (req, res) => {
  try {
    const success = await publishStatusCommand(req.params.id)
    res.json({ success })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
})

export default router
