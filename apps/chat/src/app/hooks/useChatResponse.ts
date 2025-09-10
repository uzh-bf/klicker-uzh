import { useCallback, useRef } from 'react'
import {
  useChatStore,
  type ExtendedThreadMessageLike,
} from '../stores/chatStore'
import { generateId } from '../utils/chatUtils'

/**
 * Hook for handling streaming chat responses from the backend.
 *
 * This hook manages the streaming logic including:
 * - HTTP request handling with abort controller
 * - Streaming response parsing (SSE format)
 * - Real-time message updates with text deltas
 * - Tool call handling (start, input, output, errors)
 * - Message state management in the chat store
 *
 * @param selectedModel - The AI model to use for responses
 * @param chatMode - The chat mode/configuration
 * @returns Object containing generateChatResponse function and abort controller ref
 */
export function useChatResponse(selectedModel: string, chatMode: string) {
  const { setMessages, setIsRunning } = useChatStore()

  // AbortController to handle request cancellation
  const abortControllerRef = useRef<AbortController | null>(null)

  /**
   * Streaming chat response from the backend API.
   *
   * Process flow:
   * 1. Setup abort controller for cancellation
   * 2. Send POST request to /api/chat with messages and config
   * 3. Parse streaming response:
   *    - Handle different message types: text-delta, tool-calls, etc.
   *    - Update UI in real-time with partial responses
   *    - Finalize message when stream completes
   *
   * @param messagesToSend - Array of messages to send to the API
   * @param threadId - ID of the current chat thread
   */
  const generateChatResponse = useCallback(
    async (messagesToSend: ExtendedThreadMessageLike[], threadId: string) => {
      const abortController = new AbortController()
      abortControllerRef.current = abortController

      setIsRunning(true)

      const triggerMessage = messagesToSend[messagesToSend.length - 1]
      const parentId = triggerMessage?.parentId

      // generate assistant message ID; also sent to backend for consistency
      const assistantMessageId = generateId()

      try {
        // send request to API with streaming enabled
        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: abortController.signal,
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
            chatMode,
            parentId: parentId || undefined,
            assistantMessageId,
          }),
        })

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`)
        }

        // setup streaming response parsing
        const reader = response.body?.getReader()
        const decoder = new TextDecoder()
        let buffer = ''

        // state management for streaming content assembly
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const orderedContentParts: any[] = []
        let currentTextContent = ''
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const toolCallsMap: Map<string, any> = new Map()

        if (reader) {
          /**
           * STREAMING PROTOCOL:
           *
           * The AI SDK streams responses using SSE format:
           * - Each chunk may contain partial lines that need buffering
           * - Lines start with "data: " prefix followed by JSON
           * - Special line "data: [DONE]" signals stream completion
           *
           * SSE types:
           * - 'start': indicates beginning of new message
           * - 'finish': indicates end of message
           * - '[DONE]': indicates stream completion
           *
           * - 'text-start': text generation started
           * - 'text-delta': incremental text content
           * - 'text-end': text generation ended
           *
           * - 'tool-input-start': tool call started (shows "Loading...")
           * - 'tool-input-delta': incremental chunks of tool input (can be ignored)
           * - 'tool-input-available': tool arguments ready (shows "Executing...")
           * - 'tool-output-available': contains result of tool execution
           * - 'tool-output-error': tool execution failed; contains error details
           *
           * UI Update strategy:
           * - update UI after each meaningful event
           * - maintain ordered content parts (text + tool calls in sequence)
           * - use map to track tool calls by ID for updates
           */
          while (true) {
            const { done, value } = await reader.read()
            if (done) break

            // buffer management for incomplete chunks
            const chunk = decoder.decode(value, { stream: true })
            buffer += chunk

            // split by lines and process each complete line
            const lines = buffer.split('\n')
            buffer = lines.pop() || '' // keep incomplete line in buffer for next chunk

            for (const line of lines) {
              if (!line.trim()) continue
              if (line === 'data: [DONE]') continue

              try {
                // standard SSE format: "data: {json}" or raw JSON
                let jsonData
                if (line.startsWith('data: ')) {
                  const jsonString = line.substring(6) // Remove "data: " prefix
                  jsonData = JSON.parse(jsonString)
                } else {
                  jsonData = JSON.parse(line)
                }

                if (jsonData.type === 'text-delta') {
                  // INCREMENTAL TEXT
                  currentTextContent += jsonData.delta || ''

                  // maintain ordered parts (text + tools mixed)
                  if (
                    orderedContentParts.length === 0 ||
                    orderedContentParts[orderedContentParts.length - 1].type !==
                      'text'
                  ) {
                    // create new text part if none exists or last part was tool
                    orderedContentParts.push({
                      type: 'text',
                      text: currentTextContent,
                    })
                  } else {
                    // update existing text part with accumulated content
                    const lastPart =
                      orderedContentParts[orderedContentParts.length - 1]
                    if (lastPart.type === 'text') {
                      lastPart.text = currentTextContent
                    }
                  }

                  const assistantMessage: ExtendedThreadMessageLike = {
                    id: assistantMessageId,
                    role: 'assistant',
                    content: orderedContentParts,
                    createdAt: new Date(),
                    parentId: triggerMessage.id,
                  }
                  setMessages([...messagesToSend, assistantMessage])
                } else if (jsonData.type === 'tool-input-start') {
                  // TOOL-CALL INITIALIZATION
                  if (
                    currentTextContent.trim() &&
                    (orderedContentParts.length === 0 ||
                      orderedContentParts[orderedContentParts.length - 1]
                        .type !== 'text')
                  ) {
                    // finalize any pending text before starting tool call
                    orderedContentParts.push({
                      type: 'text',
                      text: currentTextContent,
                    })
                    currentTextContent = ''
                  }

                  // create tool call object and track by ID
                  const toolCall = {
                    type: 'tool-call',
                    toolCallId: jsonData.toolCallId,
                    toolName: jsonData.toolName,
                    args: {},
                    result: 'Loading...',
                  }

                  toolCallsMap.set(jsonData.toolCallId, toolCall)
                  orderedContentParts.push(toolCall)

                  const assistantMessage: ExtendedThreadMessageLike = {
                    id: assistantMessageId,
                    role: 'assistant',
                    content: orderedContentParts,
                    createdAt: new Date(),
                    parentId: triggerMessage.id,
                  }
                  setMessages([...messagesToSend, assistantMessage])
                } else if (jsonData.type === 'tool-input-available') {
                  // TOOL-CALL ARGS READY
                  const existingToolCall = toolCallsMap.get(jsonData.toolCallId)
                  if (existingToolCall) {
                    existingToolCall.args = jsonData.input
                    existingToolCall.result = 'Executing...'

                    const assistantMessage: ExtendedThreadMessageLike = {
                      id: assistantMessageId,
                      role: 'assistant',
                      content: orderedContentParts,
                      createdAt: new Date(),
                      parentId: triggerMessage.id,
                    }
                    setMessages([...messagesToSend, assistantMessage])
                  }
                } else if (jsonData.type === 'tool-output-available') {
                  // TOOL-CALL RESULT READY
                  const existingToolCall = toolCallsMap.get(jsonData.toolCallId)
                  if (existingToolCall) {
                    existingToolCall.result = jsonData.output

                    const assistantMessage: ExtendedThreadMessageLike = {
                      id: assistantMessageId,
                      role: 'assistant',
                      content: orderedContentParts,
                      createdAt: new Date(),
                      parentId: triggerMessage.id,
                    }
                    setMessages([...messagesToSend, assistantMessage])
                  }
                } else if (jsonData.type === 'tool-output-error') {
                  // TOOL-CALL FAILURE
                  const existingToolCall = toolCallsMap.get(jsonData.toolCallId)
                  if (existingToolCall) {
                    existingToolCall.result = `Error: ${jsonData.errorText || 'Tool execution failed'}`

                    const assistantMessage: ExtendedThreadMessageLike = {
                      id: assistantMessageId,
                      role: 'assistant',
                      content: orderedContentParts,
                      createdAt: new Date(),
                      parentId: triggerMessage.id,
                    }
                    setMessages([...messagesToSend, assistantMessage])
                  }
                } else if (jsonData.type === 'error') {
                  // STREAM ERROR
                  console.error(
                    'Stream error:',
                    jsonData.errorText || 'Unknown error',
                    jsonData
                  )

                  const errorContent = {
                    type: 'text',
                    text: `\n\n**Error**: I'm sorry, something went wrong while processing your request. Please try again.`,
                  }

                  orderedContentParts.push(errorContent)

                  const assistantMessage: ExtendedThreadMessageLike = {
                    id: assistantMessageId,
                    role: 'assistant',
                    content: orderedContentParts,
                    createdAt: new Date(),
                    parentId: triggerMessage.id,
                  }
                  setMessages([...messagesToSend, assistantMessage])

                  // stop processing the stream on error
                  break
                } else if (
                  [
                    'start', // stream started
                    'finish', // stream ended
                    'start-step', // processing step started
                    'finish-step', // processing step completed
                    'tool-input-delta', // tool argument building
                    'text-start', // text generation started
                    'text-end', // text generation ended
                  ].includes(jsonData.type)
                ) {
                  // STREAM LIFECYCLE: No action needed for these events
                } else {
                  // UNKNOWN EVENT
                  console.error('Unknown stream type:', jsonData.type, jsonData)
                }
              } catch (error) {
                console.warn('Failed to parse stream line:', line, error)
              }
            }
          }

          // finalize any remaining text content
          if (
            currentTextContent.trim() &&
            (orderedContentParts.length === 0 ||
              orderedContentParts[orderedContentParts.length - 1].type !==
                'text')
          ) {
            orderedContentParts.push({ type: 'text', text: currentTextContent })
          }

          // create final message and update store
          if (orderedContentParts.length > 0) {
            const finalAssistantMessage: ExtendedThreadMessageLike = {
              id: assistantMessageId,
              role: 'assistant',
              content: orderedContentParts,
              createdAt: new Date(),
              parentId: triggerMessage.id,
            }

            const newCurrentPath = [...messagesToSend, finalAssistantMessage]

            // update both current message path and complete message history
            const { threads } = useChatStore.getState()
            const activeThread = threads.find((t) => t.id === threadId)
            const updatedAllMessages = activeThread
              ? [...activeThread.allMessages, finalAssistantMessage]
              : newCurrentPath

            // persist final state to store
            useChatStore.setState((state) => ({
              threads: state.threads.map((thread) =>
                thread.id === threadId
                  ? {
                      ...thread,
                      messages: newCurrentPath,
                      allMessages: updatedAllMessages,
                    }
                  : thread
              ),
            }))
          }
        }
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
          // request was cancelled by user
        } else {
          console.error('Chat error:', error)
        }
      } finally {
        setIsRunning(false)
        abortControllerRef.current = null
      }
    },
    [setMessages, setIsRunning, selectedModel, chatMode]
  )

  return {
    generateChatResponse,
    abortControllerRef,
  }
}
