'use client'

import { useAuiState } from '@assistant-ui/react'
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  LoaderCircleIcon,
  Maximize2Icon,
  PanelRightOpenIcon,
  RotateCwIcon,
  XCircleIcon,
  XIcon,
} from 'lucide-react'
import { useParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useEffect, useId, useRef, useState } from 'react'
import type { ExplanationToolResult } from '@/src/lib/explanations'
import {
  type ChatWorkspaceItem,
  useChatWorkspace,
  useOptionalChatWorkspace,
} from './workspace/chat-workspace-context'
import { PanelIconButton } from './workspace/panel-icon-button'

/* Tall enough for the compact layout's diagram, inputs and panel at chat width. */
const FRAME_HEIGHT = 640

function asResult(value: unknown): ExplanationToolResult | null {
  const v =
    value && typeof value === 'object' && 'result' in value
      ? (value as { result: unknown }).result
      : value
  if (!v || typeof v !== 'object' || !('kind' in v)) return null
  const kind = (v as { kind: unknown }).kind
  return kind === 'explanation' ||
    kind === 'explanation-invalid' ||
    kind === 'explanation-unavailable'
    ? (v as ExplanationToolResult)
    : null
}

/**
 * A call whose writer could not produce an accepted draft, or whose input did
 * not parse. The tutor then answers in text, so the attempt belongs in the
 * collapsed tool-call trace rather than in the answer.
 */
export function isRejectedExplanation(
  result: unknown,
  isError: boolean | undefined
): boolean {
  const parsed = asResult(result)
  return parsed?.kind === 'explanation-invalid' || (isError === true && !parsed)
}

function Chip({
  tone,
  icon,
  text,
}: {
  tone: 'muted' | 'error'
  icon: React.ReactNode
  text: string
}) {
  return (
    <div
      className={
        'my-2 inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm ' +
        (tone === 'error'
          ? 'border-red-200 bg-red-50 text-red-700'
          : 'border-slate-200 bg-white text-slate-600')
      }
    >
      {icon}
      <span>{text}</span>
    </div>
  )
}

/**
 * The reader's place in each explanation (step, sliders, preset, chosen path)
 * by explanation id. A new frame for the same explanation continues there: the
 * stored message that replaces a streamed answer, the panel and the large
 * view. The page reports its place and receives it back through the explainer
 * kit's host messages; the values are display state only.
 */
const places = new Map<string, unknown>()

/** Makes the next frame for this explanation start at its first step. */
export function forgetExplanationPlace(id: string) {
  places.delete(id)
}

/**
 * The page runs its own scripts in an opaque origin: no same-origin access to
 * the chat, its cookies or storage, and its own policy forbids network requests.
 * Downloads are allowed so its button can save the diagram as an image.
 */
export function ExplanationFrame({
  html,
  title,
  placeId,
  className,
  style,
}: {
  html: string
  title: string
  /** Frames with the same id share the reader's place. */
  placeId?: string
  className?: string
  style?: React.CSSProperties
}) {
  const frameRef = useRef<HTMLIFrameElement>(null)
  useEffect(() => {
    if (!placeId) return
    const onMessage = (event: MessageEvent) => {
      const frame = frameRef.current?.contentWindow
      // Only this frame's page may report or ask for this explanation's place.
      if (!frame || event.source !== frame) return
      const data: unknown = event.data
      if (!data || typeof data !== 'object' || !('explainer' in data)) return
      if (data.explainer === 'ready')
        frame.postMessage(
          { explainer: 'restore', state: places.get(placeId) ?? null },
          '*'
        )
      else if (
        data.explainer === 'state' &&
        'state' in data &&
        data.state &&
        typeof data.state === 'object'
      )
        places.set(placeId, data.state)
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [placeId])
  return (
    <iframe
      ref={frameRef}
      title={title}
      srcDoc={html}
      sandbox="allow-scripts allow-downloads"
      referrerPolicy="no-referrer"
      className={className}
      style={style}
    />
  )
}

export function ExplanationCard({
  toolCallId,
  result,
  status,
  isError,
}: {
  toolCallId?: string
  result?: unknown
  status: { type: string }
  isError?: boolean
}) {
  const t = useTranslations('chat.thread.explanation')
  const params = useParams<{ chatbotId?: string }>()
  const workspace = useOptionalChatWorkspace()
  // The tool call id survives the remount when a streamed answer is replaced
  // by its stored copy, so the panel keeps showing the same explanation.
  const fallbackId = useId()
  const id = toolCallId ?? fallbackId
  const parsed = asResult(result)
  const content = parsed?.kind === 'explanation' ? parsed.content : null
  // While the answer streams, the call carries a text placeholder until the
  // explainer service has validated and rendered the draft. Its part then
  // already reads as complete, so the streaming message decides instead.
  const messageRunning = useAuiState(
    (state) => state.message.status?.type === 'running'
  )
  const [page, setPage] = useState<{ html: string } | { failed: true } | null>(
    null
  )
  // An explanation that arrives in the live answer may replace the one shown
  // in the panel; explanations loaded with older messages never do.
  const arrivedLive = useRef(false)
  useEffect(() => {
    if (messageRunning) arrivedLive.current = true
  }, [messageRunning])
  const dialogRef = useRef<HTMLDialogElement>(null)
  // The large frame is mounted only while the dialog is open, so each
  // explanation runs once.
  const [dialogOpen, setDialogOpen] = useState(false)

  useEffect(() => {
    if (!content || !params.chatbotId) return
    let cancelled = false
    fetch(`/api/chatbots/${params.chatbotId}/explanations/page`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
    })
      .then(async (response) => {
        const data = (await response.json()) as { html?: string }
        if (cancelled) return
        setPage(
          response.ok && typeof data.html === 'string'
            ? { html: data.html }
            : { failed: true }
        )
      })
      .catch(() => !cancelled && setPage({ failed: true }))
    return () => {
      cancelled = true
    }
    // The content of a stored tool result never changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.chatbotId, content === null])

  const html = page && 'html' in page ? page.html : null
  const title =
    content && typeof content.title === 'string'
      ? content.title
      : t('fallbackTitle')
  const register = workspace?.explanations.register
  useEffect(() => {
    if (!register || html === null) return
    return register(id, { title, html })
  }, [register, id, title, html])

  const showingExplanation = workspace?.item?.kind === 'explanation'
  const openInPanel = workspace?.explanations.open
  // biome-ignore lint/correctness/useExhaustiveDependencies: Only the arrival of the page decides; later panel changes do not.
  useEffect(() => {
    if (html === null || !arrivedLive.current || !openInPanel) return
    arrivedLive.current = false
    if (showingExplanation) openInPanel(id, { title, html })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [html])

  if (
    !parsed &&
    isError !== true &&
    (status.type === 'running' || messageRunning)
  )
    return (
      <Chip
        tone="muted"
        icon={<LoaderCircleIcon className="size-4 animate-spin" />}
        text={t('preparing')}
      />
    )
  // Rejected drafts render as a trace row in the tool-call group instead.
  if (isRejectedExplanation(result, isError)) return null
  if (!content || (page && 'failed' in page))
    return (
      <Chip
        tone="error"
        icon={<XCircleIcon className="size-4" />}
        text={t('unavailable')}
      />
    )

  const inPanel = workspace?.explanations.activeId === id
  return (
    // The marker lets the message widen past the text column, so the
    // visualization gets the full thread width.
    <div
      data-explanation-card
      data-explanation-id={id}
      data-in-panel={inPanel}
      className="my-3 w-full overflow-hidden rounded-md border border-slate-200 bg-white"
    >
      <div className="flex items-center justify-between gap-2 border-b border-slate-200 px-3 py-1.5 text-xs text-slate-600">
        <span className="min-w-0 truncate" title={t('header')}>
          {t('header')}
        </span>
        <button
          type="button"
          data-cy="explanation-open"
          className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded px-2 py-1 hover:bg-slate-100 disabled:opacity-50"
          disabled={html === null}
          onClick={() => {
            if (html === null) return
            if (workspace) {
              if (inPanel) workspace.close()
              else workspace.explanations.open(id, { title, html })
              return
            }
            setDialogOpen(true)
            dialogRef.current?.showModal()
          }}
        >
          {workspace ? (
            <PanelRightOpenIcon className="size-3.5" aria-hidden />
          ) : (
            <Maximize2Icon className="size-3.5" aria-hidden />
          )}
          {workspace ? t(inPanel ? 'close' : 'openInPanel') : t('openLarge')}
        </button>
      </div>
      {inPanel ? (
        // Only one live copy runs: two would drift apart, and with narration
        // both would speak.
        <div
          className="flex items-center gap-2 px-3 py-3 text-sm text-slate-600"
          data-cy="explanation-in-panel"
        >
          <PanelRightOpenIcon
            className="size-4 shrink-0 text-slate-400"
            aria-hidden
          />
          <span className="min-w-0 truncate font-medium text-slate-800">
            {title}
          </span>
          <span className="shrink-0 text-slate-500">· {t('shownInPanel')}</span>
        </div>
      ) : dialogOpen ? (
        // The large view runs the only live copy; the card keeps its height
        // and gets a new frame at the reached place when the view closes.
        <div style={{ height: FRAME_HEIGHT }} />
      ) : html !== null ? (
        <ExplanationFrame
          html={html}
          title={title}
          placeId={id}
          className="block w-full border-0"
          style={{ height: FRAME_HEIGHT }}
        />
      ) : (
        <div
          className="flex items-center justify-center text-sm text-slate-500"
          style={{ height: FRAME_HEIGHT }}
        >
          <LoaderCircleIcon className="mr-2 size-4 animate-spin" />
          {t('loading')}
        </div>
      )}
      {workspace ? null : (
        <dialog
          ref={dialogRef}
          className="m-auto h-[90vh] w-[min(1200px,95vw)] max-w-none rounded-md p-0 backdrop:bg-black/40"
          aria-label={title}
          onClose={() => setDialogOpen(false)}
        >
          <div className="flex h-full flex-col">
            <div className="flex items-center justify-end border-b border-slate-200 px-2 py-1">
              <button
                type="button"
                className="inline-flex items-center gap-1 rounded px-2 py-1 text-sm hover:bg-slate-100"
                onClick={() => dialogRef.current?.close()}
              >
                <XIcon className="size-4" />
                {t('close')}
              </button>
            </div>
            {dialogOpen && html !== null ? (
              <ExplanationFrame
                html={html}
                title={title}
                placeId={id}
                className="min-h-0 w-full flex-1 border-0"
              />
            ) : null}
          </div>
        </dialog>
      )}
    </div>
  )
}

type ExplanationItem = Extract<ChatWorkspaceItem, { kind: 'explanation' }>

/** The explanation's heading in the shared workspace panel toolbar. */
export function ExplanationPanelTitle({ item }: { item: ExplanationItem }) {
  const t = useTranslations('chat.thread.explanation')
  return (
    <>
      <h2 className="min-w-0 truncate text-sm font-medium">{item.title}</h2>
      <span className="text-muted-foreground hidden shrink-0 rounded-full border px-2 py-0.5 text-xs sm:inline">
        {t('aiDraft')}
      </span>
    </>
  )
}

/** Steps between the thread's explanations and reloads the current one. */
export function ExplanationPanelActions({
  item,
  onReload,
}: {
  item: ExplanationItem
  onReload: () => void
}) {
  const t = useTranslations('chat.thread.explanation')
  const workspace = useChatWorkspace()
  const ordered = workspace.explanations.ordered()
  const index = ordered.findIndex((entry) => entry.id === item.id)
  const previous = index > 0 ? ordered[index - 1] : undefined
  const next =
    index >= 0 && index < ordered.length - 1 ? ordered[index + 1] : undefined
  const open = (entry: (typeof ordered)[number] | undefined) => {
    if (!entry) return
    workspace.explanations.open(entry.id, entry)
    document
      .querySelector(`[data-explanation-id="${CSS.escape(entry.id)}"]`)
      ?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }
  return (
    <>
      {ordered.length > 1 ? (
        <>
          <PanelIconButton
            label={t('previous')}
            onClick={() => open(previous)}
            disabled={!previous}
            testId="explanation-panel-previous"
          >
            <ChevronLeftIcon className="size-4" aria-hidden />
          </PanelIconButton>
          <span
            className="text-muted-foreground shrink-0 text-xs tabular-nums"
            data-cy="explanation-panel-position"
          >
            {t('position', { current: index + 1, total: ordered.length })}
          </span>
          <PanelIconButton
            label={t('next')}
            onClick={() => open(next)}
            disabled={!next}
            testId="explanation-panel-next"
          >
            <ChevronRightIcon className="size-4" aria-hidden />
          </PanelIconButton>
        </>
      ) : null}
      <PanelIconButton
        label={t('reload')}
        onClick={onReload}
        testId="explanation-panel-reload"
      >
        <RotateCwIcon className="size-4" aria-hidden />
      </PanelIconButton>
    </>
  )
}
