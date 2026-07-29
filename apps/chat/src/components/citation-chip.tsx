'use client'

import { useTranslations } from 'next-intl'
import type { MouseEvent } from 'react'
import { twMerge } from 'tailwind-merge'

import { resolveCitationSource } from '@/src/lib/sources/normalizeSources'
import { getSourceSecondaryLine } from '@/src/lib/sources/sourceDisplay'
import { useMessageSourcesContext } from './message-sources-context'
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip'

// Exported so `test/citation-chip.test.ts` can assert the wrap contract
// below against this exact character instead of a hand-copied duplicate
// that could silently drift out of sync. This repo's chat test setup has
// no jsdom/testing-library (see `test/thread-list-delete-confirm.test.ts`),
// so that test verifies the joiner placement as a string contract rather
// than rendering the component.
export const CITATION_CHIP_JOINER = '\u2060'

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
      {/* U+2060 WORD JOINER, front AND back — the wrap contract. With
          whitespace before a marker stripped by `splitCitationMarkers`, the
          word, the chip digit, and any trailing punctuation form one text
          run, and UAX #14 rule LB11 ("do not break before or after WJ")
          forbids the only two boundaries that could still wrap:
            - the leading WJ glues the chip to the word before it;
            - the trailing WJ glues the chip to whatever comes right after
              it — trailing punctuation (`chip.`, `chip,`) or the next chip
              in a `[1][2]` run.
          A WJ does not reach past an adjacent space: for
          `chip + " " + nextWord`, the following SP<->word boundary still
          wraps normally (rule LB18), so ordinary word-wrapping after a chip
          is unaffected.

          This only holds because the chip is a NON-ATOMIC inline. An atomic
          inline (inline-flex/inline-block) is its own break opportunity in
          Chromium and an adjacent WJ does not suppress it — the previous
          <button> version detached from its word at narrow widths despite
          both joiners, and a <button> cannot be made non-atomic
          (`display: inline` still renders as an atomic widget box). Hence
          the plain inline <a>, which is also the honest semantic: the chip
          is an in-page link to its source card. */}
      {CITATION_CHIP_JOINER}
      <Tooltip>
        <TooltipTrigger asChild>
          <a
            href={`#src-${messageId}-${source.index}`}
            data-cy="chat-citation"
            aria-label={accessibleLabel}
            onClick={handleClick}
            className={twMerge(
              'text-primary bg-primary/10 hover:bg-primary/20 focus-visible:ring-ring rounded-[4px] px-[5px] py-[3px] align-middle font-mono text-[10px] font-semibold leading-none no-underline transition-colors focus-visible:outline-none focus-visible:ring-1'
            )}
          >
            {source.index}
          </a>
        </TooltipTrigger>
        <TooltipContent className="max-w-64 text-left">
          <span className="block font-semibold">{source.title}</span>
          {secondaryLine && (
            <span className="text-muted-foreground mt-0.5 block text-[11px]">
              {secondaryLine}
            </span>
          )}
          {source.excerpt && (
            <span className="mt-1 block text-[11px] italic">
              {source.excerpt}
            </span>
          )}
          <span className="text-muted-foreground mt-1 block text-[10px]">
            {t('chat.citations.goToSource')}
          </span>
        </TooltipContent>
      </Tooltip>
      {CITATION_CHIP_JOINER}
    </sup>
  )
}
