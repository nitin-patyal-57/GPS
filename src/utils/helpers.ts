import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { format, formatDistanceToNow, isValid } from 'date-fns'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function parseDateSafe(val: string | number | undefined | null): Date | null {
  if (!val) return null
  if (typeof val === 'number') {
    const d = new Date(val)
    return isValid(d) ? d : null
  }
  const str = String(val).trim()
  if (!str) return null

  // Epoch ms or seconds string
  if (/^\d+$/.test(str)) {
    const num = Number(str)
    const ms = str.length === 10 ? num * 1000 : num
    const d = new Date(ms)
    return isValid(d) ? d : null
  }

  const d = new Date(str)
  return isValid(d) ? d : null
}

export function formatTimeSafe(
  val: string | number | undefined | null,
  pattern = 'yyyy-MM-dd HH:mm:ss',
  fallback = 'N/A'
): string {
  const d = parseDateSafe(val)
  if (!d) return fallback
  try {
    return format(d, pattern)
  } catch {
    return fallback
  }
}

export function formatRelativeTime(
  val: string | number | undefined | null,
  fallback = 'Never'
): string {
  const d = parseDateSafe(val)
  if (!d) return fallback
  try {
    const diffSec = Math.floor((Date.now() - d.getTime()) / 1000)
    if (diffSec < 10 && diffSec >= -120) return 'Just now'
    if (diffSec < 60 && diffSec >= 10) return `${diffSec}s ago`
    return formatDistanceToNow(d, { addSuffix: true })
  } catch {
    return fallback
  }
}

export function formatUptime(seconds: number): string {
  if (!seconds || seconds <= 0) return '0m'
  const d = Math.floor(seconds / 86400)
  const h = Math.floor((seconds % 86400) / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60

  if (d > 0) return `${d}d ${h}h ${m}m`
  if (h > 0) return `${h}h ${m}m ${s}s`
  return `${m}m ${s}s`
}

export function getHeadingDirection(heading: number): string {
  const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']
  const index = Math.round(((heading %= 360) < 0 ? heading + 360 : heading) / 45) % 8
  return directions[index]
}

export function calculateDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

/**
 * Checks if a device is online on MQTT (received telemetry packet within the last 15 minutes)
 */
export function isDeviceMqttOnline(lastSeen: string | number | undefined | null): boolean {
  const d = parseDateSafe(lastSeen)
  if (!d) return false
  const diffMinutes = (Date.now() - d.getTime()) / (1000 * 60)
  return diffMinutes <= 15
}
