'use client'

import {
  AssistantRuntimeProvider,
  useExternalStoreRuntime,
  type ThreadMessageLike,
} from '@assistant-ui/react'
import { useCallback, useEffect } from 'react'
import { RAGToolUI } from '../components/assistant-ui/tools-ui/rag-tool-ui'
import { useChatResponse } from '../hooks/useChatResponse'
import { useThreadManagement } from '../hooks/useThreadManagement'
import { useChatStore } from '../stores/chatStore'
import { useSettingsStore } from '../stores/settingsStore'

export function RuntimeProvider({
  chatbotId,
  children,
}: Readonly<{
  chatbotId: string
  children: React.ReactNode
}>) {
  const { activeThreadId, threads, setMessages, loadThreads } = useChatStore()
  const { selectedModel, selectedMode, modeOptions, loadCredits } =
    useSettingsStore()

  // get current thread state
  const activeThread = threads.find((t) => t.id === activeThreadId)
  const messages = activeThread?.messages || []
  const isRunning = activeThread?.isRunning || false

  // get selected chat mode config
  const currentModeOption = modeOptions.find((mode) => mode.id === selectedMode)
  const chatMode = currentModeOption?.id || 'default'

  // load threads and credits on component mount
  useEffect(() => {
    loadThreads(chatbotId)
    loadCredits(chatbotId)
  }, [chatbotId, loadCredits])

  // init chat response handling hook
  const { generateChatResponse, abortControllerRef } = useChatResponse(
    selectedModel,
    chatMode
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
      <RAGToolUI />
      {children}
    </AssistantRuntimeProvider>
  )
}
