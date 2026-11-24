// In production or on Vercel (same-origin routing), API calls are routed via relative path '' -> /api/...
// In local dev without VITE_API_URL, fallback to http://localhost:3001
const isLocalhost =
  typeof window !== 'undefined' &&
  (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')

export const config = {
  apiUrl:
    import.meta.env.VITE_API_URL !== undefined
      ? import.meta.env.VITE_API_URL
      : isLocalhost
      ? 'http://localhost:3001'
      : '',
  wsUrl:
    import.meta.env.VITE_WS_URL ||
    (typeof window !== 'undefined'
      ? `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws`
      : 'ws://localhost:3001/ws'),
  useMockFallback: import.meta.env.VITE_USE_MOCK_FALLBACK === 'true',
  defaultImei: import.meta.env.VITE_DEFAULT_IMEI || '861185084122719',
}
