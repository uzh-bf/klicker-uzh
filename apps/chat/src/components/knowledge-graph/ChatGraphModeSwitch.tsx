'use client'

import { MessagesSquare, Network } from 'lucide-react'
import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { twMerge } from 'tailwind-merge'

export function ChatGraphModeSwitch({
  chatbotId,
  className,
  compact = false,
}: {
  chatbotId: string
  className?: string
  compact?: boolean
}) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const embedValue = searchParams.get('embed')
  const embedSuffix =
    embedValue === 'true' || embedValue === '1' ? '?embed=true' : ''
  const chatPath = `/${chatbotId}`
  const graphPath = `/${chatbotId}/graph`
  const isGraphMode = pathname === graphPath

  return (
    <nav
      aria-label="Chatbot workspace"
      className={twMerge(
        'grid grid-cols-2 rounded-full border border-[#E9E9E9] bg-[#FAFAFA] p-1 text-sm font-semibold',
        compact && 'text-xs',
        className
      )}
      data-cy="chat-graph-mode-switch"
    >
      <Link
        href={`${chatPath}${embedSuffix}`}
        aria-current={isGraphMode ? undefined : 'page'}
        className={twMerge(
          'flex min-h-11 items-center justify-center gap-2 rounded-full px-3 text-[#4C4C4C] transition-colors hover:text-[#0028A5] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0028A5] focus-visible:ring-offset-2',
          compact && 'gap-1 px-2',
          !isGraphMode && 'bg-[#0028A5] text-white hover:text-white'
        )}
        data-cy="chat-mode-link"
      >
        <MessagesSquare
          aria-hidden="true"
          className={twMerge('size-4', compact && 'hidden')}
        />
        <span>Chat</span>
      </Link>
      <Link
        href={`${graphPath}${embedSuffix}`}
        aria-current={isGraphMode ? 'page' : undefined}
        className={twMerge(
          'flex min-h-11 items-center justify-center gap-2 rounded-full px-3 text-[#4C4C4C] transition-colors hover:text-[#0028A5] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0028A5] focus-visible:ring-offset-2',
          compact && 'gap-1 px-2',
          isGraphMode && 'bg-[#0028A5] text-white hover:text-white'
        )}
        data-cy="knowledge-graph-mode-link"
      >
        <Network
          aria-hidden="true"
          className={twMerge('size-4', compact && 'hidden')}
        />
        <span>Knowledge graph</span>
      </Link>
    </nav>
  )
}
