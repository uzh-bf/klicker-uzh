'use client'

import { useAuiState } from '@assistant-ui/react'
import Image from 'next/image'
import { useParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import {
  type CourseImage,
  selectedCourseImages,
} from '@/src/lib/sources/courseImages'
import { courseImagePlacements } from '@/src/lib/markdown/remarkCourseImages'
import type { ChatSourcePart } from '@/src/lib/sources/normalizeSources'
import { useChatStore } from '@/src/stores/chatStore'

export function CourseImageCard({
  image,
  src,
}: {
  image: CourseImage
  src: string
}) {
  const t = useTranslations('chat.courseImages')
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const label = t('source', {
    title: image.title,
    page: image.logical_page_number ?? image.physical_page_number,
  })
  const caption = image.captions?.map((value) => value.text).join(' ')
  return (
    <figure
      data-cy="chat-course-image"
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
        <Image
          key={attempt}
          src={src}
          alt={caption || label}
          width={image.width_px}
          height={image.height_px}
          unoptimized
          onError={() => setFailed(true)}
          className="h-auto w-full object-contain"
        />
      )}
      <figcaption className="mt-2 text-xs text-muted-foreground">
        {image.captions?.map((entry, index) => (
          <p key={`${entry.ref}-${index}`}>{entry.text}</p>
        ))}
        <p className={caption ? 'mt-1' : undefined}>{label}</p>
      </figcaption>
    </figure>
  )
}

export function InlineCourseImage({ assetId }: { assetId: string }) {
  const { chatbotId } = useParams<{ chatbotId: string }>()
  const threadId = useChatStore((state) => state.activeThreadId)
  const message = useAuiState((state) => state.message)
  const image = selectedCourseImages(
    message.content as readonly ChatSourcePart[]
  ).find((candidate) => candidate.asset_id === assetId)
  // The image endpoint authorizes against the persisted assistant message.
  if (
    !image ||
    !chatbotId ||
    !threadId ||
    message.status?.type === 'running' ||
    message.status?.type === 'requires-action'
  )
    return null
  return (
    <CourseImageCard
      image={image}
      src={`/api/chatbots/${chatbotId}/threads/${threadId}/messages/${message.id}/images/${image.asset_id}`}
    />
  )
}

export function CourseImagesSection() {
  const { chatbotId } = useParams<{ chatbotId: string }>()
  const threadId = useChatStore((state) => state.activeThreadId)
  const message = useAuiState((state) => state.message)
  const placements = new Set(
    message.content.flatMap((part) =>
      part.type === 'text' ? courseImagePlacements(part.text) : []
    )
  )
  const images = selectedCourseImages(
    message.content as readonly ChatSourcePart[]
  ).filter((image) => !placements.has(image.asset_id))
  if (!chatbotId || !threadId || images.length === 0) return null
  return (
    <div>
      {images.map((image) => (
        <CourseImageCard
          key={`${message.id}-${image.asset_id}`}
          image={image}
          src={`/api/chatbots/${chatbotId}/threads/${threadId}/messages/${message.id}/images/${image.asset_id}`}
        />
      ))}
    </div>
  )
}
