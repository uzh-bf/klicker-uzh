'use client'

import { useAui } from '@assistant-ui/react'
import type { KnowledgeGraphAskSelection } from '@klicker-uzh/shared-components/src/knowledgeGraph/knowledgeGraphView'
import { Maximize2, Minimize2, X } from 'lucide-react'
import { usePathname } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { type ReactNode, useEffect, useRef, useState } from 'react'
import { twMerge } from 'tailwind-merge'
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip'
import { ChatKnowledgeGraphWorkspace } from './ChatKnowledgeGraphWorkspace'

export function useChatGraphPanel(chatbotId: string, enabled: boolean) {
  const pathname = usePathname()
  const [open, setOpen] = useState(pathname === `/${chatbotId}/graph`)
  return {
    open: enabled && open,
    toggle: () => setOpen((value) => !value),
    close: () => setOpen(false),
  }
}

export function ChatKnowledgeGraphPanel({
  chatbotId,
  open,
  onClose,
  children,
}: {
  chatbotId: string
  open: boolean
  onClose: () => void
  children: ReactNode
}) {
  const t = useTranslations('chat.graphPanel')
  const aui = useAui()
  const [fullscreen, setFullscreen] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)
  const expandRef = useRef<HTMLButtonElement>(null)
  const focusComposerRef = useRef(false)
  const previousOpen = useRef(open)

  useEffect(() => {
    if (!open) setFullscreen(false)
    if (previousOpen.current && !open && !focusComposerRef.current) {
      document
        .querySelector<HTMLButtonElement>(
          '[data-cy="knowledge-graph-mode-link"]'
        )
        ?.focus()
    }
    previousOpen.current = open
  }, [open])

  useEffect(() => {
    if (!fullscreen || !open || !panelRef.current) return
    const changed: HTMLElement[] = []
    let element: HTMLElement | null = panelRef.current
    // Inert siblings at each ancestor keep both embedded and standalone
    // background controls out of the fullscreen focus order.
    while (element?.parentElement) {
      for (const sibling of Array.from(element.parentElement.children)) {
        if (
          sibling !== element &&
          sibling instanceof HTMLElement &&
          !sibling.inert
        ) {
          sibling.inert = true
          changed.push(sibling)
        }
      }
      element = element.parentElement
      if (element === document.body) break
    }
    expandRef.current?.focus()
    return () => {
      changed.forEach((element) => {
        element.inert = false
      })
    }
  }, [fullscreen, open])

  useEffect(() => {
    if (!focusComposerRef.current || (fullscreen && open)) return
    focusComposerRef.current = false
    document
      .querySelector<HTMLTextAreaElement>('[data-cy="chat-composer-input"]')
      ?.focus()
  }, [fullscreen, open])

  function ask(selection: KnowledgeGraphAskSelection) {
    const prompt =
      selection.kind === 'node'
        ? t('nodePrompt', { topic: selection.label })
        : t('edgePrompt', {
            source: selection.source,
            target: selection.target,
            relationship: selection.label,
          })
    const text = aui.composer.getState().text
    aui.composer.setText(text.trim() ? `${text}\n\n${prompt}` : prompt)
    focusComposerRef.current = true
    setFullscreen(false)
    if (window.matchMedia('(max-width: 1023px)').matches) onClose()
    // A docked desktop action has no state transition to trigger the effect.
    if (!fullscreen && window.matchMedia('(min-width: 1024px)').matches) {
      focusComposerRef.current = false
      document
        .querySelector<HTMLTextAreaElement>('[data-cy="chat-composer-input"]')
        ?.focus()
    }
  }

  return (
    <div
      className="relative flex min-h-0 flex-1 flex-col lg:flex-row"
      data-cy="chat-graph-layout"
    >
      <div
        className="relative flex min-h-0 min-w-0 flex-1 flex-col"
        data-cy="chat-conversation-pane"
      >
        {children}
      </div>
      {open ? (
        <div
          id="chat-knowledge-graph-panel"
          ref={panelRef}
          {...(fullscreen
            ? { role: 'dialog', 'aria-modal': true as const }
            : { role: 'region' })}
          aria-label={t('title')}
          data-cy="chat-knowledge-graph-panel"
          data-fullscreen={fullscreen}
          onKeyDown={(event) => {
            // The fullscreen tooltip may consume Escape while dismissing itself.
            // Search controls still keep their own first-Escape dismissal.
            if (event.defaultPrevented && event.target !== expandRef.current)
              return
            if (event.key === 'Escape' && fullscreen) {
              event.preventDefault()
              setFullscreen(false)
              expandRef.current?.focus()
            }
            if (event.key !== 'Tab' || !fullscreen) return
            const controls = Array.from(
              panelRef.current?.querySelectorAll<HTMLElement>(
                'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], [tabindex="0"]'
              ) ?? []
            ).filter((element) => element.getClientRects().length > 0)
            const first = controls[0]
            const last = controls[controls.length - 1]
            if (event.shiftKey && document.activeElement === first) {
              event.preventDefault()
              last?.focus()
            } else if (!event.shiftKey && document.activeElement === last) {
              event.preventDefault()
              first?.focus()
            }
          }}
          className={twMerge(
            'bg-background flex min-h-0 min-w-0 flex-col',
            fullscreen
              ? 'fixed inset-0 z-50'
              : 'order-first h-[45%] min-h-60 shrink-0 border-b lg:order-last lg:h-auto lg:w-[42%] lg:min-w-[25rem] lg:max-w-[35rem] lg:border-b-0 lg:border-l'
          )}
        >
          <div className="flex shrink-0 items-center gap-1 border-b px-3 py-1">
            <h2 className="min-w-0 flex-1 truncate text-sm font-medium">
              {t('title')}
            </h2>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  ref={expandRef}
                  type="button"
                  aria-label={t(fullscreen ? 'restore' : 'fullscreen')}
                  onClick={() => setFullscreen((value) => !value)}
                  data-cy="knowledge-graph-fullscreen"
                  className="hover:bg-accent focus-visible:ring-ring inline-flex size-11 items-center justify-center rounded-md focus-visible:outline-none focus-visible:ring-2 fine-pointer:size-8"
                >
                  {fullscreen ? (
                    <Minimize2 className="size-4" aria-hidden />
                  ) : (
                    <Maximize2 className="size-4" aria-hidden />
                  )}
                </button>
              </TooltipTrigger>
              <TooltipContent>
                {t(fullscreen ? 'restore' : 'fullscreen')}
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  aria-label={t('close')}
                  onClick={onClose}
                  data-cy="knowledge-graph-panel-close"
                  className="hover:bg-accent focus-visible:ring-ring inline-flex size-11 items-center justify-center rounded-md focus-visible:outline-none focus-visible:ring-2 fine-pointer:size-8"
                >
                  <X className="size-4" aria-hidden />
                </button>
              </TooltipTrigger>
              <TooltipContent>{t('close')}</TooltipContent>
            </Tooltip>
          </div>
          <ChatKnowledgeGraphWorkspace chatbotId={chatbotId} onAsk={ask} />
        </div>
      ) : null}
    </div>
  )
}
