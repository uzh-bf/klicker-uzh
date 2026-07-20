'use client'

import { Markdown } from '@klicker-uzh/markdown'
import { Button, Modal } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useState } from 'react'

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
}

export const DisclaimerModal = ({
  disclaimer,
  isOpen,
  onAccept,
  onDecline,
}: DisclaimerModalProps) => {
  const t = useTranslations()
  const [isLoading, setIsLoading] = useState(false)

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
      onClose={() => {}} // Prevent closing the modal
    >
      <div data-cy="chat-disclaimer-content" className="space-y-6">
        <div className="flex flex-row space-x-12">
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
          <div className="prose prose-sm max-w-none rounded-lg bg-slate-100 p-4">
            <h3 className="text-lg font-semibold">
              {t('chat.disclaimer.studentResponsibilityTitle')}
            </h3>
            <p className="text-sm">
              {t('chat.disclaimer.studentResponsibilityText')}
            </p>
          </div>

          <div className="prose-sm prose max-w-none rounded-lg bg-slate-100 p-4">
            <h3 className="text-lg font-semibold">
              {t('chat.disclaimer.dataProtectionTitle')}
            </h3>
            <p className="mb-4 text-sm">
              {t('chat.disclaimer.dataProtectionText')}
            </p>
            <p className="text-sm">{t('chat.disclaimer.consentText')}</p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
          <Button
            data-cy="chat-disclaimer-decline"
            onClick={handleDecline}
            disabled={isLoading}
          >
            {t('chat.disclaimer.decline')}
          </Button>
          <Button
            data-cy="chat-disclaimer-accept"
            onClick={handleAccept}
            disabled={isLoading}
          >
            {isLoading
              ? t('chat.disclaimer.saving')
              : t('chat.disclaimer.acceptAndContinue')}
          </Button>
        </div>

        {/* Consequence Information */}
        <div className="prose prose-sm max-w-none rounded-lg bg-yellow-50 p-4">
          <p className="font-medium text-yellow-800">
            {t('chat.disclaimer.consequenceTitle')}
          </p>
          <ul className="mt-2 list-disc space-y-1 text-yellow-700">
            <li>{t('chat.disclaimer.consequenceAccept')}</li>
            <li>{t('chat.disclaimer.consequenceDecline')}</li>
          </ul>
        </div>
      </div>
    </Modal>
  )
}
