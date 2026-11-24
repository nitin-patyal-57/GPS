import { useState, useEffect, useCallback } from 'react'
import type { GpsDevice, GpsAlert, LocationHistoryEntry } from '@/types/gps'
import {
  gpsService,
  isIgnoredDevice,
  getDeletedDeviceIds,
  getCustomDevicesFromStorage,
} from '@/services/gpsService'
import { realtimeGpsService } from '@/services/websocket'
import { useRefresh } from '@/context/RefreshContext'

export function useGpsDevices() {
  const [devices, setDevices] = useState<GpsDevice[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { refreshCount } = useRefresh()

  const fetchDevices = useCallback(async () => {
    try {
      const data = await gpsService.getDevices()
      const deleted = getDeletedDeviceIds()
      const clean = data.filter(
        (d) => d && d.deviceId && !isIgnoredDevice(d.deviceId) && !deleted.has(d.deviceId)
      )
      setDevices(clean)
      setError(null)
    } catch (err: any) {
      setError(err.message || 'Failed to load GPS devices')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchDevices()
  }, [fetchDevices, refreshCount])

  // Real-time WebSocket updates
  useEffect(() => {
    const unsubscribe = realtimeGpsService.subscribeToDeviceUpdates((deviceId, updatedDevice) => {
      // Strictly ignore decommissioned demo devices and user-deleted devices
      if (!deviceId || isIgnoredDevice(deviceId)) return
      const deleted = getDeletedDeviceIds()
      if (deleted.has(deviceId)) return

      setDevices((prev) => {
        // Strip out any ignored/soundbox devices or deleted items
        const cleanPrev = prev.filter(
          (d) => d && d.deviceId && !isIgnoredDevice(d.deviceId) && !deleted.has(d.deviceId)
        )
        const index = cleanPrev.findIndex((d) => d.deviceId === deviceId)
        if (index >= 0) {
          const next = [...cleanPrev]
          next[index] = { ...next[index], ...updatedDevice }
          return next
        }

        // Only auto-add if it was explicitly registered in custom storage or is the primary baseline device
        const custom = getCustomDevicesFromStorage()
        const isRegistered = custom.some((c) => c.deviceId === deviceId) || deviceId === '861185084122719'
        if (isRegistered) {
          return [updatedDevice, ...cleanPrev]
        }

        // Otherwise drop the unsolicited soundbox packet
        return cleanPrev
      })
    })

    return () => unsubscribe()
  }, [])

  const addDevice = useCallback(
    async (params: { imei: string; deviceName?: string; modelId?: string }) => {
      const newDev = await gpsService.addDevice(params)
      setDevices((prev) => {
        const deleted = getDeletedDeviceIds()
        const cleanPrev = prev.filter(
          (d) => d && d.deviceId && !isIgnoredDevice(d.deviceId) && !deleted.has(d.deviceId)
        )
        const existing = cleanPrev.findIndex((d) => d.deviceId === newDev.deviceId)
        if (existing >= 0) {
          const next = [...cleanPrev]
          next[existing] = newDev
          return next
        }
        return [newDev, ...cleanPrev]
      })
      return newDev
    },
    []
  )

  const deleteDevice = useCallback(async (deviceId: string) => {
    await gpsService.deleteDevice(deviceId)
    setDevices((prev) => prev.filter((d) => d.deviceId !== deviceId))
    return true
  }, [])

  return { devices, loading, error, refetch: fetchDevices, addDevice, deleteDevice }
}

export function useGpsDevice(deviceId: string) {
  const [device, setDevice] = useState<GpsDevice | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { refreshCount } = useRefresh()

  const fetchDevice = useCallback(async () => {
    if (!deviceId || isIgnoredDevice(deviceId) || getDeletedDeviceIds().has(deviceId)) {
      setDevice(null)
      setError(`Device ${deviceId} not found`)
      setLoading(false)
      return
    }

    try {
      const data = await gpsService.getDeviceById(deviceId)
      if (data && !isIgnoredDevice(data.deviceId)) {
        setDevice(data)
        setError(null)
      } else {
        setError(`Device ${deviceId} not found`)
      }
    } catch (err: any) {
      setError(err.message || 'Failed to fetch device')
    } finally {
      setLoading(false)
    }
  }, [deviceId])

  useEffect(() => {
    fetchDevice()
  }, [fetchDevice, refreshCount])

  // Real-time device update
  useEffect(() => {
    if (!deviceId || isIgnoredDevice(deviceId)) return
    const unsubscribe = realtimeGpsService.subscribeToDeviceUpdates((id, updatedDevice) => {
      if (id === deviceId && !getDeletedDeviceIds().has(id)) {
        setDevice((prev) => (prev ? { ...prev, ...updatedDevice } : updatedDevice))
      }
    })
    return () => unsubscribe()
  }, [deviceId])

  return { device, loading, error, refetch: fetchDevice }
}

export function useLocationHistory(deviceId: string, from?: string, to?: string) {
  const [history, setHistory] = useState<LocationHistoryEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchHistory = useCallback(async () => {
    if (!deviceId || isIgnoredDevice(deviceId) || getDeletedDeviceIds().has(deviceId)) {
      setHistory([])
      return
    }
    setLoading(true)
    try {
      const data = await gpsService.getLocationHistory(deviceId, from, to)
      setHistory(data)
      setError(null)
    } catch (err: any) {
      setError(err.message || 'Failed to fetch location history')
    } finally {
      setLoading(false)
    }
  }, [deviceId, from, to])

  useEffect(() => {
    fetchHistory()
  }, [fetchHistory])

  return { history, loading, error, refetch: fetchHistory }
}

export function useGpsAlerts() {
  const [alerts, setAlerts] = useState<GpsAlert[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { refreshCount } = useRefresh()

  const fetchAlerts = useCallback(async () => {
    try {
      const data = await gpsService.getAlerts()
      const deleted = getDeletedDeviceIds()
      setAlerts(data.filter((a) => !isIgnoredDevice(a.deviceId) && !deleted.has(a.deviceId)))
      setError(null)
    } catch (err: any) {
      setError(err.message || 'Failed to load alerts')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchAlerts()
  }, [fetchAlerts, refreshCount])

  useEffect(() => {
    const unsubscribe = realtimeGpsService.subscribeToAlerts((alert) => {
      if (isIgnoredDevice(alert.deviceId) || getDeletedDeviceIds().has(alert.deviceId)) return
      setAlerts((prev) => [alert, ...prev.filter((a) => a.id !== alert.id)])
    })
    return () => unsubscribe()
  }, [])

  const acknowledgeAlert = useCallback(async (alertId: string) => {
    const ok = await gpsService.acknowledgeAlert(alertId)
    if (ok) {
      setAlerts((prev) =>
        prev.map((a) => (a.id === alertId ? { ...a, acknowledged: true } : a))
      )
    }
  }, [])

  const acknowledgeAllAlerts = useCallback(async () => {
    setAlerts((prev) => prev.map((a) => ({ ...a, acknowledged: true })))
  }, [])

  return { alerts, loading, error, refetch: fetchAlerts, acknowledgeAlert, acknowledgeAllAlerts }
}
