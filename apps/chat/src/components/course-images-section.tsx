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
    page: image.physical_page_number,
  })
  return (
    <figure
      data-cy="chat-course-image"
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
          width={image.width_px}
          height={image.height_px}
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

export function CourseImagesSection() {
  const { chatbotId } = useParams<{ chatbotId: string }>()
  const threadId = useChatStore((state) => state.activeThreadId)
  const message = useAuiState((state) => state.message)
  const images = selectedCourseImages(
    message.content as readonly ChatSourcePart[]
  )
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
