import { useState, useMemo, useEffect, useCallback } from 'react'
import { useGpsDevices } from '@/hooks/useGpsDevices'
import { otaService } from '@/services/otaService'
import { realtimeGpsService } from '@/services/websocket'
import type { OtaType, OtaJobRecord } from '@/types/ota'
import Card from '@/components/ui/Card'
import StatusBadge from '@/components/ui/StatusBadge'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import EmptyState from '@/components/ui/EmptyState'
import {
  UploadCloud,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Search,
  Wifi,
  WifiOff,
  Copy,
  Check,
  FileCode,
  RefreshCw,
  SlidersHorizontal,
  Layers,
  Cpu,
  ArrowRight,
  ExternalLink,
  ShieldCheck,
  Radio,
  CheckSquare,
  Square,
  Sparkles,
  Play,
  ChevronDown,
} from 'lucide-react'
import { formatRelativeTime, formatTimeSafe, parseDateSafe } from '@/utils/helpers'

type DeviceFilter = 'all' | 'online' | 'offline'
type ActiveTab = 'deploy' | 'history'

// Determines if a device is online/connected with MQTT (within last 15 minutes)
function isDeviceMqttOnline(lastSeen: string | number | undefined | null): boolean {
  const d = parseDateSafe(lastSeen)
  if (!d) return false
  const diffMinutes = (Date.now() - d.getTime()) / (1000 * 60)
  return diffMinutes <= 15
}

export default function OtaUpdatesPage() {
  const { devices, loading, refetch } = useGpsDevices()
  const [activeTab, setActiveTab] = useState<ActiveTab>('deploy')
  const [activeTestMenuJobId, setActiveTestMenuJobId] = useState<string | null>(null)

  // Search & Filter state
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<DeviceFilter>('all')

  // Multi-selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  // OTA Form Configuration
  const [otaType, setOtaType] = useState<OtaType>('APP_OTA')
  const [urlAddress, setUrlAddress] = useState('https://firmware.gw1ns.io/builds/customer_app_v1.0.3.bin')
  const [appVersion, setAppVersion] = useState('WMZ_DEV_1.0.3')
  const [sdkVersion, setSdkVersion] = useState('WM_SDK_C_261009')
  const [fileSha256, setFileSha256] = useState('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855')
  const [isComputingHash, setIsComputingHash] = useState(false)
  const [hashStatus, setHashStatus] = useState<{ message: string; success: boolean } | null>(null)

  // Deployment & ACK state
  const [isDeploying, setIsDeploying] = useState(false)
  const [deployResult, setDeployResult] = useState<{ message: string; success: boolean } | null>(null)
  const [otaJobs, setOtaJobs] = useState<OtaJobRecord[]>([])
  const [copiedPayload, setCopiedPayload] = useState(false)
  const [selectedJobForModal, setSelectedJobForModal] = useState<OtaJobRecord | null>(null)
  const [historyTypeFilter, setHistoryTypeFilter] = useState<'all' | 'APP_OTA' | 'DF_OTA'>('all')

  const appOtaCount = useMemo(() => otaJobs.filter((j) => j.otaType === 'APP_OTA').length, [otaJobs])
  const dfOtaCount = useMemo(() => otaJobs.filter((j) => j.otaType === 'DF_OTA').length, [otaJobs])
  const displayedJobs = useMemo(() => {
    if (historyTypeFilter === 'all') return otaJobs
    return otaJobs.filter((j) => j.otaType === historyTypeFilter)
  }, [otaJobs, historyTypeFilter])

  // Load existing OTA job history
  const loadJobs = useCallback(async () => {
    const list = await otaService.getOtaJobs()
    setOtaJobs(list)
  }, [])

  useEffect(() => {
    loadJobs()
  }, [loadJobs])

  // Listen for live ACKs from WebSocket (MQTT /ack topic)
  useEffect(() => {
    const unsubscribe = realtimeGpsService.subscribeToOta((data: any) => {
      console.log('[OTA Page] WebSocket Event received:', data)
      if (data.event === 'ota_ack') {
        const { jobId: ackJobId, deviceId: ackImei, payload, status: incomingStatus } = data
        const rawStatus = (payload?.status || incomingStatus || '').toUpperCase()
        const derivedStatus: OtaJobRecord['status'] =
          rawStatus === 'SUCCEEDED'
            ? 'succeeded'
            : rawStatus === 'IN_PROGRESS'
            ? 'in_progress'
            : rawStatus === 'FAILED'
            ? 'failed'
            : 'acknowledged'

        const incomingOtaType =
          payload?.ota_type === 'DF_OTA' || payload?.topic === 'DF_OTA' || data.otaType === 'DF_OTA'
            ? 'DF_OTA'
            : payload?.ota_type === 'APP_OTA' || payload?.topic === 'APP_OTA' || data.otaType === 'APP_OTA'
            ? 'APP_OTA'
            : undefined

        setOtaJobs((prev) => {
          const next = [...prev]
          for (let i = 0; i < next.length; i++) {
            // Strictly match OTA type if incoming payload specifies it!
            if (incomingOtaType && next[i].otaType !== incomingOtaType) {
              continue
            }

            const sameJob = ackJobId ? next[i].jobId.toLowerCase() === ackJobId.toLowerCase() : false
            const sameDevice = ackImei
              ? next[i].deviceId === ackImei || next[i].deviceId.endsWith(ackImei) || ackImei.endsWith(next[i].deviceId)
              : false

            let isMatch = false
            if (ackJobId && ackImei) {
              isMatch = sameJob && sameDevice
            } else if (ackJobId) {
              isMatch = sameJob
            } else if (ackImei) {
              isMatch = sameDevice
            }

            if (isMatch) {
              const currentHistory = next[i].ackHistory || []
              const newEntry = {
                status: derivedStatus,
                timestamp: new Date().toISOString(),
                payload: typeof payload === 'string' ? payload : JSON.stringify(payload),
              }
              next[i] = {
                ...next[i],
                status: derivedStatus,
                ackedAt: new Date().toISOString(),
                ackPayload: typeof payload === 'string' ? payload : JSON.stringify(payload),
                ackHistory: [...currentHistory, newEntry],
              }
              // Only update this specific targeted job!
              break
            }
          }
          return next
        })
      } else if (data.event === 'ota_dispatch' && data.record) {
        setOtaJobs((prev) => {
          const filtered = prev.filter((j) => j.id !== data.record.id)
          return [data.record, ...filtered]
        })
      }
    })

    return () => unsubscribe()
  }, [])

  // Filter devices by search and MQTT connection status
  const filteredDevices = useMemo(() => {
    return devices.filter((d) => {
      const q = search.toLowerCase()
      const matchesSearch =
        !q ||
        d.deviceId.toLowerCase().includes(q) ||
        d.deviceName.toLowerCase().includes(q) ||
        d.device.modelId.toLowerCase().includes(q)

      if (!matchesSearch) return false

      const isOnline = isDeviceMqttOnline(d.lastSeen)
      if (filter === 'online') return isOnline
      if (filter === 'offline') return !isOnline
      return true
    })
  }, [devices, search, filter])

  // Count stats
  const onlineCount = useMemo(() => {
    return devices.filter((d) => isDeviceMqttOnline(d.lastSeen)).length
  }, [devices])
  const offlineCount = devices.length - onlineCount

  // Multi-select handlers
  const toggleSelect = (deviceId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(deviceId)) next.delete(deviceId)
      else next.add(deviceId)
      return next
    })
  }

  const selectAllFiltered = () => {
    setSelectedIds(new Set(filteredDevices.map((d) => d.deviceId)))
  }

  const selectAllOnline = () => {
    const onlineIds = devices.filter((d) => isDeviceMqttOnline(d.lastSeen)).map((d) => d.deviceId)
    setSelectedIds(new Set(onlineIds))
  }

  const clearSelection = () => {
    setSelectedIds(new Set())
  }

  // Pre-fill version templates when switching OTA type
  const handleTypeChange = (type: OtaType) => {
    setOtaType(type)
    if (type === 'APP_OTA') {
      setUrlAddress('https://firmware.gw1ns.io/builds/customer_app_v1.0.3.bin')
    } else {
      setUrlAddress('https://firmware.gw1ns.io/patches/system_patch_v2.0.1.bin')
    }
  }

  // Sample payload for preview (matching user's payload template)
  const samplePayload = useMemo(() => {
    const obj: any = {
      ota_type: otaType,
      jobId: otaType === 'APP_OTA' ? 'J_APP_xxx' : 'J_DF_xxx',
      url_address: urlAddress,
    }
    if (otaType === 'APP_OTA') {
      obj.file_sha256 = fileSha256
      obj.app_v = appVersion
    } else {
      obj.sdk_v = sdkVersion
      if (appVersion.trim()) {
        obj.app_v = appVersion.trim()
      }
    }
    return JSON.stringify(obj, null, 2)
  }, [otaType, urlAddress, fileSha256, appVersion, sdkVersion])

  const copyPayloadToClipboard = () => {
    navigator.clipboard.writeText(samplePayload)
    setCopiedPayload(true)
    setTimeout(() => setCopiedPayload(false), 2000)
  }

  const handleComputeHash = async () => {
    if (!urlAddress.trim()) {
      setHashStatus({ message: 'Please enter a valid Binary URL first', success: false })
      return
    }
    setIsComputingHash(true)
    setHashStatus(null)
    try {
      const res = await otaService.computeHashFromUrl(urlAddress.trim())
      if (res.success && res.sha256) {
        setFileSha256(res.sha256)
        setHashStatus({
          message: `SHA-256 computed: ${res.sizeKb ? `${res.sizeKb} KB` : ''}`,
          success: true,
        })
      } else {
        setHashStatus({
          message: res.error || 'Failed to download binary from URL',
          success: false,
        })
      }
    } catch (err: any) {
      setHashStatus({ message: err.message || 'Compute error', success: false })
    } finally {
      setIsComputingHash(false)
    }
  }

  // Deploy OTA batch
  const handleDeployOta = async () => {
    if (selectedIds.size === 0) {
      setDeployResult({ success: false, message: 'Please select at least one target device.' })
      return
    }

    if (!urlAddress.trim()) {
      setDeployResult({ success: false, message: 'Please provide a valid firmware URL address.' })
      return
    }

    const targetVersion = otaType === 'APP_OTA' ? appVersion.trim() : sdkVersion.trim()
    if (!targetVersion) {
      setDeployResult({
        success: false,
        message: `Please provide the target ${otaType === 'APP_OTA' ? 'app version' : 'SDK version'}.`,
      })
      return
    }

    if (otaType === 'APP_OTA' && !fileSha256.trim()) {
      setDeployResult({ success: false, message: 'Please provide the file SHA-256 checksum for APP_OTA.' })
      return
    }

    setIsDeploying(true)
    setDeployResult(null)

    // Generate Job ID automatically when submit button is pressed
    const autoJobId =
      otaType === 'APP_OTA'
        ? `J_APP_${Math.floor(100 + Math.random() * 900)}`
        : `J_DF_${Math.floor(100 + Math.random() * 900)}`

    try {
      const res = await otaService.deployOta({
        deviceIds: Array.from(selectedIds),
        otaType,
        jobId: autoJobId,
        urlAddress,
        fileSha256: otaType === 'APP_OTA' ? fileSha256 : undefined,
        version: targetVersion,
        appVersion: appVersion.trim() || undefined,
        sdkVersion: sdkVersion.trim() || undefined,
      })

      if (res.success) {
        setDeployResult({
          success: true,
          message: `Successfully dispatched ${res.count} ${otaType} payloads for Job ID ${res.jobId || autoJobId}. Now monitoring for acknowledgments on /ack!`,
        })
        await loadJobs()
        // Switch to history/monitor tab after 1.5 seconds
        setTimeout(() => setActiveTab('history'), 1500)
      } else {
        setDeployResult({ success: false, message: res.error || 'Failed to dispatch OTA update.' })
      }
    } catch (err: any) {
      setDeployResult({ success: false, message: err.message || 'Error occurred while deploying OTA.' })
    } finally {
      setIsDeploying(false)
    }
  }

  const handleSimulateAck = async (
    jId: string,
    dId: string,
    status: string = 'SUCCEEDED',
    type?: OtaType
  ) => {
    await otaService.simulateAck(jId, dId, status, type)
    await loadJobs()
  }

  if (loading && devices.length === 0) {
    return <LoadingSpinner message="Loading fleet trackers for OTA management..." className="min-h-[60vh]" />
  }

  return (
    <div className="space-y-6">
      {/* Top Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 shadow-md shadow-indigo-500/20 text-white">
              <UploadCloud className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
                OTA Updates
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Batch Over-The-Air firmware and system patch deployment with real-time MQTT acknowledgment tracking
              </p>
            </div>
          </div>
        </div>

        {/* Top Tab Switcher */}
        <div className="flex items-center rounded-xl bg-slate-100 p-1 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
          <button
            onClick={() => setActiveTab('deploy')}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-bold transition ${
              activeTab === 'deploy'
                ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-900 dark:text-slate-100'
                : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            <UploadCloud className="h-4 w-4 text-emerald-500" />
            <span>Deploy Batch OTA</span>
            {selectedIds.size > 0 && (
              <span className="rounded-full bg-emerald-500/20 px-1.5 py-0.2 font-mono text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">
                {selectedIds.size}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('history')}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-bold transition ${
              activeTab === 'history'
                ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-900 dark:text-slate-100'
                : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            <Radio className="h-4 w-4 text-indigo-500" />
            <span>ACK Monitor & History</span>
            {otaJobs.length > 0 && (
              <span className="rounded-full bg-indigo-500/20 px-1.5 py-0.2 font-mono text-[10px] text-indigo-600 dark:text-indigo-400 font-bold">
                {otaJobs.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {deployResult && (
        <div
          className={`flex items-center justify-between rounded-xl p-4 text-xs font-medium border ${
            deployResult.success
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
              : 'bg-rose-500/10 border-rose-500/30 text-rose-700 dark:text-rose-300'
          }`}
        >
          <div className="flex items-center gap-2.5">
            {deployResult.success ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-500 flex-shrink-0" />
            ) : (
              <AlertTriangle className="h-4 w-4 text-rose-500 flex-shrink-0" />
            )}
            <span>{deployResult.message}</span>
          </div>
          <button
            onClick={() => setDeployResult(null)}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* TAB 1: DEPLOY OTA */}
      {activeTab === 'deploy' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* LEFT 7 COLS: Device Selection & Online/Offline Filters */}
          <div className="lg:col-span-7 space-y-4">
            <Card padding="md">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                <div>
                  <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider flex items-center gap-2">
                    <Layers className="h-4 w-4 text-emerald-500" />
                    Target Fleet Devices
                  </h2>
                  <p className="text-xs text-slate-400">
                    Select target IMEIs to receive the downlink OTA payload
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 font-mono">
                    {selectedIds.size} of {devices.length} Selected
                  </span>
                </div>
              </div>

              {/* Search & Online/Offline Filter Tabs */}
              <div className="flex flex-col sm:flex-row items-center gap-3 mb-4">
                <div className="relative flex-1 w-full">
                  <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search IMEI, Model, Name..."
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 py-1.5 pl-9 pr-3 text-xs text-slate-900 placeholder-slate-400 focus:border-emerald-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800/80 dark:text-slate-100"
                  />
                </div>

                <div className="flex items-center gap-1.5 w-full sm:w-auto">
                  <button
                    onClick={() => setFilter('all')}
                    className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                      filter === 'all'
                        ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
                    }`}
                  >
                    All ({devices.length})
                  </button>
                  <button
                    onClick={() => setFilter('online')}
                    className={`flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                      filter === 'online'
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-100 text-emerald-600 hover:bg-emerald-50 dark:bg-slate-800 dark:text-emerald-400'
                    }`}
                  >
                    <Wifi className="h-3 w-3" />
                    <span>Online ({onlineCount})</span>
                  </button>
                  <button
                    onClick={() => setFilter('offline')}
                    className={`flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                      filter === 'offline'
                        ? 'bg-slate-600 text-white'
                        : 'bg-slate-100 text-slate-500 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400'
                    }`}
                  >
                    <WifiOff className="h-3 w-3" />
                    <span>Offline ({offlineCount})</span>
                  </button>
                </div>
              </div>

              {/* Bulk Selection Actions */}
              <div className="flex flex-wrap items-center justify-between gap-2 py-2 px-3 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60 mb-3 text-xs">
                <div className="flex items-center gap-2">
                  <button
                    onClick={selectAllFiltered}
                    className="font-medium text-emerald-600 hover:text-emerald-500 dark:text-emerald-400 hover:underline"
                  >
                    Select All Filtered ({filteredDevices.length})
                  </button>
                  <span className="text-slate-300 dark:text-slate-700">&middot;</span>
                  <button
                    onClick={selectAllOnline}
                    className="font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400 hover:underline"
                  >
                    Select All Online ({onlineCount})
                  </button>
                </div>

                {selectedIds.size > 0 && (
                  <button
                    onClick={clearSelection}
                    className="font-medium text-rose-500 hover:text-rose-400 hover:underline"
                  >
                    Clear Selection
                  </button>
                )}
              </div>

              {/* Device List Table */}
              {filteredDevices.length === 0 ? (
                <EmptyState
                  icon={<SlidersHorizontal className="h-8 w-8 text-slate-400" />}
                  title="No Matching Devices"
                  description="No tracker matched your current filter criteria."
                />
              ) : (
                <div className="overflow-x-auto max-h-[500px] overflow-y-auto rounded-xl border border-slate-200/80 dark:border-slate-800">
                  <table className="w-full text-left text-xs">
                    <thead className="sticky top-0 z-10 bg-slate-100/90 dark:bg-slate-800/90 backdrop-blur-xs border-b border-slate-200 dark:border-slate-700">
                      <tr>
                        <th className="px-3 py-2.5 w-10 text-center">
                          <input
                            type="checkbox"
                            checked={
                              filteredDevices.length > 0 &&
                              filteredDevices.every((d) => selectedIds.has(d.deviceId))
                            }
                            onChange={(e) => {
                              if (e.target.checked) selectAllFiltered()
                              else clearSelection()
                            }}
                            className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 dark:border-slate-600"
                          />
                        </th>
                        <th className="px-3 py-2.5 font-bold text-slate-600 dark:text-slate-300">Device / IMEI</th>
                        <th className="px-3 py-2.5 font-bold text-slate-600 dark:text-slate-300">MQTT Link</th>
                        <th className="px-3 py-2.5 font-bold text-slate-600 dark:text-slate-300">Current Versions</th>
                        <th className="px-3 py-2.5 font-bold text-slate-600 dark:text-slate-300">Last Seen</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {filteredDevices.map((d) => {
                        const isSelected = selectedIds.has(d.deviceId)
                        const isOnline = isDeviceMqttOnline(d.lastSeen)

                        return (
                          <tr
                            key={d.deviceId}
                            onClick={() => toggleSelect(d.deviceId)}
                            className={`cursor-pointer transition ${
                              isSelected
                                ? 'bg-emerald-500/10 dark:bg-emerald-500/15'
                                : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                            }`}
                          >
                            <td className="px-3 py-2.5 text-center" onClick={(e) => e.stopPropagation()}>
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => toggleSelect(d.deviceId)}
                                className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 dark:border-slate-600 cursor-pointer"
                              />
                            </td>
                            <td className="px-3 py-2.5">
                              <p className="font-bold text-slate-900 dark:text-slate-100">{d.deviceName}</p>
                              <p className="font-mono text-[11px] text-slate-400">IMEI: {d.deviceId}</p>
                            </td>
                            <td className="px-3 py-2.5">
                              {isOnline ? (
                                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                  <span>Online (MQTT)</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 rounded-full bg-slate-200/60 dark:bg-slate-700/60 px-2 py-0.5 text-[10px] font-medium text-slate-500 dark:text-slate-400">
                                  <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
                                  <span>Offline</span>
                                </span>
                              )}
                            </td>
                            <td className="px-3 py-2.5 text-slate-500 font-mono text-[11px]">
                              <div>App: <strong className="text-slate-700 dark:text-slate-300">{d.device.appVersion || 'WMZ_DEV_1.0.2'}</strong></div>
                              <div className="text-[10px] text-slate-400">SDK: {d.device.sdkVersion || 'WM_SDK_C_261008'}</div>
                            </td>
                            <td className="px-3 py-2.5 text-slate-400 text-[11px]">
                              <p>{formatRelativeTime(d.lastSeen)}</p>
                              <p className="font-mono text-[10px] text-slate-400">{formatTimeSafe(d.lastSeen, 'HH:mm:ss')}</p>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          </div>

          {/* RIGHT 5 COLS: OTA Configuration & Payload Builder Form */}
          <div className="lg:col-span-5 space-y-4">
            <Card padding="md">
              <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider flex items-center gap-2 mb-4">
                <FileCode className="h-4 w-4 text-purple-500" />
                OTA Package Configuration
              </h2>

              {/* OTA Type Radio Cards */}
              <div className="mb-4 space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block">
                  Select OTA Firmware Type:
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => handleTypeChange('APP_OTA')}
                    className={`flex flex-col items-start p-3 rounded-xl border text-left transition ${
                      otaType === 'APP_OTA'
                        ? 'border-emerald-500 bg-emerald-500/10 text-emerald-900 dark:text-emerald-100 ring-1 ring-emerald-500'
                        : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}
                  >
                    <span className="font-bold text-xs">APP_OTA</span>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                      Customer Application Update
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleTypeChange('DF_OTA')}
                    className={`flex flex-col items-start p-3 rounded-xl border text-left transition ${
                      otaType === 'DF_OTA'
                        ? 'border-purple-500 bg-purple-500/10 text-purple-900 dark:text-purple-100 ring-1 ring-purple-500'
                        : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}
                  >
                    <span className="font-bold text-xs">DF_OTA</span>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                      System Differential Patch
                    </span>
                  </button>
                </div>
              </div>

              {/* Job ID (Auto-generated on submit) */}
              <div className="mb-3.5 flex items-center justify-between rounded-xl border border-slate-200/80 bg-slate-50/70 p-3 dark:border-slate-700/80 dark:bg-slate-800/50">
                <div>
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300">
                    <span>Job ID (<code className="text-slate-400">jobId</code>)</span>
                  </div>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                    Generated automatically when submit button is pressed
                  </p>
                </div>
                <span className="font-mono text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/20">
                  {otaType === 'APP_OTA' ? 'J_APP_xxx' : 'J_DF_xxx'} (Auto)
                </span>
              </div>

              {/* URL Address Input */}
              <div className="mb-3 space-y-1">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block">
                  Binary URL (<code className="text-slate-400">url_address</code>)
                </label>
                <input
                  type="url"
                  value={urlAddress}
                  onChange={(e) => setUrlAddress(e.target.value)}
                  placeholder="https://domain.com/firmware/customer_app.bin"
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-mono text-slate-900 focus:border-emerald-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
              </div>

              {/* Version Inputs */}
              {otaType === 'APP_OTA' ? (
                <div className="mb-3 space-y-1">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block">
                    Target App Version (<code className="text-slate-400">app_v</code>)
                  </label>
                  <input
                    type="text"
                    value={appVersion}
                    onChange={(e) => setAppVersion(e.target.value)}
                    placeholder="e.g. WMZ_DEV_1.0.3"
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-mono text-slate-900 focus:border-emerald-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  />
                </div>
              ) : (
                <>
                  <div className="mb-3 space-y-1">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block">
                      Target SDK Version (<code className="text-slate-400">sdk_v</code>)
                    </label>
                    <input
                      type="text"
                      value={sdkVersion}
                      onChange={(e) => setSdkVersion(e.target.value)}
                      placeholder="e.g. WM_SDK_C_261009"
                      className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-mono text-slate-900 focus:border-purple-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                    />
                  </div>

                  <div className="mb-3 space-y-1">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                        Target App Version (<code className="text-slate-400">app_v</code>)
                      </label>
                      <span className="text-[10px] text-purple-600 dark:text-purple-400 font-semibold">
                        Added for DFOTA
                      </span>
                    </div>
                    <input
                      type="text"
                      value={appVersion}
                      onChange={(e) => setAppVersion(e.target.value)}
                      placeholder="e.g. WMZ_DEV_1.0.3"
                      className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-mono text-slate-900 focus:border-purple-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                    />
                    <p className="text-[10px] text-slate-400">
                      Specify the application version to associate with this differential firmware patch.
                    </p>
                  </div>
                </>
              )}

              {/* File SHA-256 (Required only for APP_OTA, not DFOTA) */}
              {otaType === 'APP_OTA' && (
                <div className="mb-4 space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      File Checksum (<code className="text-slate-400">file_sha256</code>)
                    </label>
                    <button
                      type="button"
                      onClick={handleComputeHash}
                      disabled={isComputingHash}
                      className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-500 hover:text-emerald-600 dark:hover:text-emerald-400 hover:underline disabled:opacity-50 transition"
                    >
                      {isComputingHash ? (
                        <>
                          <RefreshCw className="h-3 w-3 animate-spin" />
                          Downloading & Computing...
                        </>
                      ) : (
                        <>
                          <Sparkles className="h-3 w-3" />
                          Compute SHA-256 from URL
                        </>
                      )}
                    </button>
                  </div>
                  <input
                    type="text"
                    value={fileSha256}
                    onChange={(e) => setFileSha256(e.target.value)}
                    placeholder="64-character hex SHA-256 hash"
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-mono text-slate-900 focus:border-emerald-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  />
                  {hashStatus && (
                    <p
                      className={`text-[11px] font-medium flex items-center gap-1 mt-1 ${
                        hashStatus.success ? 'text-emerald-500' : 'text-rose-500'
                      }`}
                    >
                      {hashStatus.success ? <Check className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
                      {hashStatus.message}
                    </p>
                  )}
                </div>
              )}

              {/* Live Payload Preview */}
              <div className="mb-4 rounded-xl bg-slate-950 p-3 text-slate-200 border border-slate-800">
                <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800 text-[11px]">
                  <span className="font-bold text-slate-400">MQTT Downlink Payload Template</span>
                  <button
                    type="button"
                    onClick={copyPayloadToClipboard}
                    className="flex items-center gap-1 text-emerald-400 hover:text-emerald-300 transition"
                  >
                    {copiedPayload ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                    <span>{copiedPayload ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
                <pre className="font-mono text-[11px] leading-relaxed text-emerald-400 overflow-x-auto whitespace-pre-wrap">
                  {samplePayload}
                </pre>
                <p className="mt-2 text-[10px] text-slate-500">
                  ⚡ Published to <code className="text-slate-400">soundbox_dev/&lt;IMEI&gt;/command</code> and listening for responses on <code className="text-slate-400">/ack</code>.
                </p>
              </div>

              {/* Submit / Deploy Button */}
              <button
                type="button"
                disabled={isDeploying || selectedIds.size === 0}
                onClick={handleDeployOta}
                className={`w-full py-2.5 px-4 rounded-xl text-xs font-bold text-white shadow-md transition flex items-center justify-center gap-2 ${
                  isDeploying || selectedIds.size === 0
                    ? 'bg-slate-400 cursor-not-allowed dark:bg-slate-700'
                    : 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-500/20'
                }`}
              >
                {isDeploying ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    <span>Dispatching {selectedIds.size} OTA Payloads over MQTT...</span>
                  </>
                ) : (
                  <>
                    <UploadCloud className="h-4 w-4" />
                    <span>
                      Deploy OTA to {selectedIds.size} Selected Device{selectedIds.size === 1 ? '' : 's'}
                    </span>
                  </>
                )}
              </button>
            </Card>
          </div>
        </div>
      )}

      {/* TAB 2: LIVE ACK MONITOR & HISTORY */}
      {activeTab === 'history' && (
        <div className="space-y-4">
          <Card padding="md">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
              <div>
                <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider flex items-center gap-2">
                  <Radio className="h-4 w-4 text-emerald-500" />
                  Live OTA Acknowledgment Monitor
                </h2>
                <p className="text-xs text-slate-400">
                  Real-time status of dispatched OTA packets listening for device ACKs on <code className="text-emerald-500">soundbox_dev/&lt;imei&gt;/ack</code>
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center rounded-lg bg-slate-100 p-0.5 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs">
                  <button
                    type="button"
                    onClick={() => setHistoryTypeFilter('all')}
                    className={`rounded-md px-2.5 py-1 font-semibold transition cursor-pointer ${
                      historyTypeFilter === 'all'
                        ? 'bg-white text-slate-900 shadow-2xs dark:bg-slate-700 dark:text-slate-100'
                        : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
                    }`}
                  >
                    All ({otaJobs.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setHistoryTypeFilter('APP_OTA')}
                    className={`rounded-md px-2.5 py-1 font-semibold transition flex items-center gap-1 cursor-pointer ${
                      historyTypeFilter === 'APP_OTA'
                        ? 'bg-emerald-500 text-white shadow-2xs'
                        : 'text-emerald-600 hover:text-emerald-700 dark:text-emerald-400'
                    }`}
                  >
                    <span>APP_OTA</span>
                    <span className="text-[10px] opacity-80">({appOtaCount})</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setHistoryTypeFilter('DF_OTA')}
                    className={`rounded-md px-2.5 py-1 font-semibold transition flex items-center gap-1 cursor-pointer ${
                      historyTypeFilter === 'DF_OTA'
                        ? 'bg-purple-600 text-white shadow-2xs'
                        : 'text-purple-600 hover:text-purple-700 dark:text-purple-400'
                    }`}
                  >
                    <span>DF_OTA</span>
                    <span className="text-[10px] opacity-80">({dfOtaCount})</span>
                  </button>
                </div>

                <button
                  onClick={loadJobs}
                  className="flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  <span>Refresh</span>
                </button>
              </div>
            </div>

            {otaJobs.length === 0 ? (
              <EmptyState
                icon={<UploadCloud className="h-10 w-10 text-slate-400" />}
                title="No OTA Dispatches Yet"
                description="Deploy firmware or system patch updates to devices to view real-time transmission and acknowledgment records."
                action={
                  <button
                    onClick={() => setActiveTab('deploy')}
                    className="mt-3 flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-500 transition"
                  >
                    <UploadCloud className="h-4 w-4" />
                    <span>Go to Deploy OTA</span>
                  </button>
                }
              />
            ) : (
              <div className="overflow-x-auto rounded-xl border border-slate-200/80 dark:border-slate-800">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50/50 dark:border-slate-800 dark:bg-slate-800/50">
                      <th className="px-4 py-3 font-bold text-slate-600 dark:text-slate-300">Job ID</th>
                      <th className="px-4 py-3 font-bold text-slate-600 dark:text-slate-300">Target Device (IMEI)</th>
                      <th className="px-4 py-3 font-bold text-slate-600 dark:text-slate-300">Type & Version</th>
                      <th className="px-4 py-3 font-bold text-slate-600 dark:text-slate-300">MQTT Status</th>
                      <th className="px-4 py-3 font-bold text-slate-600 dark:text-slate-300">Dispatched Time</th>
                      <th className="px-4 py-3 font-bold text-slate-600 dark:text-slate-300">ACK Response</th>
                      <th className="px-4 py-3 font-bold text-slate-600 dark:text-slate-300 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {displayedJobs.map((job) => {
                      const isSucceeded = job.status === 'succeeded'
                      const isInProgress = job.status === 'in_progress'
                      const isFailed = job.status === 'failed'
                      const isAcked = isSucceeded || isInProgress || job.status === 'acknowledged'

                      return (
                        <tr
                          key={job.id}
                          className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition"
                        >
                          <td className="px-4 py-3">
                            <span className="font-mono font-bold text-slate-900 dark:text-slate-100 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md border border-slate-200 dark:border-slate-700">
                              {job.jobId}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <p className="font-mono font-bold text-slate-800 dark:text-slate-200">{job.deviceId}</p>
                            <p className="text-[10px] text-slate-400">
                              ACK Topic: <code className="text-emerald-500 font-mono">soundbox_dev/{job.deviceId}/ack</code>
                            </p>
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`inline-block font-bold text-[10px] px-2 py-0.5 rounded-md ${
                                job.otaType === 'APP_OTA'
                                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                                  : 'bg-purple-500/10 text-purple-600 dark:text-purple-400'
                              }`}
                            >
                              {job.otaType}
                            </span>
                            <p className="font-mono text-[11px] text-slate-700 dark:text-slate-300 mt-0.5">
                              {job.otaType === 'APP_OTA' ? (
                                <>app_v: {job.appVersion || job.version}</>
                              ) : (
                                <>
                                  <span>sdk_v: {job.sdkVersion || job.version}</span>
                                  {job.appVersion && (
                                    <span className="block text-[10px] text-slate-400">app_v: {job.appVersion}</span>
                                  )}
                                </>
                              )}
                            </p>
                          </td>
                          <td className="px-4 py-3">
                            {isSucceeded ? (
                              <div className="space-y-0.5">
                                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-2.5 py-1 text-xs font-bold text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                                  <span>SUCCEEDED</span>
                                </span>
                                {job.ackHistory && job.ackHistory.length > 1 && (
                                  <p className="text-[10px] text-emerald-500/80 font-medium pl-1">
                                    ✓ IN_PROGRESS &rarr; SUCCEEDED
                                  </p>
                                )}
                              </div>
                            ) : isInProgress ? (
                              <div className="space-y-0.5">
                                <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-500/15 px-2.5 py-1 text-xs font-bold text-blue-600 dark:text-blue-400 border border-blue-500/20">
                                  <RefreshCw className="h-3.5 w-3.5 animate-spin text-blue-500" />
                                  <span>IN_PROGRESS</span>
                                </span>
                                <p className="text-[10px] text-blue-400 font-medium pl-1 animate-pulse">
                                  Downloading & Flashing...
                                </p>
                              </div>
                            ) : isFailed ? (
                              <span className="inline-flex items-center gap-1.5 rounded-full bg-red-500/15 px-2.5 py-1 text-xs font-bold text-red-600 dark:text-red-400 border border-red-500/20">
                                <AlertTriangle className="h-3.5 w-3.5 text-red-500" />
                                <span>FAILED</span>
                              </span>
                            ) : isAcked ? (
                              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-2.5 py-1 text-xs font-bold text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                                <span>ACK Received</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/15 px-2.5 py-1 text-xs font-semibold text-amber-600 dark:text-amber-400 border border-amber-500/20">
                                <Clock className="h-3.5 w-3.5 animate-spin text-amber-500" />
                                <span>Waiting for ACK</span>
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-slate-400 text-[11px]">
                            <p>{formatRelativeTime(job.sentAt)}</p>
                            <p className="font-mono text-[10px]">{formatTimeSafe(job.sentAt, 'HH:mm:ss')}</p>
                          </td>
                          <td className="px-4 py-3">
                            {job.ackPayload ? (
                              <button
                                onClick={() => setSelectedJobForModal(job)}
                                className="font-mono text-[10px] text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 px-2 py-1 rounded-md border border-emerald-500/30 transition flex items-center gap-1"
                              >
                                <Check className="h-3 w-3" />
                                <span>View Response</span>
                              </button>
                            ) : (
                              <span className="text-slate-400 text-[11px]">Pending...</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="relative inline-flex items-center justify-end gap-1">
                              <button
                                type="button"
                                onClick={() =>
                                  handleSimulateAck(
                                    job.jobId,
                                    job.deviceId,
                                    job.status === 'in_progress' ? 'SUCCEEDED' : 'IN_PROGRESS',
                                    job.otaType
                                  )
                                }
                                title={`Simulate ACK for ${job.jobId} (${
                                  job.status === 'in_progress' ? 'Send SUCCEEDED' : 'Send IN_PROGRESS'
                                })`}
                                className="rounded-lg bg-slate-100 hover:bg-emerald-500 hover:text-white dark:bg-slate-800 dark:hover:bg-emerald-600 px-2.5 py-1 text-[11px] font-bold text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 transition flex items-center gap-1 shadow-2xs cursor-pointer"
                              >
                                <Play className="h-3 w-3 text-emerald-500" />
                                <span>Test ACK</span>
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  setActiveTestMenuJobId(activeTestMenuJobId === job.id ? null : job.id)
                                }
                                title="Select specific ACK status to test"
                                className="rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 px-1.5 py-1 text-[11px] font-bold text-slate-500 border border-slate-200 dark:border-slate-700 transition cursor-pointer"
                              >
                                <ChevronDown className="h-3 w-3" />
                              </button>

                              {activeTestMenuJobId === job.id && (
                                <div className="absolute right-0 top-full mt-1 w-36 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-xl py-1 z-30 text-[11px]">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      handleSimulateAck(job.jobId, job.deviceId, 'IN_PROGRESS', job.otaType)
                                      setActiveTestMenuJobId(null)
                                    }}
                                    className="w-full text-left px-3 py-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40 flex items-center gap-1.5 font-semibold transition cursor-pointer"
                                  >
                                    <span className="h-2 w-2 rounded-full bg-blue-500" />
                                    IN_PROGRESS
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      handleSimulateAck(job.jobId, job.deviceId, 'SUCCEEDED', job.otaType)
                                      setActiveTestMenuJobId(null)
                                    }}
                                    className="w-full text-left px-3 py-1.5 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 flex items-center gap-1.5 font-semibold transition cursor-pointer"
                                  >
                                    <span className="h-2 w-2 rounded-full bg-emerald-500" />
                                    SUCCEEDED
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      handleSimulateAck(job.jobId, job.deviceId, 'FAILED', job.otaType)
                                      setActiveTestMenuJobId(null)
                                    }}
                                    className="w-full text-left px-3 py-1.5 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 flex items-center gap-1.5 font-semibold transition cursor-pointer"
                                  >
                                    <span className="h-2 w-2 rounded-full bg-rose-500" />
                                    FAILED
                                  </button>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      )}

      {/* ACK Payload Details Modal */}
      {selectedJobForModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800 mb-4">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">
                  ACK Payload &middot; Job {selectedJobForModal.jobId}
                </h3>
              </div>
              <button
                onClick={() => setSelectedJobForModal(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-lg font-bold"
              >
                &times;
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60">
                <div>
                  <span className="text-slate-400 block text-[10px]">Target Device IMEI</span>
                  <span className="font-mono font-bold">{selectedJobForModal.deviceId}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Acknowledged At</span>
                  <span className="font-mono font-bold">
                    {formatTimeSafe(selectedJobForModal.ackedAt, 'HH:mm:ss')} ({formatRelativeTime(selectedJobForModal.ackedAt)})
                  </span>
                </div>
              </div>

              {/* Interactive Test Bar inside Modal */}
              <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                  Test ACK for Job {selectedJobForModal.jobId} ({selectedJobForModal.otaType}):
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={async () => {
                      await handleSimulateAck(selectedJobForModal.jobId, selectedJobForModal.deviceId, 'IN_PROGRESS', selectedJobForModal.otaType)
                      const updated = (await otaService.getOtaJobs()).find((j) => j.id === selectedJobForModal.id)
                      if (updated) setSelectedJobForModal(updated)
                    }}
                    className="px-2 py-1 rounded-md bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 dark:text-blue-400 border border-blue-500/30 text-[10px] font-bold transition cursor-pointer"
                  >
                    + IN_PROGRESS
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      await handleSimulateAck(selectedJobForModal.jobId, selectedJobForModal.deviceId, 'SUCCEEDED', selectedJobForModal.otaType)
                      const updated = (await otaService.getOtaJobs()).find((j) => j.id === selectedJobForModal.id)
                      if (updated) setSelectedJobForModal(updated)
                    }}
                    className="px-2 py-1 rounded-md bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 text-[10px] font-bold transition cursor-pointer"
                  >
                    + SUCCEEDED
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      await handleSimulateAck(selectedJobForModal.jobId, selectedJobForModal.deviceId, 'FAILED', selectedJobForModal.otaType)
                      const updated = (await otaService.getOtaJobs()).find((j) => j.id === selectedJobForModal.id)
                      if (updated) setSelectedJobForModal(updated)
                    }}
                    className="px-2 py-1 rounded-md bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/30 text-[10px] font-bold transition cursor-pointer"
                  >
                    + FAILED
                  </button>
                </div>
              </div>

              {selectedJobForModal.ackHistory && selectedJobForModal.ackHistory.length > 0 && (
                <div>
                  <span className="text-slate-400 font-semibold block mb-1">
                    ACK Progression Timeline ({selectedJobForModal.ackHistory.length} events received):
                  </span>
                  <div className="space-y-2 mb-3">
                    {selectedJobForModal.ackHistory.map((item, idx) => (
                      <div key={idx} className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-[11px]">
                        <div className="flex items-center justify-between pb-1 mb-1 border-b border-slate-800/80">
                          <span
                            className={`font-bold uppercase ${
                              item.status === 'succeeded'
                                ? 'text-emerald-400'
                                : item.status === 'in_progress'
                                ? 'text-blue-400'
                                : item.status === 'failed'
                                ? 'text-red-400'
                                : 'text-amber-400'
                            }`}
                          >
                            Step {idx + 1}: {item.status.toUpperCase()}
                          </span>
                          <span className="font-mono text-[10px] text-slate-400">
                            {formatTimeSafe(item.timestamp, 'HH:mm:ss')} ({formatRelativeTime(item.timestamp)})
                          </span>
                        </div>
                        <pre className="font-mono text-[10px] text-emerald-400 overflow-x-auto whitespace-pre-wrap">
                          {typeof item.payload === 'string' ? item.payload : JSON.stringify(item.payload, null, 2)}
                        </pre>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <span className="text-slate-400 font-semibold block mb-1">Latest Acknowledgment JSON:</span>
                <pre className="rounded-xl bg-slate-950 p-3 font-mono text-[11px] text-emerald-400 overflow-x-auto whitespace-pre-wrap border border-slate-800">
                  {selectedJobForModal.ackPayload || 'No payload recorded'}
                </pre>
              </div>

              <div>
                <span className="text-slate-400 font-semibold block mb-1">Dispatched Downlink Payload:</span>
                <pre className="rounded-xl bg-slate-950 p-3 font-mono text-[11px] text-slate-300 overflow-x-auto whitespace-pre-wrap border border-slate-800">
                  {selectedJobForModal.payload}
                </pre>
              </div>
            </div>

            <div className="mt-5 flex justify-end">
              <button
                onClick={() => setSelectedJobForModal(null)}
                className="px-4 py-2 rounded-xl bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 text-xs font-bold hover:opacity-90 transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
