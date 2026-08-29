import { useThreadViewportStore } from '@assistant-ui/react'
import {
  BookOpenIcon,
  ExternalLinkIcon,
  FileTextIcon,
  ImageIcon,
  LinkIcon,
  PlayIcon,
} from 'lucide-react'
import { useTranslations } from 'next-intl'
import {
  type ComponentType,
  type SVGProps,
  useLayoutEffect,
  useRef,
} from 'react'
import { twMerge } from 'tailwind-merge'

import { getSourceSecondaryLine } from '@/src/lib/sources/sourceDisplay'
import type { ChatSource, ChatSourceType } from '@/src/lib/sources/types'
import { useMessageSourcesContext } from './message-sources-context'
import { SourceActionLinks } from './source-action-links'
import { SourcePreviewContent } from './source-preview-content'
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip'

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
            ellipsized line cuts before the part that identifies it. No
            `block` here —
            it would override the `display: -webkit-box` that `line-clamp-2`
            needs, silently disabling the clamp. */}
        <span className="text-foreground line-clamp-2 break-words text-sm font-medium">
          {source.title}
        </span>
        {secondaryLine && (
          <span className="text-muted-foreground block truncate text-xs">
            {secondaryLine}
          </span>
        )}
      </span>
      {(source.url || source.elementReference) && (
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
      // programmatic focus to a non-url card too, and that focus needs to
      // stay visible even though the card itself isn't a link. All cards use
      // the same passive tooltip for their source details.
      'border-border bg-background focus-visible:ring-ring flex h-full min-w-0 items-start gap-2 rounded-lg border p-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-1',
      source.url &&
        !source.elementReference &&
        'hover:bg-accent hover:text-accent-foreground'
    ),
  }

  const card = source.elementReference ? (
    // biome-ignore lint/a11y/noNoninteractiveTabindex: Citation navigation focuses this passive source summary before the participant chooses a locator action.
    <div {...sharedProps} tabIndex={0}>
      {inner}
      <SourceActionLinks source={source.elementReference} />
    </div>
  ) : source.url ? (
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
  ) : (
    // biome-ignore lint/a11y/noNoninteractiveTabindex: The passive source card must be keyboard-focusable so its hover-equivalent preview is available without presenting a fake action.
    <div {...sharedProps} tabIndex={0}>
      {inner}
    </div>
  )

  return (
    <Tooltip>
      <TooltipTrigger asChild>{card}</TooltipTrigger>
      <TooltipContent className="max-w-64 text-left">
        <SourcePreviewContent source={source} />
      </TooltipContent>
    </Tooltip>
  )
}

export function SourcesSection() {
  const t = useTranslations()
  // Computed once in `AssistantMessage` (see `useMessageSources`) and shared
  // via context with the inline citation chips, instead of re-parsing the
  // tool JSON here again.
  const { messageId, sources } = useMessageSourcesContext()
  const threadViewportStore = useThreadViewportStore()
  const revealOnMountRef = useRef(threadViewportStore.getState().isAtBottom)
  const headingRef = useRef<HTMLHeadingElement>(null)

  // Auto-scroll follows the answer while it streams but deliberately switches
  // off before this terminal-only section mounts. If the participant was still
  // following at the bottom, reveal just the sources heading with the smallest
  // possible scroll instead of jumping to the final card. If they had scrolled
  // up, preserve their position entirely.
  useLayoutEffect(() => {
    if (!revealOnMountRef.current) return
    headingRef.current?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }, [])

  if (sources.length === 0) return null

  const headingId = `chat-sources-heading-${messageId}`

  return (
    <section
      aria-labelledby={headingId}
      data-cy="chat-sources-section"
      className="border-border animate-in fade-in mt-3 min-w-0 border-t border-dashed pt-3 duration-300 motion-reduce:animate-none"
    >
      <h3
        ref={headingRef}
        id={headingId}
        className="text-muted-foreground mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide"
      >
        <BookOpenIcon aria-hidden="true" className="size-3.5" />
        {t('chat.sources.title')} · {sources.length}
      </h3>

      {/* All source types share one responsive grid. Equal-width tracks keep
          mixed document/media results aligned, while min(230px, 100%) prevents
          horizontal overflow in mobile and embedded containers. */}
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(230px,100%),1fr))] items-stretch gap-2">
        {sources.map((source) => (
          <SourceCard key={source.id} source={source} messageId={messageId} />
        ))}
      </div>
    </section>
  )
}
