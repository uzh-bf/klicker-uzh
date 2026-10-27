'use client'

import { useTranslations } from 'next-intl'

import { getSourceSecondaryLine } from '@/src/lib/sources/sourceDisplay'
import type { ChatSource } from '@/src/lib/sources/types'
import { useMessageSourcesContext } from './message-sources-context'

export function SourcePreviewContent({
  source,
  showNavigationHint = false,
}: {
  source: ChatSource
  showNavigationHint?: boolean
}) {
  const t = useTranslations()
  // Cited pages, when the answer carries them; outside an assistant message
  // the context default is empty and the retrieved range stays in place.
  const { citedPageRanges } = useMessageSourcesContext()
  const secondaryLine = getSourceSecondaryLine(
    source,
    t,
    citedPageRanges.get(source.index)
  )

  return (
    <div data-cy="chat-source-preview">
      <span className="block font-semibold">{source.title}</span>
      {secondaryLine && (
        <span className="text-muted-foreground mt-0.5 block text-[11px]">
          {secondaryLine}
        </span>
      )}
      {source.excerpt && (
        <span className="mt-1 block text-[11px] italic">{source.excerpt}</span>
      )}
      {showNavigationHint && (
        <span className="text-muted-foreground mt-1 block text-[10px]">
          {t('chat.citations.goToSource')}
        </span>
      )}
    </div>
  )
}
