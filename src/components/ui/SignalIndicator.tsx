import { cn } from '@/utils/helpers'

interface SignalIndicatorProps {
  rssi?: number
  signalQuality?: number // 1 to 5
  signalText?: string   // EXCELLENT, GOOD, FAIR, POOR
  size?: 'sm' | 'md'
  showText?: boolean
  className?: string
}

export default function SignalIndicator({
  rssi,
  signalQuality = 4,
  signalText,
  size = 'md',
  showText = false,
  className,
}: SignalIndicatorProps) {
  // Normalize bars 1-4
  const bars = Math.min(4, Math.max(1, Math.round((signalQuality / 5) * 4)))

  const heights = {
    sm: ['h-1', 'h-2', 'h-3', 'h-4'],
    md: ['h-1.5', 'h-2.5', 'h-3.5', 'h-5'],
  }

  return (
    <div className={cn('inline-flex items-center gap-1.5', className)}>
      <div className="flex items-end gap-0.5" title={`RSSI: ${rssi ?? 'N/A'}, Quality: ${signalQuality}/5`}>
        {[0, 1, 2, 3].map((idx) => {
          const active = idx < bars
          const isHigh = idx >= 2
          return (
            <div
              key={idx}
              className={cn(
                'w-1 rounded-xs transition-colors',
                heights[size][idx],
                active
                  ? isHigh
                    ? 'bg-emerald-500'
                    : 'bg-blue-500'
                  : 'bg-slate-300 dark:bg-slate-700'
              )}
            />
          )
        })}
      </div>
      {showText && (
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400">
          {signalText || `${signalQuality}/5`}
        </span>
      )}
    </div>
  )
}
