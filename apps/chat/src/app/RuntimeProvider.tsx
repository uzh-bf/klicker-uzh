'use client'

import {
  AssistantRuntimeProvider,
  useExternalStoreRuntime,
  type ThreadMessageLike,
} from '@assistant-ui/react'
import { useCallback, useEffect } from 'react'
import { useChatResponse } from 'src/hooks/useChatResponse'
import { useThreadManagement } from 'src/hooks/useThreadManagement'
import { useChatStore } from 'src/stores/chatStore'
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
  const { activeThreadId, threads, setMessages, loadThreads, resetSession } =
    useChatStore()
  const { selectedModel, selectedMode, loadModeOptions, loadCredits } =
    useSettingsStore()

  // get current thread state
  const activeThread = threads.find((t) => t.id === activeThreadId)
  const messages = activeThread?.messages || []
  const isRunning = activeThread?.isRunning || false

  // load runtime data on component mount / chatbot changes
  useEffect(() => {
    if (embedded) {
      resetSession()
    } else {
      loadThreads(chatbotId)
    }
    loadCredits(chatbotId)
    loadModeOptions(chatbotId)
  }, [
    chatbotId,
    embedded,
    loadCredits,
    loadModeOptions,
    loadThreads,
    resetSession,
  ])

  // init chat response handling hook
  const { generateChatResponse, abortControllerRef } = useChatResponse(
    selectedModel,
    selectedMode
  )

  // init thread management hooks
  const { onNew, onEdit, onReload, onCancel } = useThreadManagement(
    generateChatResponse,
    abortControllerRef
  )

  const convertMessage = useCallback(
    (message: ThreadMessageLike) => message,
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
