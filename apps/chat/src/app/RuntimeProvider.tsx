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

export function RuntimeProvider({
  chatbotId,
  children,
}: Readonly<{
  chatbotId: string
  children: React.ReactNode
}>) {
  const { activeThreadId, threads, setMessages, loadThreads } = useChatStore()
  const { selectedModel, selectedMode, loadModeOptions, loadCredits } =
    useSettingsStore()

  // get current thread state
  const activeThread = threads.find((t) => t.id === activeThreadId)
  const messages = activeThread?.messages || []
  const isRunning = activeThread?.isRunning || false

  // load threads, modeOptions and credits on component mount
  useEffect(() => {
    loadThreads(chatbotId)
    loadCredits(chatbotId)
    loadModeOptions(chatbotId)
  }, [chatbotId, loadCredits, loadThreads, loadModeOptions])

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
