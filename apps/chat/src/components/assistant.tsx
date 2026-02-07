'use client'

import Footer from '@klicker-uzh/shared-components/src/Footer'
import { SidebarInset, SidebarProvider } from '@uzh-bf/design-system'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { RuntimeProvider } from '../app/RuntimeProvider'
import { useChatStore } from '../stores/chatStore'
import { AppSidebar } from './app-sidebar'
import { DisclaimerModal } from './disclaimer-modal'
import { Thread } from './thread'

interface ChatbotDisclaimer {
  id: string
  name: string
  title: string
  introText?: string
  mediaUrl?: string
  mediaType?: 'video' | 'image'
}

interface DisclaimerStatus {
  required: boolean
  accepted: boolean
  disclaimerId?: string
  acceptedAt?: string
  declined?: boolean
}

export const Assistant = ({
  chatbot,
}: {
  chatbot: { id: string; name: string; avatar?: string }
}) => {
  const { participationRequired, participationMessage } = useChatStore()
  const [disclaimer, setDisclaimer] = useState<ChatbotDisclaimer | null>(null)
  const [disclaimerStatus, setDisclaimerStatus] =
    useState<DisclaimerStatus | null>(null)
  const [showDisclaimerModal, setShowDisclaimerModal] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  // Fetch disclaimer information on component mount
  useEffect(() => {
    const fetchDisclaimerInfo = async () => {
      try {
        const response = await fetch(`/api/chatbots/${chatbot.id}/disclaimer`)
        if (response.ok) {
          const data = await response.json()
          setDisclaimer(data.disclaimer)
          setDisclaimerStatus(data.status)

          // Show modal if acceptance missing and user has not previously
          // declined in this session. The server returns `declined: true`
          // when the user has explicitly declined, in which case we skip the
          // modal and let the declined view render immediately.
          if (
            data.status.required &&
            !data.status.accepted &&
            !data.status.declined
          ) {
            setShowDisclaimerModal(true)
          }
        } else {
          console.error('Failed to fetch disclaimer information')
        }
      } catch (error) {
        console.error('Error fetching disclaimer information:', error)
      } finally {
        setIsLoading(false)
      }
    }

    if (participationRequired) {
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    fetchDisclaimerInfo()
  }, [chatbot.id, participationRequired])

  const handleAcceptDisclaimer = async () => {
    if (!disclaimer) return

    try {
      const response = await fetch(`/api/chatbots/${chatbot.id}/disclaimer`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'accept',
          disclaimerId: disclaimer.id,
        }),
      })

      if (response.ok) {
        setDisclaimerStatus((prev) => ({
          ...(prev ?? {}),
          required: prev?.required ?? true,
          accepted: true,
          declined: false,
          disclaimerId: disclaimer.id,
          acceptedAt: new Date().toISOString(),
        }))
        setShowDisclaimerModal(false)
      } else {
        console.error('Failed to accept disclaimer')
      }
    } catch (error) {
      console.error('Error accepting disclaimer:', error)
    }
  }

  const handleDeclineDisclaimer = async () => {
    try {
      const response = await fetch(`/api/chatbots/${chatbot.id}/disclaimer`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'decline',
        }),
      })

      if (response.ok) {
        setDisclaimerStatus((prev) => ({
          ...(prev ?? {}),
          required: prev?.required ?? true,
          accepted: false,
          declined: true,
          acceptedAt: undefined,
        }))
        setShowDisclaimerModal(false)
      } else {
        console.error('Failed to decline disclaimer')
      }
    } catch (error) {
      console.error('Error declining disclaimer:', error)
    }
  }

  const pwaBaseUrl = process.env.NEXT_PUBLIC_PWA_URL
    ? process.env.NEXT_PUBLIC_PWA_URL.replace(/\/$/, '')
    : 'https://pwa.klicker.uzh.ch'

  if (participationRequired) {
    return (
      <div data-cy="chat-participation-required" className="bg-muted flex min-h-screen w-full items-center justify-center px-4">
        <div className="bg-card w-full max-w-lg rounded-lg border p-8 text-center shadow-sm">
          <h1 className="text-foreground text-2xl font-semibold">
            Course Access Required
          </h1>
          <p className="text-muted-foreground mt-4 text-base">
            {participationMessage ??
              'You need to join the corresponding KlickerUZH course before you can use this chatbot. Please enrol in the course or contact your instructor for access.'}
          </p>
          <Link
            href={pwaBaseUrl}
            className="bg-uzh-blue hover:bg-uzh-blue-80 focus-visible:outline-uzh-blue-40 mt-8 inline-flex w-full items-center justify-center rounded-md px-4 py-2 text-base font-semibold text-white transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
            prefetch={false}
          >
            Open KlickerUZH
          </Link>
        </div>
      </div>
    )
  }

  // Show loading state while fetching disclaimer information
  if (isLoading) {
    return (
      <div data-cy="chat-loading" className="flex h-screen items-center justify-center">
        <div className="text-lg">Loading chatbot...</div>
      </div>
    )
  }

  // Show blocked message if disclaimer was declined
  if (disclaimerStatus?.required && disclaimerStatus?.declined) {
    return (
      <>
        <div data-cy="chat-disclaimer-declined" className="flex h-screen items-center justify-center">
          <div className="max-w-md rounded-lg bg-red-50 p-6 text-center">
            <h2 className="mb-4 text-xl font-semibold text-red-800">
              Chatbot unavailable
            </h2>
            <p className="text-red-700">
              You declined the chatbot disclaimer. Accept the terms to continue
              using the chatbot.
            </p>
            <button
              data-cy="chat-show-disclaimer-again"
              onClick={() => setShowDisclaimerModal(true)}
              className="mt-4 rounded bg-red-600 px-4 py-2 text-white hover:bg-red-700"
            >
              Show disclaimer again
            </button>
          </div>
        </div>

        {disclaimer && (
          <DisclaimerModal
            disclaimer={disclaimer}
            isOpen={showDisclaimerModal}
            onAccept={handleAcceptDisclaimer}
            onDecline={handleDeclineDisclaimer}
          />
        )}
      </>
    )
  }

  return (
    <>
      <RuntimeProvider chatbotId={chatbot.id}>
        <SidebarProvider>
          <AppSidebar />
          <SidebarInset>
            <div className="flex flex-1 flex-col">
              <Thread chatbotAvatar={chatbot.avatar ?? ''} />
              <Footer />
            </div>
          </SidebarInset>
        </SidebarProvider>
      </RuntimeProvider>

      {/* Disclaimer Modal */}
      {disclaimer && (
        <DisclaimerModal
          disclaimer={disclaimer}
          isOpen={showDisclaimerModal}
          onAccept={handleAcceptDisclaimer}
          onDecline={handleDeclineDisclaimer}
        />
      )}
    </>
  )
}
