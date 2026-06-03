import React from 'react'
import { twMerge } from 'tailwind-merge'
import { getLevelColor, shortLevelLabel } from './utils'

interface LevelBadgeProps {
  label?: string | null
  index?: number
  className?: string
}

function LevelBadge({ label, index, className }: LevelBadgeProps) {
  const color = getLevelColor(label, index)

  return (
    <span
      className={twMerge(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-sm font-semibold',
        color.bg,
        color.text,
        className
      )}
    >
      <span
        className="flex h-5 w-5 items-center justify-center rounded-full text-xs text-white"
        style={{ backgroundColor: color.fill }}
      >
        {shortLevelLabel(label)}
      </span>
      {label ?? 'Unstarted'}
    </span>
  )
}

export default LevelBadge
