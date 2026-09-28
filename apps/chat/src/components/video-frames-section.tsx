'use client'

import { useAuiState } from '@assistant-ui/react'
import Image from 'next/image'
import { useParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import type { ChatSourcePart } from '@/src/lib/sources/normalizeSources'
import {
  selectedVideoFrames,
  sourceForVideoFrame,
  type VideoFrame,
} from '@/src/lib/sources/videoFrames'
import { useChatStore } from '@/src/stores/chatStore'
import { CitationChip } from './citation-chip'
import { useMessageSourcesContext } from './message-sources-context'

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
  frameSrc,
  videoSrc,
}: {
  frame: VideoFrame
  frameSrc: string
  videoSrc: string
}) {
  const t = useTranslations('chat.videoFrames')
  const { sources } = useMessageSourcesContext()
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const source = sourceForVideoFrame(frame, sources)
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
        <video
          key={attempt}
          controls
          preload="metadata"
          poster={frameSrc}
          src={`${videoSrc}#t=${frame.start_sec},${frame.end_sec}`}
          aria-label={label}
          onError={() => setFailed(true)}
          className="h-auto w-full object-contain"
        >
          <Image
            src={frameSrc}
            alt={label}
            width={frame.width_px}
            height={frame.height_px}
            unoptimized
          />
        </video>
      )}
      <figcaption className="border-border flex items-center gap-1 border-t px-3 py-2 text-sm text-muted-foreground">
        {source && <CitationChip index={source.index} />}
        <span>{label}</span>
      </figcaption>
    </figure>
  )
}

export function InlineVideoFrame({ frame }: { frame: VideoFrame }) {
  const { chatbotId } = useParams<{ chatbotId: string }>()
  const threadId = useChatStore((state) => state.activeThreadId)
  const messageId = useAuiState((state) => state.message.id)
  if (!chatbotId || !threadId) return null

  return (
    <VideoFrameCard
      frame={frame}
      frameSrc={`/api/chatbots/${chatbotId}/threads/${threadId}/messages/${messageId}/frames/${frame.asset_id}`}
      videoSrc={`/api/chatbots/${chatbotId}/threads/${threadId}/messages/${messageId}/videos/${frame.asset_id}`}
    />
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
          frameSrc={`/api/chatbots/${chatbotId}/threads/${threadId}/messages/${message.id}/frames/${frame.asset_id}`}
          videoSrc={`/api/chatbots/${chatbotId}/threads/${threadId}/messages/${message.id}/videos/${frame.asset_id}`}
        />
      ))}
    </div>
  )
}
