import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useGpsDevice } from '@/hooks/useGpsDevices'
import { gpsService } from '@/services/gpsService'
import { GpsLiveMapCard } from '@/components/map/GpsLiveMapCard'
import Card from '@/components/ui/Card'
import StatusBadge from '@/components/ui/StatusBadge'
import BatteryIndicator from '@/components/ui/BatteryIndicator'
import SignalIndicator from '@/components/ui/SignalIndicator'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import ErrorState from '@/components/ui/ErrorState'
import {
  ArrowLeft,
  Satellite,
  Gauge,
  Compass,
  Radio,
  Zap,
  Activity,
  Cpu,
  Clock,
  Layers,
  Sparkles,
  RefreshCw,
  Power,
} from 'lucide-react'
import { formatTimeSafe, formatRelativeTime, formatUptime, getHeadingDirection } from '@/utils/helpers'

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between text-xs py-1 border-b border-slate-100 dark:border-slate-800 last:border-none">
      <span className="text-slate-400 font-medium">{label}</span>
      <span className="font-semibold text-slate-800 dark:text-slate-200">{value}</span>
    </div>
  )
}

function AxisBar({ label, value, color }: { label: string; value: number; color: string }) {
  const pct = Math.min(100, Math.max(0, ((value + 2) / 4) * 100))
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-[11px]">
        <span className="font-mono text-slate-400">{label}:</span>
        <span className="font-mono font-bold">{value.toFixed(3)}g</span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-slate-200 dark:bg-slate-700 relative overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

export default function GpsDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { device, loading, error, refetch } = useGpsDevice(id || '')
  const [actionStatus, setActionStatus] = useState<string | null>(null)

  const handleQueryStatus = async () => {
    if (!id) return
    setActionStatus('Requesting status via MQTT...')
    const res = await gpsService.queryDeviceStatus(id)
    if (res.success) {
      setActionStatus('Status query sent! Awaiting device metrics.')
    } else {
      setActionStatus(res.error || 'Failed to send query')
    }
    setTimeout(() => setActionStatus(null), 4000)
  }

  const handleLed = async (led: 'red' | 'green' | 'blue', state: 'blink' | 'on' | 'off') => {
    if (!id) return
    setActionStatus(`Sending LED ${led.toUpperCase()} ${state}...`)
    const res = await gpsService.sendLedCommand(id, led, state, 15)
    if (res.success) {
      setActionStatus(`LED ${led.toUpperCase()} command published!`)
    } else {
      setActionStatus(res.error || 'Failed to send LED command')
    }
    setTimeout(() => setActionStatus(null), 4000)
  }

  if (loading) return <LoadingSpinner message="Loading telemetry packet..." className="min-h-[60vh]" />
  if (error || !device) return <ErrorState message={error || 'Device not found'} onRetry={refetch} />

  const isMoving = (device.gps?.speedKmph || 0) > 1.5

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="rounded-xl border border-slate-200 p-2 text-slate-500 hover:bg-slate-100 dark:border-slate-800 dark:text-slate-400 dark:hover:bg-slate-800"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
                {device.deviceName}
              </h1>
              <StatusBadge
                label={isMoving ? 'Moving' : 'Parked'}
                variant={isMoving ? 'success' : 'info'}
                pulse={isMoving}
              />
            </div>
            <div className="flex flex-wrap items-center gap-2.5 text-xs text-slate-400 mt-1">
              <span className="font-mono">IMEI: {device.deviceId} &middot; Model: {device.device.modelId}</span>
              <span className="inline-flex items-center gap-1 text-emerald-500 font-medium bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                <Clock className="h-3 w-3 animate-pulse" />
                <span>Last Telemetry: {formatRelativeTime(device.lastSeen)} ({formatTimeSafe(device.lastSeen, 'HH:mm:ss')})</span>
              </span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleQueryStatus}
            className="flex items-center gap-1.5 rounded-xl bg-slate-900 px-3 py-2 text-xs font-bold text-white hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 transition"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Query Telemetry
          </button>
        </div>
      </div>

      {actionStatus && (
        <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/30 p-2.5 text-xs font-semibold text-emerald-500">
          {actionStatus}
        </div>
      )}

      {/* Live Map Card */}
      <GpsLiveMapCard device={device} height="h-[460px]" />

      {/* Telemetry Detail Grid */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* 1. GNSS & GPS Satellite Metrics */}
        <Card padding="md">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-slate-100 flex items-center gap-2 mb-3">
            <Satellite className="h-4 w-4 text-blue-500" />
            GPS / GNSS Telemetry
          </h3>
          <div className="space-y-1">
            <InfoRow label="Fix Status" value={<span className="font-bold text-emerald-500">{device.gps.status} ({device.gps.fixType})</span>} />
            <InfoRow label="Latitude" value={`${device.gps.latitude.toFixed(6)}°`} />
            <InfoRow label="Longitude" value={`${device.gps.longitude.toFixed(6)}°`} />
            <InfoRow label="Speed" value={<span className="font-mono font-bold">{device.gps.speedKmph.toFixed(1)} km/h</span>} />
            <InfoRow label="Heading" value={`${device.gps.headingDeg}° (${getHeadingDirection(device.gps.headingDeg)})`} />
            <InfoRow label="Altitude" value={`${device.gps.altitudeM.toFixed(1)} m`} />
            <InfoRow label="Satellites Tracked" value={<span className="font-bold text-blue-400">{device.gps.satellites} Satellites</span>} />
            <InfoRow label="HDOP Precision" value={device.gps.hdop} />
            <InfoRow label="Accuracy" value={`±${device.gps.accuracyM} m`} />
            <InfoRow label="Last Fix Time" value={formatTimeSafe(device.gps.lastFix)} />
          </div>
        </Card>

        {/* 2. Cellular & RF Telemetry */}
        <Card padding="md">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-slate-100 flex items-center gap-2 mb-3">
            <Radio className="h-4 w-4 text-purple-500" />
            Cellular & Carrier Link
          </h3>
          <div className="space-y-1">
            <InfoRow label="Mobile Operator" value={<span className="font-bold text-purple-400">{device.cellular.operator}</span>} />
            <InfoRow label="Network Type" value={`${device.cellular.networkType} (Band ${device.cellular.band})`} />
            <InfoRow label="Signal Rating" value={<span className="text-emerald-400 font-bold">{device.cellular.signal}</span>} />
            <InfoRow label="RSSI / RSRP" value={`${device.cellular.rssi} dBm / ${device.cellular.rsrp} dBm`} />
            <InfoRow label="RSRQ / SINR" value={`${device.cellular.rsrq} dB / ${device.cellular.sinr} dB`} />
            <InfoRow label="Cell ID / TAC" value={`${device.cellular.cellId} / ${device.cellular.tac}`} />
            <InfoRow label="MCC / MNC" value={`${device.cellular.mcc} / ${device.cellular.mnc}`} />
            <InfoRow label="IPv4 Address" value={<span className="font-mono text-[11px]">{device.cellular.ip4}</span>} />
            <InfoRow label="IMSI" value={<span className="font-mono text-[11px]">{device.cellular.imsi}</span>} />
          </div>
        </Card>

        {/* 3. Power & Battery Management */}
        <Card padding="md">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-slate-100 flex items-center gap-2 mb-3">
            <Zap className="h-4 w-4 text-amber-500" />
            Power & Battery State
          </h3>
          <div className="space-y-1">
            <InfoRow
              label="Battery Level"
              value={
                <BatteryIndicator
                  level={device.power.batteryPercentage}
                  isCharging={device.power.isCharging}
                  size="sm"
                  showLabel
                />
              }
            />
            <InfoRow label="Battery Voltage" value={`${device.power.batteryVoltage} V (${device.power.batteryMv} mV)`} />
            <InfoRow label="Charging State" value={device.power.isCharging ? 'Charging (Active)' : 'Not Charging'} />
            <InfoRow label="USB Power Connection" value={device.power.isUsbConnected ? 'Connected (Y)' : 'Disconnected'} />
            <InfoRow label="External 12V/24V Power" value={device.power.isExternalPower ? 'Active (Y)' : 'Off'} />
            <InfoRow label="Low Battery Alert" value={device.power.isLowBattery ? <span className="text-red-500 font-bold">YES</span> : 'Normal'} />
          </div>
        </Card>

        {/* 4. Accelerometer & Driving Dynamics */}
        <Card padding="md">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-slate-100 flex items-center gap-2 mb-3">
            <Activity className="h-4 w-4 text-emerald-500" />
            3-Axis G-Force & Motion
          </h3>
          <div className="space-y-2 mb-3">
            <AxisBar label="X-Axis (Lateral Tilt)" value={device.accelerometer.xG} color="bg-blue-500" />
            <AxisBar label="Y-Axis (Pitch / Accel)" value={device.accelerometer.yG} color="bg-emerald-500" />
            <AxisBar label="Z-Axis (Vertical G)" value={device.accelerometer.zG} color="bg-purple-500" />
          </div>
          <div className="space-y-1">
            <InfoRow label="Motion State" value={device.accelerometer.motion ? 'Active Motion' : 'Stationary'} />
            <InfoRow label="Harsh Braking Events" value={device.accelerometer.harshBrakingCount} />
            <InfoRow label="Harsh Acceleration Events" value={device.accelerometer.harshAccelerationCount} />
            <InfoRow label="Sharp Turn Events" value={device.accelerometer.sharpTurnCount} />
            <InfoRow label="Crash / Impact Events" value={device.accelerometer.impactCount} />
          </div>
        </Card>

        {/* 5. Device Hardware & Diagnostics */}
        <Card padding="md">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-slate-100 flex items-center gap-2 mb-3">
            <Cpu className="h-4 w-4 text-slate-400" />
            Device Firmware & Hardware
          </h3>
          <div className="space-y-1">
            <InfoRow label="Model ID" value={device.device.modelId} />
            <InfoRow label="Hardware Version" value={device.device.hardwareVersion} />
            <InfoRow label="App Version" value={device.device.appVersion} />
            <InfoRow label="SDK Version" value={device.device.sdkVersion} />
            <InfoRow label="Boot Reason" value={device.device.bootReason} />
            <InfoRow label="Uptime" value={formatUptime(device.device.uptimeSec)} />
            <InfoRow label="RTC Synced Time" value={formatTimeSafe(device.rtc)} />
          </div>
        </Card>

        {/* 6. Diagnostic Controls */}
        <Card padding="md">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-slate-100 flex items-center gap-2 mb-3">
            <Sparkles className="h-4 w-4 text-emerald-500" />
            Device LED Diagnostics
          </h3>
          <p className="text-xs text-slate-400 mb-3">
            Send remote LED test blink commands to verify physical tracker indicators via MQTT.
          </p>
          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={() => handleLed('green', 'blink')}
              className="rounded-lg bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 py-2 text-xs font-bold hover:bg-emerald-600/30 transition"
            >
              Blink Green
            </button>
            <button
              onClick={() => handleLed('red', 'blink')}
              className="rounded-lg bg-red-600/20 text-red-400 border border-red-500/30 py-2 text-xs font-bold hover:bg-red-600/30 transition"
            >
              Blink Red
            </button>
            <button
              onClick={() => handleLed('blue', 'blink')}
              className="rounded-lg bg-blue-600/20 text-blue-400 border border-blue-500/30 py-2 text-xs font-bold hover:bg-blue-600/30 transition"
            >
              Blink Blue
            </button>
          </div>
        </Card>
      </div>
    </div>
  )
}
