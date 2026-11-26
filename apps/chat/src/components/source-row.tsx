'use client'

import { ExternalLinkIcon } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useSourceMedia } from '@/src/hooks/useSourceMedia'
import { getSourceSecondaryLine } from '@/src/lib/sources/sourceDisplay'
import type { ChatSource } from '@/src/lib/sources/types'
import { useMessageSourcesContext } from './message-sources-context'
import { SourcePreviewContent } from './source-preview-content'
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip'

// Compact single-line source row for embedded and mobile layouts. Same
// normalized source list as the card grid (`useMessageSources`), one line per
// source: index badge, truncated title, optional page/position label and the
// external-link affordance. Full details stay in the shared tooltip, so the
// compact shape does not hide information the card revealed.
//
// `citedPageRange` travels with the row exactly as it does for the card grid:
// the compact form is the embedded and narrow-screen surface, so it must not be
// the one place that falls back to the retrieved page envelope.
export function SourceRow({
  source,
  citedPageRange,
}: {
  source: ChatSource
  citedPageRange?: string
}) {
  const t = useTranslations()
  const { href } = useSourceMedia(source)
  const { messageId } = useMessageSourcesContext()
  const secondaryLine = getSourceSecondaryLine(source, t, citedPageRange)

  const content = (
    <>
      <span
        aria-hidden="true"
        className="bg-primary/10 text-primary inline-flex size-4 shrink-0 items-center justify-center rounded-[4px] font-mono text-[11px] font-semibold tabular-nums"
      >
        {source.index}
      </span>
      <span className="text-foreground min-w-0 flex-1 truncate text-xs font-medium">
        {source.title}
      </span>
      {secondaryLine && (
        <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
          {secondaryLine}
        </span>
      )}
      {href && (
        <ExternalLinkIcon
          aria-hidden="true"
          className="text-muted-foreground size-3 shrink-0"
        />
      )}
    </>
  )

  const className =
    'focus-visible:ring-ring flex min-w-0 items-center gap-1.5 rounded-md py-0.5 text-left transition-colors outline-none focus-visible:ring-1 focus-visible:ring-ring' +
    (href ? ' hover:bg-accent hover:text-accent-foreground' : '')

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        {href ? (
          <a
            href={href}
            id={`src-${messageId}-${source.index}`}
            data-cy="chat-source-row"
            target="_blank"
            rel="noopener noreferrer"
            className={className}
          >
            {content}
            <span className="sr-only">{t('chat.common.opensInNewTab')}</span>
          </a>
        ) : (
          // biome-ignore lint/a11y/noNoninteractiveTabindex: Keyboard focus exposes the same passive preview as hover.
          <span
            id={`src-${messageId}-${source.index}`}
            data-cy="chat-source-row"
            tabIndex={0}
            className={className}
          >
            {content}
          </span>
        )}
      </TooltipTrigger>
      <TooltipContent className="max-w-80 text-left">
        <span className="sr-only">
          {t('chat.citations.label', {
            index: source.index,
            title: source.title,
          })}
        </span>
        <SourcePreviewContent source={source} />
      </TooltipContent>
    </Tooltip>
  )
}
