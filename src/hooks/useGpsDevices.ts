import { useState, useEffect, useCallback } from 'react'
import type { GpsDevice, GpsAlert, LocationHistoryEntry } from '@/types/gps'
import { gpsService } from '@/services/gpsService'
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
      setDevices(data)
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
      setDevices((prev) => {
        const index = prev.findIndex((d) => d.deviceId === deviceId)
        if (index >= 0) {
          const next = [...prev]
          next[index] = { ...next[index], ...updatedDevice }
          return next
        }
        return [updatedDevice, ...prev]
      })
    })

    return () => unsubscribe()
  }, [])

  const addDevice = useCallback(
    async (params: { imei: string; deviceName?: string; modelId?: string }) => {
      const newDev = await gpsService.addDevice(params)
      setDevices((prev) => {
        const existing = prev.findIndex((d) => d.deviceId === newDev.deviceId)
        if (existing >= 0) {
          const next = [...prev]
          next[existing] = newDev
          return next
        }
        return [newDev, ...prev]
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
    if (!deviceId) return
    try {
      const data = await gpsService.getDeviceById(deviceId)
      if (data) {
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
    if (!deviceId) return
    const unsubscribe = realtimeGpsService.subscribeToDeviceUpdates((id, updatedDevice) => {
      if (id === deviceId) {
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
    if (!deviceId) return
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
  const { refreshCount } = useRefresh()

  const fetchAlerts = useCallback(async () => {
    try {
      const data = await gpsService.getAlerts()
      setAlerts(data)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchAlerts()
  }, [fetchAlerts, refreshCount])

  useEffect(() => {
    const unsub = realtimeGpsService.subscribeToAlerts((newAlert) => {
      setAlerts((prev) => [newAlert, ...prev.filter((a) => a.id !== newAlert.id)])
    })
    return () => unsub()
  }, [])

  const acknowledgeAlert = async (alertId: string) => {
    await gpsService.acknowledgeAlert(alertId)
    setAlerts((prev) => prev.map((a) => (a.id === alertId ? { ...a, acknowledged: true } : a)))
  }

  const acknowledgeAllAlerts = async () => {
    setAlerts((prev) => prev.map((a) => ({ ...a, acknowledged: true })))
  }

  return { alerts, loading, acknowledgeAlert, acknowledgeAllAlerts, refetch: fetchAlerts }
}
