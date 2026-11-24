import { divIcon } from 'leaflet'

export type MapLayerType =
  | 'google-streets'
  | 'google-hybrid'
  | 'google-satellite'
  | 'google-traffic'
  | 'google-terrain'
  | 'dark'
  | 'osm'

export interface MapLayerConfig {
  id: MapLayerType
  name: string
  shortName: string
  icon: string
  url: string
  subdomains?: string[]
  maxZoom: number
  attribution: string
}

export const MAP_LAYERS: Record<MapLayerType, MapLayerConfig> = {
  'google-streets': {
    id: 'google-streets',
    name: 'Google Maps (Streets)',
    shortName: 'Google Streets',
    icon: '🗺️',
    url: 'https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}',
    subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
    maxZoom: 20,
    attribution: '&copy; <a href="https://maps.google.com" target="_blank" rel="noopener">Google Maps</a>',
  },
  'google-hybrid': {
    id: 'google-hybrid',
    name: 'Google Hybrid (Satellite + Roads)',
    shortName: 'Google Hybrid',
    icon: '🌍',
    url: 'https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}',
    subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
    maxZoom: 20,
    attribution: '&copy; <a href="https://maps.google.com" target="_blank" rel="noopener">Google Maps</a>',
  },
  'google-satellite': {
    id: 'google-satellite',
    name: 'Google Satellite Imagery',
    shortName: 'Satellite',
    icon: '🛰️',
    url: 'https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}',
    subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
    maxZoom: 20,
    attribution: '&copy; <a href="https://maps.google.com" target="_blank" rel="noopener">Google Maps</a>',
  },
  'google-traffic': {
    id: 'google-traffic',
    name: 'Google Live Traffic',
    shortName: 'Traffic',
    icon: '🚦',
    url: 'https://mt1.google.com/vt/lyrs=m,traffic&x={x}&y={y}&z={z}',
    subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
    maxZoom: 20,
    attribution: '&copy; <a href="https://maps.google.com" target="_blank" rel="noopener">Google Maps Traffic</a>',
  },
  'google-terrain': {
    id: 'google-terrain',
    name: 'Google Terrain',
    shortName: 'Terrain',
    icon: '⛰️',
    url: 'https://mt1.google.com/vt/lyrs=p&x={x}&y={y}&z={z}',
    subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
    maxZoom: 20,
    attribution: '&copy; <a href="https://maps.google.com" target="_blank" rel="noopener">Google Maps</a>',
  },
  'dark': {
    id: 'dark',
    name: 'Dark Matter (Night View)',
    shortName: 'Dark Mode',
    icon: '🌙',
    url: 'https://cartodb-basemaps-a.global.ssl.fastly.net/dark_all/{z}/{x}/{y}.png',
    maxZoom: 19,
    attribution: '&copy; <a href="https://carto.com/">CARTO</a>',
  },
  'osm': {
    id: 'osm',
    name: 'OpenStreetMap',
    shortName: 'OSM',
    icon: '🌐',
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  },
}

/**
 * Creates dynamic moving vehicle marker oriented in real-time according to heading degrees
 */
export function createMovingVehicleMarker(heading: number, speed: number, deviceName = 'Vehicle') {
  const rotation = Math.round(heading || 0)
  const speedLabel = `${speed.toFixed(1)} km/h`

  return divIcon({
    className: 'custom-moving-vehicle-marker',
    html: `
      <div style="position:relative; width:52px; height:52px; display:flex; align-items:center; justify-content:center;">
        <div class="moving-radar-ring"></div>
        <div class="vehicle-heading-arrow" style="transform: rotate(${rotation}deg); width:40px; height:40px; border-radius:50%; background:linear-gradient(135deg, #10b981 0%, #059669 100%); border:3px solid #ffffff; box-shadow:0 4px 14px rgba(16, 185, 129, 0.6); display:flex; align-items:center; justify-content:center; z-index:2;">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polygon points="12 2 19 21 12 17 5 21 12 2"/>
          </svg>
        </div>
        <div style="position:absolute; top:-20px; left:50%; transform:translateX(-50%); background:#0f172a; color:#a7f3d0; font-weight:800; font-size:10px; padding:2px 7px; border-radius:9999px; border:1px solid #10b981; white-space:nowrap; box-shadow:0 2px 8px rgba(0,0,0,0.5); z-index:4;">
          🚗 ${speedLabel}
        </div>
      </div>
    `,
    iconSize: [52, 52],
    iconAnchor: [26, 26],
    popupAnchor: [0, -26],
  })
}

/**
 * Creates stationary/parked vehicle marker
 */
export function createStationaryVehicleMarker(status = 'online') {
  const bg = status === 'offline' ? '#ef4444' : '#3b82f6'
  return divIcon({
    className: 'custom-parked-vehicle-marker',
    html: `
      <div style="position:relative; width:44px; height:44px; display:flex; align-items:center; justify-content:center;">
        <div class="parked-radar-ring"></div>
        <div style="width:34px; height:34px; border-radius:50%; background:${bg}; border:3px solid #ffffff; box-shadow:0 3px 10px rgba(0,0,0,0.3); display:flex; align-items:center; justify-content:center; z-index:2;">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/>
            <circle cx="7" cy="17" r="2"/>
            <circle cx="17" cy="17" r="2"/>
          </svg>
        </div>
        <div style="position:absolute; top:-16px; left:50%; transform:translateX(-50%); background:#0f172a; color:#93c5fd; font-weight:700; font-size:9.5px; padding:1.5px 6px; border-radius:9999px; border:1px solid #3b82f6; white-space:nowrap; z-index:3;">
          PARKED
        </div>
      </div>
    `,
    iconSize: [44, 44],
    iconAnchor: [22, 22],
    popupAnchor: [0, -22],
  })
}
