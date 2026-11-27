'use client'

import type { ReactNode, Ref } from 'react'
import { twMerge } from 'tailwind-merge'
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip'

const panelButtonClassName =
  'hover:bg-accent focus-visible:ring-ring inline-flex size-11 shrink-0 items-center justify-center rounded-md focus-visible:outline-none focus-visible:ring-2 disabled:pointer-events-none disabled:opacity-40 fine-pointer:size-8'

export function PanelIconButton({
  label,
  onClick,
  testId,
  disabled,
  className,
  buttonRef,
  children,
}: {
  label: string
  onClick: () => void
  testId?: string
  disabled?: boolean
  className?: string
  buttonRef?: Ref<HTMLButtonElement>
  children: ReactNode
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          ref={buttonRef}
          type="button"
          aria-label={label}
          onClick={onClick}
          disabled={disabled}
          data-cy={testId}
          className={twMerge(panelButtonClassName, className)}
        >
          {children}
        </button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}
