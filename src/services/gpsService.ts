import { config } from './config'
import type { GpsDevice, GpsAlert, LocationHistoryEntry } from '@/types/gps'
import { BASELINE_GPS_DEVICE } from './baselineDevice'

export const DEMO_DEVICE_IDS = new Set(['867509082945058', '861185084200101'])
const STORAGE_CUSTOM_KEY = 'custom_gps_devices'
const STORAGE_DELETED_KEY = 'deleted_gps_devices'

export function isIgnoredDevice(id: string): boolean {
  if (!id) return true
  const clean = id.trim()
  // Block all demo walnut/soundbox IMEI series (86750908...)
  if (clean.startsWith('86750908') || clean === '861185084200101' || DEMO_DEVICE_IDS.has(clean)) {
    return true
  }
  return false
}

export function getDeletedDeviceIds(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_DELETED_KEY)
    if (raw) {
      const arr = JSON.parse(raw)
      return new Set([...arr])
    }
  } catch {}
  return new Set()
}

export function markDeviceDeleted(deviceId: string) {
  try {
    const set = getDeletedDeviceIds()
    set.add(deviceId)
    localStorage.setItem(STORAGE_DELETED_KEY, JSON.stringify(Array.from(set)))

    // Remove from custom devices if present
    const custom = getCustomDevicesFromStorage()
    const filtered = custom.filter((d) => d.deviceId !== deviceId)
    localStorage.setItem(STORAGE_CUSTOM_KEY, JSON.stringify(filtered))
  } catch {}
}

export function purgeStaleStorage(): void {
  try {
    const raw = localStorage.getItem(STORAGE_CUSTOM_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) {
        const cleaned = parsed.filter((d) => d && d.deviceId && !isIgnoredDevice(d.deviceId))
        if (cleaned.length !== parsed.length) {
          localStorage.setItem(STORAGE_CUSTOM_KEY, JSON.stringify(cleaned))
        }
      }
    }
  } catch {}
}

// Automatically purge legacy soundbox devices from local cache
purgeStaleStorage()

export function getCustomDevicesFromStorage(): GpsDevice[] {
  try {
    const raw = localStorage.getItem(STORAGE_CUSTOM_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) {
        const deleted = getDeletedDeviceIds()
        return parsed.filter((d) => d && d.deviceId && !isIgnoredDevice(d.deviceId) && !deleted.has(d.deviceId))
      }
    }
  } catch {}
  return []
}

export function saveCustomDeviceToStorage(device: GpsDevice) {
  try {
    if (isIgnoredDevice(device.deviceId)) return

    const current = getCustomDevicesFromStorage().filter((d) => d.deviceId !== device.deviceId)
    current.unshift(device)
    localStorage.setItem(STORAGE_CUSTOM_KEY, JSON.stringify(current))

    // Unmark as deleted if it was previously deleted
    const deleted = getDeletedDeviceIds()
    if (deleted.has(device.deviceId)) {
      deleted.delete(device.deviceId)
      localStorage.setItem(STORAGE_DELETED_KEY, JSON.stringify(Array.from(deleted)))
    }
  } catch {}
}

export const gpsService = {
  isIgnoredDevice,
  getDeletedDeviceIds,
  markDeviceDeleted,

  async getDevices(): Promise<GpsDevice[]> {
    const deleted = getDeletedDeviceIds()
    const customDevices = getCustomDevicesFromStorage()
    let serverDevices: GpsDevice[] = []

    try {
      const url = `${config.apiUrl}/api/devices?_t=${Date.now()}`
      const res = await fetch(url, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          Pragma: 'no-cache',
        },
        signal: AbortSignal.timeout(3500),
      })
      if (res.ok) {
        const data = await res.json()
        if (Array.isArray(data)) {
          serverDevices = data.filter(
            (d) => d && d.deviceId && !isIgnoredDevice(d.deviceId) && !deleted.has(d.deviceId)
          )
        }
      }
    } catch {
      // Local/cloud server offline, fallback
    }

    // Combine server devices + local custom devices
    const deviceMap = new Map<string, GpsDevice>()

    // Default baseline real device if not explicitly deleted
    if (!deleted.has(BASELINE_GPS_DEVICE.deviceId)) {
      deviceMap.set(BASELINE_GPS_DEVICE.deviceId, BASELINE_GPS_DEVICE)
    }

    for (const d of serverDevices) {
      if (!isIgnoredDevice(d.deviceId) && !deleted.has(d.deviceId)) {
        deviceMap.set(d.deviceId, d)
      }
    }

    for (const d of customDevices) {
      if (!isIgnoredDevice(d.deviceId) && !deleted.has(d.deviceId) && !deviceMap.has(d.deviceId)) {
        deviceMap.set(d.deviceId, d)
      }
    }

    return Array.from(deviceMap.values())
  },

  async getDeviceById(id: string): Promise<GpsDevice | undefined> {
    if (isIgnoredDevice(id)) return undefined
    const deleted = getDeletedDeviceIds()
    if (deleted.has(id)) return undefined

    try {
      const url = `${config.apiUrl}/api/devices/${id}?_t=${Date.now()}`
      const res = await fetch(url, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          Pragma: 'no-cache',
        },
        signal: AbortSignal.timeout(3500),
      })
      if (res.ok) {
        const device = await res.json()
        if (device && device.deviceId && !isIgnoredDevice(device.deviceId) && !deleted.has(device.deviceId)) {
          return device
        }
      }
    } catch {
      // Fallback to local storage or baseline
    }

    const custom = getCustomDevicesFromStorage()
    const matched = custom.find((d) => d.deviceId === id)
    if (matched && !isIgnoredDevice(matched.deviceId) && !deleted.has(matched.deviceId)) {
      return matched
    }

    if (id === BASELINE_GPS_DEVICE.deviceId && !deleted.has(id)) {
      return BASELINE_GPS_DEVICE
    }

    return undefined
  },

  async addDevice(params: { imei: string; deviceName?: string; modelId?: string }): Promise<GpsDevice> {
    const cleanImei = params.imei.trim()
    if (isIgnoredDevice(cleanImei)) {
      throw new Error('This demo IMEI has been decommissioned.')
    }

    const name = params.deviceName?.trim() || `${params.modelId?.trim() || 'GPS'}-${cleanImei.slice(-4)}`
    const model = params.modelId?.trim() || 'GW1NS-4'
    const now = new Date().toISOString()

    const newDevice: GpsDevice = {
      deviceId: cleanImei,
      deviceName: name,
      status: 'online',
      motionState: 'stationary',
      lastSeen: now,
      device: {
        imei: cleanImei,
        modelId: model,
        serialNumber: '',
        appVersion: 'WMZ_DEV_1.0.2',
        sdkVersion: 'WM_SDK_C_261008',
        hardwareVersion: 'Z636_V1',
        bootReason: 'manual registration',
        uptimeSec: 0,
      },
      power: {
        batteryVoltage: 4.20,
        batteryMv: 4200,
        batteryPercentage: 100,
        isCharging: false,
        isUsbConnected: false,
        isExternalPower: false,
        extPowerVoltage: '',
        isLowBattery: false,
      },
      cellular: {
        operator: 'IND airtel',
        networkType: 'LTE',
        rssi: 29,
        rsrp: 52,
        rsrq: 13,
        sinr: -4,
        signal: 'EXCELLENT',
        signalQuality: 5,
        band: '3',
        cellId: '',
        tac: '',
        mcc: '404',
        mnc: '02',
        imsi: '',
        ip4: '',
        ip6: '',
      },
      gps: {
        status: 'AWAITING_FIX',
        isFixed: true,
        latitude: 30.657035,
        longitude: 76.729596,
        altitudeM: 301.7,
        speedKmph: 0,
        headingDeg: 0,
        satellites: 12,
        hdop: 1.0,
        accuracyM: 3.5,
        fixType: '3D',
        lastFix: now,
        location: '',
      },
      accelerometer: {
        status: 'OK',
        motion: false,
        xG: 0,
        yG: 0,
        zG: -1.0,
        harshBrakingCount: 0,
        harshAccelerationCount: 0,
        sharpTurnCount: 0,
        impactCount: 0,
        drivingScore: 100,
      },
      rtc: now,
    }

    // Try posting to API
    try {
      const res = await fetch(`${config.apiUrl}/api/devices`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store',
        },
        body: JSON.stringify({
          imei: cleanImei,
          deviceName: name,
          modelId: model,
        }),
        signal: AbortSignal.timeout(4000),
      })
      if (res.ok) {
        const body = await res.json()
        if (body.device) {
          saveCustomDeviceToStorage(body.device)
          return body.device
        }
      }
    } catch {
      // Offline fallback
    }

    saveCustomDeviceToStorage(newDevice)
    return newDevice
  },

  async deleteDevice(deviceId: string): Promise<boolean> {
    markDeviceDeleted(deviceId)
    try {
      await fetch(`${config.apiUrl}/api/devices/${deviceId}`, {
        method: 'DELETE',
        headers: { 'Cache-Control': 'no-cache, no-store' },
        signal: AbortSignal.timeout(3000),
      })
    } catch {
      // Local removal succeeded
    }
    return true
  },

  async getLocationHistory(deviceId: string, from?: string, to?: string): Promise<LocationHistoryEntry[]> {
    if (isIgnoredDevice(deviceId)) return []
    const deleted = getDeletedDeviceIds()
    if (deleted.has(deviceId)) return []

    try {
      const base = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3001'
      const url = new URL(`${config.apiUrl || ''}/api/devices/${deviceId}/history`, base)
      url.searchParams.set('_t', String(Date.now()))
      if (from) url.searchParams.set('from', from)
      if (to) url.searchParams.set('to', to)

      const res = await fetch(url.toString(), {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache, no-store' },
        signal: AbortSignal.timeout(3500),
      })
      if (res.ok) {
        const rows = await res.json()
        if (Array.isArray(rows)) {
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
      // Ignore network errors and return empty list
    }

    return []
  },

  async getAlerts(): Promise<GpsAlert[]> {
    const deleted = getDeletedDeviceIds()
    try {
      const url = `${config.apiUrl}/api/alerts?_t=${Date.now()}`
      const res = await fetch(url, {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache, no-store' },
        signal: AbortSignal.timeout(3500),
      })
      if (res.ok) {
        const alerts: GpsAlert[] = await res.json()
        if (Array.isArray(alerts)) {
          return alerts.filter((a) => !isIgnoredDevice(a.deviceId) && !deleted.has(a.deviceId))
        }
      }
    } catch {
      // Fallback
    }

    const fallbackAlerts: GpsAlert[] = [
      {
        id: 'alt_1',
        deviceId: BASELINE_GPS_DEVICE.deviceId,
        type: 'low_battery' as const,
        message: 'Normal Power State: Battery voltage 4.22V (100% full)',
        severity: 'info' as const,
        timestamp: '2026-11-23T10:32:44Z',
        acknowledged: false,
      },
      {
        id: 'alt_2',
        deviceId: BASELINE_GPS_DEVICE.deviceId,
        type: 'overspeed' as const,
        message: 'GPS Satellite Fix Acquired: 29 Satellites with 0.6 HDOP',
        severity: 'info' as const,
        timestamp: '2026-11-23T10:32:44Z',
        acknowledged: true,
      },
    ]

    return fallbackAlerts.filter((a) => !isIgnoredDevice(a.deviceId) && !deleted.has(a.deviceId))
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
