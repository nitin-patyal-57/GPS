import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useGpsDevices, useGpsAlerts } from '@/hooks/useGpsDevices'
import Card from '@/components/ui/Card'
import StatusBadge from '@/components/ui/StatusBadge'
import BatteryIndicator from '@/components/ui/BatteryIndicator'
import SignalIndicator from '@/components/ui/SignalIndicator'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import ErrorState from '@/components/ui/ErrorState'
import OfflineDeviceModal from '@/components/devices/OfflineDeviceModal'
import type { GpsDevice } from '@/types/gps'
import {
  Navigation,
  Satellite,
  Gauge,
  Activity,
  AlertTriangle,
  Radio,
  Zap,
  Clock,
  Compass,
} from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { formatTimeSafe, formatRelativeTime, getHeadingDirection, isDeviceMqttOnline } from '@/utils/helpers'

export default function OverviewPage() {
  const { devices, loading, error, refetch } = useGpsDevices()
  const { alerts } = useGpsAlerts()
  const navigate = useNavigate()
  const [offlineModalDevice, setOfflineModalDevice] = useState<GpsDevice | null>(null)

  const handleDeviceClick = (device: GpsDevice) => {
    const isOnline = isDeviceMqttOnline(device.lastSeen)
    if (!isOnline) {
      setOfflineModalDevice(device)
    } else {
      navigate(`/devices/${device.deviceId}`)
    }
  }

  const stats = useMemo(() => {
    const total = devices.length
    const online = devices.filter((d) => isDeviceMqttOnline(d.lastSeen)).length
    const moving = devices.filter((d) => (d.gps?.speedKmph || 0) > 1.5 || d.motionState === 'moving').length
    const stationary = total - moving
    const lowBat = devices.filter((d) => d.power?.isLowBattery || d.power?.batteryPercentage < 20).length
    return { total, online, moving, stationary, lowBat }
  }, [devices])

  const batteryData = useMemo(() => {
    return devices.map((d) => ({
      name: d.deviceId.slice(-6),
      battery: d.power.batteryPercentage,
    }))
  }, [devices])

  if (loading) return <LoadingSpinner message="Loading GPS fleet telemetry..." className="min-h-[60vh]" />
  if (error) return <ErrorState message={error} onRetry={refetch} />

  const kpis = [
    {
      label: 'Total GPS Trackers',
      value: stats.total,
      icon: <Navigation className="h-5 w-5" />,
      gradient: 'from-blue-500/10 to-indigo-500/10',
      iconColor: 'text-blue-500',
    },
    {
      label: 'Moving Vehicles',
      value: stats.moving,
      icon: <Gauge className="h-5 w-5" />,
      gradient: 'from-emerald-500/10 to-teal-500/10',
      iconColor: 'text-emerald-500',
    },
    {
      label: 'Parked / Stationary',
      value: stats.stationary,
      icon: <Clock className="h-5 w-5" />,
      gradient: 'from-purple-500/10 to-indigo-500/10',
      iconColor: 'text-purple-500',
    },
    {
      label: 'Active Alerts',
      value: alerts.filter((a) => !a.acknowledged).length,
      icon: <AlertTriangle className="h-5 w-5" />,
      gradient: 'from-amber-500/10 to-orange-500/10',
      iconColor: 'text-amber-500',
    },
  ]

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
            Fleet GPS Telemetry Overview
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Real-time GNSS positioning, cellular signal, and 3-axis motion dynamics
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((kpi) => (
          <Card key={kpi.label} padding="md">
            <div className={`rounded-xl bg-gradient-to-br ${kpi.gradient} p-4`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    {kpi.label}
                  </p>
                  <p className="mt-1 text-3xl font-black text-slate-900 dark:text-slate-100">
                    {kpi.value}
                  </p>
                </div>
                <div className={`rounded-xl bg-white/80 p-3 shadow-xs dark:bg-slate-800/80 ${kpi.iconColor}`}>
                  {kpi.icon}
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Grid: Battery Chart & Recent Telemetry */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card padding="md">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider flex items-center gap-2">
              <Zap className="h-4 w-4 text-emerald-500" />
              Device Battery Levels (%)
            </h2>
          </div>
          {batteryData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={batteryData}>
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    border: '1px solid #334155',
                    borderRadius: '8px',
                    color: '#f8fafc',
                    fontSize: '12px',
                  }}
                  formatter={(val) => [`${val}%`, 'Battery']}
                />
                <Bar dataKey="battery" radius={[6, 6, 0, 0]} maxBarSize={36}>
                  {batteryData.map((e, idx) => (
                    <Cell key={idx} fill={e.battery > 50 ? '#10b981' : e.battery > 20 ? '#f59e0b' : '#ef4444'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="py-8 text-center text-xs text-slate-400">No telemetry data</p>
          )}
        </Card>

        {/* Live Satellite & GNSS Fix Status */}
        <Card padding="md">
          <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider flex items-center gap-2 mb-4">
            <Satellite className="h-4 w-4 text-blue-500" />
            GNSS Fix & Satellite Matrix
          </h2>
          <div className="space-y-3">
            {devices.map((device) => {
              const speed = device.gps?.speedKmph || 0
              const isMoving = speed > 1.5
              return (
                <div
                  key={device.deviceId}
                  onClick={() => handleDeviceClick(device)}
                  className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer border border-slate-200/60 dark:border-slate-700/60"
                >
                  <div className="flex items-center gap-3">
                    <div className="rounded-lg bg-blue-500/10 p-2 text-blue-500">
                      <Satellite className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-900 dark:text-slate-100">
                        {device.deviceName}
                      </p>
                      <p className="text-[11px] font-mono text-slate-500">
                        Lat: {device.gps?.latitude?.toFixed(4)}, Lon: {device.gps?.longitude?.toFixed(4)}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="inline-flex items-center gap-1 rounded-md bg-blue-500/15 px-2 py-0.5 text-[11px] font-bold text-blue-500 dark:text-blue-400">
                      {device.gps?.satellites ?? 0} Sats ({device.gps?.fixType ?? '3D'})
                    </span>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      {isMoving ? `Speed: ${speed.toFixed(1)} km/h` : 'Parked'} &middot; {formatRelativeTime(device.lastSeen)}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        </Card>
      </div>

      {/* Fleet Live List */}
      <Card padding="md">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider flex items-center gap-2">
            <Radio className="h-4 w-4 text-purple-500" />
            Active GPS Trackers
          </h2>
          <button
            onClick={() => navigate('/devices')}
            className="text-xs font-bold text-emerald-600 hover:text-emerald-500 dark:text-emerald-400"
          >
            View All ({devices.length}) →
          </button>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {devices.map((device) => {
            const speed = device.gps?.speedKmph || 0
            const heading = device.gps?.headingDeg || 0
            const isMoving = speed > 1.5

            return (
              <div
                key={device.deviceId}
                onClick={() => handleDeviceClick(device)}
                className="rounded-xl border border-slate-200 bg-white p-4 transition-all hover:shadow-md cursor-pointer dark:border-slate-700/80 dark:bg-slate-800/80 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-bold text-sm text-slate-900 dark:text-slate-100">
                        {device.deviceName}
                      </p>
                      <p className="font-mono text-xs text-slate-400">
                        IMEI: {device.deviceId}
                      </p>
                    </div>
                    <StatusBadge
                      label={isMoving ? 'Moving' : 'Parked'}
                      variant={isMoving ? 'success' : 'info'}
                      pulse={isMoving}
                    />
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded-lg bg-slate-50 p-2 dark:bg-slate-700/40">
                      <span className="text-[10px] text-slate-400 block">Speed</span>
                      <span className="font-bold font-mono text-slate-800 dark:text-slate-200">
                        {speed.toFixed(1)} km/h
                      </span>
                    </div>
                    <div className="rounded-lg bg-slate-50 p-2 dark:bg-slate-700/40">
                      <span className="text-[10px] text-slate-400 block">Heading</span>
                      <span className="font-bold font-mono text-slate-800 dark:text-slate-200 flex items-center gap-1">
                        <Compass className="h-3 w-3 text-blue-400" />
                        {Math.round(heading)}° {getHeadingDirection(heading)}
                      </span>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center justify-between text-[11px] rounded-lg bg-slate-50/80 dark:bg-slate-700/30 px-2 py-1 text-slate-400">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3 text-emerald-500" />
                      <span>{formatRelativeTime(device.lastSeen)}</span>
                    </span>
                    <span className="font-mono text-[10px]">{formatTimeSafe(device.lastSeen, 'HH:mm:ss')}</span>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-700 flex items-center justify-between text-xs">
                  <BatteryIndicator
                    level={device.power.batteryPercentage}
                    isCharging={device.power.isCharging}
                    voltage={device.power.batteryVoltage}
                    size="sm"
                    showLabel
                  />
                  <SignalIndicator
                    rssi={device.cellular.rssi}
                    signalQuality={device.cellular.signalQuality}
                    signalText={device.cellular.signal}
                    size="sm"
                    showText
                  />
                </div>
              </div>
            )
          })}
        </div>
      </Card>

      {/* Offline Device Modal Notification */}
      <OfflineDeviceModal
        device={offlineModalDevice}
        isOpen={Boolean(offlineModalDevice)}
        onClose={() => setOfflineModalDevice(null)}
        onProceed={() => {
          if (offlineModalDevice) {
            navigate(`/devices/${offlineModalDevice.deviceId}`)
          }
        }}
      />
    </div>
  )
}
