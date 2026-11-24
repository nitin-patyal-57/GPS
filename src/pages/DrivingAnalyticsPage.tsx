import { useMemo } from 'react'
import { useGpsDevices } from '@/hooks/useGpsDevices'
import Card from '@/components/ui/Card'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import { Activity, AlertTriangle, ShieldCheck, Zap, Gauge, Compass } from 'lucide-react'

export default function DrivingAnalyticsPage() {
  const { devices, loading } = useGpsDevices()

  const aggregates = useMemo(() => {
    let harshBraking = 0
    let harshAcceleration = 0
    let sharpTurn = 0
    let impacts = 0

    devices.forEach((d) => {
      harshBraking += d.accelerometer?.harshBrakingCount || 0
      harshAcceleration += d.accelerometer?.harshAccelerationCount || 0
      sharpTurn += d.accelerometer?.sharpTurnCount || 0
      impacts += d.accelerometer?.impactCount || 0
    })

    return { harshBraking, harshAcceleration, sharpTurn, impacts }
  }, [devices])

  if (loading) return <LoadingSpinner message="Calculating driving analytics..." />

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
          Driving Dynamics & Accelerometer Analytics
        </h1>
        <p className="text-xs text-slate-500">
          3-axis inertial motion telemetry, harsh braking, acceleration and cornering audits
        </p>
      </div>

      {/* Aggregate Cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card padding="md" className="border-l-4 border-l-amber-500">
          <p className="text-xs font-semibold text-slate-400 uppercase">Harsh Braking</p>
          <p className="mt-1 text-2xl font-black text-slate-900 dark:text-slate-100">{aggregates.harshBraking}</p>
          <p className="text-[10px] text-slate-400 mt-1">Events recorded</p>
        </Card>
        <Card padding="md" className="border-l-4 border-l-blue-500">
          <p className="text-xs font-semibold text-slate-400 uppercase">Harsh Acceleration</p>
          <p className="mt-1 text-2xl font-black text-slate-900 dark:text-slate-100">{aggregates.harshAcceleration}</p>
          <p className="text-[10px] text-slate-400 mt-1">Events recorded</p>
        </Card>
        <Card padding="md" className="border-l-4 border-l-purple-500">
          <p className="text-xs font-semibold text-slate-400 uppercase">Sharp Cornering</p>
          <p className="mt-1 text-2xl font-black text-slate-900 dark:text-slate-100">{aggregates.sharpTurn}</p>
          <p className="text-[10px] text-slate-400 mt-1">Events recorded</p>
        </Card>
        <Card padding="md" className="border-l-4 border-l-red-500">
          <p className="text-xs font-semibold text-slate-400 uppercase">Crash / Impact Shock</p>
          <p className="mt-1 text-2xl font-black text-slate-900 dark:text-slate-100">{aggregates.impacts}</p>
          <p className="text-[10px] text-slate-400 mt-1">Events recorded</p>
        </Card>
      </div>

      {/* Per-device Breakdown */}
      <Card padding="md">
        <h2 className="text-sm font-bold uppercase tracking-wider text-slate-900 dark:text-slate-100 flex items-center gap-2 mb-4">
          <Activity className="h-4 w-4 text-emerald-500" />
          Per-Tracker Inertial Dynamics
        </h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {devices.map((d) => (
            <div key={d.deviceId} className="rounded-xl border border-slate-200 p-4 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="font-bold text-sm text-slate-900 dark:text-slate-100">{d.deviceName}</p>
                  <p className="font-mono text-[11px] text-slate-400">IMEI: {d.deviceId}</p>
                </div>
                <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-xs font-bold text-emerald-400">
                  Score: {d.accelerometer.drivingScore || 100}
                </span>
              </div>

              <div className="space-y-2 font-mono text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-400">X-Axis (Lateral):</span>
                  <span>{d.accelerometer.xG.toFixed(3)}g</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Y-Axis (Pitch):</span>
                  <span>{d.accelerometer.yG.toFixed(3)}g</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Z-Axis (Vertical):</span>
                  <span>{d.accelerometer.zG.toFixed(3)}g</span>
                </div>
                <div className="flex justify-between pt-2 border-t border-slate-200 dark:border-slate-700">
                  <span className="text-slate-400">Motion Sensor:</span>
                  <span className={d.accelerometer.motion ? 'text-emerald-400 font-bold' : 'text-slate-400'}>
                    {d.accelerometer.motion ? 'ACTIVE' : 'RESTING'}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}
