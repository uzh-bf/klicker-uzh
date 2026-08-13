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
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useChatUi } from '../components/chat-ui-context'
import { imageAttachmentAdapter } from '../lib/attachments/imageAttachmentAdapter'

const EMPTY_MESSAGES: ExtendedThreadMessageLike[] = []

export function RuntimeProvider({
  chatbotId,
  children,
}: Readonly<{
  chatbotId: string
  children: React.ReactNode
}>) {
  const { embedded } = useChatUi()
  const { threadId } = useParams<{ chatbotId: string; threadId?: string }>()
  const activeThreadId = useChatStore((state) => state.activeThreadId)
  const activeThread = useChatStore((state) =>
    state.threads.find((thread) => thread.id === state.activeThreadId)
  )
  const existingThread = useChatStore((state) =>
    threadId
      ? (state.threads.find((thread) => thread.id === threadId) ?? null)
      : null
  )
  const setMessagesInternal = useChatStore((state) => state.setMessages)
  const loadThreads = useChatStore((state) => state.loadThreads)
  const switchToThread = useChatStore((state) => state.switchToThread)
  const resyncModeFromThread = useChatStore(
    (state) => state.resyncModeFromThread
  )
  const resetSession = useChatStore((state) => state.resetSession)
  const selectedModel = useSettingsStore((state) => state.selectedModel)
  const selectedMode = useSettingsStore((state) => state.selectedMode)
  const selectedReasoningEffort = useSettingsStore(
    (state) => state.selectedReasoningEffort
  )
  const supportsImageAttachments = useSettingsStore(
    (state) =>
      state.modelOptions.find((model) => model.id === selectedModel)
        ?.supportsImageAttachments !== false
  )
  const loadCredits = useSettingsStore((state) => state.loadCredits)
  const loadModeOptions = useSettingsStore((state) => state.loadModeOptions)
  const router = useRouter()
  const searchParams = useSearchParams()
  const queryString = searchParams.toString()
  const missingThreadRedirectPath = queryString
    ? `/${chatbotId}?${queryString}`
    : `/${chatbotId}`
  const [threadsLoaded, setThreadsLoaded] = useState(false)
  const lastSyncedThreadId = useRef<string | null>(null)
  const modeResyncedForThread = useRef<string | null>(null)
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
  const messages = activeThread?.messages ?? EMPTY_MESSAGES
  const isRunning = activeThread?.isRunning ?? false

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
  }, [chatbotId, embedded, loadCredits, loadModeOptions, loadThreads, threadId])

  // sync active thread with URL params
  // Retry state intentionally triggers this synchronization effect without
  // being read by its callback after a failed thread switch.
  // biome-ignore lint/correctness/useExhaustiveDependencies: syncRetryTrigger is an intentional retry-only lifecycle trigger
  useEffect(() => {
    if (!threadsLoaded) return

    if (!threadId) {
      if (activeThreadId !== null) {
        useChatStore.setState({ activeThreadId: null })
      }
      lastSyncedThreadId.current = null
      modeResyncedForThread.current = null
      syncInFlight.current = null
      syncRetryCount.current = 0
      return
    }

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
        // A direct URL load (bookmark/reload) can restore a persisted
        // `activeThreadId` that already matches the URL with messages
        // already cached, so `switchToThread` below never runs for this
        // thread and its mode-resync would otherwise be skipped entirely.
        // Resync at most once per thread activation: this effect re-runs on
        // every `threads` update (streaming, rating, rename), and repeating
        // the resync then would snap back a mode the user picked manually
        // while viewing the thread.
        if (modeResyncedForThread.current !== threadId) {
          modeResyncedForThread.current = threadId
          resyncModeFromThread(threadId)
        }
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
        // switchToThread already resynced the mode for this activation.
        modeResyncedForThread.current = threadId
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
    resyncModeFromThread,
    router,
    switchToThread,
    syncRetryTrigger,
    threadId,
    existingThread,
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
      delete rest.rating
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

  const adapters = useMemo(
    () =>
      supportsImageAttachments ? { attachments: imageAttachmentAdapter } : {},
    [supportsImageAttachments]
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
    adapters,
  })

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      {children}
    </AssistantRuntimeProvider>
  )
}
