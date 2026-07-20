'use client'

import { Markdown } from '@klicker-uzh/markdown'
import { Button, Modal } from '@uzh-bf/design-system'
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
          title="Disclaimer media"
        />
      )
    }

    if (disclaimer.mediaType === 'image') {
      return (
        <img
          src={disclaimer.mediaUrl}
          alt="Chatbot Introduction"
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
            <h3 className="text-lg font-semibold">Student Responsibility</h3>
            <p className="text-sm">
              Chatbot answers may contain more or less information than what is
              required to pass the course and are therefore not exam relevant on
              their own (only the underlying course material is). While we aim
              to provide accurate information through the chatbot, we do not
              guarantee the correctness, completeness, or timeliness of the
              responses. Please verify important information against the
              official course materials and references.
            </p>
          </div>

          <div className="prose-sm prose max-w-none rounded-lg bg-slate-100 p-4">
            <h3 className="text-lg font-semibold">Data Protection</h3>
            <p className="mb-4 text-sm">
              Do not share any personal information with the chatbot. Your
              prompts are processed exclusively via Azure OpenAI instances
              hosted in the EU or Switzerland. Conversations may be reviewed in
              anonymised form by the KlickerUZH team or your lecturers to
              improve chatbot quality and course content.
            </p>
            <p className="text-sm">
              By using the chatbot you acknowledge and accept these conditions.
              If you have feedback or concerns, please contact your lecturers.
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
          <Button
            data-cy="chat-disclaimer-decline"
            onClick={handleDecline}
            disabled={isLoading}
          >
            Decline
          </Button>
          <Button
            data-cy="chat-disclaimer-accept"
            onClick={handleAccept}
            disabled={isLoading}
          >
            {isLoading ? 'Saving...' : 'Accept and continue'}
          </Button>
        </div>

        {/* Consequence Information */}
        <div className="prose prose-sm max-w-none rounded-lg bg-yellow-50 p-4">
          <p className="font-medium text-yellow-800">
            What happens after your choice:
          </p>
          <ul className="mt-2 list-disc space-y-1 text-yellow-700">
            <li>Accept: You can use the chatbot and access all features.</li>
            <li>
              Decline: The chatbot remains blocked and you cannot send messages.
            </li>
          </ul>
        </div>
      </div>
    </Modal>
  )
}
