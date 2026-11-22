'use client'

import { ExternalLink } from 'lucide-react'
import { useParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { twMerge } from 'tailwind-merge'
import { useEmbedded } from '../hooks/useEmbedded'
import { useFramed } from '../hooks/useFramed'
import { authedFetch } from '../lib/client/authedFetch'
import { useChatStore } from '../stores/chatStore'
import { toolbarIconButtonClassName } from './ui/toolbar-icon-button'
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip'

/**
 * Opens the current chatbot and thread in a new browser tab when the chat runs
 * inside a host frame, such as an LMS course page.
 *
 * The frame's session is partitioned to the host site, so a plain link would
 * open logged out. The control asks the server for a short-lived handoff URL
 * that sets up the same identity as a first-party session in the new tab.
 *
 * The `?embed=1` layout gets no control: its hosts, such as the PWA chat
 * drawer, already offer their own link to the full chat.
 */
export function OpenInNewTabButton({ className }: { className?: string }) {
  const t = useTranslations()
  const framed = useFramed()
  const embedded = useEmbedded()
  const { chatbotId } = useParams<{ chatbotId?: string }>()
  const activeThreadId = useChatStore((state) => state.activeThreadId)
  const [failed, setFailed] = useState(false)

  if (!framed || embedded || !chatbotId) return null

  const open = async () => {
    setFailed(false)
    // Open the tab synchronously, inside the click, so pop-up blockers accept
    // it; the handoff URL arrives after the request below.
    const tab = window.open('', '_blank')
    if (!tab) {
      setFailed(true)
      return
    }
    tab.opener = null

    try {
      const response = await authedFetch(`/api/chatbots/${chatbotId}/handoff`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          activeThreadId ? { threadId: activeThreadId } : {}
        ),
      })
      if (!response.ok) throw new Error(`Handoff failed: ${response.status}`)
      const { url } = (await response.json()) as { url: string }
      tab.location.href = new URL(url, window.location.origin).toString()
    } catch {
      tab.close()
      setFailed(true)
    }
  }

  const label = t('chat.openInNewTab.label')

  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            data-cy="chat-open-in-new-tab"
            onClick={open}
            className={twMerge(toolbarIconButtonClassName, className)}
          >
            <ExternalLink aria-hidden="true" className="size-4" />
            <span className="sr-only">{label}</span>
          </button>
        </TooltipTrigger>
        <TooltipContent>
          {failed ? t('chat.openInNewTab.failed') : label}
        </TooltipContent>
      </Tooltip>
      <span role="status" className="sr-only">
        {failed ? t('chat.openInNewTab.failed') : ''}
      </span>
    </>
  )
}
