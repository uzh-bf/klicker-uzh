'use client'

import { TextMessagePartProvider, useAuiState } from '@assistant-ui/react'
import {
  ArrowRightIcon,
  CheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CircleCheckIcon,
  type CircleIcon,
  CircleSlashIcon,
  CopyIcon,
  LoaderCircleIcon,
  PanelRightOpenIcon,
  TriangleAlertIcon,
  XIcon,
} from 'lucide-react'
import { useTranslations } from 'next-intl'
import {
  type FC,
  Fragment,
  type KeyboardEvent,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react'
import { twMerge } from 'tailwind-merge'
import type { MessageSources } from '@/src/hooks/useMessageSources'
import {
  annotateFeedback,
  asFeedbackResult,
  type CriterionStatus,
  type FeedbackAnnotation,
  type FeedbackContent,
  type FeedbackItem,
  feedbackItems,
  feedbackToText,
} from '@/src/lib/feedback'
import { MarkdownText } from './markdown-text'
import {
  MessageSourcesProvider,
  useMessageSourcesContext,
} from './message-sources-context'
import {
  type ChatCanvasArtifact,
  useOptionalChatWorkspace,
} from './workspace/chat-workspace-context'

// Distinct shapes, so the status does not rest on colour alone.
const STATUS_STYLE: Record<
  CriterionStatus,
  { icon: typeof CircleIcon; className: string; iconClassName: string }
> = {
  met: {
    icon: CircleCheckIcon,
    className: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    iconClassName: 'text-emerald-600',
  },
  partial: {
    icon: TriangleAlertIcon,
    className: 'border-amber-200 bg-amber-50 text-amber-800',
    iconClassName: 'text-amber-600',
  },
  missing: {
    icon: CircleSlashIcon,
    className: 'border-rose-200 bg-rose-50 text-rose-700',
    iconClassName: 'text-rose-600',
  },
}

/** Underline of a marked passage at rest, and its fill while selected. */
const MARK_STYLE = {
  improvement: {
    rest: 'decoration-amber-500 decoration-wavy decoration-2',
    active: 'bg-amber-100',
  },
  partial: {
    rest: 'decoration-amber-500 decoration-dashed decoration-2',
    active: 'bg-amber-100',
  },
  missing: {
    rest: 'decoration-rose-500 decoration-dotted decoration-2',
    active: 'bg-rose-100',
  },
  met: {
    rest: 'decoration-emerald-500 decoration-1',
    active: 'bg-emerald-100',
  },
  strength: {
    rest: 'decoration-emerald-500 decoration-1',
    active: 'bg-emerald-100',
  },
}

type MarkStyle = keyof typeof MARK_STYLE

/** A passage several remarks cover is drawn as the most pressing of them. */
function markStyle(items: readonly FeedbackItem[]): MarkStyle {
  const styles = items.map((item): MarkStyle => {
    if (item.kind === 'criterion') return item.status ?? 'met'
    return item.kind
  })
  const order: MarkStyle[] = [
    'improvement',
    'missing',
    'partial',
    'met',
    'strength',
  ]
  return order.find((style) => styles.includes(style)) ?? 'strength'
}

function Quote({ text }: Readonly<{ text: string }>) {
  return (
    <q className="block border-l-2 border-slate-300 py-0.5 pl-2 text-sm italic text-slate-600 before:content-none after:content-none">
      {text}
    </q>
  )
}

/**
 * Model-written card text goes through the message renderer, so citation
 * markers, mathematics and code render as in the reply itself.
 */
function FeedbackText({ text }: Readonly<{ text: string }>) {
  return (
    <div className="text-sm [&_.aui-md>*:first-child]:mt-0 [&_.aui-md>*:last-child]:mb-0">
      <TextMessagePartProvider text={text}>
        <MarkdownText />
      </TextMessagePartProvider>
    </div>
  )
}

function SectionTitle({ children }: Readonly<{ children: string }>) {
  return (
    <h4 className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">
      {children}
    </h4>
  )
}

function useStatusLabels(): Record<CriterionStatus, string> {
  const t = useTranslations('chat.thread.feedback')
  return {
    met: t('status.met'),
    partial: t('status.partial'),
    missing: t('status.missing'),
  }
}

function StatusPill({ status }: Readonly<{ status: CriterionStatus }>) {
  const labels = useStatusLabels()
  const style = STATUS_STYLE[status]
  const StatusIcon = style.icon
  return (
    <span
      className={twMerge(
        'inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-xs',
        style.className
      )}
    >
      <StatusIcon className="size-3.5" aria-hidden />
      {labels[status]}
    </span>
  )
}

/** The badge a remark shows at the end of its passage and on its comment. */
function ItemBadge({ item }: Readonly<{ item: FeedbackItem }>) {
  const t = useTranslations('chat.thread.feedback')
  if (item.kind === 'improvement')
    return (
      <span
        className="inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-amber-100 align-middle text-[11px] font-semibold not-italic text-amber-900"
        title={t('improvementNumber', { number: item.index + 1 })}
      >
        {item.index + 1}
      </span>
    )
  if (item.kind === 'criterion' && item.status) {
    const StatusIcon = STATUS_STYLE[item.status].icon
    return (
      <StatusIcon
        className={twMerge(
          'inline size-4 shrink-0 align-text-bottom',
          STATUS_STYLE[item.status].iconClassName
        )}
        aria-hidden
      />
    )
  }
  return (
    <CheckIcon
      className="inline size-4 shrink-0 align-text-bottom text-emerald-600"
      aria-hidden
    />
  )
}

/** One remark with its comment, as listed in the margin or the drawer. */
function ItemHeading({ item }: Readonly<{ item: FeedbackItem }>) {
  const t = useTranslations('chat.thread.feedback')
  return (
    <span className="flex flex-wrap items-center gap-2">
      <ItemBadge item={item} />
      <span className="text-sm font-semibold text-slate-900">
        {item.kind === 'strength' ? t('strengths') : item.label}
      </span>
      {item.kind === 'criterion' && item.status ? (
        <StatusPill status={item.status} />
      ) : null}
    </span>
  )
}

function ItemComment({ item }: Readonly<{ item: FeedbackItem }>) {
  return (
    <div className="min-w-0 space-y-1">
      <ItemHeading item={item} />
      <div className="text-slate-700">
        <FeedbackText text={item.comment} />
      </div>
    </div>
  )
}

/**
 * The card as lists: criteria and points to work on first, then strengths
 * and the next step. Quotes always sit above their comment.
 */
function FeedbackList({
  content,
  only,
}: Readonly<{ content: FeedbackContent; only?: ReadonlySet<string> }>) {
  const t = useTranslations('chat.thread.feedback')
  const items = feedbackItems(content).filter(
    (item) => !only || only.has(item.id)
  )
  const criteria = items.filter((item) => item.kind === 'criterion')
  const improvements = items.filter((item) => item.kind === 'improvement')
  const strengths = items.filter((item) => item.kind === 'strength')
  return (
    <>
      {criteria.length > 0 && (
        <div>
          <SectionTitle>{t('criteria')}</SectionTitle>
          <ul className="space-y-3">
            {criteria.map((criterion) => (
              <li key={criterion.id} className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold text-slate-900">
                    {criterion.label}
                  </span>
                  {criterion.status ? (
                    <StatusPill status={criterion.status} />
                  ) : null}
                </div>
                {criterion.quote && <Quote text={criterion.quote} />}
                <div className="text-slate-700">
                  <FeedbackText text={criterion.comment} />
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {improvements.length > 0 && (
        <div>
          <SectionTitle>{t('points')}</SectionTitle>
          <ol className="space-y-3">
            {improvements.map((point) => (
              <li key={point.id} className="flex gap-3">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-amber-100 text-xs font-semibold text-amber-900">
                  {point.index + 1}
                </span>
                <div className="min-w-0 flex-1 space-y-1">
                  <span className="text-sm font-semibold text-slate-900">
                    {point.label}
                  </span>
                  {point.quote && <Quote text={point.quote} />}
                  <div className="text-slate-700">
                    <FeedbackText text={point.comment} />
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </div>
      )}

      {strengths.length > 0 && (
        <div>
          <SectionTitle>{t('strengths')}</SectionTitle>
          <ul className="space-y-2">
            {strengths.map((strength) => (
              <li
                key={strength.id}
                className="flex gap-2 text-sm text-slate-800"
              >
                <CheckIcon
                  className="mt-0.5 size-4 shrink-0 text-emerald-600"
                  aria-hidden
                />
                <div className="min-w-0 space-y-1">
                  {strength.quote && <Quote text={strength.quote} />}
                  <FeedbackText text={strength.comment} />
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  )
}

/**
 * The learner's text with the card's quotes marked, Word-style. In a wide
 * container the remarks stand in a margin beside the text; in a narrow one
 * the selected remarks open in a drawer below their paragraph. Marks are
 * reachable by keyboard, and the list layout stays one click away.
 */
function AnnotatedText({
  content,
  annotation,
}: Readonly<{ content: FeedbackContent; annotation: FeedbackAnnotation }>) {
  const t = useTranslations('chat.thread.feedback')
  const items = useMemo(() => feedbackItems(content), [content])
  const byId = useMemo(
    () => new Map(items.map((item) => [item.id, item])),
    [items]
  )
  const [selected, setSelected] = useState<readonly string[]>([])
  const rootId = useId()
  const rootRef = useRef<HTMLDivElement>(null)

  // The badge of a remark follows the last stretch of its passage.
  const lastSegment = useMemo(() => {
    const last = new Map<string, string>()
    annotation.blocks.forEach((block, b) => {
      block.segments.forEach((segment, s) => {
        for (const id of segment.itemIds) last.set(id, `${b}:${s}`)
      })
    })
    return last
  }, [annotation])

  const selectedBlock = annotation.blocks.findIndex((block) =>
    block.segments.some((segment) =>
      segment.itemIds.some((id) => selected.includes(id))
    )
  )
  const anchoredIndex = annotation.anchored.findIndex((group) =>
    group.includes(selected[0] ?? '')
  )

  useEffect(() => {
    if (selected.length === 0) return
    rootRef.current
      ?.querySelector(`[data-feedback-comment="${CSS.escape(selected[0])}"]`)
      ?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [selected])

  const focusMark = (id: string) => {
    rootRef.current
      ?.querySelector<HTMLElement>(`[data-feedback-mark~="${CSS.escape(id)}"]`)
      ?.focus()
  }
  const step = (offset: number) => {
    const next = annotation.anchored[anchoredIndex + offset]
    if (!next) return
    setSelected(next)
    focusMark(next[0])
  }

  const onMarkKey = (event: KeyboardEvent, itemIds: string[]) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      setSelected((current) =>
        current.join() === itemIds.join() ? [] : itemIds
      )
    } else if (event.key === 'Escape' && selected.length > 0) {
      // Clearing the selection is this Escape's whole effect; the panel must
      // not also leave fullscreen.
      event.preventDefault()
      event.stopPropagation()
      setSelected([])
    }
  }

  const drawer =
    selected.length > 0 ? (
      <div
        className="my-2 rounded-md border border-slate-200 bg-slate-50 p-3 @2xl:hidden"
        data-cy="feedback-comment-drawer"
      >
        <div className="mb-2 flex items-center justify-end gap-1">
          {annotation.anchored.length > 1 ? (
            <>
              <button
                type="button"
                aria-label={t('previousComment')}
                data-cy="feedback-comment-previous"
                disabled={anchoredIndex <= 0}
                onClick={() => step(-1)}
                className="inline-flex size-7 items-center justify-center rounded hover:bg-slate-200 disabled:opacity-40"
              >
                <ChevronLeftIcon className="size-4" aria-hidden />
              </button>
              <span className="text-xs tabular-nums text-slate-600">
                {t('position', {
                  current: anchoredIndex + 1,
                  total: annotation.anchored.length,
                })}
              </span>
              <button
                type="button"
                aria-label={t('nextComment')}
                data-cy="feedback-comment-next"
                disabled={anchoredIndex >= annotation.anchored.length - 1}
                onClick={() => step(1)}
                className="inline-flex size-7 items-center justify-center rounded hover:bg-slate-200 disabled:opacity-40"
              >
                <ChevronRightIcon className="size-4" aria-hidden />
              </button>
            </>
          ) : null}
          <button
            type="button"
            aria-label={t('closeComment')}
            onClick={() => {
              const first = selected[0]
              setSelected([])
              if (first) focusMark(first)
            }}
            className="inline-flex size-7 items-center justify-center rounded hover:bg-slate-200"
          >
            <XIcon className="size-4" aria-hidden />
          </button>
        </div>
        <div className="space-y-3">
          {selected.map((id) => {
            const item = byId.get(id)
            return item ? <ItemComment key={id} item={item} /> : null
          })}
        </div>
      </div>
    ) : null

  return (
    <div ref={rootRef} className="@container" data-cy="feedback-annotated">
      <div className="grid gap-4 @2xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div
          id={rootId}
          className="space-y-3 self-start rounded-md border border-slate-200 bg-slate-50/60 px-3 py-2 text-[15px] leading-7 text-slate-900"
        >
          {annotation.blocks.map((block, b) => (
            // Blocks keep their order and never reorder.
            // biome-ignore lint/suspicious/noArrayIndexKey: blocks have no other identity
            <Fragment key={b}>
              {block.gapBefore ? <TextGap /> : null}
              <p className="whitespace-pre-wrap break-words">
                {block.segments.map((segment, s) => {
                  const key = `${b}:${s}`
                  if (segment.itemIds.length === 0)
                    return <Fragment key={key}>{segment.text}</Fragment>
                  const covering = segment.itemIds.flatMap((id) => {
                    const item = byId.get(id)
                    return item ? [item] : []
                  })
                  const style = MARK_STYLE[markStyle(covering)]
                  const active = segment.itemIds.some((id) =>
                    selected.includes(id)
                  )
                  const ending = covering.filter(
                    (item) => lastSegment.get(item.id) === key
                  )
                  return (
                    <Fragment key={key}>
                      {/* biome-ignore lint/a11y/useSemanticElements: A button cannot wrap across lines inside a paragraph; a span with the button role can. */}
                      <span
                        role="button"
                        tabIndex={0}
                        aria-pressed={active}
                        aria-label={t('markLabel', {
                          text: covering
                            .map((item) =>
                              item.kind === 'strength'
                                ? t('strengths')
                                : item.label
                            )
                            .join(', '),
                        })}
                        data-feedback-mark={segment.itemIds.join(' ')}
                        onClick={() =>
                          setSelected((current) =>
                            current.join() === segment.itemIds.join()
                              ? []
                              : segment.itemIds
                          )
                        }
                        onKeyDown={(event) => onMarkKey(event, segment.itemIds)}
                        className={twMerge(
                          'cursor-pointer rounded-sm underline underline-offset-4 outline-none focus-visible:ring-2 focus-visible:ring-sky-500',
                          style.rest,
                          active && style.active
                        )}
                      >
                        {segment.text}
                      </span>
                      {ending.map((item) => (
                        <span key={item.id} className="ml-0.5">
                          <ItemBadge item={item} />
                        </span>
                      ))}
                    </Fragment>
                  )
                })}
              </p>
              {b === selectedBlock ? drawer : null}
            </Fragment>
          ))}
          {annotation.gapAfter ? <TextGap /> : null}
        </div>

        <section
          aria-label={t('comments')}
          className="hidden space-y-2 @2xl:block"
          data-cy="feedback-comment-rail"
        >
          {annotation.anchored.flatMap((group) =>
            group.map((id) => {
              const item = byId.get(id)
              if (!item) return null
              const active = selected.includes(id)
              // The comment may hold links and buttons of its own, so only
              // the heading selects the remark.
              return (
                <div
                  key={id}
                  data-feedback-comment={id}
                  className={twMerge(
                    'space-y-1 rounded-md border border-slate-200 bg-white p-2 transition-colors',
                    active && 'border-sky-300 bg-sky-50'
                  )}
                >
                  <button
                    type="button"
                    aria-controls={rootId}
                    aria-pressed={active}
                    onClick={() => setSelected(active ? [] : group)}
                    className="block w-full rounded text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
                  >
                    <ItemHeading item={item} />
                  </button>
                  <div className="text-slate-700">
                    <FeedbackText text={item.comment} />
                  </div>
                </div>
              )
            })
          )}
        </section>
      </div>
    </div>
  )
}

function TextGap() {
  const t = useTranslations('chat.thread.feedback')
  return (
    <p className="select-none text-center text-slate-400">
      <span aria-hidden>…</span>
      <span className="sr-only">{t('textGap')}</span>
    </p>
  )
}

/** Everything below the header, in either layout. */
function FeedbackBody({
  content,
  annotation,
  view,
}: Readonly<{
  content: FeedbackContent
  annotation: FeedbackAnnotation | null
  view: 'annotated' | 'list'
}>) {
  const t = useTranslations('chat.thread.feedback')
  const unanchored = useMemo(
    () => new Set(annotation?.unanchored ?? []),
    [annotation]
  )
  const annotated = view === 'annotated' && annotation !== null
  return (
    <div className="space-y-4 px-4 py-3">
      {annotated ? (
        <>
          <AnnotatedText content={content} annotation={annotation} />
          {unanchored.size > 0 && (
            <div className="space-y-4" data-cy="feedback-notes">
              <SectionTitle>{t('notes')}</SectionTitle>
              <FeedbackList content={content} only={unanchored} />
            </div>
          )}
        </>
      ) : (
        <FeedbackList content={content} />
      )}

      {content.nextStep && (
        <div className="flex gap-2 rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-900">
          <ArrowRightIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
          <div className="min-w-0">
            <p className="font-semibold">{t('nextStep')}</p>
            <FeedbackText text={content.nextStep} />
          </div>
        </div>
      )}
    </div>
  )
}

function FeedbackHeader({
  content,
  title,
  showTitle = true,
}: Readonly<{ content: FeedbackContent; title: string; showTitle?: boolean }>) {
  const t = useTranslations('chat.thread.feedback')
  const met = content.criteria.filter((c) => c.status === 'met').length
  return (
    <header className="border-b border-slate-100 bg-slate-50 px-4 py-3">
      <div className="flex flex-wrap items-center gap-2">
        {showTitle ? (
          <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
        ) : null}
        {content.criteria.length > 0 && (
          <span
            className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-xs tabular-nums text-slate-700"
            data-cy="feedback-rollup"
          >
            {t('rollup', { met, total: content.criteria.length })}
          </span>
        )}
      </div>
      {content.summary && (
        <div className="mt-1 text-slate-600">
          <FeedbackText text={content.summary} />
        </div>
      )}
    </header>
  )
}

function ViewToggle({
  view,
  onChange,
}: Readonly<{
  view: 'annotated' | 'list'
  onChange: (view: 'annotated' | 'list') => void
}>) {
  const t = useTranslations('chat.thread.feedback')
  return (
    <fieldset className="inline-flex rounded-md border border-slate-200 p-0.5 text-xs">
      <legend className="sr-only">{t('viewLabel')}</legend>
      {(['annotated', 'list'] as const).map((option) => (
        <button
          key={option}
          type="button"
          aria-pressed={view === option}
          onClick={() => onChange(option)}
          data-cy={`feedback-view-${option}`}
          className={twMerge(
            'min-h-7 rounded px-2 text-slate-600 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400',
            view === option && 'bg-slate-900 text-white hover:bg-slate-900'
          )}
        >
          {option === 'annotated' ? t('viewAnnotated') : t('viewList')}
        </button>
      ))}
    </fieldset>
  )
}

/**
 * The passages of the learner's messages before this one: typed text and,
 * separately, each attached document, which the thread keeps beside the
 * message. These are the passages the server accepted quotes from.
 */
function useEarlierLearnerPassages(): readonly string[] {
  const messageId = useAuiState((s) => s.message.id)
  const messages = useAuiState((s) => s.thread.messages) as ReadonlyArray<{
    id: string
    role: string
    content: ReadonlyArray<{ type: string; text?: string }>
    metadata?: { custom?: { documentAttachments?: Array<{ text?: string }> } }
  }>
  const passages = useMemo(() => {
    const end = messages.findIndex((message) => message.id === messageId)
    return (end === -1 ? messages : messages.slice(0, end))
      .filter((message) => message.role === 'user')
      .flatMap((message) => [
        message.content
          .map((part) => (part.type === 'text' ? (part.text ?? '') : ''))
          .join(''),
        ...(message.metadata?.custom?.documentAttachments ?? []).map(
          (document) => document.text ?? ''
        ),
      ])
  }, [messages, messageId])
  // The thread array changes with every streamed chunk; the learner's
  // passages do not, so matching runs again only when they change.
  const key = passages.join('\u0000')
  // biome-ignore lint/correctness/useExhaustiveDependencies: keyed by content
  return useMemo(() => passages, [key])
}

/**
 * A draft the server rejected, or a call whose input did not parse. The model
 * usually tries again, so the attempt belongs in the collapsed tool-call trace
 * rather than in the answer.
 */
export function isRejectedFeedback(
  result: unknown,
  isError: boolean | undefined
): boolean {
  const parsed = asFeedbackResult(result)
  return parsed?.kind === 'feedback-invalid' || (isError === true && !parsed)
}

interface FeedbackCardProps {
  toolCallId?: string
  result?: unknown
  status: { type: string }
  isError?: boolean
}

export const FeedbackCard: FC<FeedbackCardProps> = ({
  toolCallId,
  result,
  status,
  isError,
}) => {
  const t = useTranslations('chat.thread.feedback')
  const statusLabels = useStatusLabels()
  const workspace = useOptionalChatWorkspace()
  const fallbackId = useId()
  const id = toolCallId ?? fallbackId
  const [copied, setCopied] = useState(false)
  const parsed = asFeedbackResult(result)
  const content =
    parsed?.kind === 'feedback' && !isError ? parsed.content : null
  const passages = useEarlierLearnerPassages()
  const annotation = useMemo(
    () => (content ? annotateFeedback(feedbackItems(content), passages) : null),
    [content, passages]
  )
  const [view, setView] = useState<'annotated' | 'list'>('annotated')
  const title = content?.title || t('fallbackTitle')

  // The panel renders outside the message, so it takes the message's sources
  // along for its citation markers.
  const { messageId, sources, courseImageSourcesByAssetId, citedPageRanges } =
    useMessageSourcesContext()
  const messageSources = useMemo<MessageSources>(
    () => ({
      messageId,
      sources,
      courseImageSourcesByAssetId,
      citedPageRanges,
    }),
    [messageId, sources, courseImageSourcesByAssetId, citedPageRanges]
  )
  const register = workspace?.artifacts.register
  useEffect(() => {
    if (!register || !content) return
    return register('feedback', id, {
      title,
      content,
      annotation,
      sources: messageSources,
    })
  }, [register, id, title, content, annotation, messageSources])

  if (status.type === 'running' && !parsed)
    return (
      <div className="my-2 inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600">
        <LoaderCircleIcon className="size-4 animate-spin" aria-hidden />
        <span>{t('preparing')}</span>
      </div>
    )
  // Rejected drafts render as a trace row in the tool-call group instead.
  if (!content) return null

  const active = workspace?.artifacts.active
  const inPanel = active?.kind === 'feedback' && active.id === id
  const copy = () => {
    const text = feedbackToText(content, {
      strengths: t('strengths'),
      criteria: t('criteria'),
      improvements: t('points'),
      nextStep: t('nextStep'),
      status: statusLabels,
    })
    void navigator.clipboard?.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }

  return (
    // The marker lets the message widen past the text column, so the text
    // and its margin get the full thread width.
    <section
      aria-label={title}
      data-feedback-card
      data-canvas-artifact="feedback"
      data-canvas-artifact-id={id}
      data-in-panel={inPanel}
      className="my-3 w-full overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm"
    >
      <FeedbackHeader content={content} title={title} />
      {inPanel ? (
        // One copy at a time: the panel shows the feedback with room for its
        // margin, the card keeps its place in the thread.
        <p className="px-4 py-3 text-sm text-slate-600">{t('shownInPanel')}</p>
      ) : (
        <FeedbackBody content={content} annotation={annotation} view={view} />
      )}
      {/* Actions sit in the footer: floating thread controls cover the top
          corners on narrow screens. */}
      <footer className="flex flex-wrap items-center justify-end gap-1 border-t border-slate-100 px-2 py-1">
        {annotation && !inPanel ? (
          <div className="mr-auto">
            <ViewToggle view={view} onChange={setView} />
          </div>
        ) : null}
        {workspace ? (
          <button
            type="button"
            data-canvas-artifact-open
            data-cy="feedback-open"
            onClick={() => {
              if (inPanel) workspace.close()
              else
                workspace.artifacts.open('feedback', id, {
                  title,
                  content,
                  annotation,
                  sources: messageSources,
                })
            }}
            className="inline-flex min-h-8 items-center gap-1 rounded px-2 py-1 text-xs text-slate-600 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
          >
            <PanelRightOpenIcon className="size-3.5" aria-hidden />
            <span>{inPanel ? t('close') : t('openInPanel')}</span>
          </button>
        ) : null}
        <button
          type="button"
          onClick={copy}
          className="inline-flex min-h-8 items-center gap-1 rounded px-2 py-1 text-xs text-slate-600 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
        >
          {copied ? (
            <CheckIcon className="size-3.5" aria-hidden />
          ) : (
            <CopyIcon className="size-3.5" aria-hidden />
          )}
          <span>{copied ? t('copied') : t('copy')}</span>
        </button>
      </footer>
    </section>
  )
}

type FeedbackArtifact = ChatCanvasArtifact<'feedback'>

/** The feedback's heading in the shared workspace panel toolbar. */
export function FeedbackPanelTitle({
  item,
}: Readonly<{ item: FeedbackArtifact }>) {
  return <h2 className="min-w-0 truncate text-sm font-medium">{item.title}</h2>
}

/** The feedback in the workspace panel, annotated when its quotes were found. */
export function FeedbackPanelContent({
  item,
}: Readonly<{ item: FeedbackArtifact }>) {
  const [view, setView] = useState<'annotated' | 'list'>('annotated')
  return (
    <div className="min-h-0 flex-1 overflow-y-auto bg-white">
      {/* The panel toolbar already names the feedback. */}
      <FeedbackHeader
        content={item.content}
        title={item.title}
        showTitle={false}
      />
      {item.annotation ? (
        <div className="px-4 pt-3">
          <ViewToggle view={view} onChange={setView} />
        </div>
      ) : null}
      <MessageSourcesProvider value={item.sources}>
        <FeedbackBody
          content={item.content}
          annotation={item.annotation}
          view={view}
        />
      </MessageSourcesProvider>
    </div>
  )
}
