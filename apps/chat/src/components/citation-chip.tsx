'use client'

import { useTranslations } from 'next-intl'
import type { MouseEvent } from 'react'
import { twMerge } from 'tailwind-merge'

import { resolveCitationSource } from '@/src/lib/sources/normalizeSources'
import { getSourceSecondaryLine } from '@/src/lib/sources/sourceDisplay'
import { useMessageSourcesContext } from './message-sources-context'
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip'

/**
 * Renders a `[n]` marker (already turned into a `#cite-<n>` link node by
 * `remarkCitationMarkers`) as a small superscript citation chip when — and
 * only when — the current message's normalized sources actually contain
 * index `n`. Otherwise renders the original literal text, e.g. an
 * out-of-range `[7]` or a marker in a message with no sources at all.
 */
export function CitationChip({ index }: { index: number }) {
  const t = useTranslations()
  const { messageId, sources } = useMessageSourcesContext()
  const source = resolveCitationSource(index, sources)

  if (!source) return <>{`[${index}]`}</>

  const secondaryLine = getSourceSecondaryLine(source, t)
  const accessibleLabel = t('chat.citations.label', {
    index: source.index,
    title: source.title,
  })

  const handleClick = (event: MouseEvent) => {
    event.preventDefault()
    document
      .getElementById(`src-${messageId}-${source.index}`)
      ?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  return (
    <sup className="mx-px">
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            data-cy="chat-citation"
            aria-label={accessibleLabel}
            onClick={handleClick}
            className={twMerge(
              'text-primary bg-primary/10 hover:bg-primary/20 focus-visible:ring-ring inline-flex size-4 items-center justify-center rounded-[4px] align-middle font-mono text-[10px] font-semibold leading-none transition-colors focus-visible:outline-none focus-visible:ring-1'
            )}
          >
            {source.index}
          </button>
        </TooltipTrigger>
        <TooltipContent className="max-w-64 text-left">
          <span className="block font-semibold">{source.title}</span>
          {secondaryLine && (
            <span className="text-primary-foreground/80 mt-0.5 block text-[11px]">
              {secondaryLine}
            </span>
          )}
          {source.excerpt && (
            <span className="mt-1 block text-[11px] italic">
              {source.excerpt}
            </span>
          )}
          <span className="text-primary-foreground/70 mt-1 block text-[10px]">
            {t('chat.citations.goToSource')}
          </span>
        </TooltipContent>
      </Tooltip>
    </sup>
  )
}
