'use client'

import { useParams } from 'next/navigation'
import { useState } from 'react'
import { hasAllImageAttachmentsHydrated } from '../lib/attachments/attachmentState'
import {
  canOpenMessageAttachment,
  getAttachmentPreviewSrc,
} from '../lib/attachments/attachmentUi'
import { useChatStore } from '../stores/chatStore'
import {
  AttachmentPlaceholder,
  ThreadImageViewerModal,
} from './thread-image-viewer-modal'

type MessageImageAttachment = {
  id?: string
  type: 'image'
  position?: number
  imageBase64?: string | null
  imagePreviewBase64?: string | null
  imageDescription?: string | null
  hasFullImage?: boolean
}

interface MessageAttachmentsProps {
  attachments: MessageImageAttachment[]
  messageId?: string
  hydrationSourceMessageId?: string | null
  variant?: 'history' | 'edit'
  className?: string
}

const HYDRATION_ERROR_MESSAGE =
  'Image attachments for this message could not be loaded. Please try again.'

export function MessageAttachments({
  attachments,
  messageId,
  hydrationSourceMessageId,
  variant = 'history',
  className = '',
}: MessageAttachmentsProps) {
  const { chatbotId } = useParams<{ chatbotId: string }>()
  const activeThreadId = useChatStore((state) => state.activeThreadId)
  const ensureFullImageAttachments = useChatStore(
    (state) => state.ensureFullImageAttachments
  )
  const [viewerAttachmentIndex, setViewerAttachmentIndex] = useState<
    number | null
  >(null)
  const [isHydrating, setIsHydrating] = useState(false)
  const [viewerError, setViewerError] = useState<string | null>(null)

  const viewerAttachment =
    viewerAttachmentIndex != null
      ? (attachments[viewerAttachmentIndex] ?? null)
      : null

  const isCompact = variant === 'history'
  const tileClassName = isCompact ? 'size-10 sm:size-12' : 'size-16 sm:size-20'
  const canHydratePersistedAttachment = Boolean(
    chatbotId && activeThreadId && messageId
  )

  const hydrateMessageAttachments = async () => {
    if (!chatbotId || !activeThreadId || !messageId) {
      return
    }

    if (hasAllImageAttachmentsHydrated(attachments)) {
      return
    }

    setIsHydrating(true)
    setViewerError(null)

    try {
      const hydratedMessage = await ensureFullImageAttachments(
        chatbotId,
        activeThreadId,
        messageId,
        hydrationSourceMessageId ?? undefined
      )
      const hydratedAttachments = hydratedMessage?.imageAttachments ?? []

      if (!hasAllImageAttachmentsHydrated(hydratedAttachments)) {
        setViewerError(HYDRATION_ERROR_MESSAGE)
      }
    } finally {
      setIsHydrating(false)
    }
  }

  const handleOpen = async (
    attachment: MessageImageAttachment,
    index: number
  ) => {
    const openState = canOpenMessageAttachment({
      attachment,
      canHydratePersistedAttachment,
    })

    if (!openState.canOpen) {
      return
    }

    setViewerAttachmentIndex(index)
    setViewerError(null)

    if (openState.shouldHydrate) {
      await hydrateMessageAttachments()
    }
  }

  if (attachments.length === 0) return null

  return (
    <>
      <div
        data-cy="chat-message-attachments"
        className={`flex flex-wrap gap-2 ${className}`.trim()}
      >
        {attachments.map((attachment, index) => {
          const previewSrc = getAttachmentPreviewSrc(attachment, variant)
          const openState = canOpenMessageAttachment({
            attachment,
            canHydratePersistedAttachment,
          })
          const label =
            attachment.imageDescription?.trim() || `Attached image ${index + 1}`

          return (
            <button
              key={attachment.id ?? `${attachment.position ?? index}`}
              type="button"
              data-cy="chat-message-attachment"
              onClick={() => void handleOpen(attachment, index)}
              disabled={!openState.canOpen}
              className={`overflow-hidden rounded-md border ${tileClassName} ${
                openState.canOpen
                  ? 'cursor-pointer transition-opacity hover:opacity-80'
                  : 'cursor-default'
              }`}
            >
              {previewSrc ? (
                <img
                  src={previewSrc}
                  alt={label}
                  className="size-full object-cover"
                />
              ) : (
                <AttachmentPlaceholder compact />
              )}
            </button>
          )
        })}
      </div>

      <ThreadImageViewerModal
        attachment={viewerAttachment ?? undefined}
        isLoading={isHydrating}
        isOpen={viewerAttachmentIndex != null}
        error={viewerError}
        onClose={() => {
          setViewerAttachmentIndex(null)
          setViewerError(null)
        }}
        onRetry={() => void hydrateMessageAttachments()}
      />
    </>
  )
}
