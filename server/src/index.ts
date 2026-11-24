import express from 'express'
import cors from 'cors'
import { createServer } from 'http'
import { WebSocketServer } from 'ws'
import { initDatabase } from './services/database'
import deviceRoutes from './routes/devices'
import alertRoutes from './routes/alerts'
import { broadcast, addClient } from './services/websocket'
import { initMqttService, getMqttStatus } from './services/mqttService'

const app = express()
const server = createServer(app)
const wss = new WebSocketServer({ server, path: '/ws' })

app.use(cors({ origin: true, credentials: true }))
app.use(express.json())

// API Routes
app.use('/api', deviceRoutes)
app.use('/api', alertRoutes)

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'GPS Telemetry Server',
    timestamp: new Date().toISOString(),
    mqtt: getMqttStatus(),
  })
})

// WebSocket connection handling
wss.on('connection', (ws) => {
  console.log('[WebSocket] Client connected to live GPS stream')
  addClient(ws)
})

const PORT = process.env.PORT || 3001

initDatabase().then(() => {
  initMqttService(broadcast)

  server.listen(PORT, () => {
    console.log(`GPS Server running on port ${PORT}`)
    console.log(`Health endpoint: http://localhost:${PORT}/api/health`)
    console.log(`WebSocket live stream: ws://localhost:${PORT}/ws`)
  })
}).catch((err) => {
  console.error('Failed to initialize GPS server:', err)
  process.exit(1)
})
