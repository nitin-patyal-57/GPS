import { Router } from 'express'
import { getDb } from '../services/database'
import { publishLedCommand, publishStatusCommand } from '../services/mqttService'

const router = Router()

// GET /api/devices
router.get('/devices', (req, res) => {
  try {
    const db = getDb()
    const rows = db.prepare('SELECT * FROM devices ORDER BY updatedAt DESC').all() as any[]
    const devices = rows.map((r) => {
      try {
        return JSON.parse(r.data)
      } catch {
        return null
      }
    }).filter(Boolean)
    res.json(devices)
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/devices/:id
router.get('/devices/:id', (req, res) => {
  try {
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
