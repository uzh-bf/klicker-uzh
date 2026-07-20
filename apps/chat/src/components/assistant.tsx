'use client'

import Footer from '@klicker-uzh/shared-components/src/Footer'
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from '@uzh-bf/design-system'
import { Loader2, Plus } from 'lucide-react'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { twMerge } from 'tailwind-merge'
import { RuntimeProvider } from '../app/RuntimeProvider'
import { useEmbedded } from '../hooks/useEmbedded'
import { useChatStore } from '../stores/chatStore'
import { AppSidebar } from './app-sidebar'
import { ChatUiProvider, useChatUi } from './chat-ui-context'
import { DisclaimerModal } from './disclaimer-modal'
import { EmbeddedSettings } from './embedded-settings'
import { ModeSwitcher } from './mode-switcher'
import { Thread } from './thread'
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip'

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
  const t = useTranslations()
  const embedded = useEmbedded()
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
      <div
        data-cy="chat-participation-required"
        className={twMerge(
          'bg-muted flex w-full items-center justify-center px-4',
          embedded ? 'h-full p-4' : 'min-h-screen'
        )}
      >
        <div
          className={twMerge(
            'bg-card w-full rounded-lg border text-center shadow-sm',
            embedded ? 'max-w-sm p-4' : 'max-w-lg p-8'
          )}
        >
          <h1
            className={twMerge(
              'text-foreground font-semibold',
              embedded ? 'text-lg' : 'text-2xl'
            )}
          >
            {t('chat.assistant.participationRequiredTitle')}
          </h1>
          <p
            className={twMerge(
              'text-muted-foreground',
              embedded ? 'mt-2 text-sm' : 'mt-4 text-base'
            )}
          >
            {participationMessage ??
              t('chat.assistant.participationRequiredDefaultMessage')}
          </p>
          {!embedded && (
            <Link
              href={pwaBaseUrl}
              className="bg-uzh-blue hover:bg-uzh-blue-80 focus-visible:outline-uzh-blue-40 mt-8 inline-flex w-full items-center justify-center rounded-md px-4 py-2 text-base font-semibold text-white transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
              prefetch={false}
            >
              {t('chat.assistant.openKlickerUzh')}
            </Link>
          )}
        </div>
      </div>
    )
  }

  // Show loading state while fetching disclaimer information
  if (isLoading) {
    return (
      <div
        data-cy="chat-loading"
        className={twMerge(
          'flex items-center justify-center',
          embedded ? 'h-full' : 'h-screen'
        )}
      >
        <div className={embedded ? 'text-sm' : 'text-lg'}>
          {t('chat.assistant.loading')}
        </div>
      </div>
    )
  }

  // Show blocked message if disclaimer was declined
  if (disclaimerStatus?.required && disclaimerStatus?.declined) {
    return (
      <>
        <div
          data-cy="chat-disclaimer-declined"
          className={twMerge(
            'flex items-center justify-center',
            embedded ? 'h-full p-4' : 'h-screen'
          )}
        >
          <div
            className={twMerge(
              'rounded-lg bg-red-50 text-center',
              embedded ? 'max-w-sm p-4' : 'max-w-md p-6'
            )}
          >
            <h2
              className={twMerge(
                'font-semibold text-red-800',
                embedded ? 'mb-2 text-base' : 'mb-4 text-xl'
              )}
            >
              {t('chat.assistant.disclaimerDeclinedTitle')}
            </h2>
            <p className={twMerge('text-red-700', embedded && 'text-sm')}>
              {t('chat.assistant.disclaimerDeclinedMessage')}
            </p>
            {!embedded && (
              <button
                data-cy="chat-show-disclaimer-again"
                onClick={() => setShowDisclaimerModal(true)}
                className="mt-4 rounded bg-red-600 px-4 py-2 text-white hover:bg-red-700"
              >
                {t('chat.assistant.showDisclaimerAgain')}
              </button>
            )}
          </div>
        </div>

        {!embedded && disclaimer && (
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
      <ChatUiProvider>
        <RuntimeProvider chatbotId={chatbot.id}>
          <AssistantLayout chatbot={chatbot} />
        </RuntimeProvider>
      </ChatUiProvider>

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

function SidebarMain({
  chatbot,
  showFooter,
}: {
  chatbot: { id: string; name: string; avatar?: string }
  showFooter: boolean
}) {
  const t = useTranslations()
  const { open } = useSidebar()
  const { chatbotId } = useParams<{ chatbotId: string }>()
  const router = useRouter()
  const { createThread, participationRequired, isLoading } = useChatStore()

  const handleNewThread = async () => {
    if (participationRequired) return
    try {
      const threadId = await createThread(chatbotId)
      router.push(`/${chatbotId}/threads/${threadId}`)
    } catch {
      /* handled centrally */
    }
  }

  return (
    <SidebarInset>
      <div className="flex shrink-0 items-center gap-2 border-b bg-gray-50 px-2 py-1.5">
        <div
          className={twMerge(
            'flex min-w-0 items-center gap-2',
            open && 'md:hidden'
          )}
        >
          <SidebarTrigger className="size-5" />
          <span className="min-w-0 truncate text-sm">{chatbot.name}</span>
        </div>
        <div className="flex flex-1 justify-center">
          <ModeSwitcher />
        </div>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={handleNewThread}
              disabled={participationRequired}
              className={twMerge(
                'text-muted-foreground hover:text-foreground inline-flex size-5 items-center justify-center rounded-sm transition-colors disabled:pointer-events-none disabled:opacity-50',
                open && 'md:hidden'
              )}
            >
              <Plus className="size-4" />
              <span className="sr-only">{t('chat.sidebar.newChat')}</span>
            </button>
          </TooltipTrigger>
          <TooltipContent>{t('chat.sidebar.newChat')}</TooltipContent>
        </Tooltip>
      </div>
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="relative flex min-h-0 flex-1 flex-col">
          {isLoading && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-white">
              <Loader2 className="text-muted-foreground size-6 animate-spin" />
            </div>
          )}
          <Thread chatbotAvatar={chatbot.avatar ?? ''} />
        </div>
        {showFooter && <Footer />}
      </div>
    </SidebarInset>
  )
}

function AssistantLayout({
  chatbot,
}: {
  chatbot: { id: string; name: string; avatar?: string }
}) {
  const { showSidebar, showFooter } = useChatUi()

  if (showSidebar) {
    return (
      <SidebarProvider className="h-dvh overflow-hidden">
        <AppSidebar chatbotName={chatbot.name} />
        <SidebarMain chatbot={chatbot} showFooter={showFooter} />
      </SidebarProvider>
    )
  }

  return (
    <div className="flex h-dvh w-full flex-col overflow-hidden">
      <div className="flex shrink-0 items-center justify-between gap-2 border-b bg-gray-50 px-2 py-1.5 sm:gap-4 sm:px-4 sm:py-3">
        <div className="min-w-0 truncate text-xs font-semibold sm:text-sm">
          {chatbot.name}
        </div>
        <EmbeddedSettings />
      </div>
      <div className="flex min-h-0 flex-1 flex-col">
        <Thread chatbotAvatar={chatbot.avatar ?? ''} />
        {showFooter && <Footer />}
      </div>
    </div>
  )
}
