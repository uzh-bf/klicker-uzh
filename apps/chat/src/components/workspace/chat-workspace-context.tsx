'use client'

import type { KnowledgeGraphFocusRequest } from '@klicker-uzh/shared-components/src/knowledgeGraph/KnowledgeGraphViewer'
import type { KnowledgeGraphResponse } from '@klicker-uzh/types'
import { usePathname } from 'next/navigation'
import type { FeedbackAnnotation, FeedbackContent } from '@/src/lib/feedback'
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
 * What a message card hands the canvas to show one of its artifacts, per
 * artifact type. A new type adds its entry here, its open size below and its
 * panel in `chat-workspace-layout.tsx`.
 */
export type ChatCanvasArtifactData = {
  explanation: { title: string; html: string }
  feedback: {
    title: string
    content: FeedbackContent
    annotation: FeedbackAnnotation | null
  }
}

export type ChatCanvasArtifactType = keyof ChatCanvasArtifactData

/** An artifact of a message, identified by its type and tool call id. */
export type ChatCanvasArtifact<
  K extends ChatCanvasArtifactType = ChatCanvasArtifactType,
> = { [T in K]: { kind: T; id: string } & ChatCanvasArtifactData[T] }[K]

/**
 * The docked workspace beside the conversation shows one item at a time: the
 * knowledge graph or one artifact of the thread, such as an interactive
 * explanation. Two side panels would leave neither usable, so opening one
 * replaces the other.
 */
export type ChatWorkspaceItem = { kind: 'graph' } | ChatCanvasArtifact

/**
 * docked: the panel's own (resizable) width beside the conversation.
 * expanded: the panel takes the room and the conversation stays docked in a
 * narrow column with a usable composer.
 * fullscreen: the panel covers the page and the conversation is inert.
 */
export type ChatWorkspaceSize = 'docked' | 'expanded' | 'fullscreen'

/** The size each artifact type opens at, unless the panel is fullscreen. */
const ARTIFACT_OPEN_SIZE: Record<
  ChatCanvasArtifactType,
  Exclude<ChatWorkspaceSize, 'fullscreen'>
> = {
  explanation: 'expanded',
  feedback: 'expanded',
}

type PendingFocus = 'composer' | 'opener' | null

const COMPOSER_SELECTOR = '[data-cy="chat-composer-input"]'
const GRAPH_OPENER_SELECTOR = '[data-cy="knowledge-graph-mode-link"]'

/** Cards mark their root and their open control with these attributes. */
export const canvasArtifactCardSelector = (
  kind: ChatCanvasArtifactType,
  id: string
) =>
  `[data-canvas-artifact="${kind}"][data-canvas-artifact-id="${CSS.escape(id)}"]`

const artifactOpenerSelector = (kind: ChatCanvasArtifactType, id: string) =>
  `${canvasArtifactCardSelector(kind, id)} [data-canvas-artifact-open]`

const registryKey = (kind: ChatCanvasArtifactType, id: string) =>
  `${kind}:${id}`

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
  artifacts: {
    /** The artifact the panel shows, if it shows one. */
    active: ChatCanvasArtifact | null
    open: <K extends ChatCanvasArtifactType>(
      kind: K,
      id: string,
      data: ChatCanvasArtifactData[K]
    ) => void
    /** Cards register their ready artifact so the panel can step between them. */
    register: <K extends ChatCanvasArtifactType>(
      kind: K,
      id: string,
      data: ChatCanvasArtifactData[K]
    ) => () => void
    /** The registered artifacts of one type in thread order. */
    ordered: <K extends ChatCanvasArtifactType>(
      kind: K
    ) => Array<ChatCanvasArtifact<K>>
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
  const registry = useRef(new Map<string, ChatCanvasArtifact>())

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

  const openArtifact = useCallback(
    <K extends ChatCanvasArtifactType>(
      kind: K,
      id: string,
      data: ChatCanvasArtifactData[K]
    ) =>
      show(
        { kind, id, ...data } as ChatCanvasArtifact,
        ARTIFACT_OPEN_SIZE[kind],
        artifactOpenerSelector(kind, id)
      ),
    [show]
  )

  const activeArtifact =
    visibleItem && visibleItem.kind !== 'graph' ? visibleItem : null
  const activeKey = activeArtifact
    ? registryKey(activeArtifact.kind, activeArtifact.id)
    : null
  const activeKeyRef = useRef(activeKey)
  useEffect(() => {
    activeKeyRef.current = activeKey
  }, [activeKey])

  const register = useCallback(
    <K extends ChatCanvasArtifactType>(
      kind: K,
      id: string,
      data: ChatCanvasArtifactData[K]
    ) => {
      const key = registryKey(kind, id)
      registry.current.set(key, { kind, id, ...data } as ChatCanvasArtifact)
      return () => {
        registry.current.delete(key)
        // A card leaves when the thread changes; its artifact then has no
        // place in the chat anymore. The check waits a tick, so a remount of
        // the same card (React strict mode) does not close the panel.
        setTimeout(() => {
          if (activeKeyRef.current === key && !registry.current.has(key)) {
            setItem((current) =>
              current?.kind === kind && current.id === id ? null : current
            )
            setSizeState('docked')
          }
        }, 0)
      }
    },
    []
  )

  const ordered = useCallback(
    <K extends ChatCanvasArtifactType>(kind: K) =>
      Array.from(
        document.querySelectorAll<HTMLElement>(
          `[data-canvas-artifact="${kind}"]`
        )
      ).flatMap((element) => {
        const artifact = registry.current.get(
          registryKey(kind, element.dataset.canvasArtifactId ?? '')
        )
        return artifact ? [artifact as unknown as ChatCanvasArtifact<K>] : []
      }),
    []
  )

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
      artifacts: {
        active: activeArtifact,
        open: openArtifact,
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
      activeArtifact,
      openArtifact,
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
