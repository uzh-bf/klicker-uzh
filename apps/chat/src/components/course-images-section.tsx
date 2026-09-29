'use client'

import { useAui, useAuiState } from '@assistant-ui/react'
import Image from 'next/image'
import { useParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import {
  courseImagePlacements,
  firstCourseImagePlacementIndex,
} from '@/src/lib/markdown/remarkCourseImages'
import {
  type CourseImage,
  matchCourseImageSource,
  selectedCourseImages,
} from '@/src/lib/sources/courseImages'
import type { ChatSourcePart } from '@/src/lib/sources/normalizeSources'
import { useChatStore } from '@/src/stores/chatStore'
import { CitationChip } from './citation-chip'
import { CourseImageViewer } from './course-image-viewer'
import { useMessageSourcesContext } from './message-sources-context'

function courseImageSrc({
  chatbotId,
  threadId,
  messageId,
  assetId,
}: {
  chatbotId: string
  threadId: string
  messageId: string
  assetId: string
}) {
  return `/api/chatbots/${chatbotId}/threads/${threadId}/messages/${messageId}/images/${assetId}`
}

function usePersistedCourseImageContext() {
  const { chatbotId } = useParams<{ chatbotId: string }>()
  const threadId = useChatStore((state) => state.activeThreadId)
  const message = useAuiState((state) => state.message)
  if (
    !chatbotId ||
    !threadId ||
    message.status?.type === 'running' ||
    message.status?.type === 'requires-action'
  )
    return null
  return {
    chatbotId,
    threadId,
    messageId: message.id,
    content: (message.content ?? []) as readonly ChatSourcePart[],
  }
}

export function CourseImageCard({
  image,
  src,
  messageParts,
}: {
  image: CourseImage
  src: string
  messageParts: readonly ChatSourcePart[]
}) {
  const t = useTranslations('chat.courseImages')
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const label = t('source', {
    title: image.title,
    page: image.logical_page_number ?? image.physical_page_number,
  })
  const caption = image.captions?.map((value) => value.text).join(' ')
  // The figure points at its own Sources card, matched on the identity of the
  // retrieval record that carried the asset (see `matchCourseImageSource`).
  // An unmatched or ambiguous figure shows no citation rather than a guess.
  const { sources } = useMessageSourcesContext()
  const citationSource = matchCourseImageSource(image, sources, messageParts)
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
        <CourseImageViewer
          src={src}
          alt={caption || label}
          label={label}
          caption={caption}
          width={image.width_px}
          height={image.height_px}
        >
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
        </CourseImageViewer>
      )}
      <figcaption className="mt-2 text-xs text-muted-foreground">
        {image.captions?.map((entry) => (
          <p key={entry.ref}>{entry.text}</p>
        ))}
        <p className={caption ? 'mt-1' : undefined}>
          {label}
          {citationSource && (
            <>
              {' '}
              <CitationChip index={citationSource.index} />
            </>
          )}
        </p>
      </figcaption>
    </figure>
  )
}

export function InlineCourseImage({ assetId }: { assetId: string }) {
  const aui = useAui()
  const context = usePersistedCourseImageContext()
  const partIndex =
    aui.part.source === 'message' && aui.part.query.type === 'index'
      ? aui.part.query.index
      : -1
  const firstPlacementIndex = context
    ? firstCourseImagePlacementIndex(
        context.content.map((part) =>
          part.type === 'text' && typeof part.text === 'string'
            ? part.text
            : null
        ),
        assetId
      )
    : -1
  const image = context
    ? selectedCourseImages(context.content).find(
        (candidate) => candidate.asset_id === assetId
      )
    : undefined
  // The image endpoint authorizes against the persisted assistant message.
  if (!image || !context || partIndex !== firstPlacementIndex) return null
  return (
    <CourseImageCard
      image={image}
      messageParts={context.content}
      src={courseImageSrc({
        ...context,
        assetId: image.asset_id,
      })}
    />
  )
}

export function CourseImagesSection() {
  const context = usePersistedCourseImageContext()
  if (!context) return null
  const placements = new Set(
    context.content.flatMap((part) =>
      part.type === 'text' && typeof part.text === 'string'
        ? courseImagePlacements(part.text)
        : []
    )
  )
  const images = selectedCourseImages(context.content).filter(
    (image) => !placements.has(image.asset_id)
  )
  if (images.length === 0) return null
  return (
    <div>
      {images.map((image) => (
        <CourseImageCard
          key={`${context.messageId}-${image.asset_id}`}
          image={image}
          messageParts={context.content}
          src={courseImageSrc({
            ...context,
            assetId: image.asset_id,
          })}
        />
      ))}
    </div>
  )
}
