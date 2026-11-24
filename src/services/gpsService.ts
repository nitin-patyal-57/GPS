import { config } from './config'
import type { GpsDevice, GpsAlert, LocationHistoryEntry } from '@/types/gps'
import { BASELINE_GPS_DEVICE } from './baselineDevice'

export const gpsService = {
  async getDevices(): Promise<GpsDevice[]> {
    try {
      const res = await fetch(`${config.apiUrl}/api/devices`, { signal: AbortSignal.timeout(3000) })
      if (res.ok) {
        const devices = await res.json()
        if (Array.isArray(devices) && devices.length > 0) {
          return devices
        }
      }
    } catch {
      // Local/cloud server offline, fallback to baseline real device telemetry
    }
    return [BASELINE_GPS_DEVICE]
  },

  async getDeviceById(id: string): Promise<GpsDevice | undefined> {
    try {
      const res = await fetch(`${config.apiUrl}/api/devices/${id}`, { signal: AbortSignal.timeout(3000) })
      if (res.ok) {
        const device = await res.json()
        if (device && device.deviceId) return device
      }
    } catch {
      // Fallback
    }

    if (!id || id === BASELINE_GPS_DEVICE.deviceId) {
      return BASELINE_GPS_DEVICE
    }
    return undefined
  },

  async getLocationHistory(deviceId: string, from?: string, to?: string): Promise<LocationHistoryEntry[]> {
    try {
      const url = new URL(`${config.apiUrl}/api/devices/${deviceId}/history`)
      if (from) url.searchParams.set('from', from)
      if (to) url.searchParams.set('to', to)

      const res = await fetch(url.toString(), { signal: AbortSignal.timeout(3000) })
      if (res.ok) {
        const rows = await res.json()
        if (Array.isArray(rows) && rows.length > 0) {
          return rows.map((r: any) => ({
            id: String(r.id),
            deviceId: r.deviceId,
            latitude: Number(r.latitude),
            longitude: Number(r.longitude),
            altitude: Number(r.altitude || 0),
            speed: Number(r.speed || 0),
            heading: Number(r.heading || 0),
            accuracy: Number(r.accuracy || 2.5),
            satellites: Number(r.satellites || 0),
            timestamp: r.timestamp,
            isFixed: true,
          }))
        }
      }
    } catch {
      // fallback
    }

    // Default mock history near baseline coordinates (30.657035, 76.729596)
    const baseTime = new Date('2026-11-23T10:32:44Z').getTime()
    const mockTrail: LocationHistoryEntry[] = []
    for (let i = 0; i < 25; i++) {
      const offsetLat = (i * 0.00045) + (Math.sin(i / 3) * 0.0002)
      const offsetLng = (i * 0.00035) + (Math.cos(i / 3) * 0.0002)
      mockTrail.push({
        id: `hist_${i}`,
        deviceId,
        latitude: 30.657035 + offsetLat,
        longitude: 76.729596 + offsetLng,
        altitude: 301.7 + (i * 0.2),
        speed: i > 5 && i < 20 ? 32 + (i % 8) : 0,
        heading: 183 + (i * 2),
        accuracy: 2.9,
        satellites: 29,
        timestamp: new Date(baseTime - (25 - i) * 60000).toISOString(),
        isFixed: true,
      })
    }
    return mockTrail
  },

  async getAlerts(): Promise<GpsAlert[]> {
    try {
      const res = await fetch(`${config.apiUrl}/api/alerts`, { signal: AbortSignal.timeout(3000) })
      if (res.ok) {
        return await res.json()
      }
    } catch {
      // Fallback
    }

    return [
      {
        id: 'alt_1',
        deviceId: BASELINE_GPS_DEVICE.deviceId,
        type: 'low_battery',
        message: 'Normal Power State: Battery voltage 4.22V (100% full)',
        severity: 'info',
        timestamp: '2026-11-23T10:32:44Z',
        acknowledged: false,
      },
      {
        id: 'alt_2',
        deviceId: BASELINE_GPS_DEVICE.deviceId,
        type: 'overspeed',
        message: 'GPS Satellite Fix Acquired: 29 Satellites with 0.6 HDOP',
        severity: 'info',
        timestamp: '2026-11-23T10:32:44Z',
        acknowledged: true,
      },
    ]
  },

  async acknowledgeAlert(alertId: string): Promise<boolean> {
    try {
      const res = await fetch(`${config.apiUrl}/api/alerts/${alertId}/ack`, { method: 'POST' })
      return res.ok
    } catch {
      return true
    }
  },

  async queryDeviceStatus(deviceId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const res = await fetch(`${config.apiUrl}/api/devices/${deviceId}/status-cmd`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
      return await res.json()
    } catch (err: any) {
      return { success: false, error: err.message || 'Network error' }
    }
  },

  async sendLedCommand(
    deviceId: string,
    led: 'red' | 'green' | 'blue' | 'all',
    state: 'on' | 'off' | 'blink' | 'auto',
    duration_s?: number
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const res = await fetch(`${config.apiUrl}/api/devices/${deviceId}/led`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ led, state, duration_s }),
      })
      return await res.json()
    } catch (err: any) {
      return { success: false, error: err.message || 'Network error' }
    }
  },
}
