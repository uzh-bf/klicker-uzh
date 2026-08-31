'use client'

import type { TourId } from '@klicker-uzh/product-tours'
import {
  type ProductTourStep,
  unsolicitedOverlayShownThisSession,
  useProductTour,
} from '@klicker-uzh/product-tours/react'
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
import { resolveFeatureTarget } from './onboarding/featureTargets'

// The overlay's own stylesheet is imported once in `app/globals.css`, as a
// layered import, so Tailwind utilities can still override it. Importing it
// from here instead would put it outside every cascade layer and let it win
// over the shared popover styling.

const CHAT_ONBOARDING_TOUR_ID: TourId = 'chat-onboarding-v1'

interface ChatOnboardingValue {
  replay: () => void
}

const ChatOnboardingContext = createContext<ChatOnboardingValue | null>(null)

/**
 * Whether the tour should open on its own, or `null` while that cannot be
 * decided yet.
 *
 * The distinction matters because the hook resolves this once and for good:
 * answering "no" on a state that is still arriving would close the tour for
 * exactly the first-time reader it exists for. `null` keeps the question open
 * instead.
 */
function resolveAutoStart({
  embedded,
  completed,
  disclaimerPending,
  replayed,
}: {
  embedded: boolean
  completed: boolean | null
  disclaimerPending: boolean
  replayed: boolean
}): boolean | null {
  // An embedded conversation is a chatbot inside somebody else's page. It has
  // no sidebar, no room for an overlay over it, and the participant did not
  // come to it to be introduced to an application.
  if (embedded) return false
  // A replay spends the one unsolicited opening this page view gets: a tour
  // the participant started themselves must not be followed by a surprise
  // auto-start when the stored state finally lands.
  if (replayed) return false
  if (completed === null) return null
  if (completed) return false
  // The tour points at parts of an application the disclaimer may yet deny
  // this participant, so it waits for that decision rather than talking over
  // the dialog.
  if (disclaimerPending) return null
  return true
}

interface ChatOnboardingProviderProps {
  /**
   * Whether the disclaimer still stands between the participant and the chat.
   * The tour introduces an application the disclaimer may yet deny them, so it
   * waits for that decision instead of opening behind a dialog.
   */
  disclaimerPending: boolean
  children: ReactNode
}

export function ChatOnboardingProvider({
  disclaimerPending,
  children,
}: ChatOnboardingProviderProps) {
  const t = useTranslations()
  const { embedded } = useChatUi()
  // `null` while the completion state is still unknown, which is not the same
  // as "never completed": opening on an unsettled state would show the tour to
  // someone who finished it long ago.
  const [completed, setCompleted] = useState<boolean | null>(null)
  const [replayed, setReplayed] = useState(false)
  const gateClaimed = useRef(false)

  // Nothing is fetched in an embedded conversation, because nothing is shown
  // there either.
  useEffect(() => {
    if (embedded) return

    let active = true

    async function load() {
      try {
        const response = await fetch(
          `/api/onboarding-tour?tourId=${CHAT_ONBOARDING_TOUR_ID}`
        )
        // A participant without a full account gets 403 here. Any failure
        // settles as completed, which keeps the tour shut for this page view
        // rather than opening it over a chat whose state is unknown.
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

  // The composer autofocuses itself and would pull focus out of the overlay,
  // so it is told to wait for as long as the tour is in front of it — the same
  // gate the disclaimer uses.
  const claimGate = useCallback(() => {
    gateClaimed.current = true
    setOnboardingGateOpen(true)
  }, [])

  // Finishing, skipping and closing all end the tour for good, because the
  // promise it makes is "you will not be shown this again", not "you read all
  // of it". A replay records nothing: the state is already stored, and the
  // route would only touch its housekeeping timestamp.
  const endTour = useCallback(() => {
    gateClaimed.current = false
    setOnboardingGateOpen(false)

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

  // Five things about this chat that are true on every screen, in the order a
  // newcomer meets them. Their copy lives under `chat.onboarding` in the
  // shared message files — `<id>Title` and `<id>Body` per step.
  const steps = useMemo<ProductTourStep[]>(
    () => [
      {
        element: () => resolveFeatureTarget('chat-mode-switcher'),
        title: t('chat.onboarding.modesTitle'),
        description: t('chat.onboarding.modesBody'),
      },
      {
        // Citations only exist inside an answer, so there is nothing on an
        // empty chat to point at. Driver.js centers a step that names no
        // element, which is how a tour carries a card of plain explanation.
        title: t('chat.onboarding.sourcesTitle'),
        description: t('chat.onboarding.sourcesBody'),
      },
      {
        element: () => resolveFeatureTarget('chat-composer-attach'),
        title: t('chat.onboarding.attachmentsTitle'),
        description: t('chat.onboarding.attachmentsBody'),
      },
      {
        element: () => resolveFeatureTarget('chat-thread-list'),
        title: t('chat.onboarding.historyTitle'),
        description: t('chat.onboarding.historyBody'),
      },
      {
        element: () => resolveFeatureTarget('chat-credits'),
        title: t('chat.onboarding.creditsTitle'),
        description: t('chat.onboarding.creditsBody'),
      },
    ],
    [t]
  )

  const labels = useMemo(
    () => ({
      next: t('chat.onboarding.next'),
      previous: t('chat.onboarding.previous'),
      done: t('chat.onboarding.done'),
      // Driver.js fills its own counters into the rendered string, so the
      // markers travel through the translation as plain values.
      progress: t('chat.onboarding.progress', {
        current: '{{current}}',
        total: '{{total}}',
      }),
    }),
    [t]
  )

  const autoStart = resolveAutoStart({
    embedded,
    completed,
    disclaimerPending,
    replayed,
  })

  const { startTour } = useProductTour({
    steps,
    labels,
    autoStart,
    onComplete: endTour,
    onSkip: endTour,
    onDismiss: endTour,
  })

  // The hook opens an auto-start one frame later and has no way to announce
  // it, so the gate is claimed here on the same condition the hook uses. The
  // remaining reason it would not open — a tab that already spent its single
  // unsolicited overlay — is the one checked here as well; the step list
  // always contains the centered card, so there is no run in which every step
  // is missing.
  useEffect(() => {
    if (autoStart !== true || gateClaimed.current) return
    if (unsolicitedOverlayShownThisSession()) return

    claimGate()
  }, [autoStart, claimGate])

  const replay = useCallback(() => {
    setReplayed(true)
    claimGate()
    startTour()
  }, [claimGate, startTour])

  // A provider that unmounts while the tour is open must not leave the
  // composer waiting for an overlay that is gone.
  useEffect(() => () => setOnboardingGateOpen(false), [])

  const value = useMemo<ChatOnboardingValue>(() => ({ replay }), [replay])

  return (
    <ChatOnboardingContext.Provider value={value}>
      {children}
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
