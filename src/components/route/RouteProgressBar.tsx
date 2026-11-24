import { Navigation, Clock, Gauge, Compass } from 'lucide-react'
import Card from '@/components/ui/Card'

interface RouteProgressBarProps {
  totalDistance: number
  elapsedMinutes: number
  maxSpeed?: number
  avgSpeed?: number
}

export default function RouteProgressBar({
  totalDistance,
  elapsedMinutes,
  maxSpeed = 0,
  avgSpeed = 0,
}: RouteProgressBarProps) {
  const hours = Math.floor(elapsedMinutes / 60)
  const mins = elapsedMinutes % 60
  const durationStr = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`

  return (
    <Card padding="md">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-blue-500/10 p-2.5 text-blue-600 dark:text-blue-400">
            <Navigation className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400">Total Distance</p>
            <p className="text-lg font-bold text-slate-900 dark:text-slate-100">
              {totalDistance.toFixed(2)} <span className="text-xs font-normal text-slate-400">km</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-emerald-500/10 p-2.5 text-emerald-600 dark:text-emerald-400">
            <Clock className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400">Trip Duration</p>
            <p className="text-lg font-bold text-slate-900 dark:text-slate-100">{durationStr}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-purple-500/10 p-2.5 text-purple-600 dark:text-purple-400">
            <Gauge className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400">Max Speed</p>
            <p className="text-lg font-bold text-slate-900 dark:text-slate-100">
              {maxSpeed.toFixed(1)} <span className="text-xs font-normal text-slate-400">km/h</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-amber-500/10 p-2.5 text-amber-600 dark:text-amber-400">
            <Compass className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400">Avg Speed</p>
            <p className="text-lg font-bold text-slate-900 dark:text-slate-100">
              {(avgSpeed || (elapsedMinutes > 0 ? (totalDistance / (elapsedMinutes / 60)) : 0)).toFixed(1)}{' '}
              <span className="text-xs font-normal text-slate-400">km/h</span>
            </p>
          </div>
        </div>
      </div>
    </Card>
  )
}
