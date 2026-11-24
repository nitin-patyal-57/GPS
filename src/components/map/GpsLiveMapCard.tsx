import { useState, useMemo, useEffect, useRef } from 'react'
import { MapContainer, TileLayer, Marker, Polyline, useMap } from 'react-leaflet'
import {
  Compass, Satellite, Crosshair, Gauge, Activity, Battery, Radio
} from 'lucide-react'
import type { GpsDevice } from '@/types/gps'
import {
  MAP_LAYERS,
  type MapLayerType,
  createMovingVehicleMarker,
  createStationaryVehicleMarker,
} from './mapLayers'
import { MapLayerSwitcher } from './MapLayerSwitcher'
import { getHeadingDirection } from '@/utils/helpers'

interface GpsLiveMapCardProps {
  device: GpsDevice
  height?: string
}

function MapFollowController({
  targetPos,
  isFollowing,
}: {
  targetPos: [number, number]
  isFollowing: boolean
}) {
  const map = useMap()
  const lastPosRef = useRef<[number, number] | null>(null)

  useEffect(() => {
    if (!targetPos || (targetPos[0] === 0 && targetPos[1] === 0)) return

    if (!lastPosRef.current) {
      map.setView(targetPos, 16, { animate: true })
    } else if (isFollowing) {
      map.panTo(targetPos, { animate: true, duration: 0.8 })
    }
    lastPosRef.current = targetPos
  }, [targetPos, isFollowing, map])

  return null
}

export function GpsLiveMapCard({ device, height = 'h-[460px]' }: GpsLiveMapCardProps) {
  const [currentLayer, setCurrentLayer] = useState<MapLayerType>('google-streets')
  const [isFollowing, setIsFollowing] = useState<boolean>(true)
  const [trail, setTrail] = useState<[number, number][]>([])

  const hasGps = Boolean(
    device.gps &&
      device.gps.latitude !== 0 &&
      device.gps.longitude !== 0 &&
      !isNaN(device.gps.latitude) &&
      !isNaN(device.gps.longitude)
  )

  const pos: [number, number] = useMemo(() => {
    return hasGps
      ? [device.gps.latitude, device.gps.longitude]
      : [30.657035, 76.729596]
  }, [hasGps, device.gps?.latitude, device.gps?.longitude])

  const speed = device.gps?.speedKmph || 0
  const heading = device.gps?.headingDeg || 0
  const isMoving = speed > 1.5 || device.motionState === 'moving'
  const motionDetected = Boolean(device.accelerometer?.motion)

  useEffect(() => {
    if (!hasGps) return

    setTrail((prev) => {
      if (prev.length === 0) return [pos]
      const last = prev[prev.length - 1]
      const dist = Math.hypot(last[0] - pos[0], last[1] - pos[1])
      if (dist > 0.00002) {
        return [...prev.slice(-100), pos]
      }
      return prev
    })
  }, [hasGps, pos])

  const activeLayerConfig = MAP_LAYERS[currentLayer] || MAP_LAYERS['google-streets']

  const markerIcon = useMemo(() => {
    if (isMoving) {
      return createMovingVehicleMarker(heading, speed, device.deviceName)
    }
    return createStationaryVehicleMarker(device.status)
  }, [isMoving, heading, speed, device.deviceName, device.status])

  return (
    <div className={`relative ${height} w-full overflow-hidden rounded-2xl border border-slate-200/80 shadow-md dark:border-slate-800`}>
      {/* Top Floating Controls Bar */}
      <div className="absolute top-3 left-3 right-3 z-[1000] flex flex-wrap items-center justify-between gap-2 pointer-events-none">
        {/* Left: Dynamic Real-time Status */}
        <div className="pointer-events-auto flex flex-wrap items-center gap-2">
          {isMoving ? (
            <div className="flex items-center gap-2.5 rounded-xl bg-slate-900/95 px-3.5 py-2 text-xs font-bold text-white shadow-xl backdrop-blur-md border border-emerald-500/40">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-80" />
                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500" />
              </span>
              <div className="flex items-center gap-2">
                <span className="text-emerald-400 font-black tracking-wider uppercase">MOVING</span>
                <span className="text-slate-600">|</span>
                <span className="text-white font-mono text-sm font-black">
                  {speed.toFixed(1)} <span className="text-[10px] font-normal text-slate-400">km/h</span>
                </span>
                <span className="text-slate-600">|</span>
                <span className="text-slate-300 font-mono text-xs flex items-center gap-1">
                  <Compass className="h-3.5 w-3.5 text-blue-400" />
                  {Math.round(heading)}° {getHeadingDirection(heading)}
                </span>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2.5 rounded-xl bg-slate-900/95 px-3.5 py-2 text-xs font-bold text-white shadow-xl backdrop-blur-md border border-blue-500/40">
              <span className="h-3 w-3 rounded-full bg-blue-400" />
              <div className="flex items-center gap-2">
                <span className="text-blue-300 font-bold uppercase tracking-wider">PARKED / AT REST</span>
                <span className="text-slate-600">|</span>
                <span className="text-slate-300 font-mono text-xs">0.0 km/h</span>
                <span className="text-slate-600">|</span>
                <span className="text-slate-300 text-xs">
                  {device.gps?.satellites ?? 0} Sats
                </span>
              </div>
            </div>
          )}

          {/* Accelerometer Vibration Badge */}
          <div className="hidden sm:flex items-center gap-1.5 rounded-xl bg-slate-900/90 px-3 py-2 text-[11px] font-medium text-slate-300 shadow-md backdrop-blur-md border border-slate-700/60">
            <Activity className={`h-3.5 w-3.5 ${motionDetected ? 'text-emerald-400 animate-pulse' : 'text-slate-400'}`} />
            <span>{motionDetected ? 'Motion: Active' : 'Motion: Resting'}</span>
          </div>
        </div>

        {/* Right: Camera follow + Layer switch */}
        <div className="pointer-events-auto flex items-center gap-2">
          <button
            onClick={() => setIsFollowing(!isFollowing)}
            className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold shadow-xl backdrop-blur-md transition border ${
              isFollowing
                ? 'bg-emerald-600 text-white border-emerald-500'
                : 'bg-slate-900/90 text-slate-300 border-slate-700/60 hover:text-white'
            }`}
          >
            <Crosshair className={`h-3.5 w-3.5 ${isFollowing ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">{isFollowing ? 'Tracking Locked' : 'Free Camera'}</span>
          </button>
          <MapLayerSwitcher currentLayer={currentLayer} onSelectLayer={setCurrentLayer} />
        </div>
      </div>

      {/* Map Container */}
      <MapContainer
        center={pos}
        zoom={16}
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

        <MapFollowController targetPos={pos} isFollowing={isFollowing} />

        {/* Real-time breadcrumb trail */}
        {trail.length > 1 && (
          <Polyline
            positions={trail}
            pathOptions={{
              color: '#10b981',
              weight: 4,
              opacity: 0.85,
              lineCap: 'round',
              lineJoin: 'round',
            }}
          />
        )}

        {/* Vehicle Marker */}
        <Marker position={pos} icon={markerIcon} />
      </MapContainer>

      {/* Bottom Floating Telemetry Quick Bar */}
      <div className="absolute bottom-3 left-3 right-3 z-[1000] pointer-events-none">
        <div className="pointer-events-auto mx-auto max-w-2xl rounded-xl bg-slate-900/90 p-2.5 text-xs text-white shadow-xl backdrop-blur-md border border-slate-700/60 flex flex-wrap items-center justify-around gap-2">
          <div className="flex items-center gap-1.5">
            <Gauge className="h-4 w-4 text-emerald-400" />
            <span className="text-slate-400">Speed:</span>
            <span className="font-mono font-bold">{speed.toFixed(1)} km/h</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Satellite className="h-4 w-4 text-blue-400" />
            <span className="text-slate-400">Accuracy:</span>
            <span className="font-mono font-bold">{device.gps?.accuracyM ?? 0}m ({device.gps?.satellites ?? 0} Sats)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Battery className="h-4 w-4 text-emerald-400" />
            <span className="text-slate-400">Battery:</span>
            <span className="font-mono font-bold">{device.power?.batteryPercentage}% ({device.power?.batteryVoltage}V)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Radio className="h-4 w-4 text-purple-400" />
            <span className="text-slate-400">Cellular:</span>
            <span className="font-mono font-bold">{device.cellular?.signal} ({device.cellular?.operator})</span>
          </div>
        </div>
      </div>
    </div>
  )
}
