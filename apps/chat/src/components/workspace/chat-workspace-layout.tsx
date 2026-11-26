'use client'

import {
  Maximize2,
  Minimize2,
  PanelLeftClose,
  PanelLeftOpen,
  X,
} from 'lucide-react'
import { useTranslations } from 'next-intl'
import {
  type ComponentType,
  type CSSProperties,
  type ReactNode,
  type PointerEvent as ReactPointerEvent,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { twMerge } from 'tailwind-merge'
import {
  ExplanationFrame,
  ExplanationPanelActions,
  ExplanationPanelTitle,
  forgetExplanationPlace,
} from '../explanation-card'
import { FeedbackPanelContent, FeedbackPanelTitle } from '../feedback-card'
import { ChatGraphConceptContext } from '../knowledge-graph/ChatGraphConcepts'
import {
  ChatKnowledgeGraphPanelContent,
  ChatKnowledgeGraphPanelTitle,
} from '../knowledge-graph/ChatKnowledgeGraphPanel'
import {
  type ChatCanvasArtifact,
  type ChatWorkspaceItem,
  type ChatWorkspaceSize,
  useChatWorkspace,
} from './chat-workspace-context'
import { PanelIconButton } from './panel-icon-button'

const PANEL_MIN_WIDTH = 320
// The conversation keeps at least this width beside a resized panel.
const CONVERSATION_MIN_WIDTH = 360
const PANEL_KEYBOARD_STEP = 32

type PanelLabels = {
  region: string
  enlarge: string
  shrink: string
  fullscreen: string
  restore: string
  close: string
  resize: string
  resizeHint: string
}

/** What a kind of workspace item contributes to the shared panel shell. */
type PanelConfig = {
  id: string
  testId: string
  /** Prefix of the shell controls' test ids, e.g. `<prefix>-fullscreen`. */
  testIdPrefix: string
  storageKey: string
  /** Width classes of the docked panel before the user resizes it. */
  dockedClassName: string
  labels: PanelLabels
  title: ReactNode
  actions?: ReactNode
  content: ReactNode
}

function readStoredWidth(key: string): number | undefined {
  try {
    const value = Number(window.localStorage.getItem(key))
    return Number.isFinite(value) && value >= PANEL_MIN_WIDTH
      ? value
      : undefined
  } catch {
    return undefined
  }
}

function writeStoredWidth(key: string, width: number | undefined) {
  try {
    if (width === undefined) window.localStorage.removeItem(key)
    else window.localStorage.setItem(key, String(width))
  } catch {
    // Storage can be unavailable; the width then lasts for this page only.
  }
}

/** The concept map in the shared panel shell. */
function GraphPanel() {
  const t = useTranslations('chat.graphPanel')
  return (
    <WorkspacePanel
      config={{
        id: 'chat-knowledge-graph-panel',
        testId: 'chat-knowledge-graph-panel',
        testIdPrefix: 'knowledge-graph',
        storageKey: 'klicker-chat-graph-panel-width',
        dockedClassName: 'lg:w-[42%] lg:min-w-[25rem] lg:max-w-[35rem]',
        labels: {
          region: t('title'),
          enlarge: t('enlarge'),
          shrink: t('shrink'),
          fullscreen: t('fullscreen'),
          restore: t('restore'),
          close: t('close'),
          resize: t('resize'),
          resizeHint: t('resizeHint'),
        },
        title: <ChatKnowledgeGraphPanelTitle />,
        content: <ChatKnowledgeGraphPanelContent />,
      }}
    />
  )
}

/** An interactive explanation in the shared panel shell. */
function ExplanationPanel({
  item,
}: {
  item: ChatCanvasArtifact<'explanation'>
}) {
  const t = useTranslations('chat.thread.explanation')
  // Reloading remounts the explanation's frame, which restarts its page.
  const [reload, setReload] = useState(0)
  return (
    <WorkspacePanel
      config={{
        id: 'chat-explanation-panel',
        testId: 'chat-explanation-panel',
        testIdPrefix: 'explanation-panel',
        storageKey: 'klicker-chat-explanation-panel-width',
        dockedClassName: 'lg:w-[55%] lg:min-w-[30rem]',
        labels: {
          region: item.title,
          enlarge: t('enlarge'),
          shrink: t('shrink'),
          fullscreen: t('fullscreen'),
          restore: t('restore'),
          close: t('closePanel'),
          resize: t('resize'),
          resizeHint: t('resizeHint'),
        },
        title: <ExplanationPanelTitle item={item} />,
        actions: (
          <ExplanationPanelActions
            item={item}
            onReload={() => {
              forgetExplanationPlace(item.id)
              setReload((value) => value + 1)
            }}
          />
        ),
        content: (
          <ExplanationFrame
            key={`${item.id}:${reload}`}
            html={item.html}
            title={item.title}
            placeId={item.id}
            className="min-h-0 w-full flex-1 border-0 bg-white"
          />
        ),
      }}
    />
  )
}

/** A feedback card in the shared panel shell, with room for its margin. */
function FeedbackPanel({ item }: { item: ChatCanvasArtifact<'feedback'> }) {
  const t = useTranslations('chat.thread.feedback')
  return (
    <WorkspacePanel
      config={{
        id: 'chat-feedback-panel',
        testId: 'chat-feedback-panel',
        testIdPrefix: 'feedback-panel',
        storageKey: 'klicker-chat-feedback-panel-width',
        dockedClassName: 'lg:w-[55%] lg:min-w-[30rem]',
        labels: {
          region: item.title,
          enlarge: t('enlarge'),
          shrink: t('shrink'),
          fullscreen: t('fullscreen'),
          restore: t('restore'),
          close: t('closePanel'),
          resize: t('resize'),
          resizeHint: t('resizeHint'),
        },
        title: <FeedbackPanelTitle item={item} />,
        content: <FeedbackPanelContent key={item.id} item={item} />,
      }}
    />
  )
}

/**
 * The panel of each workspace item kind: the concept map and every canvas
 * artifact type. A panel passes its title, actions and content to the shared
 * shell; switching kinds mounts the other panel.
 */
const WORKSPACE_PANELS: {
  [K in ChatWorkspaceItem['kind']]: ComponentType<{
    item: Extract<ChatWorkspaceItem, { kind: K }>
  }>
} = {
  graph: GraphPanel,
  explanation: ExplanationPanel,
  feedback: FeedbackPanel,
}

/**
 * The conversation with the workspace panel docked beside it. From the lg
 * breakpoint the two share the row; below it the panel replaces the
 * conversation, since a stacked panel and chat leave neither usable.
 */
export function ChatWorkspaceLayout({ children }: { children: ReactNode }) {
  const workspace = useChatWorkspace()
  const { item, graph, chatbotId } = workspace

  const conceptContext = useMemo(
    () =>
      graph.focusConcept === undefined
        ? null
        : { chatbotId, focusConcept: graph.focusConcept },
    [chatbotId, graph.focusConcept]
  )

  const Panel = item
    ? (WORKSPACE_PANELS[item.kind] as ComponentType<{
        item: ChatWorkspaceItem
      }>)
    : null
  const expanded = item !== null && workspace.size === 'expanded'

  return (
    <div
      className="relative flex min-h-0 flex-1 flex-col lg:flex-row"
      data-cy="chat-graph-layout"
      data-workspace-size={item ? workspace.size : undefined}
    >
      <div
        className={twMerge(
          'relative flex min-h-0 min-w-0 flex-1 flex-col',
          item && 'hidden lg:flex',
          // Expanded, the conversation keeps a narrow column with its
          // composer, like a chat docked beside a document.
          expanded && 'lg:w-[26rem] lg:flex-none lg:shrink-0'
        )}
        data-cy="chat-conversation-pane"
      >
        <ChatGraphConceptContext.Provider value={conceptContext}>
          {children}
        </ChatGraphConceptContext.Provider>
      </div>
      {item && Panel ? <Panel item={item} /> : null}
    </div>
  )
}

function WorkspacePanel({ config }: { config: PanelConfig }) {
  const t = useTranslations('chat.workspace')
  const workspace = useChatWorkspace()
  const { size, setSize } = workspace
  const fullscreen = size === 'fullscreen'
  const expanded = size === 'expanded'
  const [panelWidth, setPanelWidth] = useState<number>()
  const panelRef = useRef<HTMLDivElement>(null)
  const fullscreenRef = useRef<HTMLButtonElement>(null)
  const { storageKey, testIdPrefix, labels } = config

  // Read before paint: switching kinds mounts a new panel, which must not
  // flash its default width first.
  useLayoutEffect(() => {
    setPanelWidth(readStoredWidth(storageKey))
  }, [storageKey])

  useEffect(() => {
    if (!fullscreen || !panelRef.current) return
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
    fullscreenRef.current?.focus()
    return () => {
      changed.forEach((element) => {
        element.inert = false
      })
    }
  }, [fullscreen])

  function clampWidth(width: number) {
    const available = panelRef.current?.parentElement?.clientWidth ?? width
    return Math.round(
      Math.min(
        Math.max(width, PANEL_MIN_WIDTH),
        Math.max(PANEL_MIN_WIDTH, available - CONVERSATION_MIN_WIDTH)
      )
    )
  }

  function resize(width: number) {
    const next = clampWidth(width)
    setPanelWidth(next)
    writeStoredWidth(storageKey, next)
    // A width chosen by hand is the docked width, also when it started from
    // the expanded layout.
    setSize('docked')
  }

  function startResize(event: ReactPointerEvent<HTMLDivElement>) {
    const layout = panelRef.current?.parentElement
    if (!layout) return
    event.preventDefault()
    const handle = event.currentTarget
    handle.setPointerCapture(event.pointerId)
    const right = layout.getBoundingClientRect().right
    const onMove = (moveEvent: PointerEvent) => {
      setPanelWidth(clampWidth(right - moveEvent.clientX))
      setSize('docked')
    }
    const onUp = (upEvent: PointerEvent) => {
      handle.removeEventListener('pointermove', onMove)
      handle.removeEventListener('pointerup', onUp)
      handle.removeEventListener('pointercancel', onUp)
      resize(right - upEvent.clientX)
    }
    handle.addEventListener('pointermove', onMove)
    handle.addEventListener('pointerup', onUp)
    handle.addEventListener('pointercancel', onUp)
  }

  const nextSize: ChatWorkspaceSize = expanded ? 'docked' : 'expanded'
  const useStoredWidth = panelWidth !== undefined && size === 'docked'

  return (
    <div
      id={config.id}
      ref={panelRef}
      {...(fullscreen
        ? { role: 'dialog', 'aria-modal': true as const }
        : { role: 'region' })}
      aria-label={labels.region}
      data-cy={config.testId}
      data-fullscreen={fullscreen}
      data-size={size}
      onKeyDown={(event) => {
        if (event.nativeEvent.isComposing) return
        // Nested controls stop propagation when they dismiss their own
        // popups. A tooltip preventing Escape must not prevent leaving
        // fullscreen.
        if (event.key === 'Escape' && fullscreen) {
          event.preventDefault()
          setSize('docked')
          fullscreenRef.current?.focus()
        }
        if (event.key !== 'Tab' || !fullscreen) return
        const controls = Array.from(
          panelRef.current?.querySelectorAll<HTMLElement>(
            'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), iframe, a[href], [tabindex="0"]'
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
          : expanded
            ? 'relative flex-1 lg:min-w-0 lg:border-l'
            : twMerge(
                'relative flex-1 lg:flex-none lg:shrink-0 lg:border-l',
                useStoredWidth
                  ? 'lg:w-[var(--chat-workspace-panel-width)] lg:min-w-0 lg:max-w-none'
                  : config.dockedClassName
              )
      )}
      style={
        useStoredWidth
          ? ({
              '--chat-workspace-panel-width': `${panelWidth}px`,
            } as CSSProperties)
          : undefined
      }
    >
      {fullscreen ? null : (
        // biome-ignore lint/a11y/useSemanticElements: A focusable separator is the ARIA pattern for a resizable split; <hr> cannot be focused or dragged.
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label={labels.resize}
          aria-valuenow={panelWidth}
          aria-valuemin={PANEL_MIN_WIDTH}
          title={labels.resizeHint}
          tabIndex={0}
          onPointerDown={startResize}
          onDoubleClick={() => {
            setPanelWidth(undefined)
            writeStoredWidth(storageKey, undefined)
            setSize('docked')
          }}
          onKeyDown={(event) => {
            if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
            event.preventDefault()
            const current =
              panelRef.current?.getBoundingClientRect().width ?? PANEL_MIN_WIDTH
            resize(
              current +
                (event.key === 'ArrowLeft'
                  ? PANEL_KEYBOARD_STEP
                  : -PANEL_KEYBOARD_STEP)
            )
          }}
          className="hover:bg-primary/30 focus-visible:bg-primary/40 absolute inset-y-0 -left-1 z-40 hidden w-2 cursor-col-resize touch-none focus-visible:outline-none lg:block"
          data-cy={`${testIdPrefix}-resize`}
        />
      )}
      <div
        role="toolbar"
        aria-label={t('toolbar')}
        className="flex shrink-0 items-center gap-1 border-b px-3 py-1"
      >
        <div className="flex min-w-0 flex-1 items-center gap-1">
          {config.title}
        </div>
        {config.actions}
        {fullscreen ? null : (
          <PanelIconButton
            label={expanded ? labels.shrink : labels.enlarge}
            onClick={() => setSize(nextSize)}
            testId={`${testIdPrefix}-enlarge`}
            className="hidden lg:inline-flex"
          >
            {expanded ? (
              <PanelLeftClose className="size-4" aria-hidden />
            ) : (
              <PanelLeftOpen className="size-4" aria-hidden />
            )}
          </PanelIconButton>
        )}
        <PanelIconButton
          buttonRef={fullscreenRef}
          label={fullscreen ? labels.restore : labels.fullscreen}
          onClick={() => setSize(fullscreen ? 'docked' : 'fullscreen')}
          testId={`${testIdPrefix}-fullscreen`}
        >
          {fullscreen ? (
            <Minimize2 className="size-4" aria-hidden />
          ) : (
            <Maximize2 className="size-4" aria-hidden />
          )}
        </PanelIconButton>
        <PanelIconButton
          label={labels.close}
          onClick={() => workspace.close()}
          testId={`${testIdPrefix}-panel-close`}
        >
          <X className="size-4" aria-hidden />
        </PanelIconButton>
      </div>
      {config.content}
    </div>
  )
}
