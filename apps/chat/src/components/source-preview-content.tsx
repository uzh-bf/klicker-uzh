'use client'

import Image from 'next/image'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { useSourceMedia } from '@/src/hooks/useSourceMedia'

import {
  formatTimestamp,
  getSourceSecondaryLine,
} from '@/src/lib/sources/sourceDisplay'
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
  const { frameSrc } = useSourceMedia(source)
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
      {frameSrc && source.videoFrame && (
        <SourceFramePreview key={frameSrc} src={frameSrc} source={source} />
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

function SourceFramePreview({
  src,
  source,
}: {
  src: string
  source: ChatSource
}) {
  const t = useTranslations('chat.videoFrames')
  const [failed, setFailed] = useState(false)
  const frame = source.videoFrame
  if (!frame) return null
  if (failed)
    return <span className="mt-2 block text-xs">{t('unavailable')}</span>
  return (
    <Image
      data-cy="chat-source-frame-preview"
      src={src}
      alt={t('source', {
        title: source.title,
        timestamp: formatTimestamp(frame.timestamp_sec),
      })}
      width={frame.width_px}
      height={frame.height_px}
      unoptimized
      onError={() => setFailed(true)}
      className="my-2 max-h-48 w-full rounded-md object-contain"
    />
  )
}
