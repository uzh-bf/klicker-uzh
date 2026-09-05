'use client'

import { Markdown } from '@klicker-uzh/markdown'
import { Button, Modal } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useEffect, useRef, useState } from 'react'
import { setDisclaimerGateOpen } from './chat-ui-context'

interface ChatbotDisclaimer {
  id: string
  name: string
  title: string
  introText?: string
  mediaUrl?: string
  mediaType?: 'video' | 'image'
}

interface DisclaimerModalProps {
  disclaimer: ChatbotDisclaimer
  isOpen: boolean
  onAccept: () => void
  onDecline: () => void
  errorMessage?: string | null
}

export const DisclaimerModal = ({
  disclaimer,
  isOpen,
  onAccept,
  onDecline,
  errorMessage,
}: DisclaimerModalProps) => {
  const t = useTranslations()
  const [isLoading, setIsLoading] = useState(false)
  const acceptButtonRef = useRef<HTMLButtonElement>(null)

  // Published to the composer via `chat-ui-context` (see comment there) so
  // it can suppress its own autofocus and hand focus back once the gate
  // closes, and reset if this component unmounts while still gating.
  useEffect(() => {
    setDisclaimerGateOpen(isOpen)
    return () => setDisclaimerGateOpen(false)
  }, [isOpen])

  // The design-system `Modal` (@uzh-bf/design-system Modal.tsx) hardcodes
  // `onOpenAutoFocus={(e) => e.preventDefault()}` with no prop to override
  // it, so Radix never moves focus into the dialog on its own — do it here
  // instead, once the Accept button is actually in the DOM.
  useEffect(() => {
    if (isOpen) acceptButtonRef.current?.focus()
  }, [isOpen])

  const handleAccept = async () => {
    setIsLoading(true)
    try {
      await onAccept()
    } finally {
      setIsLoading(false)
    }
  }

  const handleDecline = async () => {
    setIsLoading(true)
    try {
      await onDecline()
    } finally {
      setIsLoading(false)
    }
  }

  const renderMedia = () => {
    if (!disclaimer.mediaUrl) return null

    if (disclaimer.mediaType === 'video') {
      return (
        <iframe
          src={disclaimer.mediaUrl}
          width="100%"
          height="240"
          className="aspect-video w-full max-w-lg rounded-lg"
          allow="autoplay *; fullscreen *; encrypted-media *"
          referrerPolicy="no-referrer-when-downgrade"
          sandbox="allow-downloads allow-forms allow-same-origin allow-scripts allow-pointer-lock allow-popups allow-modals allow-orientation-lock allow-popups-to-escape-sandbox allow-presentation allow-top-navigation-by-user-activation"
          frameBorder="0"
          title={t('chat.disclaimer.mediaTitle')}
        />
      )
    }

    if (disclaimer.mediaType === 'image') {
      return (
        <img
          src={disclaimer.mediaUrl}
          alt={t('chat.disclaimer.introAlt')}
          className="mx-auto h-auto w-full max-w-lg rounded-lg object-contain"
        />
      )
    }

    return null
  }

  return (
    <Modal
      data-cy="chat-disclaimer-modal"
      title={disclaimer.title}
      className={{
        content:
          'min-h-content max-h-[95%] w-full min-w-[60%] max-w-[95%] overflow-y-auto xl:max-w-5xl',
      }}
      open={isOpen}
      onClose={() => {}}
      hideCloseButton
      escapeDisabled
    >
      <div data-cy="chat-disclaimer-content" className="space-y-6">
        <div className="flex flex-col gap-6 md:flex-row md:gap-12">
          {/* Custom Introduction */}
          {disclaimer.introText && (
            <Markdown
              content={disclaimer.introText}
              withProse
              className={{ root: 'prose prose-sm max-w-none' }}
            />
          )}

          {/* Media Section */}
          {renderMedia()}
        </div>

        {/* Core Content - Fixed Disclaimer Text */}
        <div className="max-w-none space-y-6">
          <div className="prose prose-sm bg-muted max-w-none rounded-lg p-4">
            <h3 className="text-lg font-semibold">
              {t('chat.disclaimer.studentResponsibilityTitle')}
            </h3>
            <p className="text-sm">
              {t('chat.disclaimer.studentResponsibilityText')}
            </p>
          </div>

          <div className="prose-sm prose bg-muted max-w-none rounded-lg p-4">
            <h3 className="text-lg font-semibold">
              {t('chat.disclaimer.dataProtectionTitle')}
            </h3>
            <p className="mb-4 text-sm">
              {t('chat.disclaimer.dataProtectionText')}
            </p>
            <p className="text-sm">{t('chat.disclaimer.consentText')}</p>
          </div>
        </div>

        {/* Consequence Information */}
        <div
          data-cy="chat-disclaimer-consequences"
          className="prose prose-sm max-w-none rounded-lg bg-yellow-50 p-4"
        >
          <p className="font-medium text-yellow-800">
            {t('chat.disclaimer.consequenceTitle')}
          </p>
          <ul className="mt-2 list-disc space-y-1 text-yellow-700">
            <li>{t('chat.disclaimer.consequenceAccept')}</li>
            <li>{t('chat.disclaimer.consequenceDecline')}</li>
          </ul>
        </div>

        {/* Action Error */}
        {errorMessage && (
          <p
            role="alert"
            data-cy="chat-disclaimer-error"
            className="text-destructive text-sm"
          >
            {errorMessage}
          </p>
        )}

        {/* Action Buttons */}
        <div
          data-cy="chat-disclaimer-actions"
          className="flex flex-col gap-3 sm:flex-row sm:justify-end"
        >
          <Button
            data-cy="chat-disclaimer-decline"
            onClick={handleDecline}
            disabled={isLoading}
          >
            {t('chat.disclaimer.decline')}
          </Button>
          <Button
            ref={acceptButtonRef}
            primary
            data-cy="chat-disclaimer-accept"
            onClick={handleAccept}
            disabled={isLoading}
            // `primary` selects the design-system `default` variant, whose own
            // `bg-primary-100` resolves to nothing because Chat's theme has no
            // primary-100 token. The explicit classes below supply the colour.
            // The prop is still required: without it the button falls back to
            // the `outline` variant, whose `dark:bg-input/30` survives
            // tailwind-merge (different modifier) and hides the button for
            // anyone whose browser prefers a dark colour scheme.
            className={{
              root: 'bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground disabled:hover:bg-primary border-transparent font-semibold',
            }}
          >
            {isLoading
              ? t('chat.disclaimer.saving')
              : t('chat.disclaimer.acceptAndContinue')}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
