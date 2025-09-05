'use client'

import { useChatResponse } from '@/app/hooks/useChatResponse'
import { useThreadManagement } from '@/app/hooks/useThreadManagement'
import { useChatStore } from '@/app/stores/chatStore'
import { useSettingsStore } from '@/app/stores/settingsStore'
import { Context7ToolUI } from '@/components/assistant-ui/tools-ui/context7-tool-ui'
import { RAGToolUI } from '@/components/assistant-ui/tools-ui/rag-tool-ui'
import {
  AssistantRuntimeProvider,
  useExternalStoreRuntime,
  type ThreadMessageLike,
} from '@assistant-ui/react'
import { useCallback, useEffect } from 'react'

export function RuntimeProvider({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const { activeThreadId, threads, setMessages } = useChatStore()
  const { selectedModel, selectedMode, modeOptions } = useSettingsStore()

  // get current thread state
  const activeThread = threads.find((t) => t.id === activeThreadId)
  const messages = activeThread?.messages || []
  const isRunning = activeThread?.isRunning || false

  // get selected chat mode config
  const currentModeOption = modeOptions.find((mode) => mode.id === selectedMode)
  const chatMode = currentModeOption?.id || 'default'

  // load threads on component mount
  useEffect(() => {
    useChatStore.getState().loadThreads()
  }, [])

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
      <Context7ToolUI />
      {children}
    </AssistantRuntimeProvider>
  )
}
