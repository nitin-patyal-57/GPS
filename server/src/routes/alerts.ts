import { Router } from 'express'
import { getDb } from '../services/database'

const router = Router()

// GET /api/alerts
router.get('/alerts', (req, res) => {
  try {
    const db = getDb()
    const rows = db.prepare('SELECT * FROM alerts ORDER BY timestamp DESC LIMIT 50').all()
    res.json(rows)
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/alerts/:id/ack
router.post('/alerts/:id/ack', (req, res) => {
  try {
    const db = getDb()
    db.prepare('UPDATE alerts SET acknowledged = 1 WHERE id = ?').run(req.params.id)
    res.json({ success: true })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

export default router
