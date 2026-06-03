import React, { type ReactNode } from 'react'
import { twMerge } from 'tailwind-merge'

interface AdaptiveMetricCardProps {
  label: string
  value: ReactNode
  detail?: ReactNode
  icon?: ReactNode
  accentClassName?: string
  className?: string
}

function AdaptiveMetricCard({
  label,
  value,
  detail,
  icon,
  accentClassName = 'bg-primary-20',
  className,
}: AdaptiveMetricCardProps) {
  return (
    <div
      className={twMerge(
        'flex items-center gap-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm',
        className
      )}
    >
      <div
        className={twMerge(
          'flex h-12 w-12 items-center justify-center rounded-md text-lg',
          accentClassName
        )}
      >
        {icon}
      </div>
      <div className="min-w-0">
        <div className="text-2xl font-bold text-slate-900">{value}</div>
        <div className="text-sm text-slate-600">{label}</div>
        {detail && <div className="mt-1 text-xs text-slate-500">{detail}</div>}
      </div>
    </div>
  )
}

export default AdaptiveMetricCard
