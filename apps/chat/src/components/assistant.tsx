'use client'

import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from '@uzh-bf/design-system'
import { Plus } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'
import { twMerge } from 'tailwind-merge'
import { RuntimeProvider } from '../app/RuntimeProvider'
import { useChatGuestTokenBootstrap } from '../hooks/useChatGuestTokenBootstrap'
import { useEmbedded } from '../hooks/useEmbedded'
import { useEmbeddedChatContext } from '../hooks/useEmbeddedChatContext'
import { usePwaEmbedTokenBootstrap } from '../hooks/usePwaEmbedTokenBootstrap'
import { authedFetch } from '../lib/client/authedFetch'
import { getKlickerChatContextLabel } from '../services/chatContext'
import { useChatContextStore } from '../stores/chatContextStore'
import { useChatStore } from '../stores/chatStore'
import { AppSidebar } from './app-sidebar'
import { ChatUiProvider, useChatUi } from './chat-ui-context'
import { DisclaimerModal } from './disclaimer-modal'
import { MobileCreditsBar } from './credits-footer'
import { EmbeddedCreditsBar, EmbeddedSettings } from './embedded-settings'
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

interface AssistantProps {
  readonly chatbot: { id: string; name: string; avatar?: string }
  readonly initialModeOptions: Record<string, string>
  readonly initialModeOptionsAreFallback: boolean
}

interface ParticipationRequiredProps {
  readonly embedded: boolean
  readonly message: string | null
}

interface DisclaimerDeclinedProps {
  readonly embedded: boolean
  readonly disclaimer: ChatbotDisclaimer | null
  readonly showDisclaimerModal: boolean
  readonly actionError: boolean
  readonly onShowDisclaimer: () => void
  readonly onAccept: () => Promise<void>
  readonly onDecline: () => Promise<void>
}

export function Assistant({
  chatbot,
  initialModeOptions,
  initialModeOptionsAreFallback,
}: AssistantProps) {
  const t = useTranslations()
  // Stuff CHIPS fallback tokens into sessionStorage and strip them from the URL.
  useChatGuestTokenBootstrap()
  usePwaEmbedTokenBootstrap()
  const embedded = useEmbedded()
  const participationRequired = useChatStore(
    (state) => state.participationRequired
  )
  const participationMessage = useChatStore(
    (state) => state.participationMessage
  )
  const {
    disclaimer,
    disclaimerStatus,
    showDisclaimerModal,
    isLoading,
    disclaimerActionError,
    setShowDisclaimerModal,
    handleAcceptDisclaimer,
    handleDeclineDisclaimer,
  } = useDisclaimerGate(chatbot.id, participationRequired)

  if (participationRequired) {
    return (
      <ParticipationRequired
        embedded={embedded}
        message={
          participationMessage ??
          t('chat.assistant.participationRequiredDefaultMessage')
        }
      />
    )
  }

  // Show loading state while fetching disclaimer information
  if (isLoading) {
    return <ChatLoading embedded={embedded} />
  }

  // Show blocked message if disclaimer was declined
  if (disclaimerStatus?.required && disclaimerStatus?.declined) {
    return (
      <DisclaimerDeclined
        embedded={embedded}
        disclaimer={disclaimer}
        showDisclaimerModal={showDisclaimerModal}
        actionError={disclaimerActionError}
        onShowDisclaimer={() => setShowDisclaimerModal(true)}
        onAccept={handleAcceptDisclaimer}
        onDecline={handleDeclineDisclaimer}
      />
    )
  }

  return (
    <>
      <ChatUiProvider>
        <RuntimeProvider
          chatbotId={chatbot.id}
          initialModeOptions={initialModeOptions}
          initialModeOptionsAreFallback={initialModeOptionsAreFallback}
        >
          <AssistantLayout
            chatbot={chatbot}
            initialModeOptions={initialModeOptions}
            initialModeOptionsAreFallback={initialModeOptionsAreFallback}
          />
        </RuntimeProvider>
      </ChatUiProvider>

      {/* Disclaimer Modal */}
      {disclaimer && (
        <DisclaimerModal
          disclaimer={disclaimer}
          isOpen={showDisclaimerModal}
          onAccept={handleAcceptDisclaimer}
          onDecline={handleDeclineDisclaimer}
          errorMessage={
            disclaimerActionError ? t('chat.disclaimer.actionError') : null
          }
        />
      )}
    </>
  )
}

function useDisclaimerGate(chatbotId: string, participationRequired: boolean) {
  const [disclaimer, setDisclaimer] = useState<ChatbotDisclaimer | null>(null)
  const [disclaimerStatus, setDisclaimerStatus] =
    useState<DisclaimerStatus | null>(null)
  const [showDisclaimerModal, setShowDisclaimerModal] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [disclaimerActionError, setDisclaimerActionError] = useState(false)

  useEffect(() => {
    const fetchDisclaimerInfo = async () => {
      try {
        const response = await authedFetch(
          `/api/chatbots/${chatbotId}/disclaimer`
        )
        if (response.ok) {
          const data = await response.json()
          setDisclaimer(data.disclaimer)
          setDisclaimerStatus(data.status)

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
    void fetchDisclaimerInfo()
  }, [chatbotId, participationRequired])

  const handleAcceptDisclaimer = async () => {
    if (!disclaimer) return

    setDisclaimerActionError(false)

    try {
      const response = await authedFetch(
        `/api/chatbots/${chatbotId}/disclaimer`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            action: 'accept',
            disclaimerId: disclaimer.id,
          }),
        }
      )
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
        setDisclaimerActionError(true)
      }
    } catch (error) {
      console.error('Error accepting disclaimer:', error)
      setDisclaimerActionError(true)
    }
  }

  const handleDeclineDisclaimer = async () => {
    setDisclaimerActionError(false)

    try {
      const response = await authedFetch(
        `/api/chatbots/${chatbotId}/disclaimer`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            action: 'decline',
          }),
        }
      )
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
        setDisclaimerActionError(true)
      }
    } catch (error) {
      console.error('Error declining disclaimer:', error)
      setDisclaimerActionError(true)
    }
  }

  return {
    disclaimer,
    disclaimerStatus,
    showDisclaimerModal,
    isLoading,
    disclaimerActionError,
    setShowDisclaimerModal,
    handleAcceptDisclaimer,
    handleDeclineDisclaimer,
  }
}

function ParticipationRequired({
  embedded,
  message,
}: ParticipationRequiredProps) {
  const t = useTranslations()
  const pwaBaseUrl = process.env.NEXT_PUBLIC_PWA_URL
    ? process.env.NEXT_PUBLIC_PWA_URL.replace(/\/$/, '')
    : 'https://pwa.klicker.uzh.ch'

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
          {message}
        </p>
        {!embedded && (
          <Link
            href={pwaBaseUrl}
            className="bg-primary hover:bg-primary/90 focus-visible:outline-primary/40 mt-8 inline-flex w-full items-center justify-center rounded-md px-4 py-2 text-base font-semibold text-white transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
            prefetch={false}
          >
            {t('chat.assistant.openKlickerUzh')}
          </Link>
        )}
      </div>
    </div>
  )
}

function ChatLoading({ embedded }: { readonly embedded: boolean }) {
  const t = useTranslations()

  return (
    <output
      data-cy="chat-loading"
      aria-live="polite"
      aria-busy="true"
      className={twMerge(
        'bg-muted flex items-center justify-center px-4',
        embedded ? 'h-full' : 'min-h-screen'
      )}
    >
      <span
        className={twMerge(
          'bg-card flex w-full items-center gap-4 rounded-xl border p-6 shadow-sm',
          embedded ? 'max-w-xs p-4' : 'max-w-sm'
        )}
      >
        <Image
          src="/KlickerLogo.png"
          alt=""
          width={48}
          height={48}
          priority
          className="size-12 shrink-0 object-contain"
        />
        <span className="min-w-0 flex-1 space-y-2">
          <span
            aria-hidden="true"
            className="bg-muted block h-3 w-28 animate-pulse rounded-full motion-reduce:animate-none"
          />
          <span
            aria-hidden="true"
            className="bg-muted block h-3 w-full animate-pulse rounded-full motion-reduce:animate-none"
          />
          <span className="text-muted-foreground block text-sm">
            {t('chat.assistant.loading')}
          </span>
        </span>
      </span>
    </output>
  )
}

function DisclaimerDeclined({
  embedded,
  disclaimer,
  showDisclaimerModal,
  actionError,
  onShowDisclaimer,
  onAccept,
  onDecline,
}: DisclaimerDeclinedProps) {
  const t = useTranslations()

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
            'bg-destructive/10 rounded-lg text-center',
            embedded ? 'max-w-sm p-4' : 'max-w-md p-6'
          )}
        >
          <h2
            className={twMerge(
              'text-foreground font-semibold',
              embedded ? 'mb-2 text-base' : 'mb-4 text-xl'
            )}
          >
            {t('chat.assistant.disclaimerDeclinedTitle')}
          </h2>
          <p className={twMerge('text-foreground', embedded && 'text-sm')}>
            {t('chat.assistant.disclaimerDeclinedMessage')}
          </p>
          {!embedded && (
            // text-white, not text-destructive-foreground: this app's
            // theme only defines --color-destructive (see globals.css),
            // no matching foreground token. White sits ~4.8:1 on the solid
            // destructive bg, near the 4.5:1 AA floor — so the hover must
            // darken (brightness-90), not alpha-lighten like the app's
            // hover:bg-primary/90 pattern, which would drop below AA here.
            <button
              type="button"
              data-cy="chat-show-disclaimer-again"
              onClick={onShowDisclaimer}
              className="bg-destructive mt-4 min-h-11 rounded px-4 py-2 text-white transition-[filter] touch-manipulation hover:brightness-90 fine-pointer:min-h-8"
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
          onAccept={onAccept}
          onDecline={onDecline}
          errorMessage={actionError ? t('chat.disclaimer.actionError') : null}
        />
      )}
    </>
  )
}

/**
 * M4: stand-in for the thread pane while the initial disclaimer/thread fetch
 * is in flight. Shaped like a couple of message bubbles rather than a bare
 * spinner so the layout the real thread will occupy is already legible.
 */
function ThreadSkeleton() {
  const t = useTranslations()
  return (
    <div data-cy="chat-thread-skeleton" role="status" className="p-4">
      <span className="sr-only">{t('chat.thread.loading')}</span>
      <div
        aria-hidden="true"
        className="animate-pulse space-y-4 motion-reduce:animate-none"
      >
        <div className="flex justify-end">
          <div className="bg-muted h-8 w-1/3 rounded-lg" />
        </div>
        <div className="flex justify-start">
          <div className="bg-muted h-20 w-2/3 rounded-lg" />
        </div>
        <div className="flex justify-end">
          <div className="bg-muted h-8 w-1/4 rounded-lg" />
        </div>
      </div>
    </div>
  )
}

function SidebarMain({
  chatbot,
  initialModeOptions,
  initialModeOptionsAreFallback,
}: {
  chatbot: { id: string; name: string; avatar?: string }
  initialModeOptions: Record<string, string>
  initialModeOptionsAreFallback: boolean
}) {
  const t = useTranslations()
  const { open } = useSidebar()
  const { chatbotId } = useParams<{ chatbotId: string }>()
  const router = useRouter()
  const createThread = useChatStore((state) => state.createThread)
  const participationRequired = useChatStore(
    (state) => state.participationRequired
  )
  const isLoading = useChatStore((state) => state.isLoading)

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
      <div className="bg-muted/50 flex shrink-0 items-center gap-2 border-b px-2 py-1.5">
        <div className="flex min-w-0 items-center gap-2">
          {/* Only visible when the sidebar is closed — once it's open, the
              sidebar's own trigger closes it, so this stays the single
              toggle on screen at any given time (Overrides the design
              system's hardcoded English sr-only label). */}
          <SidebarTrigger
            className={twMerge(
              'size-11 touch-manipulation fine-pointer:size-8',
              open && 'md:hidden'
            )}
            aria-label={t('chat.sidebar.openSidebar')}
          />
          {/* Persistent header identity (V3): name (+ avatar) stays visible
              here regardless of sidebar open/closed state, so the sidebar's
              own header no longer repeats it (see app-sidebar.tsx). */}
          {chatbot.avatar && (
            <Image
              src={`${process.env.NEXT_PUBLIC_AVATAR_BASE_PATH}/${chatbot.avatar}.svg`}
              alt=""
              width={24}
              height={24}
              unoptimized
              className="ring-border size-6 shrink-0 rounded-full bg-white ring-1"
            />
          )}
          <h1 className="min-w-0 truncate text-sm">{chatbot.name}</h1>
        </div>
        <div className="flex min-w-0 flex-1 justify-center">
          <ModeSwitcher />
        </div>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={handleNewThread}
              disabled={participationRequired}
              className={twMerge(
                'text-muted-foreground hover:text-foreground inline-flex size-11 items-center justify-center rounded-sm transition-colors touch-manipulation disabled:pointer-events-none disabled:opacity-50 fine-pointer:size-8',
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
      <MobileCreditsBar />
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="relative flex min-h-0 flex-1 flex-col">
          {isLoading && (
            <div className="bg-background absolute inset-0 z-10 overflow-y-auto">
              <ThreadSkeleton />
            </div>
          )}
          <Thread
            chatbotAvatar={chatbot.avatar ?? ''}
            chatbotName={chatbot.name}
            initialModeOptions={initialModeOptions}
            initialModeOptionsAreFallback={initialModeOptionsAreFallback}
          />
        </div>
      </div>
    </SidebarInset>
  )
}

function AssistantLayout({
  chatbot,
  initialModeOptions,
  initialModeOptionsAreFallback,
}: {
  chatbot: { id: string; name: string; avatar?: string }
  initialModeOptions: Record<string, string>
  initialModeOptionsAreFallback: boolean
}) {
  const { showSidebar } = useChatUi()
  const isLoading = useChatStore((state) => state.isLoading)
  useEmbeddedChatContext()
  const context = useChatContextStore((state) => state.context)
  const contextLabel = getKlickerChatContextLabel(context)
  const hasQuestionContext = Boolean(context?.question)

  if (showSidebar) {
    return (
      <SidebarProvider className="h-dvh overflow-hidden">
        <AppSidebar />
        <SidebarMain
          chatbot={chatbot}
          initialModeOptions={initialModeOptions}
          initialModeOptionsAreFallback={initialModeOptionsAreFallback}
        />
      </SidebarProvider>
    )
  }

  return (
    <div className="flex h-dvh w-full flex-col overflow-hidden">
      <div className="bg-muted/50 flex shrink-0 items-center justify-between gap-2 border-b px-2 py-1.5 sm:gap-4 sm:px-4 sm:py-3">
        <h1 className="min-w-0 truncate text-xs font-semibold sm:text-sm">
          {chatbot.name}
        </h1>
        <EmbeddedSettings />
      </div>
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="relative flex min-h-0 flex-1 flex-col">
          {isLoading && (
            <div className="bg-background absolute inset-0 z-10 overflow-y-auto">
              <ThreadSkeleton />
            </div>
          )}
          <Thread
            chatbotAvatar={chatbot.avatar ?? ''}
            chatbotName={chatbot.name}
            contextLabel={contextLabel}
            contextualSuggestions={hasQuestionContext}
            initialModeOptions={initialModeOptions}
            initialModeOptionsAreFallback={initialModeOptionsAreFallback}
          />
        </div>
        <EmbeddedCreditsBar />
      </div>
    </div>
  )
}
