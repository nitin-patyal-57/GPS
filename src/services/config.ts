export const config = {
  apiUrl: import.meta.env.VITE_API_URL || 'http://localhost:3001',
  wsUrl: import.meta.env.VITE_WS_URL || 'ws://localhost:3001/ws',
  useMockFallback: import.meta.env.VITE_USE_MOCK_FALLBACK === 'true',
  defaultImei: import.meta.env.VITE_DEFAULT_IMEI || '861185084122719',
}
