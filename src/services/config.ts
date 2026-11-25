// Production Render backend & WebSocket endpoints
const RENDER_BACKEND_URL = 'https://gps-3t1e.onrender.com'
const RENDER_WS_URL = 'wss://gps-3t1e.onrender.com/ws'

function getApiUrl(): string {
  if (typeof window === 'undefined') return 'http://localhost:3001'

  const hostname = window.location.hostname
  const isLocal = hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '0.0.0.0'

  if (isLocal) {
    return 'http://localhost:3001'
  }

  // When deployed on Vercel or Render:
  // On Vercel, requests to /api/* are proxied directly to Render backend via vercel.json rewrites.
  // Using relative path '' avoids all mixed-content HTTP/HTTPS and CORS issues.
  return ''
}

function getWsUrl(): string {
  if (typeof window === 'undefined') return 'ws://localhost:3001/ws'

  const hostname = window.location.hostname
  const isLocal = hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '0.0.0.0'

  if (isLocal) {
    return 'ws://localhost:3001/ws'
  }

  // In production (Vercel, Render, or custom domain):
  // If hosted directly on Render web service, use relative wss:
  if (hostname.includes('onrender.com')) {
    return `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws`
  }

  // On Vercel or other hosts, connect directly to Render's WebSocket server
  return RENDER_WS_URL
}

export const config = {
  apiUrl: getApiUrl(),
  wsUrl: getWsUrl(),
  useMockFallback: false,
  defaultImei: '861185084122719',
}
