import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { format, formatDistanceToNow, isValid } from 'date-fns'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatTimeSafe(val: string | undefined | null, pattern = 'yyyy-MM-dd HH:mm:ss', fallback = 'N/A'): string {
  if (!val) return fallback
  const d = new Date(val)
  if (!isValid(d)) return fallback
  try {
    return format(d, pattern)
  } catch {
    return fallback
  }
}

export function formatRelativeTime(val: string | undefined | null, fallback = 'Never'): string {
  if (!val) return fallback
  const d = new Date(val)
  if (!isValid(d)) return fallback
  try {
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
