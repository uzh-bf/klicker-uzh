import { twMerge } from 'tailwind-merge'
import type { KnowledgeResourceStatus } from '../types.js'
import {
  getStatusClassName,
  getStatusDotClassName,
  getStatusLabel,
} from '../utils.js'

interface StatusBadgeProps {
  status: KnowledgeResourceStatus
  label?: string
  className?: string
}

export function StatusBadge({ status, label, className }: StatusBadgeProps) {
  return (
    <span
      className={twMerge(
        'inline-flex items-center gap-2 whitespace-nowrap text-sm font-semibold',
        getStatusClassName(status),
        className
      )}
    >
      <span
        aria-hidden="true"
        className={twMerge(
          'size-2 rounded-full',
          getStatusDotClassName(status)
        )}
      />
      {label ?? getStatusLabel(status)}
    </span>
  )
}
