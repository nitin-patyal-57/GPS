import { useState, useMemo, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useGpsDevices } from '@/hooks/useGpsDevices'
import type { GpsDevice } from '@/types/gps'
import Card from '@/components/ui/Card'
import StatusBadge from '@/components/ui/StatusBadge'
import BatteryIndicator from '@/components/ui/BatteryIndicator'
import SignalIndicator from '@/components/ui/SignalIndicator'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import ErrorState from '@/components/ui/ErrorState'
import EmptyState from '@/components/ui/EmptyState'
import AddDeviceModal from '@/components/devices/AddDeviceModal'
import {
  Search,
  LayoutGrid,
  List,
  SlidersHorizontal,
  Plus,
  Trash2,
  Cpu,
  Clock,
} from 'lucide-react'
import { getHeadingDirection, formatTimeSafe, formatRelativeTime } from '@/utils/helpers'

type FilterType = 'all' | 'moving' | 'stationary' | 'online' | 'lowBattery'

export default function GpsTrackersPage() {
  const { devices, loading, error, refetch, addDevice, deleteDevice } = useGpsDevices()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [search, setSearch] = useState(() => searchParams.get('search') || '')
  const [filter, setFilter] = useState<FilterType>('all')
  const [view, setView] = useState<'grid' | 'list'>('grid')
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [, setTick] = useState(0)

  // Auto-tick every 5 seconds to keep relative time fresh ("Just now", "5s ago", etc.)
  useEffect(() => {
    const timer = setInterval(() => setTick((t) => t + 1), 5000)
    return () => clearInterval(timer)
  }, [])

  const filtered = useMemo(() => {
    return devices.filter((d) => {
      const q = search.toLowerCase()
      const matchSearch =
        !q ||
        d.deviceId.toLowerCase().includes(q) ||
        d.deviceName.toLowerCase().includes(q) ||
        d.device.modelId.toLowerCase().includes(q) ||
        d.cellular.operator.toLowerCase().includes(q)

      const isMoving = (d.gps?.speedKmph || 0) > 1.5 || d.motionState === 'moving'
      if (!matchSearch) return false

      switch (filter) {
        case 'moving': return isMoving
        case 'stationary': return !isMoving
        case 'online': return d.status === 'online'
        case 'lowBattery': return d.power?.isLowBattery || d.power?.batteryPercentage < 20
        default: return true
      }
    })
  }, [devices, search, filter])

  const handleDelete = async (e: React.MouseEvent, device: GpsDevice) => {
    e.stopPropagation()
    const confirmDelete = window.confirm(
      `Remove tracker "${device.deviceName}" (IMEI: ${device.deviceId}) from the dashboard?`
    )
    if (!confirmDelete) return

    setDeletingId(device.deviceId)
    try {
      await deleteDevice(device.deviceId)
    } finally {
      setDeletingId(null)
    }
  }

  if (loading) return <LoadingSpinner message="Loading GPS trackers..." className="min-h-[60vh]" />
  if (error) return <ErrorState message={error} onRetry={refetch} />

  const filterButtons: { key: FilterType; label: string }[] = [
    { key: 'all', label: 'All Trackers' },
    { key: 'moving', label: 'Moving' },
    { key: 'stationary', label: 'Parked' },
    { key: 'online', label: 'Online' },
    { key: 'lowBattery', label: 'Low Battery' },
  ]

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
            GPS Trackers
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {filtered.length} active tracker device{filtered.length !== 1 ? 's' : ''} in fleet
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-bold text-white shadow-sm hover:bg-emerald-500 transition"
          >
            <Plus className="h-4 w-4" />
            <span>Add Tracker</span>
          </button>

          <div className="flex items-center gap-1 border-l border-slate-200 dark:border-slate-800 pl-2.5">
            <button
              onClick={() => setView('grid')}
              title="Grid View"
              className={`rounded-lg p-2 transition ${
                view === 'grid'
                  ? 'bg-emerald-500/20 text-emerald-500 dark:bg-emerald-500/20 dark:text-emerald-400'
                  : 'text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <LayoutGrid className="h-5 w-5" />
            </button>
            <button
              onClick={() => setView('list')}
              title="List View"
              className={`rounded-lg p-2 transition ${
                view === 'list'
                  ? 'bg-emerald-500/20 text-emerald-500 dark:bg-emerald-500/20 dark:text-emerald-400'
                  : 'text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <List className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by IMEI, Model ID, Operator..."
            className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-10 pr-4 text-xs text-slate-900 placeholder-slate-400 focus:border-emerald-500 focus:outline-none dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100"
          />
        </div>

        <div className="flex flex-wrap gap-2 w-full sm:w-auto">
          {filterButtons.map((btn) => (
            <button
              key={btn.key}
              onClick={() => setFilter(btn.key)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                filter === btn.key
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
              }`}
            >
              {btn.label}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<SlidersHorizontal className="h-10 w-10 text-slate-400" />}
          title="No Trackers Found"
          description="No GPS devices matched your search or filter criteria. You can register a new tracker anytime."
          action={
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="mt-3 flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-500 transition"
            >
              <Plus className="h-4 w-4" />
              <span>Register New Tracker</span>
            </button>
          }
        />
      ) : view === 'grid' ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((d) => {
            const speed = d.gps?.speedKmph || 0
            const heading = d.gps?.headingDeg || 0
            const isMoving = speed > 1.5

            return (
              <Card
                key={d.deviceId}
                hover
                padding="md"
                onClick={() => navigate(`/devices/${d.deviceId}`)}
                className="flex flex-col justify-between relative group cursor-pointer"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="pr-6">
                      <p className="font-bold text-slate-900 dark:text-slate-100 text-sm">
                        {d.deviceName}
                      </p>
                      <p className="font-mono text-xs text-slate-400">
                        IMEI: {d.deviceId}
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <StatusBadge
                        label={isMoving ? 'Moving' : 'Parked'}
                        variant={isMoving ? 'success' : 'info'}
                        pulse={isMoving}
                      />
                      <button
                        onClick={(e) => handleDelete(e, d)}
                        disabled={deletingId === d.deviceId}
                        title="Remove tracker"
                        className="rounded-md p-1.5 text-slate-400 opacity-60 hover:opacity-100 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40 dark:hover:text-rose-400 transition"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-lg bg-slate-50 p-2 dark:bg-slate-800">
                      <span className="text-[10px] text-slate-400 block">Speed</span>
                      <span className="font-bold font-mono text-xs text-slate-800 dark:text-slate-200">
                        {speed.toFixed(1)} km/h
                      </span>
                    </div>
                    <div className="rounded-lg bg-slate-50 p-2 dark:bg-slate-800">
                      <span className="text-[10px] text-slate-400 block">Satellites</span>
                      <span className="font-bold font-mono text-xs text-blue-500">
                        {d.gps?.satellites ?? 0}
                      </span>
                    </div>
                    <div className="rounded-lg bg-slate-50 p-2 dark:bg-slate-800">
                      <span className="text-[10px] text-slate-400 block">Heading</span>
                      <span className="font-bold font-mono text-xs text-slate-800 dark:text-slate-200">
                        {Math.round(heading)}° {getHeadingDirection(heading)}
                      </span>
                    </div>
                  </div>

                  <div className="mt-3 text-xs text-slate-500 dark:text-slate-400 space-y-1">
                    <p className="truncate">
                      <span className="font-medium text-slate-400">Coords:</span> {d.gps?.latitude?.toFixed(5)}, {d.gps?.longitude?.toFixed(5)}
                    </p>
                    <p className="truncate">
                      <span className="font-medium text-slate-400">Carrier:</span> {d.cellular.operator || 'Cellular'} ({d.cellular.networkType || 'LTE'})
                    </p>
                  </div>

                  {/* Live Timestamp & Last Packet */}
                  <div className="mt-3 flex items-center justify-between text-[11px] rounded-lg bg-slate-50/80 dark:bg-slate-800/60 px-2.5 py-1.5 border border-slate-200/60 dark:border-slate-700/60">
                    <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
                      <Clock className="h-3 w-3 text-emerald-500" />
                      <span>Last Seen:</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200">
                        {formatRelativeTime(d.lastSeen)}
                      </span>
                    </div>
                    <span className="font-mono text-[10px] text-slate-400">
                      {formatTimeSafe(d.lastSeen, 'HH:mm:ss')}
                    </span>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
                  <BatteryIndicator
                    level={d.power.batteryPercentage}
                    isCharging={d.power.isCharging}
                    voltage={d.power.batteryVoltage}
                    size="sm"
                    showLabel
                  />
                  <SignalIndicator
                    rssi={d.cellular.rssi}
                    signalQuality={d.cellular.signalQuality}
                    signalText={d.cellular.signal}
                    size="sm"
                    showText
                  />
                </div>
              </Card>
            )
          })}
        </div>
      ) : (
        <Card padding="none">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/50 dark:border-slate-800 dark:bg-slate-800/50">
                  <th className="px-4 py-3 font-bold text-slate-600 dark:text-slate-300">Tracker Device</th>
                  <th className="px-4 py-3 font-bold text-slate-600 dark:text-slate-300">Movement</th>
                  <th className="px-4 py-3 font-bold text-slate-600 dark:text-slate-300">Speed</th>
                  <th className="px-4 py-3 font-bold text-slate-600 dark:text-slate-300">GPS Fix</th>
                  <th className="px-4 py-3 font-bold text-slate-600 dark:text-slate-300">Battery</th>
                  <th className="px-4 py-3 font-bold text-slate-600 dark:text-slate-300">Network</th>
                  <th className="px-4 py-3 font-bold text-slate-600 dark:text-slate-300">Last Seen</th>
                  <th className="px-4 py-3 font-bold text-slate-600 dark:text-slate-300 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filtered.map((d) => (
                  <tr
                    key={d.deviceId}
                    onClick={() => navigate(`/devices/${d.deviceId}`)}
                    className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 cursor-pointer transition"
                  >
                    <td className="px-4 py-3">
                      <p className="font-bold text-slate-900 dark:text-slate-100">{d.deviceName}</p>
                      <p className="font-mono text-[11px] text-slate-400">IMEI: {d.deviceId}</p>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge
                        label={(d.gps?.speedKmph || 0) > 1.5 ? 'Moving' : 'Parked'}
                        variant={(d.gps?.speedKmph || 0) > 1.5 ? 'success' : 'info'}
                      />
                    </td>
                    <td className="px-4 py-3 font-mono font-bold text-slate-800 dark:text-slate-200">
                      {(d.gps?.speedKmph || 0).toFixed(1)} km/h
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                      {d.gps?.satellites ?? 0} Sats ({d.gps?.fixType ?? '3D'})
                    </td>
                    <td className="px-4 py-3">
                      <BatteryIndicator
                        level={d.power.batteryPercentage}
                        isCharging={d.power.isCharging}
                        size="sm"
                        showLabel
                      />
                    </td>
                    <td className="px-4 py-3">
                      <SignalIndicator
                        rssi={d.cellular.rssi}
                        signalQuality={d.cellular.signalQuality}
                        size="sm"
                        showText
                      />
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-semibold text-slate-800 dark:text-slate-200">
                        {formatRelativeTime(d.lastSeen)}
                      </p>
                      <p className="font-mono text-[10px] text-slate-400">
                        {formatTimeSafe(d.lastSeen, 'yyyy-MM-dd HH:mm:ss')}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={(e) => handleDelete(e, d)}
                        disabled={deletingId === d.deviceId}
                        title="Remove tracker"
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40 dark:hover:text-rose-400 transition"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Add Device Modal */}
      <AddDeviceModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onDeviceAdded={(dev) => {
          navigate(`/devices/${dev.deviceId}`)
        }}
        addDeviceFn={addDevice}
      />
    </div>
  )
}
