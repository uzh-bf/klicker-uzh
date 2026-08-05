'use client'

import { createContext, useContext, type ReactNode } from 'react'

import type { MessageSources } from '@/src/hooks/useMessageSources'
import type { ChatSource } from '@/src/lib/sources/types'

const EMPTY_SOURCES: ChatSource[] = []

// Default = no sources, for any consumer rendered outside an
// `AssistantMessage` (or a user message, which never wraps one) — zero
// behavior change: inline `[n]` markers stay plain text and `SourcesSection`
// renders nothing.
const DEFAULT_VALUE: MessageSources = { messageId: '', sources: EMPTY_SOURCES }

const MessageSourcesContext = createContext<MessageSources>(DEFAULT_VALUE)

export function MessageSourcesProvider({
  value,
  children,
}: {
  value: MessageSources
  children: ReactNode
}) {
  return (
    <MessageSourcesContext.Provider value={value}>
      {children}
    </MessageSourcesContext.Provider>
  )
}

export function useMessageSourcesContext(): MessageSources {
  return useContext(MessageSourcesContext)
}
