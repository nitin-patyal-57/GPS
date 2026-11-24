import { type ReactNode } from 'react'
import Card from './Card'

interface EmptyStateProps {
  icon: ReactNode
  title: string
  description: string
  action?: ReactNode
}

export default function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <Card className="flex flex-col items-center justify-center p-12 text-center">
      <div className="rounded-2xl bg-slate-100 p-4 text-slate-400 dark:bg-slate-800 dark:text-slate-500 mb-3">
        {icon}
      </div>
      <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">{title}</h3>
      <p className="mt-1 text-sm text-slate-500 max-w-sm">{description}</p>
      {action && <div className="mt-4">{action}</div>}
    </Card>
  )
}
