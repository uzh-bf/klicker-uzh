'use client'

import { createContext, useContext, useMemo, type ReactNode } from 'react'
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
