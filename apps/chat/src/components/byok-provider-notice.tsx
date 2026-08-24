'use client'

import { Button } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useEffect, useRef, useState } from 'react'

export interface ByokProviderNoticeProps {
  isOpen: boolean
  profileKey: string
  dataBoundary: string[]
  onAcknowledge: () => Promise<void>
  onDismiss: () => void
}

/**
 * Blocking provider disclosure shown before first BYOK use and after material
 * provider revisions. Participants must acknowledge to proceed; declining
 * prevents model dispatch entirely. This is factual disclosure, not consent.
 */
export function ByokProviderNotice({
  isOpen,
  dataBoundary,
  onAcknowledge,
  onDismiss,
}: ByokProviderNoticeProps) {
  const t = useTranslations()
  const ackButtonRef = useRef<HTMLButtonElement>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (isOpen) ackButtonRef.current?.focus()
  }, [isOpen])

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50"
      role="dialog"
      aria-modal="true"
      aria-labelledby="byok-notice-title"
    >
      <div className="mx-4 max-w-md rounded-lg bg-white p-6 shadow-xl dark:bg-slate-800">
        <h2 id="byok-notice-title" className="mb-3 text-lg font-semibold">
          {t('byok.notice.title')}
        </h2>
        <div className="mb-4 text-sm">
          <p className="mb-2">{t('byok.notice.intro')}</p>
          <ul className="list-disc pl-5">
            {dataBoundary.map((boundary, idx) => (
              <li key={idx} className="mb-1">
                {boundary}
              </li>
            ))}
          </ul>
        </div>
        <div className="flex justify-end gap-2">
          <Button
            variant="secondary"
            onClick={onDismiss}
            disabled={isSubmitting}
            data-testid="byok-notice-decline"
          >
            {t('byok.notice.decline')}
          </Button>
          <Button
            ref={ackButtonRef}
            onClick={async () => {
              setIsSubmitting(true)
              try {
                await onAcknowledge()
              } finally {
                setIsSubmitting(false)
              }
            }}
            disabled={isSubmitting}
            data-testid="byok-notice-acknowledge"
          >
            {t('byok.notice.acknowledge')}
          </Button>
        </div>
      </div>
    </div>
  )
}
