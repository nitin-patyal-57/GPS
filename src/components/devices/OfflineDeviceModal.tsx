import { X, WifiOff, AlertTriangle, Clock, Battery, MapPin, Cpu, ArrowRight } from 'lucide-react'
import type { GpsDevice } from '@/types/gps'
import { formatRelativeTime, formatTimeSafe } from '@/utils/helpers'

interface OfflineDeviceModalProps {
  device: GpsDevice | null
  isOpen: boolean
  onClose: () => void
  onProceed: () => void
}

export default function OfflineDeviceModal({
  device,
  isOpen,
  onClose,
  onProceed,
}: OfflineDeviceModalProps) {
  if (!isOpen || !device) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-md rounded-2xl border border-amber-500/30 bg-white p-6 shadow-2xl dark:border-amber-500/30 dark:bg-slate-900 transition-all sm:p-7"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Header Icon & Alert Badge */}
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-500 ring-4 ring-amber-500/10 dark:bg-amber-500/20">
            <WifiOff className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                Device is Offline
              </h2>
              <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/15 px-2 py-0.5 text-[10px] font-bold text-rose-600 dark:text-rose-400">
                <AlertTriangle className="h-3 w-3" />
                No Signal
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              This GPS tracker is currently disconnected from the AWS IoT Core MQTT broker.
            </p>
          </div>
        </div>

        {/* Device Telemetry Snapshot Card */}
        <div className="mt-5 space-y-2.5 rounded-xl border border-slate-200 bg-slate-50/80 p-3.5 dark:border-slate-800 dark:bg-slate-950/60 text-xs">
          <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800/80">
            <span className="font-medium text-slate-500 dark:text-slate-400">Device / Tracker</span>
            <span className="font-bold text-slate-900 dark:text-slate-100">{device.deviceName}</span>
          </div>

          <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800/80">
            <span className="font-medium text-slate-500 dark:text-slate-400 flex items-center gap-1">
              <Cpu className="h-3.5 w-3.5 text-slate-400" />
              IMEI
            </span>
            <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{device.deviceId}</span>
          </div>

          <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800/80">
            <span className="font-medium text-slate-500 dark:text-slate-400 flex items-center gap-1">
              <Clock className="h-3.5 w-3.5 text-amber-500" />
              Last Packet Seen
            </span>
            <div className="text-right">
              <span className="font-bold text-amber-600 dark:text-amber-400">
                {formatRelativeTime(device.lastSeen)}
              </span>
              <span className="block text-[10px] font-mono text-slate-400">
                {formatTimeSafe(device.lastSeen)}
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800/80">
            <span className="font-medium text-slate-500 dark:text-slate-400 flex items-center gap-1">
              <Battery className="h-3.5 w-3.5 text-emerald-500" />
              Last Battery Level
            </span>
            <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
              {device.power?.batteryPercentage ?? 0}% ({device.power?.batteryMv ?? 0} mV)
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="font-medium text-slate-500 dark:text-slate-400 flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5 text-blue-500" />
              Last Known Coords
            </span>
            <span className="font-mono text-[11px] text-slate-700 dark:text-slate-300">
              {device.gps?.latitude ? `${device.gps.latitude.toFixed(4)}, ${device.gps.longitude.toFixed(4)}` : 'No fix'}
            </span>
          </div>
        </div>

        {/* Info Box */}
        <div className="mt-4 rounded-xl bg-amber-500/10 p-3 text-[11px] text-amber-700 dark:text-amber-300/90 leading-relaxed border border-amber-500/20">
          <p>
            The device has not transmitted telemetry in over 15 minutes. Live tracking commands and instant ping may not respond until cellular connectivity is restored.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="mt-6 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 transition"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              onClose()
              onProceed()
            }}
            className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 transition"
          >
            <span>View Last Telemetry</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  )
}
