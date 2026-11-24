import { useMemo } from 'react'
import { useGpsDevices } from '@/hooks/useGpsDevices'
import Card from '@/components/ui/Card'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import BatteryIndicator from '@/components/ui/BatteryIndicator'
import { Battery, Zap, Clock, ShieldCheck, Plug } from 'lucide-react'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts'

export default function BatteryPowerPage() {
  const { devices, loading } = useGpsDevices()

  const dummyCurve = useMemo(() => {
    const data = []
    let val = 100
    for (let i = 24; i >= 0; i--) {
      val = Math.max(70, val - (0.4 + Math.random() * 0.5))
      data.push({
        hour: `${i}h ago`,
        level: Math.round(val),
        voltage: parseFloat((3.7 + (val / 100) * 0.52).toFixed(2)),
      })
    }
    return data
  }, [])

  if (loading) return <LoadingSpinner message="Analyzing power & battery profiles..." />

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
          Battery & Power Telemetry
        </h1>
        <p className="text-xs text-slate-500">
          Power supply management, internal lithium voltage ($mV \to V$), USB charging, and external 12V/24V line
        </p>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {devices.map((d) => (
          <Card key={d.deviceId} padding="md">
            <div className="flex items-center justify-between mb-2">
              <span className="font-bold text-sm">{d.deviceName}</span>
              <BatteryIndicator
                level={d.power.batteryPercentage}
                isCharging={d.power.isCharging}
                size="sm"
              />
            </div>
            <p className="text-2xl font-black text-slate-900 dark:text-slate-100">
              {d.power.batteryPercentage}%
            </p>
            <div className="mt-2 space-y-1 text-xs text-slate-500 font-mono">
              <p>Voltage: {d.power.batteryVoltage} V ({d.power.batteryMv} mV)</p>
              <p>Charging: {d.power.isCharging ? 'YES (Active)' : 'NO'}</p>
              <p>USB Line: {d.power.isUsbConnected ? 'Connected' : 'Unplugged'}</p>
              <p>Ext Power: {d.power.isExternalPower ? 'Active (12V/24V)' : 'None'}</p>
            </div>
          </Card>
        ))}
      </div>

      {/* Discharge Curve */}
      <Card padding="md">
        <h3 className="text-sm font-bold uppercase tracking-wider text-slate-900 dark:text-slate-100 flex items-center gap-2 mb-4">
          <Zap className="h-4 w-4 text-emerald-500" />
          Battery Level & Discharge Curve (Past 24 Hours)
        </h3>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={dummyCurve}>
              <defs>
                <linearGradient id="batteryGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} />
              <XAxis dataKey="hour" tick={{ fontSize: 11, fill: '#94a3b8' }} />
              <YAxis domain={[50, 100]} tick={{ fontSize: 11, fill: '#94a3b8' }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#0f172a',
                  border: '1px solid #334155',
                  borderRadius: '8px',
                  color: '#f8fafc',
                  fontSize: '12px',
                }}
              />
              <ReferenceLine y={20} stroke="#ef4444" strokeDasharray="4 4" label="Low Battery" />
              <Area type="monotone" dataKey="level" stroke="#10b981" fill="url(#batteryGrad)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </div>
  )
}
