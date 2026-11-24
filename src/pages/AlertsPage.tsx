import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useGpsAlerts } from '@/hooks/useGpsDevices'
import Card from '@/components/ui/Card'
import StatusBadge from '@/components/ui/StatusBadge'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import EmptyState from '@/components/ui/EmptyState'
import {
  AlertTriangle,
  AlertCircle,
  Info,
  CheckCircle2,
  CheckCheck,
  Bell,
  Gauge,
  Battery,
  Activity,
} from 'lucide-react'
import type { AlertSeverity } from '@/types/gps'
import { formatTimeSafe } from '@/utils/helpers'

export default function AlertsPage() {
  const navigate = useNavigate()
  const { alerts, loading, acknowledgeAlert, acknowledgeAllAlerts } = useGpsAlerts()
  const [filter, setFilter] = useState<'all' | AlertSeverity>('all')

  const unacknowledged = alerts.filter((a) => !a.acknowledged).length

  const filtered = useMemo(() => {
    if (filter === 'all') return alerts
    return alerts.filter((a) => a.severity === filter)
  }, [alerts, filter])

  if (loading) return <LoadingSpinner message="Loading telemetry alerts..." />

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
            Telemetry Alerts & Events
          </h1>
          <p className="text-xs text-slate-500">
            Real-time overspeed events, low battery notifications, and harsh driving triggers
          </p>
        </div>
        {unacknowledged > 0 && (
          <button
            onClick={acknowledgeAllAlerts}
            className="flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 transition"
          >
            <CheckCheck className="h-4 w-4" />
            Mark All as Read
          </button>
        )}
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2">
        {(['all', 'critical', 'warning', 'info'] as const).map((sev) => (
          <button
            key={sev}
            onClick={() => setFilter(sev)}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold capitalize transition ${
              filter === sev
                ? 'bg-emerald-600 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
            }`}
          >
            {sev} ({sev === 'all' ? alerts.length : alerts.filter((a) => a.severity === sev).length})
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<CheckCircle2 className="h-10 w-10 text-emerald-400" />}
          title="All Systems Operational"
          description="No active alerts matching your filter criteria."
        />
      ) : (
        <div className="space-y-3">
          {filtered.map((alert) => (
            <Card
              key={alert.id}
              className={`border-l-4 ${
                alert.severity === 'critical'
                  ? 'border-l-red-500'
                  : alert.severity === 'warning'
                  ? 'border-l-amber-500'
                  : 'border-l-blue-500'
              } ${alert.acknowledged ? 'opacity-60' : ''}`}
              padding="md"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5">
                    {alert.severity === 'critical' ? (
                      <AlertTriangle className="h-5 w-5 text-red-500" />
                    ) : alert.severity === 'warning' ? (
                      <AlertCircle className="h-5 w-5 text-amber-500" />
                    ) : (
                      <Info className="h-5 w-5 text-blue-500" />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <StatusBadge
                        label={alert.severity}
                        variant={alert.severity === 'critical' ? 'danger' : alert.severity === 'warning' ? 'warning' : 'info'}
                      />
                      <span className="font-mono text-xs text-slate-400">IMEI: {alert.deviceId}</span>
                    </div>
                    <p className="mt-1 font-semibold text-xs text-slate-900 dark:text-slate-100">
                      {alert.message}
                    </p>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      {formatTimeSafe(alert.timestamp)}
                    </p>
                  </div>
                </div>

                {!alert.acknowledged && (
                  <button
                    onClick={() => acknowledgeAlert(alert.id)}
                    className="rounded-lg border border-slate-200 px-2.5 py-1 text-[11px] font-bold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 transition"
                  >
                    Acknowledge
                  </button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
