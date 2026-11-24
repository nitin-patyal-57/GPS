import { AlertCircle, RotateCcw } from 'lucide-react'
import Card from './Card'

interface ErrorStateProps {
  title?: string
  message: string
  onRetry?: () => void
}

export default function ErrorState({ title = 'Telemetry Error', message, onRetry }: ErrorStateProps) {
  return (
    <Card className="flex flex-col items-center justify-center p-8 text-center">
      <div className="rounded-full bg-red-100 p-3 text-red-600 dark:bg-red-900/30 dark:text-red-400 mb-3">
        <AlertCircle className="h-6 w-6" />
      </div>
      <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">{title}</h3>
      <p className="mt-1 text-sm text-slate-500 max-w-md">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-4 inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-xs hover:bg-emerald-700 transition"
        >
          <RotateCcw className="h-4 w-4" />
          Retry Connection
        </button>
      )}
    </Card>
  )
}
