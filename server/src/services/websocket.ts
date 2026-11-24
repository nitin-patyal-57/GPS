import { WebSocket } from 'ws'

const clients: Set<WebSocket> = new Set()

export function addClient(ws: WebSocket): void {
  clients.add(ws)

  ws.on('close', () => {
    clients.delete(ws)
  })

  ws.on('error', (err) => {
    console.error('[WebSocket] Client error:', err.message)
    clients.delete(ws)
  })

  // Send initial welcome
  try {
    ws.send(JSON.stringify({ event: 'connected', timestamp: new Date().toISOString() }))
  } catch {}
}

export function broadcast(event: string, data: unknown): void {
  const message = JSON.stringify({ event, data })
  for (const client of clients) {
    if (client.readyState === WebSocket.OPEN) {
      try {
        client.send(message)
      } catch (err) {
        console.error('[WebSocket] Broadcast error:', err)
      }
    }
  }
}

export function getConnectedClientCount(): number {
  return clients.size
}
