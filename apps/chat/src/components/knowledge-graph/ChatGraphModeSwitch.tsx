'use client'

import { Network } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { twMerge } from 'tailwind-merge'
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip'

export function ChatGraphModeSwitch({
  open,
  onToggle,
}: {
  open: boolean
  onToggle: () => void
}) {
  const t = useTranslations('chat.graphPanel')
  const label = t(open ? 'close' : 'open')
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={label}
          aria-expanded={open}
          aria-controls="chat-knowledge-graph-panel"
          onClick={onToggle}
          data-cy="knowledge-graph-mode-link"
          className={twMerge(
            'text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:ring-ring inline-flex size-11 shrink-0 items-center justify-center rounded-full touch-manipulation focus-visible:outline-none focus-visible:ring-2 fine-pointer:size-8',
            open && 'bg-primary/10 text-primary'
          )}
        >
          <Network aria-hidden="true" className="size-4" />
        </button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}
