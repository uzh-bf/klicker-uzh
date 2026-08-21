import {
  BookOpenIcon,
  ExternalLinkIcon,
  FileTextIcon,
  ImageIcon,
  LinkIcon,
  PlayIcon,
} from 'lucide-react'
import { useTranslations } from 'next-intl'
import { type ComponentType, type SVGProps } from 'react'
import { twMerge } from 'tailwind-merge'

import {
  getSourceSecondaryLine,
  isMediaSource,
} from '@/src/lib/sources/sourceDisplay'
import type { ChatSource, ChatSourceType } from '@/src/lib/sources/types'
import { useMessageSourcesContext } from './message-sources-context'

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
  const isMedia = isMediaSource(source)
  const secondaryLine = getSourceSecondaryLine(source, t)

  const inner = (
    <>
      {/* The visible index badge below is aria-hidden — without this, a
          screen-reader user following a citation chip's "Source 1: ..." link
          would land on a card with no announced number to confirm the
          match. Styled as the same filled-badge family as `CitationChip`
          (bg-primary/10 + rounded square), just a size up for the roomier
          card context, so the two indices read as one visual token instead
          of two different numbering conventions — hence a plain digit
          here too, no leading-zero `padStart`, matching the inline chip. */}
      <span className="sr-only">
        {t('chat.citations.label', {
          index: source.index,
          title: source.title,
        })}
      </span>
      <span
        aria-hidden="true"
        className="bg-primary/10 text-primary mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-[4px] font-mono text-xs font-semibold tabular-nums"
      >
        {source.index}
      </span>
      <Icon
        aria-hidden="true"
        className="text-muted-foreground mt-0.5 size-3.5 shrink-0"
      />
      <span className="min-w-0 flex-1">
        {/* Two lines, not `truncate`: these are file names like
            `kapitel-4-erwartungswert-und-varianz.pdf`, which a single
            ellipsized line cuts before the part that identifies it. `title`
            keeps the untruncated name reachable on hover. No `block` here —
            it would override the `display: -webkit-box` that `line-clamp-2`
            needs, silently disabling the clamp. */}
        <span
          title={source.title}
          className="text-foreground line-clamp-2 break-words text-sm font-medium"
        >
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
      // `focus-visible` applies to both branches: a citation chip can send
      // programmatic focus to a non-url card too (see `tabIndex={-1}`
      // below), and that focus needs to stay visible even though the card
      // itself isn't a link. The hover treatment stays url-only — hovering
      // a card that does nothing would be a misleading affordance.
      'border-border bg-background focus-visible:ring-ring flex min-w-0 items-start gap-2 rounded-lg border p-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-1',
      isMedia && 'w-auto max-w-[16rem]',
      source.url && 'hover:bg-accent hover:text-accent-foreground'
    ),
  }

  // Only sources with a url are interactive for Tab navigation — everything
  // else stays role-less and out of the tab order. `tabIndex={-1}` on the
  // non-url card below only enables the programmatic focus a citation chip
  // sends here (see citation-chip.tsx); Tab still skips straight past it.
  if (source.url) {
    return (
      <a
        {...sharedProps}
        href={source.url}
        target="_blank"
        rel="noopener noreferrer"
      >
        {inner}
        {/* `target="_blank"` is otherwise only signalled visually (the
            external-link icon above is aria-hidden), so the accessible name
            has to carry the new-tab hint itself. */}
        <span className="sr-only">{t('chat.common.opensInNewTab')}</span>
      </a>
    )
  }

  return (
    <div {...sharedProps} tabIndex={-1}>
      {inner}
    </div>
  )
}

export function SourcesSection() {
  const t = useTranslations()
  // Computed once in `AssistantMessage` (see `useMessageSources`) and shared
  // via context with the inline citation chips, instead of re-parsing the
  // tool JSON here again.
  const { messageId, sources } = useMessageSourcesContext()

  if (sources.length === 0) return null

  const documentSources = sources.filter((s) => !isMediaSource(s))
  const mediaSources = sources.filter((s) => isMediaSource(s))
  const headingId = `chat-sources-heading-${messageId}`

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

      {/* `auto-fit`, not `auto-fill`: with fewer cards than would fit, the
          empty tracks collapse and the cards stretch across the full row —
          cards only wrap when they genuinely no longer fit. The `min(230px,
          100%)` floor keeps a track from forcing horizontal overflow in
          containers narrower than 230px (embedded mode). */}
      {documentSources.length > 0 && (
        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(230px,100%),1fr))] gap-2">
          {documentSources.map((source) => (
            <SourceCard key={source.id} source={source} messageId={messageId} />
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
            <SourceCard key={source.id} source={source} messageId={messageId} />
          ))}
        </div>
      )}
    </section>
  )
}
