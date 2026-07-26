import { useMessage } from '@assistant-ui/react'
import {
  BookOpenIcon,
  ExternalLinkIcon,
  FileTextIcon,
  ImageIcon,
  LinkIcon,
  PlayIcon,
} from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useMemo, type ComponentType, type SVGProps } from 'react'
import { twMerge } from 'tailwind-merge'

import {
  normalizeSourcesFromParts,
  type ChatSourcePart,
} from '@/src/lib/sources/normalizeSources'
import type { ChatSource, ChatSourceType } from '@/src/lib/sources/types'

// Minimal shape this component needs from the assistant message — kept local
// (rather than importing assistant-ui's ThreadAssistantMessage type) so this
// file only depends on what it actually reads, matching the
// `MessageWithCustomMetadata` pattern used elsewhere in thread.tsx. `readonly`
// matches assistant-ui's own message part arrays (and normalizeSourcesFromParts
// gets a mutable copy at the call site).
type MessageWithSourceParts = {
  id: string
  content?: readonly ChatSourcePart[]
}

// Video/image sources render as a second, more compact row (no page/chapter
// data, just a type label) — everything else (documents, plain links) shares
// the primary card grid.
const MEDIA_TYPES: readonly ChatSourceType[] = ['video', 'image']

// Module-scope map (not a function returning a component per call) so
// `<Icon />` below resolves to a stable, already-existing component
// reference rather than one "created during render".
const SOURCE_TYPE_ICONS: Record<
  ChatSourceType,
  ComponentType<SVGProps<SVGSVGElement>>
> = {
  video: PlayIcon,
  image: ImageIcon,
  link: LinkIcon,
  document: FileTextIcon,
}

function SourceCard({
  source,
  messageId,
}: {
  source: ChatSource
  messageId: string
}) {
  const t = useTranslations()
  const Icon = SOURCE_TYPE_ICONS[source.type]
  const isMedia = MEDIA_TYPES.includes(source.type)

  // "S. 4 · IV" when both a numeric page and a human page label are
  // present, either one alone, a type label for video/image, or null when
  // none of these apply.
  const secondaryLineParts: string[] = []
  if (isMedia) {
    secondaryLineParts.push(
      t(source.type === 'video' ? 'chat.sources.video' : 'chat.sources.image')
    )
  }
  if (typeof source.page === 'number') {
    secondaryLineParts.push(t('chat.sources.page', { page: source.page }))
  }
  if (source.labeledPage) secondaryLineParts.push(source.labeledPage)
  const secondaryLine =
    secondaryLineParts.length > 0 ? secondaryLineParts.join(' · ') : null

  const inner = (
    <>
      <span
        aria-hidden="true"
        className="text-muted-foreground shrink-0 pt-0.5 font-mono text-xs tabular-nums"
      >
        {String(source.index).padStart(2, '0')}
      </span>
      <Icon
        aria-hidden="true"
        className="text-muted-foreground mt-0.5 size-3.5 shrink-0"
      />
      <span className="min-w-0 flex-1">
        <span className="text-foreground block truncate text-sm font-medium">
          {source.title}
        </span>
        {secondaryLine && (
          <span className="text-muted-foreground block truncate text-xs">
            {secondaryLine}
          </span>
        )}
        {source.excerpt && (
          <span className="text-muted-foreground mt-1 line-clamp-2 block text-xs italic">
            {source.excerpt}
          </span>
        )}
      </span>
      {source.url && (
        <ExternalLinkIcon
          aria-hidden="true"
          className="text-muted-foreground mt-0.5 size-3 shrink-0"
        />
      )}
    </>
  )

  const sharedProps = {
    id: `src-${messageId}-${source.index}`,
    'data-cy': 'chat-source-card',
    className: twMerge(
      'border-border bg-background flex min-w-0 items-start gap-2 rounded-lg border p-2 text-left transition-colors',
      isMedia && 'w-auto max-w-[16rem]',
      source.url &&
        'hover:bg-accent hover:text-accent-foreground focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-1'
    ),
  }

  // Only sources with a url are interactive — everything else stays a plain,
  // non-focusable card (no tabIndex/role) so screen readers and keyboard
  // navigation skip straight past it.
  if (source.url) {
    return (
      <a
        {...sharedProps}
        href={source.url}
        target="_blank"
        rel="noopener noreferrer"
      >
        {inner}
      </a>
    )
  }

  return <div {...sharedProps}>{inner}</div>
}

export function SourcesSection() {
  const t = useTranslations()
  const message = useMessage() as MessageWithSourceParts
  const parts = message.content ?? []

  // The message store re-renders this component on every streamed token and
  // rebuilds `content` (so its reference is never stable). Tool results are
  // set exactly once, so a cheap fingerprint of the tool-call parts is enough
  // to skip re-parsing the tool JSON on unrelated re-renders.
  let fingerprint = message.id
  for (const part of parts) {
    if (part.type !== 'tool-call') continue
    const result = part.result
    const resultMark =
      result === undefined || result === null
        ? '-'
        : typeof result === 'string'
          ? `s${result.length}`
          : 'o'
    fingerprint += `|${'toolCallId' in part ? String(part.toolCallId) : ''}:${part.isError ? 1 : 0}:${resultMark}`
  }

  const sources = useMemo(
    () => normalizeSourcesFromParts(parts),
    // Deliberately keyed on the fingerprint: `parts` is referentially
    // unstable on every render, and the fingerprint captures the values that
    // can actually change the normalization result.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [fingerprint]
  )

  if (sources.length === 0) return null

  const documentSources = sources.filter((s) => !MEDIA_TYPES.includes(s.type))
  const mediaSources = sources.filter((s) => MEDIA_TYPES.includes(s.type))
  const headingId = `chat-sources-heading-${message.id}`

  return (
    <section
      aria-labelledby={headingId}
      data-cy="chat-sources-section"
      className="border-border mt-3 border-t border-dashed pt-3"
    >
      <h3
        id={headingId}
        className="text-muted-foreground mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide"
      >
        <BookOpenIcon aria-hidden="true" className="size-3.5" />
        {t('chat.sources.title')} · {sources.length}
      </h3>

      {documentSources.length > 0 && (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(230px,1fr))] gap-2">
          {documentSources.map((source) => (
            <SourceCard
              key={source.id}
              source={source}
              messageId={message.id}
            />
          ))}
        </div>
      )}

      {mediaSources.length > 0 && (
        <div
          className={twMerge(
            'flex flex-wrap gap-2',
            documentSources.length > 0 && 'mt-2'
          )}
        >
          {mediaSources.map((source) => (
            <SourceCard
              key={source.id}
              source={source}
              messageId={message.id}
            />
          ))}
        </div>
      )}
    </section>
  )
}
