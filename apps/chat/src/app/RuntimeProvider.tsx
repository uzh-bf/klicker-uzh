'use client'

import { useChatResponse } from '@/src/hooks/useChatResponse'
import { useThreadManagement } from '@/src/hooks/useThreadManagement'
import {
  useChatStore,
  type ExtendedThreadMessageLike,
} from '@/src/stores/chatStore'
import { useSettingsStore } from '@/src/stores/settingsStore'
import {
  AssistantRuntimeProvider,
  useExternalStoreRuntime,
  type ThreadMessageLike,
} from '@assistant-ui/react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useChatUi } from '../components/chat-ui-context'
import { imageAttachmentAdapter } from '../lib/attachments/imageAttachmentAdapter'

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
    setMessages: setMessagesInternal,
    loadThreads,
    switchToThread,
    resetSession,
  } = useChatStore()
  const {
    selectedModel,
    selectedMode,
    selectedReasoningEffort,
    modelOptions,
    loadCredits,
    loadModeOptions,
  } = useSettingsStore()
  const { threadId } = useParams<{ chatbotId: string; threadId?: string }>()
  const router = useRouter()
  const searchParams = useSearchParams()
  const queryString = searchParams.toString()
  const missingThreadRedirectPath = queryString
    ? `/${chatbotId}?${queryString}`
    : `/${chatbotId}`
  const [threadsLoaded, setThreadsLoaded] = useState(false)
  const lastSyncedThreadId = useRef<string | null>(null)
  const syncInFlight = useRef<string | null>(null)
  const syncRetryCount = useRef(0)
  const loadGeneration = useRef(0)
  const [syncRetryTrigger, setSyncRetryTrigger] = useState(0)
  const previousRuntimeContext = useRef<{
    chatbotId: string
    embedded: boolean
    threadId?: string
  } | null>(null)

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
    const previousContext = previousRuntimeContext.current

    if (embedded && !threadId) {
      // No thread yet: skip thread loading, but chatbot-scoped settings
      // (mode options, credits) are still needed for the embedded chrome.
      previousRuntimeContext.current = { chatbotId, embedded, threadId }
      void (async () => {
        await loadModeOptions(chatbotId)
        await loadCredits(chatbotId)
      })()
      return
    }

    const chatbotChanged = previousContext?.chatbotId !== chatbotId
    const embeddedThreadBecameAvailable =
      embedded &&
      !!threadId &&
      previousContext?.embedded &&
      !previousContext.threadId

    const shouldLoadRuntimeData =
      !previousContext || chatbotChanged || embeddedThreadBecameAvailable

    previousRuntimeContext.current = { chatbotId, embedded, threadId }

    if (!shouldLoadRuntimeData) return

    const currentGen = ++loadGeneration.current

    setThreadsLoaded(false)
    lastSyncedThreadId.current = null

    void (async () => {
      try {
        await loadThreads(chatbotId)
      } catch (error) {
        console.error('Failed to load threads:', error)
      } finally {
        if (loadGeneration.current === currentGen) setThreadsLoaded(true)
      }
    })()

    void (async () => {
      await loadModeOptions(chatbotId)
      await loadCredits(chatbotId)
    })()
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
      syncRetryCount.current = 0
      return
    }

    const existingThread = threads.find((thread) => thread.id === threadId)

    if (!existingThread) {
      router.replace(missingThreadRedirectPath)
      lastSyncedThreadId.current = null
      syncInFlight.current = null
      syncRetryCount.current = 0
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
        syncRetryCount.current = 0
      } else if (syncRetryCount.current < 2) {
        syncRetryCount.current++
        setTimeout(() => setSyncRetryTrigger((c) => c + 1), 2000)
      }

      if (syncInFlight.current === threadId) {
        syncInFlight.current = null
      }
    })
  }, [
    activeThreadId,
    chatbotId,
    missingThreadRedirectPath,
    router,
    switchToThread,
    syncRetryTrigger,
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
        imageAttachments,
        metadata,
        ...rest
      } = message
      const custom = {
        ...(metadata?.custom ?? {}),
        chatMode: chatMode ?? null,
        modelId: modelId ?? null,
        reasoningEffort: reasoningEffort ?? null,
        creditsUsed: creditsUsed ?? null,
        imageAttachments: imageAttachments ?? [],
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

  // Wrap setMessages to handle readonly array from useExternalStoreRuntime
  const setMessages = useCallback(
    (messages: readonly ExtendedThreadMessageLike[]) => {
      setMessagesInternal([...messages])
    },
    [setMessagesInternal]
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
    adapters: {
      ...(modelOptions.find((m) => m.id === selectedModel)
        ?.supportsImageAttachments !== false && {
        attachments: imageAttachmentAdapter,
      }),
    },
  })

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      {children}
    </AssistantRuntimeProvider>
  )
}
