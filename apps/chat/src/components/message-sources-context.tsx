'use client'

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useLayoutEffect,
  useReducer,
} from 'react'

import type { MessageSources } from '@/src/hooks/useMessageSources'
import type { ChatSource } from '@/src/lib/sources/types'

const EMPTY_SOURCES: ChatSource[] = []
const EMPTY_CITATION_COUNTS = new Map<number, number>()
const NOOP_CLEANUP = () => {}

export type CitationRegistryState = {
  messageId: string
  sourceList: ChatSource[]
  counts: Map<number, number>
  ready: boolean
}

export type CitationRegistryAction =
  | { type: 'register'; messageId: string; index: number }
  | { type: 'unregister'; messageId: string; index: number }
  | { type: 'ready'; messageId: string; sourceList: ChatSource[] }

/**
 * Tracks the citations that were actually rendered for one assistant message.
 * The message id on every action makes stale effect cleanups harmless when a
 * branch switch reuses a component instance for a different message.
 */
export function citationRegistryReducer(
  state: CitationRegistryState,
  action: CitationRegistryAction
): CitationRegistryState {
  if (action.type === 'ready') {
    if (state.messageId !== action.messageId) {
      return {
        messageId: action.messageId,
        sourceList: action.sourceList,
        counts: new Map(),
        ready: true,
      }
    }

    return {
      ...state,
      sourceList: action.sourceList,
      ready: true,
    }
  }

  if (action.type === 'register' && state.messageId !== action.messageId) {
    return {
      messageId: action.messageId,
      sourceList: EMPTY_SOURCES,
      counts: new Map([[action.index, 1]]),
      ready: false,
    }
  }

  if (state.messageId !== action.messageId) return state

  const nextCounts = new Map(state.counts)
  const currentCount = nextCounts.get(action.index) ?? 0

  if (action.type === 'register') {
    nextCounts.set(action.index, currentCount + 1)
  } else if (currentCount <= 1) {
    nextCounts.delete(action.index)
  } else {
    nextCounts.set(action.index, currentCount - 1)
  }

  return { ...state, counts: nextCounts }
}

export function partitionSources(
  sources: readonly ChatSource[],
  citationCounts: ReadonlyMap<number, number>
): { citedSources: ChatSource[]; uncitedSources: ChatSource[] } {
  const citedSources: ChatSource[] = []
  const uncitedSources: ChatSource[] = []

  for (const source of sources) {
    if ((citationCounts.get(source.index) ?? 0) > 0) {
      citedSources.push(source)
    } else {
      uncitedSources.push(source)
    }
  }

  return { citedSources, uncitedSources }
}

type MessageSourcesContextValue = MessageSources & {
  citationCounts: ReadonlyMap<number, number>
  citationsReady: boolean
  registerCitation: (index: number) => () => void
}

// Default = no sources, for any consumer rendered outside an
// `AssistantMessage` (or a user message, which never wraps one) — zero
// behavior change: inline `[n]` markers stay plain text and `SourcesSection`
// renders nothing.
const DEFAULT_VALUE: MessageSourcesContextValue = {
  messageId: '',
  sources: EMPTY_SOURCES,
  citationCounts: EMPTY_CITATION_COUNTS,
  citationsReady: true,
  registerCitation: () => NOOP_CLEANUP,
}

const MessageSourcesContext =
  createContext<MessageSourcesContextValue>(DEFAULT_VALUE)

export function MessageSourcesProvider({
  value,
  children,
}: {
  value: MessageSources
  children: ReactNode
}) {
  const [registry, dispatch] = useReducer(citationRegistryReducer, {
    messageId: value.messageId,
    sourceList: value.sources,
    counts: new Map(),
    ready: false,
  })

  // Registration happens in child layout effects. This parent effect runs in
  // the same commit, after those registrations, and closes the initial
  // uncited window without ever rendering all sources as uncited first.
  useLayoutEffect(() => {
    dispatch({
      type: 'ready',
      messageId: value.messageId,
      sourceList: value.sources,
    })
  }, [value.messageId, value.sources])

  const registerCitation = useCallback(
    (index: number) => {
      dispatch({ type: 'register', messageId: value.messageId, index })
      return () => {
        dispatch({ type: 'unregister', messageId: value.messageId, index })
      }
    },
    [value.messageId]
  )

  const stateMatchesValue =
    registry.messageId === value.messageId &&
    registry.sourceList === value.sources

  return (
    <MessageSourcesContext.Provider
      value={{
        ...value,
        citationCounts: stateMatchesValue
          ? registry.counts
          : EMPTY_CITATION_COUNTS,
        citationsReady: stateMatchesValue && registry.ready,
        registerCitation,
      }}
    >
      {children}
    </MessageSourcesContext.Provider>
  )
}

export function useMessageSourcesContext(): MessageSourcesContextValue {
  return useContext(MessageSourcesContext)
}
