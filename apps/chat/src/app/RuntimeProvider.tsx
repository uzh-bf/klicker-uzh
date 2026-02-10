'use client'

import {
  AssistantRuntimeProvider,
  useExternalStoreRuntime,
  type ThreadMessageLike,
} from '@assistant-ui/react'
import { useParams, useRouter } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useChatResponse } from 'src/hooks/useChatResponse'
import { useThreadManagement } from 'src/hooks/useThreadManagement'
import {
  useChatStore,
  type ExtendedThreadMessageLike,
} from 'src/stores/chatStore'
import { useSettingsStore } from 'src/stores/settingsStore'
import { useChatUi } from '../components/chat-ui-context'

export function RuntimeProvider({
  chatbotId,
  children,
}: Readonly<{
  chatbotId: string
  children: React.ReactNode
}>) {
  const { embedded } = useChatUi()
  const {
    activeThreadId,
    threads,
    setMessages,
    loadThreads,
    switchToThread,
    resetSession,
  } = useChatStore()
  const {
    selectedModel,
    selectedMode,
    selectedReasoningEffort,
    loadCredits,
    loadModeOptions,
  } = useSettingsStore()
  const { threadId } = useParams<{ chatbotId: string; threadId?: string }>()
  const router = useRouter()
  const [threadsLoaded, setThreadsLoaded] = useState(false)
  const lastSyncedThreadId = useRef<string | null>(null)
  const syncInFlight = useRef<string | null>(null)
  // get current thread state
  const activeThread = threads.find((t) => t.id === activeThreadId)
  const messages = activeThread?.messages || []
  const isRunning = activeThread?.isRunning || false

  // reset session for embedded mode without a thread
  useEffect(() => {
    if (embedded && !threadId) {
      resetSession()
    }
  }, [embedded, resetSession, threadId])

  // load runtime data on component mount / chatbot changes
  useEffect(() => {
    if (embedded && !threadId) return

    let isMounted = true

    setThreadsLoaded(false)
    lastSyncedThreadId.current = null

    void (async () => {
      await loadThreads(chatbotId)
      if (isMounted) setThreadsLoaded(true)
    })()

    void (async () => {
      await loadModeOptions(chatbotId)
      await loadCredits(chatbotId)
    })()

    return () => {
      isMounted = false
    }
    // threadId intentionally excluded -- thread switches are handled by the
    // sync effect below; re-running loadThreads on every navigation wipes
    // already-fetched messages and causes race conditions.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatbotId, embedded, loadCredits, loadModeOptions, loadThreads])

  // sync active thread with URL params
  useEffect(() => {
    if (!threadsLoaded) return

    if (!threadId) {
      if (activeThreadId !== null) {
        useChatStore.setState({ activeThreadId: null })
      }
      lastSyncedThreadId.current = null
      syncInFlight.current = null
      return
    }

    const existingThread = threads.find((thread) => thread.id === threadId)

    if (!existingThread) {
      const redirectTarget = `/${chatbotId}${window.location.search}`

      router.replace(redirectTarget)
      lastSyncedThreadId.current = null
      syncInFlight.current = null
      return
    }

    if (activeThreadId === threadId) {
      if (
        existingThread.allMessages.length > 0 ||
        existingThread.messages.length > 0
      ) {
        lastSyncedThreadId.current = threadId
        return
      }

      if (lastSyncedThreadId.current === threadId) {
        return
      }
    }

    if (
      lastSyncedThreadId.current === threadId &&
      activeThreadId === threadId
    ) {
      return
    }

    if (syncInFlight.current === threadId) {
      return
    }

    syncInFlight.current = threadId

    void switchToThread(chatbotId, threadId).then((success) => {
      if (success) {
        lastSyncedThreadId.current = threadId
      }

      if (syncInFlight.current === threadId) {
        syncInFlight.current = null
      }
    })
  }, [
    activeThreadId,
    chatbotId,
    router,
    switchToThread,
    threadId,
    threads,
    threadsLoaded,
  ])

  // init chat response handling hook
  const { generateChatResponse, abortControllerRef } = useChatResponse(
    selectedModel,
    selectedMode,
    selectedReasoningEffort
  )

  // init thread management hooks
  const { onNew, onEdit, onReload, onCancel } = useThreadManagement(
    generateChatResponse,
    abortControllerRef
  )

  const convertMessage = useCallback(
    (message: ExtendedThreadMessageLike): ThreadMessageLike => {
      const {
        chatMode,
        modelId,
        reasoningEffort,
        creditsUsed,
        metadata,
        ...rest
      } = message
      const custom = {
        ...(metadata?.custom ?? {}),
        chatMode: chatMode ?? null,
        modelId: modelId ?? null,
        reasoningEffort: reasoningEffort ?? null,
        creditsUsed: creditsUsed ?? null,
      }

      return {
        ...rest,
        metadata: {
          ...metadata,
          custom,
        },
      }
    },
    []
  )

  // runtime config for assistant UI
  const runtime = useExternalStoreRuntime({
    messages,
    isRunning,
    setMessages,
    onNew,
    onEdit,
    onReload,
    onCancel,
    convertMessage,
  })

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      {/* <RAGToolUI /> */}
      {children}
    </AssistantRuntimeProvider>
  )
}
