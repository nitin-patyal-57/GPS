import { useState, useMemo } from 'react'
import { MapContainer, TileLayer, Marker, Polyline } from 'react-leaflet'
import { divIcon } from 'leaflet'
import type { LocationHistoryEntry } from '@/types/gps'
import { MAP_LAYERS, type MapLayerType } from '@/components/map/mapLayers'
import { MapLayerSwitcher } from '@/components/map/MapLayerSwitcher'
import { Play, Pause, RotateCcw, FastForward } from 'lucide-react'

interface RouteTrackerProps {
  locations: LocationHistoryEntry[]
  height?: string
}

function createPinIcon(text: string, color: string) {
  return divIcon({
    className: '',
    html: `
      <div style="width:28px;height:28px;border-radius:50%;background:${color};color:white;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;border:2.5px solid white;box-shadow:0 3px 8px rgba(0,0,0,0.35);">
        ${text}
      </div>
    `,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  })
}

export default function RouteTracker({ locations, height = 'h-[440px]' }: RouteTrackerProps) {
  const [currentLayer, setCurrentLayer] = useState<MapLayerType>('google-streets')
  const [playbackIndex, setPlaybackIndex] = useState<number>(locations.length - 1)
  const [isPlaying, setIsPlaying] = useState<boolean>(false)

  const activeLayerConfig = MAP_LAYERS[currentLayer] || MAP_LAYERS['google-streets']

  const points: [number, number][] = useMemo(() => {
    return locations
      .filter((l) => l.latitude !== 0 && l.longitude !== 0 && !isNaN(l.latitude) && !isNaN(l.longitude))
      .map((l) => [l.latitude, l.longitude])
  }, [locations])

  const center: [number, number] = useMemo(() => {
    if (points.length === 0) return [30.657035, 76.729596]
    return points[Math.floor(points.length / 2)]
  }, [points])

  const startPoint = points[0]
  const endPoint = points[points.length - 1]
  const currentPlaybackPoint = points[playbackIndex] || endPoint

  return (
    <div className={`relative ${height} w-full overflow-hidden rounded-2xl border border-slate-200 shadow-md dark:border-slate-800`}>
      <div className="absolute top-3 right-3 z-[1000] pointer-events-auto">
        <MapLayerSwitcher currentLayer={currentLayer} onSelectLayer={setCurrentLayer} />
      </div>

      <MapContainer
        center={center}
        zoom={14}
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

        {points.length > 1 && (
          <Polyline
            positions={points}
            pathOptions={{
              color: '#3b82f6',
              weight: 5,
              opacity: 0.8,
              lineCap: 'round',
              lineJoin: 'round',
            }}
          />
        )}

        {startPoint && (
          <Marker position={startPoint} icon={createPinIcon('S', '#10b981')} />
        )}
        {endPoint && (
          <Marker position={endPoint} icon={createPinIcon('D', '#ef4444')} />
        )}

        {currentPlaybackPoint && (
          <Marker position={currentPlaybackPoint} icon={createPinIcon('📍', '#6366f1')} />
        )}
      </MapContainer>

      {/* Route Timeline Slider */}
      {points.length > 1 && (
        <div className="absolute bottom-3 left-3 right-3 z-[1000] pointer-events-none">
          <div className="pointer-events-auto mx-auto max-w-xl rounded-xl bg-slate-900/95 p-3 text-white shadow-2xl backdrop-blur-md border border-slate-700/80">
            <div className="flex items-center justify-between text-xs mb-2">
              <span className="text-slate-400">Route Playback</span>
              <span className="font-mono text-emerald-400">
                {playbackIndex + 1} / {points.length} points
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={points.length - 1}
              value={playbackIndex}
              onChange={(e) => setPlaybackIndex(Number(e.target.value))}
              className="w-full accent-emerald-500 cursor-pointer"
            />
          </div>
        </div>
      )}
    </div>
  )
}
