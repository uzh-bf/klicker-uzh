'use client'

import { useAui } from '@assistant-ui/react'
import type { KnowledgeGraphFocusRequest } from '@klicker-uzh/shared-components/src/knowledgeGraph/KnowledgeGraphViewer'
import type { KnowledgeGraphAskSelection } from '@klicker-uzh/shared-components/src/knowledgeGraph/knowledgeGraphView'
import type { KnowledgeGraphResponse } from '@klicker-uzh/types'
import { Maximize2, Minimize2, X } from 'lucide-react'
import { usePathname } from 'next/navigation'
import { useTranslations } from 'next-intl'
import {
  type CSSProperties,
  type ReactNode,
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { twMerge } from 'tailwind-merge'
import { resolveSelectedMode } from '@/src/lib/config/modes'
import { useSettingsStore } from '@/src/stores/settingsStore'
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip'
import { ChatGraphConceptContext } from './ChatGraphConcepts'
import { ChatKnowledgeGraphWorkspace } from './ChatKnowledgeGraphWorkspace'

const PANEL_WIDTH_STORAGE_KEY = 'klicker-chat-graph-panel-width'
const PANEL_MIN_WIDTH = 320
// The conversation keeps at least this width beside a resized graph.
const CONVERSATION_MIN_WIDTH = 360
const PANEL_KEYBOARD_STEP = 32
const QUIZ_MODE = 'quizzer'

function readStoredPanelWidth(): number | undefined {
  try {
    const value = Number(window.localStorage.getItem(PANEL_WIDTH_STORAGE_KEY))
    return Number.isFinite(value) && value >= PANEL_MIN_WIDTH
      ? value
      : undefined
  } catch {
    return undefined
  }
}

function storePanelWidth(width: number) {
  try {
    window.localStorage.setItem(PANEL_WIDTH_STORAGE_KEY, String(width))
  } catch {
    // Storage can be unavailable; the width then lasts for this page only.
  }
}

export function useChatGraphPanel(chatbotId: string, enabled: boolean) {
  const pathname = usePathname()
  const [open, setOpen] = useState(pathname === `/${chatbotId}/graph`)
  const [focusRequest, setFocusRequest] = useState<KnowledgeGraphFocusRequest>()
  const focusConcept = useCallback(
    (response: KnowledgeGraphResponse, nodeId: string) => {
      setFocusRequest((current) => ({
        response,
        nodeId,
        nonce: (current?.nonce ?? 0) + 1,
      }))
      setOpen(true)
    },
    []
  )
  // Closing drops the request, so reopening the panel shows the overview
  // instead of replaying the last clicked concept in a fresh viewer.
  const close = () => {
    setFocusRequest(undefined)
    setOpen(false)
  }
  return {
    open: enabled && open,
    toggle: () => (open ? close() : setOpen(true)),
    close,
    focusRequest,
    focusConcept: enabled ? focusConcept : undefined,
  }
}

export function ChatKnowledgeGraphPanel({
  chatbotId,
  open,
  onClose,
  focusRequest,
  onFocusConcept,
  children,
}: {
  chatbotId: string
  open: boolean
  onClose: () => void
  focusRequest?: KnowledgeGraphFocusRequest
  /** Absent when the concept map is disabled, which also disables links. */
  onFocusConcept?: (response: KnowledgeGraphResponse, nodeId: string) => void
  children: ReactNode
}) {
  const t = useTranslations('chat.graphPanel')
  const aui = useAui()
  const [fullscreen, setFullscreen] = useState(false)
  const [panelWidth, setPanelWidth] = useState<number>()
  const layoutRef = useRef<HTMLDivElement>(null)
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

  useEffect(() => {
    setPanelWidth(readStoredPanelWidth())
  }, [])

  function clampPanelWidth(width: number) {
    const available = layoutRef.current?.clientWidth ?? width
    return Math.round(
      Math.min(
        Math.max(width, PANEL_MIN_WIDTH),
        Math.max(PANEL_MIN_WIDTH, available - CONVERSATION_MIN_WIDTH)
      )
    )
  }

  function resizePanel(width: number) {
    const next = clampPanelWidth(width)
    setPanelWidth(next)
    storePanelWidth(next)
  }

  function startResize(event: ReactPointerEvent<HTMLDivElement>) {
    const layout = layoutRef.current
    if (layout === null) return
    event.preventDefault()
    const handle = event.currentTarget
    handle.setPointerCapture(event.pointerId)
    const right = layout.getBoundingClientRect().right
    const onMove = (moveEvent: PointerEvent) => {
      setPanelWidth(clampPanelWidth(right - moveEvent.clientX))
    }
    const onUp = (upEvent: PointerEvent) => {
      handle.removeEventListener('pointermove', onMove)
      handle.removeEventListener('pointerup', onUp)
      handle.removeEventListener('pointercancel', onUp)
      resizePanel(right - upEvent.clientX)
    }
    handle.addEventListener('pointermove', onMove)
    handle.addEventListener('pointerup', onUp)
    handle.addEventListener('pointercancel', onUp)
  }

  const modeOptions = useSettingsStore((state) => state.modeOptions)
  const selectedMode = useSettingsStore((state) => state.selectedMode)
  const setSelectedMode = useSettingsStore((state) => state.setSelectedMode)
  const activeMode = resolveSelectedMode(modeOptions, selectedMode)
  const canQuiz = QUIZ_MODE in modeOptions

  const conceptContext = useMemo(
    () =>
      onFocusConcept === undefined
        ? null
        : { chatbotId, focusConcept: onFocusConcept },
    [chatbotId, onFocusConcept]
  )

  // Each mode gets the wording it is built to answer, so the drafted
  // question starts the kind of work that mode supports.
  function askPrompt(selection: KnowledgeGraphAskSelection) {
    if (selection.kind === 'node') {
      const values = { topic: selection.label }
      if (activeMode === 'tutor') return t('nodePromptTutor', values)
      if (activeMode === 'explainer') return t('nodePromptExplainer', values)
      return t('nodePrompt', values)
    }
    const values = {
      source: selection.source,
      target: selection.target,
      relationship: selection.label,
    }
    if (activeMode === 'tutor') return t('edgePromptTutor', values)
    if (activeMode === 'explainer') return t('edgePromptExplainer', values)
    return t('edgePrompt', values)
  }

  function quiz(selection: KnowledgeGraphAskSelection) {
    setSelectedMode(QUIZ_MODE)
    draft(
      selection.kind === 'node'
        ? t('quizNodePrompt', { topic: selection.label })
        : t('quizEdgePrompt', {
            source: selection.source,
            target: selection.target,
            relationship: selection.label,
          })
    )
  }

  function ask(selection: KnowledgeGraphAskSelection) {
    draft(askPrompt(selection))
  }

  function draft(prompt: string) {
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
      ref={layoutRef}
      className="relative flex min-h-0 flex-1 flex-col lg:flex-row"
      data-cy="chat-graph-layout"
    >
      <div
        className={twMerge(
          'relative flex min-h-0 min-w-0 flex-1 flex-col',
          // Below the split breakpoint the graph replaces the conversation:
          // a stacked graph and chat leave neither usable.
          open && 'hidden lg:flex'
        )}
        data-cy="chat-conversation-pane"
      >
        <ChatGraphConceptContext.Provider value={conceptContext}>
          {children}
        </ChatGraphConceptContext.Provider>
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
            if (event.nativeEvent.isComposing) return
            // Nested graph controls stop propagation when they dismiss suggestions.
            // A tooltip preventing Escape must not prevent leaving fullscreen.
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
              : twMerge(
                  'relative flex-1 lg:w-[42%] lg:min-w-[25rem] lg:max-w-[35rem] lg:flex-none lg:shrink-0 lg:border-l',
                  panelWidth !== undefined &&
                    'lg:w-[var(--chat-graph-panel-width)] lg:min-w-0 lg:max-w-none'
                )
          )}
          style={
            panelWidth === undefined || fullscreen
              ? undefined
              : ({
                  '--chat-graph-panel-width': `${panelWidth}px`,
                } as CSSProperties)
          }
        >
          {fullscreen ? null : (
            // biome-ignore lint/a11y/useSemanticElements: A focusable separator is the ARIA pattern for a resizable split; <hr> cannot be focused or dragged.
            <div
              role="separator"
              aria-orientation="vertical"
              aria-label={t('resize')}
              aria-valuenow={panelWidth}
              aria-valuemin={PANEL_MIN_WIDTH}
              title={t('resizeHint')}
              tabIndex={0}
              onPointerDown={startResize}
              onDoubleClick={() => {
                setPanelWidth(undefined)
                try {
                  window.localStorage.removeItem(PANEL_WIDTH_STORAGE_KEY)
                } catch {
                  // Nothing stored to reset.
                }
              }}
              onKeyDown={(event) => {
                if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight')
                  return
                event.preventDefault()
                const current =
                  panelRef.current?.getBoundingClientRect().width ??
                  PANEL_MIN_WIDTH
                resizePanel(
                  current +
                    (event.key === 'ArrowLeft'
                      ? PANEL_KEYBOARD_STEP
                      : -PANEL_KEYBOARD_STEP)
                )
              }}
              className="hover:bg-primary/30 focus-visible:bg-primary/40 absolute inset-y-0 -left-1 z-40 hidden w-2 cursor-col-resize touch-none focus-visible:outline-none lg:block"
              data-cy="knowledge-graph-resize"
            />
          )}
          <div className="flex shrink-0 items-center gap-1 border-b px-3 py-1">
            <h2 className="min-w-0 truncate text-sm font-medium">
              {t('title')}
            </h2>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  className="text-muted-foreground focus-visible:ring-ring shrink-0 cursor-help rounded-full border px-2 py-0.5 text-xs focus-visible:outline-none focus-visible:ring-2"
                  data-cy="knowledge-graph-ai-generated"
                >
                  {t('aiGenerated')}
                </button>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                {t('aiGeneratedHint')}
              </TooltipContent>
            </Tooltip>
            <span className="flex-1" />
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
          <ChatKnowledgeGraphWorkspace
            chatbotId={chatbotId}
            onAsk={ask}
            onQuiz={canQuiz ? quiz : undefined}
            focusRequest={focusRequest}
          />
        </div>
      ) : null}
    </div>
  )
}
