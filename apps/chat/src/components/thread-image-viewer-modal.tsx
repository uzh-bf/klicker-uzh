'use client'

import { normalizeCustomMathTags } from '@/src/components/markdown-text'
import { Markdown } from '@klicker-uzh/markdown'
import { Button, Modal } from '@uzh-bf/design-system'

type MessageImageAttachment = {
  id?: string
  type: 'image'
  position?: number
  imageBase64?: string | null
  imagePreviewBase64?: string | null
  imageDescription?: string | null
  hasFullImage?: boolean
}

interface ThreadImageViewerModalProps {
  attachment?: MessageImageAttachment
  isLoading: boolean
  isOpen: boolean
  error: string | null
  onClose: () => void
  onRetry: () => void
}

function AttachmentPlaceholder({ compact = false }: { compact?: boolean }) {
  return (
    <div
      className={
        compact
          ? 'text-muted-foreground bg-muted flex size-full items-center justify-center rounded-md text-[10px] font-medium'
          : 'text-muted-foreground bg-muted flex min-h-72 w-full items-center justify-center rounded-lg border text-sm font-medium'
      }
    >
      Preview unavailable
    </div>
  )
}

export function ThreadImageViewerModal({
  attachment,
  isLoading,
  isOpen,
  error,
  onClose,
  onRetry,
}: ThreadImageViewerModalProps) {
  if (!attachment) return null

  const previewSrc =
    attachment.imageBase64 ?? attachment.imagePreviewBase64 ?? null
  const description = attachment.imageDescription?.trim() || null
  const title = 'Image attachment'

  return (
    <Modal
      data={{ cy: 'chat-image-viewer' }}
      title={title}
      className={{
        content:
          'min-h-content max-h-[92vh] w-full min-w-[min(24rem,90vw)] max-w-3xl overflow-y-auto',
      }}
      open={isOpen}
      onClose={onClose}
    >
      <div className="space-y-4">
        {previewSrc ? (
          <img
            data-cy="chat-image-viewer-image"
            src={previewSrc}
            alt={description || title}
            className="max-h-[70vh] w-full rounded-lg border object-contain"
          />
        ) : (
          <AttachmentPlaceholder />
        )}

        {description ? (
          <Markdown
            content={normalizeCustomMathTags(description)}
            withProse
            singleDollarTextMath
            className={{
              root: 'prose prose-sm text-foreground max-w-none',
            }}
          />
        ) : null}

        {isLoading ? (
          <p className="text-muted-foreground text-sm">Loading full image...</p>
        ) : null}

        {error ? (
          <div className="space-y-3">
            <p className="text-sm text-red-600">{error}</p>
            <Button data={{ cy: 'chat-image-viewer-retry' }} onClick={onRetry}>
              <Button.Label>Retry</Button.Label>
            </Button>
          </div>
        ) : null}
      </div>
    </Modal>
  )
}

export { AttachmentPlaceholder }
