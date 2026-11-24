import { Loader2 } from 'lucide-react'
import { cn } from '@/utils/helpers'

interface LoadingSpinnerProps {
  message?: string
  className?: string
}

export default function LoadingSpinner({ message = 'Loading GPS telemetry...', className }: LoadingSpinnerProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center p-8 text-center', className)}>
      <Loader2 className="h-8 w-8 animate-spin text-emerald-500 mb-3" />
      <p className="text-sm font-medium text-slate-600 dark:text-slate-400">{message}</p>
    </div>
  )
}
