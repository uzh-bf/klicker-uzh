'use client'

import { useAui, useAuiState } from '@assistant-ui/react'
import { Button, Modal } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useEffect, useRef, useSyncExternalStore } from 'react'

// The acknowledgement is remembered per browser, not per account: it is a
// one-time reminder about what may be shared, not a recorded consent.
const NOTICE_STORAGE_KEY = 'klicker-chat-document-notice-accepted'

// Kept in memory as well, so a browser that blocks storage shows the notice
// once per page load instead of on every document.
let acceptedInMemory = false
const listeners = new Set<() => void>()

function isNoticeAccepted(): boolean {
  if (acceptedInMemory) return true
  try {
    return window.localStorage.getItem(NOTICE_STORAGE_KEY) === 'true'
  } catch {
    return false
  }
}

function rememberNoticeAccepted() {
  acceptedInMemory = true
  try {
    window.localStorage.setItem(NOTICE_STORAGE_KEY, 'true')
  } catch {
    // Storage can be unavailable in private windows; the in-memory flag holds.
  }
  for (const listener of listeners) listener()
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/**
 * Asks the student, the first time they attach a document, to attach only
 * material they may share. Declining removes the documents from the composer.
 * Must render inside a composer, because it watches its attachments.
 */
export function DocumentNoticeGate() {
  const t = useTranslations()
  const aui = useAui()
  const accepted = useSyncExternalStore(
    subscribe,
    isNoticeAccepted,
    () => false
  )
  const documentIndexes = useAuiState((s) =>
    s.composer.attachments
      .flatMap((attachment, index) =>
        attachment.type === 'document' ? [index] : []
      )
      .join(',')
  )
  const open = !accepted && documentIndexes !== ''
  const acceptButtonRef = useRef<HTMLButtonElement>(null)

  // The design-system `Modal` prevents Radix from moving focus into the
  // dialog, and its portal mounts after this effect runs, so focus the
  // primary action on the next frame.
  useEffect(() => {
    if (!open) return
    const frame = requestAnimationFrame(() => acceptButtonRef.current?.focus())
    return () => cancelAnimationFrame(frame)
  }, [open])

  const removeDocuments = () => {
    const indexes = documentIndexes.split(',').map(Number).reverse()
    void Promise.all(
      indexes.map((index) => aui.composer.attachment({ index }).remove())
    )
  }

  return (
    <Modal
      data-cy="chat-document-notice"
      title={t('chat.documentNotice.title')}
      className={{ content: 'w-full max-w-[95%] sm:max-w-lg' }}
      open={open}
      onClose={removeDocuments}
      hideCloseButton
    >
      <div className="mt-4 space-y-5 text-sm leading-relaxed">
        <ul className="list-disc space-y-3 pl-5">
          <li>{t('chat.documentNotice.allowed')}</li>
          <li>{t('chat.documentNotice.notAllowed')}</li>
          <li>{t('chat.documentNotice.access')}</li>
          <li>{t('chat.documentNotice.dataBoundary')}</li>
        </ul>
        <p className="text-muted-foreground">{t('chat.documentNotice.once')}</p>
        <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:justify-end">
          <Button
            data-cy="chat-document-notice-remove"
            onClick={removeDocuments}
          >
            {t('chat.documentNotice.remove')}
          </Button>
          <Button
            ref={acceptButtonRef}
            primary
            data-cy="chat-document-notice-accept"
            onClick={rememberNoticeAccepted}
            // Same explicit colours as the disclaimer's accept button: Chat's
            // theme has no token for the design-system primary variant.
            className={{
              root: 'bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground disabled:hover:bg-primary border-transparent font-semibold',
            }}
          >
            {t('chat.documentNotice.accept')}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
