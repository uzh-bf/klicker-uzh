'use client'

import Image from 'next/image'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { formatTimestamp } from '@/src/lib/sources/sourceDisplay'
import {
  sourceForVideoFrame,
  type VideoFrame,
} from '@/src/lib/sources/videoFrames'
import { CitationChip } from './citation-chip'
import { CourseImageViewer } from './course-image-viewer'
import { useMessageSourcesContext } from './message-sources-context'

export function VideoFrameCard({
  frame,
  frameSrc,
}: {
  frame: VideoFrame
  frameSrc: string
}) {
  const t = useTranslations('chat.videoFrames')
  const { sources } = useMessageSourcesContext()
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const source = sourceForVideoFrame(frame, sources)
  const label = t('source', {
    title: frame.title,
    timestamp: formatTimestamp(frame.timestamp_sec),
  })
  return (
    <figure
      data-cy="chat-video-frame"
      className="my-5 overflow-hidden rounded-lg"
    >
      {failed ? (
        <div role="alert" className="p-4 text-sm">
          <p>{t('unavailable')}</p>
          <button
            type="button"
            className="mt-2 min-h-11 rounded-md border px-3 focus-visible:outline focus-visible:outline-2"
            onClick={() => {
              setFailed(false)
              setAttempt((value) => value + 1)
            }}
          >
            {t('retry')}
          </button>
        </div>
      ) : (
        <CourseImageViewer
          src={frameSrc}
          alt={label}
          label={label}
          width={frame.width_px}
          height={frame.height_px}
        >
          <Image
            key={attempt}
            src={frameSrc}
            alt={label}
            width={frame.width_px}
            height={frame.height_px}
            unoptimized
            onError={() => setFailed(true)}
            className="h-auto w-full object-contain"
          />
        </CourseImageViewer>
      )}
      <figcaption className="mt-2 text-xs text-muted-foreground">
        <p>
          {label}
          {source && (
            <>
              {' '}
              <CitationChip index={source.index} />
            </>
          )}
        </p>
      </figcaption>
    </figure>
  )
}
