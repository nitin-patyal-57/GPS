import { type ReactNode, type HTMLAttributes } from 'react'
import { cn } from '@/utils/helpers'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode
  className?: string
  padding?: 'none' | 'sm' | 'md' | 'lg'
  hover?: boolean
}

export default function Card({
  children,
  className,
  padding = 'md',
  hover = false,
  ...props
}: CardProps) {
  const paddings = {
    none: '',
    sm: 'p-3',
    md: 'p-4 sm:p-5',
    lg: 'p-6',
  }

  return (
    <div
      className={cn(
        'rounded-xl border border-slate-200/80 bg-white shadow-xs backdrop-blur-xs transition-all dark:border-slate-800/80 dark:bg-slate-900',
        hover && 'hover:shadow-md hover:border-slate-300 dark:hover:border-slate-700 cursor-pointer',
        paddings[padding],
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}
