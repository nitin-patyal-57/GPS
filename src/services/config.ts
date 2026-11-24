// Production Render backend & WebSocket endpoints
const RENDER_BACKEND_URL = 'https://gps-server-9skp.onrender.com'
const RENDER_WS_URL = 'wss://gps-server-9skp.onrender.com/ws'

const isLocalhost =
  typeof window !== 'undefined' &&
  (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')

const isOnRender =
  typeof window !== 'undefined' &&
  window.location.hostname.includes('onrender.com')

export const config = {
  // If explicitly overridden via env var, use that; otherwise route to Render backend or localhost
  apiUrl:
    import.meta.env.VITE_API_URL ||
    (isLocalhost
      ? 'http://localhost:3001'
      : isOnRender
      ? ''
      : RENDER_BACKEND_URL),

  // WebSockets connect directly to Render backend where AWS IoT Core MQTT client runs
  wsUrl:
    import.meta.env.VITE_WS_URL ||
    (isLocalhost
      ? 'ws://localhost:3001/ws'
      : isOnRender
      ? `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws`
      : RENDER_WS_URL),

  useMockFallback: import.meta.env.VITE_USE_MOCK_FALLBACK === 'true',
  defaultImei: import.meta.env.VITE_DEFAULT_IMEI || '861185084122719',
}
