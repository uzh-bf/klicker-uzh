'use client'

import Footer from '@klicker-uzh/shared-components/src/Footer'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
  SidebarInset,
  SidebarProvider,
} from '@uzh-bf/design-system'
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
  const { activeThreadId, threads } = useChatStore()
  const [disclaimer, setDisclaimer] = useState<ChatbotDisclaimer | null>(null)
  const [disclaimerStatus, setDisclaimerStatus] =
    useState<DisclaimerStatus | null>(null)
  const [showDisclaimerModal, setShowDisclaimerModal] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  const activeThread = threads.find((t) => t.id === activeThreadId)

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

    fetchDisclaimerInfo()
  }, [chatbot.id])

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

  // Show loading state while fetching disclaimer information
  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-lg">Loading chatbot...</div>
      </div>
    )
  }

  // Show blocked message if disclaimer was declined
  if (disclaimerStatus?.required && disclaimerStatus?.declined) {
    return (
      <>
        <div className="flex h-screen items-center justify-center">
          <div className="max-w-md rounded-lg bg-red-50 p-6 text-center">
            <h2 className="mb-4 text-xl font-semibold text-red-800">
              Chatbot unavailable
            </h2>
            <p className="text-red-700">
              You declined the chatbot disclaimer. Accept the terms to continue
              using the chatbot.
            </p>
            <button
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
            <div className="p-4">
              <header className="flex h-10 shrink-0 items-center gap-2 rounded-md border-b bg-gray-50 px-4">
                <Breadcrumb>
                  <BreadcrumbList>
                    <BreadcrumbItem className="hidden sm:block">
                      <BreadcrumbLink asChild>
                        <div className="cursor-pointer">{chatbot.name}</div>
                      </BreadcrumbLink>
                    </BreadcrumbItem>
                    <BreadcrumbSeparator className="hidden sm:block" />
                    <BreadcrumbItem>
                      <BreadcrumbPage>
                        {activeThread?.title || 'New Chat'}
                      </BreadcrumbPage>
                    </BreadcrumbItem>
                  </BreadcrumbList>
                </Breadcrumb>
              </header>
            </div>
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
