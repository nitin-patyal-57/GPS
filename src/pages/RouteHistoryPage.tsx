import { useState, useMemo } from 'react'
import { useGpsDevices, useLocationHistory } from '@/hooks/useGpsDevices'
import RouteTracker from '@/components/route/RouteTracker'
import RouteProgressBar from '@/components/route/RouteProgressBar'
import Card from '@/components/ui/Card'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import { Search, Navigation, Calendar } from 'lucide-react'
import { calculateDistanceKm, formatTimeSafe } from '@/utils/helpers'

export default function RouteHistoryPage() {
  const { devices, loading: devicesLoading } = useGpsDevices()
  const [selectedDevice, setSelectedDevice] = useState<string>('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [submitted, setSubmitted] = useState(false)

  const activeDeviceId = submitted && selectedDevice ? selectedDevice : devices[0]?.deviceId || ''
  const { history, loading: historyLoading } = useLocationHistory(activeDeviceId, from || undefined, to || undefined)

  const stats = useMemo(() => {
    if (history.length < 2) {
      return { totalDistance: 0, elapsedMinutes: 0, maxSpeed: 0, avgSpeed: 0 }
    }

    let totalDist = 0
    let maxSpd = 0
    for (let i = 1; i < history.length; i++) {
      totalDist += calculateDistanceKm(
        history[i - 1].latitude,
        history[i - 1].longitude,
        history[i].latitude,
        history[i].longitude
      )
      if (history[i].speed > maxSpd) maxSpd = history[i].speed
    }

    const firstTime = new Date(history[0].timestamp).getTime()
    const lastTime = new Date(history[history.length - 1].timestamp).getTime()
    const elapsedMinutes = Math.max(1, Math.round((lastTime - firstTime) / 60000))
    const avgSpeed = (totalDist / (elapsedMinutes / 60)) || 0

    return { totalDistance: totalDist, elapsedMinutes, maxSpeed: maxSpd, avgSpeed }
  }, [history])

  if (devicesLoading) return <LoadingSpinner message="Loading historical data..." />

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
          Route & Location History
        </h1>
        <p className="text-xs text-slate-500">
          Replay historical tracking paths, check speed playback, and audit coordinates
        </p>
      </div>

      {/* Filter / Device Selection */}
      <Card padding="md">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-4 items-end">
          <div>
            <label className="text-xs font-semibold text-slate-500 block mb-1">Select Tracker Device</label>
            <select
              value={selectedDevice || devices[0]?.deviceId || ''}
              onChange={(e) => setSelectedDevice(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              {devices.map((d) => (
                <option key={d.deviceId} value={d.deviceId}>
                  {d.deviceName} ({d.deviceId})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-500 block mb-1">From Timestamp</label>
            <input
              type="datetime-local"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-500 block mb-1">To Timestamp</label>
            <input
              type="datetime-local"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            />
          </div>

          <button
            onClick={() => setSubmitted(true)}
            className="flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-500 transition shadow-xs"
          >
            <Search className="h-4 w-4" />
            Query Route History
          </button>
        </div>
      </Card>

      {historyLoading ? (
        <LoadingSpinner message="Fetching historical GNSS telemetry..." />
      ) : (
        <>
          <RouteProgressBar
            totalDistance={stats.totalDistance}
            elapsedMinutes={stats.elapsedMinutes}
            maxSpeed={stats.maxSpeed}
            avgSpeed={stats.avgSpeed}
          />

          <RouteTracker locations={history} height="h-[460px]" />

          {/* Table of points */}
          <Card padding="none">
            <div className="overflow-x-auto max-h-80">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 bg-slate-50 dark:bg-slate-800/90 backdrop-blur-xs">
                  <tr className="border-b border-slate-200 dark:border-slate-700">
                    <th className="px-4 py-2.5 font-bold text-slate-500">Timestamp</th>
                    <th className="px-4 py-2.5 font-bold text-slate-500">Latitude</th>
                    <th className="px-4 py-2.5 font-bold text-slate-500">Longitude</th>
                    <th className="px-4 py-2.5 font-bold text-slate-500">Speed</th>
                    <th className="px-4 py-2.5 font-bold text-slate-500">Heading</th>
                    <th className="px-4 py-2.5 font-bold text-slate-500">Satellites</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono">
                  {history.map((pt) => (
                    <tr key={pt.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <td className="px-4 py-2 text-slate-600 dark:text-slate-400">
                        {formatTimeSafe(pt.timestamp)}
                      </td>
                      <td className="px-4 py-2">{pt.latitude.toFixed(6)}°</td>
                      <td className="px-4 py-2">{pt.longitude.toFixed(6)}°</td>
                      <td className="px-4 py-2 font-bold text-emerald-500">{pt.speed.toFixed(1)} km/h</td>
                      <td className="px-4 py-2">{Math.round(pt.heading)}°</td>
                      <td className="px-4 py-2 text-blue-400">{pt.satellites ?? 29}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </div>
  )
}
