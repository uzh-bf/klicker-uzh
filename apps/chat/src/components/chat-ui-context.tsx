'use client'

import {
  createContext,
  useContext,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from 'react'
import { useEmbedded } from '../hooks/useEmbedded'

interface ChatUiContextValue {
  embedded: boolean
  showSidebar: boolean
  showMinimalSettings: boolean
  showMessageActions: boolean
}

const ChatUiContext = createContext<ChatUiContextValue | null>(null)

export function ChatUiProvider({ children }: { children: ReactNode }) {
  const embedded = useEmbedded()

  const value = useMemo<ChatUiContextValue>(
    () => ({
      embedded,
      showSidebar: !embedded,
      showMinimalSettings: embedded,
      showMessageActions: !embedded,
    }),
    [embedded]
  )

  return (
    <ChatUiContext.Provider value={value}>{children}</ChatUiContext.Provider>
  )
}

export function useChatUi() {
  const context = useContext(ChatUiContext)
  if (!context) {
    throw new Error('useChatUi must be used within ChatUiProvider')
  }
  return context
}

// The disclaimer `Modal` (`@uzh-bf/design-system`) renders as a sibling of
// `ChatUiProvider` in `assistant.tsx`, not inside it, so its open state
// cannot reach the composer through `ChatUiContext` as an ordinary prop.
// This small external store lets `disclaimer-modal.tsx` publish the gate's
// open state and `thread.tsx` subscribe to it across that tree boundary.
//
// The onboarding tour joins the same store rather than bringing its own: the
// composer does not care which overlay is in front of it, only that one is —
// it must not autofocus underneath it, and it takes focus back when the last
// one closes. The two flags stay separate because they are set by different
// components, and the tour opens in the same commit in which the disclaimer
// closes.
let disclaimerGateOpen = false
let onboardingGateOpen = false
const gateListeners = new Set<() => void>()

function publishGateState() {
  gateListeners.forEach((listener) => listener())
}

export function setDisclaimerGateOpen(open: boolean) {
  if (disclaimerGateOpen === open) return
  disclaimerGateOpen = open
  publishGateState()
}

export function setOnboardingGateOpen(open: boolean) {
  if (onboardingGateOpen === open) return
  onboardingGateOpen = open
  publishGateState()
}

function subscribeToGateState(listener: () => void) {
  gateListeners.add(listener)
  return () => gateListeners.delete(listener)
}

export function useComposerGateOpen() {
  return useSyncExternalStore(
    subscribeToGateState,
    () => disclaimerGateOpen || onboardingGateOpen,
    () => false
  )
}
