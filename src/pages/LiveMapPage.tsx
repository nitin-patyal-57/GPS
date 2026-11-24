import { useState, useMemo, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { MapContainer, TileLayer, Marker, Polyline } from 'react-leaflet'
import { useGpsDevices } from '@/hooks/useGpsDevices'
import {
  MAP_LAYERS,
  type MapLayerType,
  createMovingVehicleMarker,
  createStationaryVehicleMarker,
} from '@/components/map/mapLayers'
import { MapLayerSwitcher } from '@/components/map/MapLayerSwitcher'
import Card from '@/components/ui/Card'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import { Gauge, Compass, Satellite, Navigation, Crosshair, ArrowRight } from 'lucide-react'
import { getHeadingDirection } from '@/utils/helpers'

export default function LiveMapPage() {
  const { devices, loading } = useGpsDevices()
  const navigate = useNavigate()
  const [currentLayer, setCurrentLayer] = useState<MapLayerType>('google-streets')
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null)
  const [filterMode, setFilterMode] = useState<'all' | 'moving' | 'stationary'>('all')

  const activeLayerConfig = MAP_LAYERS[currentLayer] || MAP_LAYERS['google-streets']

  const filteredDevices = useMemo(() => {
    return devices.filter((d) => {
      const isMoving = (d.gps?.speedKmph || 0) > 1.5
      if (filterMode === 'moving') return isMoving
      if (filterMode === 'stationary') return !isMoving
      return true
    })
  }, [devices, filterMode])

  const selectedDevice = useMemo(() => {
    return devices.find((d) => d.deviceId === selectedDeviceId) || devices[0]
  }, [devices, selectedDeviceId])

  const mapCenter: [number, number] = useMemo(() => {
    if (selectedDevice?.gps?.latitude && selectedDevice?.gps?.longitude) {
      return [selectedDevice.gps.latitude, selectedDevice.gps.longitude]
    }
    return [30.657035, 76.729596]
  }, [selectedDevice])

  if (loading) return <LoadingSpinner message="Opening fleet live map..." className="min-h-[70vh]" />

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
            Live Fleet Map
          </h1>
          <p className="text-xs text-slate-500">
            Real-time multi-vehicle GNSS map tracking with Google Maps satellite & traffic layers
          </p>
        </div>
        <div className="flex items-center gap-2">
          {(['all', 'moving', 'stationary'] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => setFilterMode(mode)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold capitalize transition ${
                filterMode === mode
                  ? 'bg-emerald-600 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
              }`}
            >
              {mode} ({mode === 'all' ? devices.length : mode === 'moving' ? devices.filter(d => (d.gps?.speedKmph || 0) > 1.5).length : devices.filter(d => (d.gps?.speedKmph || 0) <= 1.5).length})
            </button>
          ))}
        </div>
      </div>

      <div className="relative h-[calc(100vh-14rem)] w-full overflow-hidden rounded-2xl border border-slate-200/80 shadow-md dark:border-slate-800">
        <div className="absolute top-3 right-3 z-[1000] pointer-events-auto">
          <MapLayerSwitcher currentLayer={currentLayer} onSelectLayer={setCurrentLayer} />
        </div>

        <MapContainer
          center={mapCenter}
          zoom={15}
          scrollWheelZoom
          zoomControl={false}
          className="h-full w-full"
        >
          <TileLayer
            key={activeLayerConfig.id}
            url={activeLayerConfig.url}
            subdomains={activeLayerConfig.subdomains || []}
            maxZoom={activeLayerConfig.maxZoom}
            attribution={activeLayerConfig.attribution}
          />

          {filteredDevices.map((d) => {
            const hasCoords = d.gps?.latitude && d.gps?.longitude
            if (!hasCoords) return null

            const speed = d.gps?.speedKmph || 0
            const heading = d.gps?.headingDeg || 0
            const isMoving = speed > 1.5
            const icon = isMoving
              ? createMovingVehicleMarker(heading, speed, d.deviceName)
              : createStationaryVehicleMarker(d.status)

            return (
              <Marker
                key={d.deviceId}
                position={[d.gps.latitude, d.gps.longitude]}
                icon={icon}
                eventHandlers={{
                  click: () => setSelectedDeviceId(d.deviceId),
                }}
              />
            )
          })}
        </MapContainer>

        {/* Selected Vehicle Floating Info Card */}
        {selectedDevice && (
          <div className="absolute bottom-3 left-3 right-3 z-[1000] pointer-events-none">
            <div className="pointer-events-auto mx-auto max-w-xl rounded-2xl bg-slate-900/95 p-4 text-white shadow-2xl backdrop-blur-md border border-slate-700/80 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-sm">{selectedDevice.deviceName}</h3>
                  <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-400">
                    {(selectedDevice.gps?.speedKmph || 0) > 1.5 ? 'Moving' : 'Parked'}
                  </span>
                </div>
                <p className="font-mono text-xs text-slate-400">IMEI: {selectedDevice.deviceId}</p>
                <div className="mt-2 flex items-center gap-4 text-xs">
                  <span className="flex items-center gap-1 font-mono font-bold text-emerald-400">
                    <Gauge className="h-3.5 w-3.5" /> {(selectedDevice.gps?.speedKmph || 0).toFixed(1)} km/h
                  </span>
                  <span className="flex items-center gap-1 text-slate-300">
                    <Compass className="h-3.5 w-3.5 text-blue-400" /> {Math.round(selectedDevice.gps?.headingDeg || 0)}° ({getHeadingDirection(selectedDevice.gps?.headingDeg || 0)})
                  </span>
                  <span className="flex items-center gap-1 text-slate-300">
                    <Satellite className="h-3.5 w-3.5 text-purple-400" /> {selectedDevice.gps?.satellites ?? 0} Sats
                  </span>
                </div>
              </div>

              <button
                onClick={() => navigate(`/devices/${selectedDevice.deviceId}`)}
                className="flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-500 transition shadow-xs"
              >
                <span>Telemetry View</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
