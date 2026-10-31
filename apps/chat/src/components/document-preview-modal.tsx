'use client'

import { Modal } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useEffect, useRef } from 'react'
import type { DocumentOriginal } from '@/src/lib/attachments/attachmentState'

interface DocumentPreviewModalProps {
  name: string
  /** The extracted text, which is what the model received. */
  text: string
  /** The original file while it is still in this browser tab. */
  original: DocumentOriginal | null
  isOpen: boolean
  onClose: () => void
}

/**
 * Shows an attached document. A PDF still in this tab opens in the browser's
 * own viewer; otherwise, and after a reload, the stored extracted text is
 * shown, because the original file is never uploaded or stored.
 */
export function DocumentPreviewModal({
  name,
  text,
  original,
  isOpen,
  onClose,
}: DocumentPreviewModalProps) {
  const t = useTranslations()
  const isPdf = original?.type === 'application/pdf'
  const contentRef = useRef<HTMLDivElement>(null)

  // The design-system Modal prevents Radix from moving focus into the dialog
  // (see disclaimer-modal.tsx), so the preview content takes focus itself.
  useEffect(() => {
    if (isOpen) contentRef.current?.focus()
  }, [isOpen])

  return (
    <Modal
      data={{ cy: 'chat-document-preview' }}
      title={name}
      className={{
        content:
          'min-h-content max-h-[92vh] w-full min-w-[min(24rem,90vw)] max-w-4xl overflow-y-auto',
      }}
      open={isOpen}
      onClose={onClose}
    >
      <div
        ref={contentRef}
        tabIndex={-1}
        className="space-y-3 focus:outline-none"
      >
        {isPdf ? (
          <iframe
            data-cy="chat-document-preview-original"
            src={original.url}
            title={name}
            className="h-[70vh] w-full rounded-lg border"
          />
        ) : (
          <>
            <p
              data-cy="chat-document-preview-text-note"
              className="text-muted-foreground text-sm"
            >
              {original
                ? t('chat.documentPreview.extractedText')
                : t('chat.documentPreview.extractedTextOnly')}
            </p>
            <pre
              data-cy="chat-document-preview-text"
              className="bg-muted text-foreground max-h-[60vh] overflow-y-auto whitespace-pre-wrap break-words rounded-lg border p-3 font-sans text-sm"
            >
              {text}
            </pre>
          </>
        )}
        {original && (
          <a
            data-cy="chat-document-preview-open-original"
            href={original.url}
            target="_blank"
            rel="noopener noreferrer"
            download={isPdf ? undefined : name}
            className="text-primary text-sm underline underline-offset-2"
          >
            {t('chat.documentPreview.openOriginal')}
          </a>
        )}
      </div>
    </Modal>
  )
}
