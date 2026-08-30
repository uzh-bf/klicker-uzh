'use client'

import type { TourId } from '@klicker-uzh/product-tours'
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@uzh-bf/design-system'
import { Compass } from 'lucide-react'
import { useTranslations } from 'next-intl'
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { setOnboardingGateOpen, useChatUi } from './chat-ui-context'
import { OnboardingCarousel } from './onboarding-carousel'

const CHAT_ONBOARDING_TOUR_ID: TourId = 'chat-onboarding-v1'

interface ChatOnboardingValue {
  replay: () => void
}

const ChatOnboardingContext = createContext<ChatOnboardingValue | null>(null)

interface ChatOnboardingProviderProps {
  /**
   * Whether the disclaimer still stands between the participant and the chat.
   * The carousel introduces an application the disclaimer may yet deny them,
   * so it waits for that decision instead of stacking two dialogs.
   */
  disclaimerPending: boolean
  children: ReactNode
}

export function ChatOnboardingProvider({
  disclaimerPending,
  children,
}: ChatOnboardingProviderProps) {
  const { embedded } = useChatUi()
  const [isOpen, setIsOpen] = useState(false)
  // `null` while the completion state is still unknown, which is not the same
  // as "never completed": opening on an unsettled state would show the
  // carousel to someone who finished it long ago.
  const [completed, setCompleted] = useState<boolean | null>(null)
  const autoShown = useRef(false)

  // An embedded conversation is a chatbot inside somebody else's page. It has
  // no sidebar, no room for a dialog over it, and the participant did not come
  // to it to be introduced to an application — so nothing is fetched and
  // nothing is mounted there.
  useEffect(() => {
    if (embedded) return

    let active = true

    async function load() {
      try {
        const response = await fetch(
          `/api/onboarding-tour?tourId=${CHAT_ONBOARDING_TOUR_ID}`
        )
        // A participant without a full account gets 403 here. Any failure
        // settles as completed, which keeps the carousel shut for this page
        // view rather than opening it over a chat whose state is unknown.
        if (!response.ok) {
          if (active) setCompleted(true)
          return
        }

        const data = await response.json()
        if (active) setCompleted(Boolean(data.completedAt))
      } catch {
        if (active) setCompleted(true)
      }
    }

    void load()
    return () => {
      active = false
    }
  }, [embedded])

  // Claiming the composer's focus gate in the same step as the open, rather
  // than from an effect on `isOpen`, is what keeps the post-disclaimer
  // handover smooth: the disclaimer publishes its own close in the very commit
  // this decision is taken, and a gate that dipped to false in between would
  // send focus to the composer for a frame before the carousel took it back.
  const openCarousel = useCallback(() => {
    setOnboardingGateOpen(true)
    setIsOpen(true)
  }, [])

  // Auto-show is derived from settled state, not from watching the disclaimer
  // close: the same condition then covers the bot that requires a disclaimer
  // and the one that does not.
  useEffect(() => {
    if (embedded || autoShown.current) return
    if (completed !== false || disclaimerPending) return

    autoShown.current = true
    openCarousel()
  }, [completed, disclaimerPending, embedded, openCarousel])

  // Finishing, skipping and closing all end the tour for good, because the
  // promise it makes is "you will not be shown this again", not "you read all
  // of it". A replay records nothing: the state is already stored, and the
  // route would only touch its housekeeping timestamp.
  const closeCarousel = useCallback(() => {
    setOnboardingGateOpen(false)
    setIsOpen(false)

    if (completed !== false) return
    setCompleted(true)

    // Best effort, like every other state call on this surface: an
    // introduction that fails to record itself must not interrupt the chat the
    // participant came for. The worst case is that it appears once more.
    void fetch('/api/onboarding-tour', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tourId: CHAT_ONBOARDING_TOUR_ID }),
    }).catch(() => {
      /* best effort */
    })
  }, [completed])

  // A provider that unmounts while the carousel is open must not leave the
  // composer waiting for a dialog that is gone.
  useEffect(() => () => setOnboardingGateOpen(false), [])

  const value = useMemo<ChatOnboardingValue>(
    () => ({ replay: openCarousel }),
    [openCarousel]
  )

  return (
    <ChatOnboardingContext.Provider value={value}>
      {children}
      {!embedded && (
        <OnboardingCarousel isOpen={isOpen} onClose={closeCarousel} />
      )}
    </ChatOnboardingContext.Provider>
  )
}

export function useChatOnboarding() {
  const context = useContext(ChatOnboardingContext)
  if (!context) {
    throw new Error(
      'useChatOnboarding must be used within ChatOnboardingProvider'
    )
  }
  return context
}

/**
 * The sidebar entry that plays the introduction again, next to "What's new".
 * It is always available, because someone who skipped it on their first day is
 * exactly who comes looking for it later.
 */
export function OnboardingMenuItem() {
  const t = useTranslations()
  const { replay } = useChatOnboarding()

  return (
    <SidebarMenu data-cy="chat-onboarding-section">
      <SidebarMenuItem>
        <SidebarMenuButton data-cy="chat-onboarding-trigger" onClick={replay}>
          <Compass className="size-4" />
          <span>{t('chat.onboarding.replay')}</span>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
