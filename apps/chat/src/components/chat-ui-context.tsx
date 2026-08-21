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
let disclaimerGateOpen = false
const disclaimerGateListeners = new Set<() => void>()

export function setDisclaimerGateOpen(open: boolean) {
  if (disclaimerGateOpen === open) return
  disclaimerGateOpen = open
  disclaimerGateListeners.forEach((listener) => listener())
}

function subscribeToDisclaimerGate(listener: () => void) {
  disclaimerGateListeners.add(listener)
  return () => disclaimerGateListeners.delete(listener)
}

export function useDisclaimerGateOpen() {
  return useSyncExternalStore(
    subscribeToDisclaimerGate,
    () => disclaimerGateOpen,
    () => false
  )
}
