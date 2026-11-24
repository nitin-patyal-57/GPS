import { config } from './config'
import type { GpsDevice, GpsAlert } from '@/types/gps'

type DeviceUpdateCallback = (deviceId: string, data: GpsDevice) => void
type AlertCallback = (alert: GpsAlert) => void
type OtaCallback = (data: any) => void

class RealtimeGpsService {
  private ws: WebSocket | null = null
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private deviceCallbacks: Set<DeviceUpdateCallback> = new Set()
  private alertCallbacks: Set<AlertCallback> = new Set()
  private otaCallbacks: Set<OtaCallback> = new Set()
  private isConnected = false

  constructor() {
    this.connect()
  }

  private connect() {
    if (typeof window === 'undefined') return

    try {
      const wsUrl = config.wsUrl
      this.ws = new WebSocket(wsUrl)

      this.ws.onopen = () => {
        this.isConnected = true
        console.log(`[WebSocket] Connected to GPS Telemetry Server: ${wsUrl}`)
        if (this.reconnectTimer) {
          clearTimeout(this.reconnectTimer)
          this.reconnectTimer = null
        }
      }

      this.ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data)
          if (msg.event === 'device_update' && msg.data) {
            const { deviceId, data } = msg.data
            this.deviceCallbacks.forEach((cb) => cb(deviceId, data))
          } else if (msg.event === 'alert' && msg.data) {
            this.alertCallbacks.forEach((cb) => cb(msg.data))
          } else if ((msg.event === 'ota_ack' || msg.event === 'ota_dispatch') && msg.data) {
            this.otaCallbacks.forEach((cb) => cb({ event: msg.event, ...msg.data }))
          }
        } catch {
          // ignore non-json messages
        }
      }

      this.ws.onclose = () => {
        this.isConnected = false
        this.ws = null
        if (!this.reconnectTimer) {
          this.reconnectTimer = setTimeout(() => {
            this.reconnectTimer = null
            this.connect()
          }, 3000)
        }
      }

      this.ws.onerror = () => {
        if (this.ws) {
          this.ws.close()
        }
      }
    } catch {
      // Backend offline, fallback to graceful polling
    }
  }

  public subscribeToDeviceUpdates(callback: DeviceUpdateCallback): () => void {
    this.deviceCallbacks.add(callback)
    return () => {
      this.deviceCallbacks.delete(callback)
    }
  }

  public subscribeToAlerts(callback: AlertCallback): () => void {
    this.alertCallbacks.add(callback)
    return () => {
      this.alertCallbacks.delete(callback)
    }
  }

  public subscribeToOta(callback: OtaCallback): () => void {
    this.otaCallbacks.add(callback)
    return () => {
      this.otaCallbacks.delete(callback)
    }
  }

  public getStatus() {
    return {
      connected: this.isConnected,
      wsUrl: config.wsUrl,
    }
  }

  public disconnect() {
    this.deviceCallbacks.clear()
    this.alertCallbacks.clear()
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
  }
}

export const realtimeGpsService = new RealtimeGpsService()
