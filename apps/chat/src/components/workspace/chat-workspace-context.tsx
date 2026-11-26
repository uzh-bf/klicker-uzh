'use client'

import type { KnowledgeGraphFocusRequest } from '@klicker-uzh/shared-components/src/knowledgeGraph/KnowledgeGraphViewer'
import type { KnowledgeGraphResponse } from '@klicker-uzh/types'
import { usePathname } from 'next/navigation'
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

/**
 * The docked workspace beside the conversation shows one item at a time: the
 * knowledge graph or an interactive explanation. Two side panels would leave
 * neither usable, so opening one replaces the other.
 */
export type ChatWorkspaceItem =
  | { kind: 'graph' }
  | { kind: 'explanation'; id: string; title: string; html: string }

/**
 * docked: the panel's own (resizable) width beside the conversation.
 * expanded: the panel takes the room and the conversation stays docked in a
 * narrow column with a usable composer.
 * fullscreen: the panel covers the page and the conversation is inert.
 */
export type ChatWorkspaceSize = 'docked' | 'expanded' | 'fullscreen'

export type ChatWorkspaceExplanation = { title: string; html: string }

type PendingFocus = 'composer' | 'opener' | null

const COMPOSER_SELECTOR = '[data-cy="chat-composer-input"]'
const GRAPH_OPENER_SELECTOR = '[data-cy="knowledge-graph-mode-link"]'

export const explanationOpenerSelector = (id: string) =>
  `[data-explanation-id="${CSS.escape(id)}"] [data-cy="explanation-open"]`

/** The split layout needs this width; below it the panel replaces the chat. */
export const WORKSPACE_SPLIT_QUERY = '(min-width: 1024px)'

export type ChatWorkspaceValue = {
  item: ChatWorkspaceItem | null
  size: ChatWorkspaceSize
  setSize: (size: ChatWorkspaceSize) => void
  /** Leaves fullscreen, moving focus to the composer when asked. */
  exitFullscreen: (options?: { focusComposer?: boolean }) => void
  /** Closes the panel. Focus returns to the control that opened it. */
  close: (options?: { focusComposer?: boolean }) => void
  chatbotId: string
  graph: {
    enabled: boolean
    open: boolean
    toggle: () => void
    focusRequest?: KnowledgeGraphFocusRequest
    /** Absent when the concept map is disabled, which also disables links. */
    focusConcept?: (response: KnowledgeGraphResponse, nodeId: string) => void
  }
  explanations: {
    activeId: string | null
    open: (id: string, explanation: ChatWorkspaceExplanation) => void
    /** Cards register their loaded page so the panel can step between them. */
    register: (id: string, explanation: ChatWorkspaceExplanation) => () => void
    /** The registered explanations in thread order. */
    ordered: () => Array<{ id: string } & ChatWorkspaceExplanation>
  }
}

const ChatWorkspaceContext = createContext<ChatWorkspaceValue | null>(null)

export function ChatWorkspaceProvider({
  chatbotId,
  graphEnabled,
  children,
}: {
  chatbotId: string
  graphEnabled: boolean
  children: ReactNode
}) {
  const pathname = usePathname()
  const [item, setItem] = useState<ChatWorkspaceItem | null>(
    pathname === `/${chatbotId}/graph` ? { kind: 'graph' } : null
  )
  const [size, setSizeState] = useState<ChatWorkspaceSize>('docked')
  // Leaving fullscreen returns to the layout it was entered from.
  const beforeFullscreen =
    useRef<Exclude<ChatWorkspaceSize, 'fullscreen'>>('docked')
  const setSize = useCallback((next: ChatWorkspaceSize) => {
    setSizeState((current) => {
      if (next === 'fullscreen' && current !== 'fullscreen')
        beforeFullscreen.current = current
      if (next === 'docked' && current === 'fullscreen')
        return beforeFullscreen.current
      return next
    })
  }, [])
  const [focusRequest, setFocusRequest] = useState<KnowledgeGraphFocusRequest>()
  const pendingFocus = useRef<PendingFocus>(null)
  const openerSelector = useRef<string | null>(null)
  const registry = useRef(new Map<string, ChatWorkspaceExplanation>())

  // A disabled concept map never shows, even through the /graph deep link.
  const visibleItem = item?.kind === 'graph' && !graphEnabled ? null : item

  const show = useCallback(
    (
      next: ChatWorkspaceItem,
      nextSize: Exclude<ChatWorkspaceSize, 'fullscreen'>,
      opener: string
    ) => {
      setItem(next)
      setSizeState((current) => {
        if (current !== 'fullscreen') return nextSize
        beforeFullscreen.current = nextSize
        return current
      })
      openerSelector.current = opener
    },
    []
  )

  const close = useCallback((options?: { focusComposer?: boolean }) => {
    // Closing drops a graph focus request, so reopening shows the overview
    // instead of replaying the last clicked concept in a fresh viewer.
    setFocusRequest(undefined)
    setItem(null)
    setSizeState('docked')
    pendingFocus.current = options?.focusComposer ? 'composer' : 'opener'
  }, [])

  const exitFullscreen = useCallback(
    (options?: { focusComposer?: boolean }) => {
      setSize('docked')
      if (options?.focusComposer) pendingFocus.current = 'composer'
    },
    [setSize]
  )

  // Runs after the panel's own effects have released the inert background,
  // so the target can take focus.
  useEffect(() => {
    const target = pendingFocus.current
    if (!target) return
    if (target === 'composer') {
      if (size === 'fullscreen') return
      pendingFocus.current = null
      document.querySelector<HTMLElement>(COMPOSER_SELECTOR)?.focus()
      return
    }
    if (visibleItem) return
    pendingFocus.current = null
    const selector = openerSelector.current
    openerSelector.current = null
    if (selector) document.querySelector<HTMLElement>(selector)?.focus()
  }, [visibleItem, size])

  const focusConcept = useCallback(
    (response: KnowledgeGraphResponse, nodeId: string) => {
      setFocusRequest((current) => ({
        response,
        nodeId,
        nonce: (current?.nonce ?? 0) + 1,
      }))
      show({ kind: 'graph' }, 'docked', GRAPH_OPENER_SELECTOR)
    },
    [show]
  )

  const graphOpen = visibleItem?.kind === 'graph'
  const toggleGraph = useCallback(() => {
    if (graphOpen) close()
    else {
      setFocusRequest(undefined)
      show({ kind: 'graph' }, 'docked', GRAPH_OPENER_SELECTOR)
    }
  }, [close, graphOpen, show])

  const openExplanation = useCallback(
    (id: string, explanation: ChatWorkspaceExplanation) =>
      show(
        { kind: 'explanation', id, ...explanation },
        'expanded',
        explanationOpenerSelector(id)
      ),
    [show]
  )

  const activeExplanationId =
    visibleItem?.kind === 'explanation' ? visibleItem.id : null
  const activeIdRef = useRef(activeExplanationId)
  useEffect(() => {
    activeIdRef.current = activeExplanationId
  }, [activeExplanationId])

  const register = useCallback(
    (id: string, explanation: ChatWorkspaceExplanation) => {
      registry.current.set(id, explanation)
      return () => {
        registry.current.delete(id)
        // A card leaves when the thread changes; its explanation then has no
        // place in the chat anymore. The check waits a tick, so a remount of
        // the same card (React strict mode) does not close the panel.
        setTimeout(() => {
          if (activeIdRef.current === id && !registry.current.has(id)) {
            setItem((current) =>
              current?.kind === 'explanation' && current.id === id
                ? null
                : current
            )
            setSizeState('docked')
          }
        }, 0)
      }
    },
    []
  )

  const ordered = useCallback(() => {
    const ids = Array.from(
      document.querySelectorAll<HTMLElement>('[data-explanation-id]')
    ).map((element) => element.dataset.explanationId ?? '')
    return ids.flatMap((id) => {
      const explanation = registry.current.get(id)
      return explanation ? [{ id, ...explanation }] : []
    })
  }, [])

  const value = useMemo<ChatWorkspaceValue>(
    () => ({
      item: visibleItem,
      size: visibleItem ? size : 'docked',
      setSize,
      chatbotId,
      exitFullscreen,
      close,
      graph: {
        enabled: graphEnabled,
        open: graphOpen,
        toggle: toggleGraph,
        focusRequest: graphOpen ? focusRequest : undefined,
        focusConcept: graphEnabled ? focusConcept : undefined,
      },
      explanations: {
        activeId: activeExplanationId,
        open: openExplanation,
        register,
        ordered,
      },
    }),
    [
      visibleItem,
      size,
      setSize,
      chatbotId,
      exitFullscreen,
      close,
      graphEnabled,
      graphOpen,
      toggleGraph,
      focusRequest,
      focusConcept,
      activeExplanationId,
      openExplanation,
      register,
      ordered,
    ]
  )

  return (
    <ChatWorkspaceContext.Provider value={value}>
      {children}
    </ChatWorkspaceContext.Provider>
  )
}

export function useChatWorkspace() {
  const context = useContext(ChatWorkspaceContext)
  if (!context) {
    throw new Error(
      'useChatWorkspace must be used within ChatWorkspaceProvider'
    )
  }
  return context
}

/** For components that also render outside the chat layout (previews). */
export function useOptionalChatWorkspace() {
  return useContext(ChatWorkspaceContext)
}
