import { BatteryCharging, Battery, BatteryLow, BatteryMedium, BatteryFull } from 'lucide-react'
import { cn } from '@/utils/helpers'

interface BatteryIndicatorProps {
  level: number
  isCharging?: boolean
  voltage?: number
  size?: 'sm' | 'md' | 'lg'
  showLabel?: boolean
  className?: string
}

export default function BatteryIndicator({
  level,
  isCharging = false,
  voltage,
  size = 'md',
  showLabel = false,
  className,
}: BatteryIndicatorProps) {
  const getIcon = () => {
    if (isCharging) return <BatteryCharging className="h-full w-full text-emerald-500 animate-pulse" />
    if (level <= 20) return <BatteryLow className="h-full w-full text-red-500" />
    if (level <= 60) return <BatteryMedium className="h-full w-full text-amber-500" />
    if (level <= 90) return <Battery className="h-full w-full text-blue-500" />
    return <BatteryFull className="h-full w-full text-emerald-500" />
  }

  const sizes = {
    sm: 'h-4 w-4 text-xs',
    md: 'h-5 w-5 text-sm',
    lg: 'h-6 w-6 text-base',
  }

  return (
    <div className={cn('inline-flex items-center gap-1.5 font-medium', sizes[size], className)}>
      <div className={cn(sizes[size])}>{getIcon()}</div>
      {showLabel && (
        <span className="tabular-nums">
          {level}%{voltage !== undefined && <span className="text-slate-400 font-normal ml-1">({voltage.toFixed(2)}V)</span>}
        </span>
      )}
    </div>
  )
}
