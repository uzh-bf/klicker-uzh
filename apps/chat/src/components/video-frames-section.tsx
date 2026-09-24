'use client'

import { useAuiState } from '@assistant-ui/react'
import Image from 'next/image'
import { useParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import type { ChatSourcePart } from '@/src/lib/sources/normalizeSources'
import {
  selectedVideoFrames,
  type VideoFrame,
} from '@/src/lib/sources/videoFrames'
import { useChatStore } from '@/src/stores/chatStore'

function timestamp(totalSeconds: number) {
  const safe = Math.max(0, Math.floor(totalSeconds))
  const hours = Math.floor(safe / 3600)
  const minutes = Math.floor((safe % 3600) / 60)
  const seconds = String(safe % 60).padStart(2, '0')
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, '0')}:${seconds}`
    : `${minutes}:${seconds}`
}

export function VideoFrameCard({
  frame,
  src,
}: {
  frame: VideoFrame
  src: string
}) {
  const t = useTranslations('chat.videoFrames')
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const label = t('source', {
    title: frame.title,
    timestamp: timestamp(frame.timestamp_sec),
  })
  return (
    <figure
      data-cy="chat-video-frame"
      className="border-border my-3 overflow-hidden rounded-xl border bg-background"
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
        <Image
          key={attempt}
          src={src}
          alt={label}
          width={frame.width_px}
          height={frame.height_px}
          unoptimized
          onError={() => setFailed(true)}
          className="h-auto w-full object-contain"
        />
      )}
      <figcaption className="border-border border-t px-3 py-2 text-sm text-muted-foreground">
        {label}
      </figcaption>
    </figure>
  )
}

export function VideoFramesSection() {
  const { chatbotId } = useParams<{ chatbotId: string }>()
  const threadId = useChatStore((state) => state.activeThreadId)
  const message = useAuiState((state) => state.message)
  const frames = selectedVideoFrames(
    message.content as readonly ChatSourcePart[]
  )
  if (!chatbotId || !threadId || frames.length === 0) return null
  return (
    <div>
      {frames.map((frame) => (
        <VideoFrameCard
          key={`${message.id}-${frame.asset_id}`}
          frame={frame}
          src={`/api/chatbots/${chatbotId}/threads/${threadId}/messages/${message.id}/frames/${frame.asset_id}`}
        />
      ))}
    </div>
  )
}
