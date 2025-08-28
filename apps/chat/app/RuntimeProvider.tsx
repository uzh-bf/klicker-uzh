'use client'

import {
  useChatStore,
  type ExtendedThreadMessageLike,
} from '@/app/stores/chatStore'
import { useSettingsStore } from '@/app/stores/settingsStore'
import { RAGToolUI } from '@/components/assistant-ui/tools-ui/rag-tool-ui'
import { WeatherToolUI } from '@/components/assistant-ui/tools-ui/weather-tool-ui'
import {
  AssistantRuntimeProvider,
  useExternalStoreRuntime,
  type AppendMessage,
  type ThreadMessageLike,
} from '@assistant-ui/react'
import { useCallback, useEffect } from 'react'

export function RuntimeProvider({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const {
    activeThreadId,
    threads,
    createThread,
    addMessage,
    setMessages,
    setIsRunning,
  } = useChatStore()
  const { selectedModel, selectedMode, modeOptions } = useSettingsStore()

  const activeThread = threads.find((t) => t.id === activeThreadId)
  const messages = activeThread?.messages || []
  const isRunning = activeThread?.isRunning || false

  // get system prompt for the selected mode
  const currentModeOption = modeOptions.find((mode) => mode.id === selectedMode)
  const systemPrompt = currentModeOption?.systemPrompt || ''

  // load threads on mount
  useEffect(() => {
    useChatStore.getState().loadThreads()
  }, [])

  // function to handle streaming chat response
  const generateChatResponse = useCallback(
    async (messagesToSend: ExtendedThreadMessageLike[], threadId: string) => {
      setIsRunning(true)

      const triggerMessage = messagesToSend[messagesToSend.length - 1]
      const parentId = triggerMessage?.parentId

      // assistant message ID which is also sent to backend to be coherent
      const assistantMessageId = generateId()

      try {
        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: messagesToSend.map((m) => ({
              id: m.id,
              role: m.role,
              content: Array.isArray(m.content)
                ? m.content
                    .map((c: { type?: string; text?: string } | string) =>
                      typeof c === 'object' && c.type === 'text'
                        ? c.text || ''
                        : String(c)
                    )
                    .join('')
                : String(m.content),
            })),
            threadId,
            selectedModel,
            systemPrompt,
            parentId: parentId || undefined,
            assistantMessageId,
          }),
        })

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`)
        }

        const reader = response.body?.getReader()
        const decoder = new TextDecoder()
        let buffer = ''

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const orderedContentParts: any[] = []
        let currentTextContent = ''
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const toolCallsMap: Map<string, any> = new Map()

        if (reader) {
          while (true) {
            const { done, value } = await reader.read()
            if (done) break

            const chunk = decoder.decode(value, { stream: true })
            buffer += chunk

            const lines = buffer.split('\n')
            buffer = lines.pop() || ''

            for (const line of lines) {
              if (!line.trim()) continue

              if (line === 'data: [DONE]') {
                continue
              }

              try {
                let jsonData

                if (line.startsWith('data: ')) {
                  const jsonString = line.substring(6) // remove "data: " prefix
                  jsonData = JSON.parse(jsonString)
                } else {
                  jsonData = JSON.parse(line)
                }

                if (jsonData.type === 'text-delta') {
                  currentTextContent += jsonData.delta || ''

                  // update last text content part or add if none exists
                  if (
                    orderedContentParts.length === 0 ||
                    orderedContentParts[orderedContentParts.length - 1].type !==
                      'text'
                  ) {
                    orderedContentParts.push({
                      type: 'text',
                      text: currentTextContent,
                    })
                  } else {
                    const lastPart =
                      orderedContentParts[orderedContentParts.length - 1]
                    if (lastPart.type === 'text') {
                      lastPart.text = currentTextContent
                    }
                  }

                  const assistantMessage: ThreadMessageLike = {
                    id: assistantMessageId,
                    role: 'assistant',
                    content: orderedContentParts,
                    createdAt: new Date(),
                  }

                  setMessages([...messagesToSend, assistantMessage])
                } else if (jsonData.type === 'tool-input-start') {
                  // finalize current text content if any
                  if (
                    currentTextContent.trim() &&
                    (orderedContentParts.length === 0 ||
                      orderedContentParts[orderedContentParts.length - 1]
                        .type !== 'text')
                  ) {
                    orderedContentParts.push({
                      type: 'text',
                      text: currentTextContent,
                    })
                    currentTextContent = ''
                  }

                  // add tool call in correct position
                  const toolCall = {
                    type: 'tool-call',
                    toolCallId: jsonData.toolCallId,
                    toolName: jsonData.toolName,
                    args: {},
                    result: 'Loading...',
                  }

                  toolCallsMap.set(jsonData.toolCallId, toolCall)
                  orderedContentParts.push(toolCall)

                  const assistantMessage: ThreadMessageLike = {
                    id: assistantMessageId,
                    role: 'assistant',
                    content: orderedContentParts,
                    createdAt: new Date(),
                  }

                  setMessages([...messagesToSend, assistantMessage])
                } else if (jsonData.type === 'tool-input-available') {
                  // update tool call with args
                  const existingToolCall = toolCallsMap.get(jsonData.toolCallId)
                  if (existingToolCall) {
                    existingToolCall.args = jsonData.input
                    existingToolCall.result = 'Executing...'

                    const assistantMessage: ThreadMessageLike = {
                      id: assistantMessageId,
                      role: 'assistant',
                      content: orderedContentParts,
                      createdAt: new Date(),
                    }

                    setMessages([...messagesToSend, assistantMessage])
                  }
                } else if (jsonData.type === 'tool-output-available') {
                  // update tool call with result
                  const existingToolCall = toolCallsMap.get(jsonData.toolCallId)
                  if (existingToolCall) {
                    existingToolCall.result = jsonData.output

                    const assistantMessage: ExtendedThreadMessageLike = {
                      id: assistantMessageId,
                      role: 'assistant',
                      content: orderedContentParts,
                      createdAt: new Date(),
                    }

                    setMessages([...messagesToSend, assistantMessage])
                  }
                } else if (jsonData.type === 'tool-output-error') {
                  const existingToolCall = toolCallsMap.get(jsonData.toolCallId)
                  if (existingToolCall) {
                    existingToolCall.result = `Error: ${jsonData.errorText || 'Tool execution failed'}`

                    const assistantMessage: ExtendedThreadMessageLike = {
                      id: assistantMessageId,
                      role: 'assistant',
                      content: orderedContentParts,
                      createdAt: new Date(),
                    }

                    setMessages([...messagesToSend, assistantMessage])
                  }
                } else if (
                  [
                    'start',
                    'start-step',
                    'tool-input-delta',
                    'finish-step',
                    'finish',
                    'text-start',
                    'text-end',
                  ].includes(jsonData.type)
                ) {
                  // just for stream management, can be ignored
                } else {
                  console.error('Unknown stream type:', jsonData.type, jsonData)
                }
              } catch (error) {
                console.warn('Failed to parse stream line:', line, error)
              }
            }
          }

          // check for remaining text
          if (
            currentTextContent.trim() &&
            (orderedContentParts.length === 0 ||
              orderedContentParts[orderedContentParts.length - 1].type !==
                'text')
          ) {
            orderedContentParts.push({ type: 'text', text: currentTextContent })
          }

          if (orderedContentParts.length > 0) {
            const finalAssistantMessage: ThreadMessageLike = {
              id: assistantMessageId,
              role: 'assistant',
              content: orderedContentParts,
              createdAt: new Date(),
            }

            setMessages([...messagesToSend, finalAssistantMessage])
          }
        }
      } catch (error) {
        console.error('Chat error:', error)
      } finally {
        setIsRunning(false)
      }
    },
    [setMessages, setIsRunning, selectedModel, systemPrompt]
  ) // Add dependencies

  const onNew = useCallback(
    async (message: AppendMessage) => {
      let threadId = activeThreadId

      // create a new thread if none exists
      if (!threadId) {
        threadId = await createThread()
        if (!threadId) {
          console.error('Failed to create thread')
          return
        }
      }

      // add user message to the store
      const userMessage: ExtendedThreadMessageLike = {
        id: generateId(),
        role: 'user',
        content: message.content,
        createdAt: new Date(),
        parentId: message.parentId,
      }

      await addMessage(userMessage)

      // get current messages from store
      const currentMessages =
        useChatStore.getState().threads.find((t) => t.id === threadId)
          ?.messages || []

      // generate chat response
      await generateChatResponse(currentMessages, threadId)
    },
    [activeThreadId, createThread, addMessage, generateChatResponse]
  )

  const onEdit = async (message: AppendMessage) => {
    if (!activeThreadId) {
      console.error('No active thread for edit')
      return
    }

    // Find the index where to insert the edited message
    const index = messages.findIndex((m) => m.id === message.parentId) + 1

    // Keep messages up to the parent
    const newMessages = [...messages.slice(0, index)]

    // Add the edited message
    const editedMessage: ExtendedThreadMessageLike = {
      role: 'user',
      content: message.content,
      id: generateId(),
      createdAt: new Date(),
      parentId: message.parentId,
    }
    newMessages.push(editedMessage)

    // update the messages in the store
    setMessages(newMessages)

    // generate new chat response
    await generateChatResponse(newMessages, activeThreadId)
  }

  const onCancel = useCallback(async () => {
    setIsRunning(false)
  }, [setIsRunning])

  const runtime = useExternalStoreRuntime({
    messages,
    isRunning,
    setMessages,
    onNew,
    onEdit,
    onCancel,
    convertMessage: (message: ThreadMessageLike) => message,
  })

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <WeatherToolUI />
      <RAGToolUI />
      {children}
    </AssistantRuntimeProvider>
  )
}

function generateId(): string {
  return `msg-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`
}
