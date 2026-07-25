import { useTranslations } from 'next-intl'
import { useParams } from 'next/navigation'
import { useCallback, useRef } from 'react'
import { hasAllImageAttachmentsHydrated } from '../lib/attachments/attachmentState'
import { type ReasoningEffort } from '../lib/config/reasoning'
import { normalizeLiveToolOutput } from '../lib/toolOutput'
import { generateId } from '../lib/utils/chatUtils'
import {
  useChatStore,
  type ExtendedThreadMessageLike,
} from '../stores/chatStore'
import { useSettingsStore } from '../stores/settingsStore'

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
 * @param selectedReasoningEffort - Requested reasoning effort
 * @returns Object containing generateChatResponse function and abort controller ref
 */
export function useChatResponse(
  selectedModel: string,
  selectedMode: string,
  selectedReasoningEffort: ReasoningEffort
) {
  const { chatbotId } = useParams<{ chatbotId: string }>()
  const t = useTranslations()

  const { loadCredits } = useSettingsStore()

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

      // Thread-specific helpers that target threadId directly,
      // bypassing activeThreadId which may be stale during race conditions
      const updateThreadMessages = (messages: ExtendedThreadMessageLike[]) => {
        useChatStore.setState((state) => ({
          threads: state.threads.map((thread) =>
            thread.id === threadId ? { ...thread, messages } : thread
          ),
        }))
      }

      const updateThreadRunning = (isRunning: boolean) => {
        useChatStore.setState((state) => ({
          threads: state.threads.map((thread) =>
            thread.id === threadId ? { ...thread, isRunning } : thread
          ),
        }))
      }

      updateThreadRunning(true)

      const triggerMessage = messagesToSend[messagesToSend.length - 1]
      const parentId = triggerMessage?.parentId
      let resolvedTriggerMessage = triggerMessage
      let resolvedMessagesToSend = messagesToSend

      // generate assistant message ID; also sent to backend for consistency
      const assistantMessageId = generateId()

      // Declared outside the try so the network-failure catch can preserve
      // whatever already streamed instead of replacing it with the error
      // bubble alone.
      const orderedContentParts: any[] = []

      try {
        const serializeMessageContent = (
          message: ExtendedThreadMessageLike
        ): string => {
          if (!Array.isArray(message.content)) {
            return String(message.content ?? '')
          }

          return message.content
            .filter(
              (
                part
              ): part is {
                type: 'text'
                text: string
              } =>
                typeof part === 'object' &&
                part !== null &&
                'type' in part &&
                part.type === 'text' &&
                'text' in part &&
                typeof part.text === 'string'
            )
            .map((part) => part.text)
            .join('')
        }

        if (
          resolvedTriggerMessage?.role === 'user' &&
          resolvedTriggerMessage.imageAttachments?.length &&
          !hasAllImageAttachmentsHydrated(
            resolvedTriggerMessage.imageAttachments
          )
        ) {
          const attachmentSourceMessageId =
            resolvedTriggerMessage.attachmentSourceMessageId ??
            resolvedTriggerMessage.id
          const hydratedTriggerMessage =
            chatbotId && resolvedTriggerMessage.id
              ? attachmentSourceMessageId === resolvedTriggerMessage.id
                ? await useChatStore
                    .getState()
                    .ensureFullImageAttachments(
                      chatbotId,
                      threadId,
                      resolvedTriggerMessage.id
                    )
                : await useChatStore
                    .getState()
                    .ensureFullImageAttachments(
                      chatbotId,
                      threadId,
                      resolvedTriggerMessage.id,
                      attachmentSourceMessageId
                    )
              : undefined

          if (
            !hydratedTriggerMessage?.imageAttachments?.length ||
            !hasAllImageAttachmentsHydrated(
              hydratedTriggerMessage.imageAttachments
            )
          ) {
            console.error(
              'Image attachments for this message could not be loaded.'
            )
            return
          }

          resolvedTriggerMessage = hydratedTriggerMessage
          resolvedMessagesToSend = [
            ...messagesToSend.slice(0, -1),
            hydratedTriggerMessage,
          ]
        }

        // send request to API with streaming enabled
        const response = await fetch(`/api/chatbots/${chatbotId}/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: abortController.signal,
          body: JSON.stringify({
            messages: resolvedMessagesToSend.map((m) => ({
              id: m.id,
              role: m.role,
              content: serializeMessageContent(m),
            })),
            threadId,
            selectedModel,
            selectedMode,
            reasoningEffort: selectedReasoningEffort,
            parentId: parentId || undefined,
            assistantMessageId,
            images: (resolvedTriggerMessage?.imageAttachments ?? [])
              .filter(
                (
                  attachment
                ): attachment is {
                  type: 'image'
                  imageBase64: string
                } => typeof attachment.imageBase64 === 'string'
              )
              .map((attachment) => attachment.imageBase64),
          }),
        })

        if (!response.ok) {
          // raw server-provided error detail is console-only; the student sees a
          // localized generic message instead (server text may be unlocalized or
          // leak implementation detail)
          let errorDetail = `HTTP error! status: ${response.status}`
          try {
            const errorPayload = await response.json()
            if (errorPayload?.error) {
              errorDetail = `${errorPayload.error}`
            } else if (errorPayload?.message) {
              errorDetail = `${errorPayload.message}`
            }
          } catch {
            try {
              const errorText = await response.text()
              if (errorText) {
                errorDetail = errorText
              }
            } catch {
              // ignore parsing errors and fall back to status message
            }
          }
          console.error('Chat request failed:', errorDetail)

          const assistantMessage: ExtendedThreadMessageLike = {
            id: assistantMessageId,
            role: 'assistant',
            content: [
              {
                type: 'text',
                text: `\n\n**${t('chat.response.errorLabel')}**: ${t('chat.response.genericError')}`,
              },
            ],
            createdAt: new Date(),
            parentId: triggerMessage?.id || null,
          }
          updateThreadMessages([...resolvedMessagesToSend, assistantMessage])
          return
        }

        // setup streaming response parsing
        const reader = response.body?.getReader()
        const decoder = new TextDecoder()
        let buffer = ''

        // state management for streaming content assembly
        let currentTextContent = ''
        let currentReasoningContent = ''
        const toolCallsMap: Map<string, any> = new Map()
        let finishReason: string | null = null
        let messageMetadata: {
          chatMode?: string | null
          modelId?: string | null
          reasoningEffort?: ReasoningEffort | null
          reasoningContent?: string | null
          creditsUsed?: number | null
        } | null = null
        let hasFinishEvent = false
        let hasStreamError = false

        const buildAssistantMessage = (): ExtendedThreadMessageLike => ({
          id: assistantMessageId,
          role: 'assistant',
          content: orderedContentParts,
          createdAt: new Date(),
          parentId: triggerMessage?.id || null,
          chatMode: messageMetadata?.chatMode ?? null,
          modelId: messageMetadata?.modelId ?? null,
          reasoningEffort: messageMetadata?.reasoningEffort ?? null,
          reasoningContent:
            (messageMetadata?.reasoningContent ?? currentReasoningContent) ||
            null,
          creditsUsed: messageMetadata?.creditsUsed ?? null,
        })

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

                  updateThreadMessages([
                    ...resolvedMessagesToSend,
                    buildAssistantMessage(),
                  ])
                } else if (jsonData.type === 'reasoning-delta') {
                  const reasoningDelta = jsonData.text || jsonData.delta || ''
                  if (reasoningDelta) {
                    currentReasoningContent += reasoningDelta

                    if (
                      orderedContentParts.length === 0 ||
                      orderedContentParts[orderedContentParts.length - 1]
                        .type !== 'reasoning'
                    ) {
                      orderedContentParts.push({
                        type: 'reasoning',
                        text: reasoningDelta,
                      })
                    } else {
                      const lastPart =
                        orderedContentParts[orderedContentParts.length - 1]
                      if (lastPart.type === 'reasoning') {
                        lastPart.text += reasoningDelta
                      }
                    }

                    updateThreadMessages([
                      ...resolvedMessagesToSend,
                      buildAssistantMessage(),
                    ])
                  }
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

                  updateThreadMessages([
                    ...resolvedMessagesToSend,
                    buildAssistantMessage(),
                  ])
                } else if (jsonData.type === 'tool-input-available') {
                  // TOOL-CALL ARGS READY
                  const existingToolCall = toolCallsMap.get(jsonData.toolCallId)
                  if (existingToolCall) {
                    existingToolCall.args = jsonData.input
                    existingToolCall.result = 'Executing...'

                    updateThreadMessages([
                      ...resolvedMessagesToSend,
                      buildAssistantMessage(),
                    ])
                  }
                } else if (jsonData.type === 'tool-output-available') {
                  // TOOL-CALL RESULT READY
                  const existingToolCall = toolCallsMap.get(jsonData.toolCallId)
                  if (existingToolCall) {
                    const output = normalizeLiveToolOutput(jsonData.output)
                    existingToolCall.result = output.result
                    existingToolCall.isError = output.isError

                    updateThreadMessages([
                      ...resolvedMessagesToSend,
                      buildAssistantMessage(),
                    ])
                  }
                } else if (jsonData.type === 'tool-output-error') {
                  // TOOL-CALL FAILURE
                  const existingToolCall = toolCallsMap.get(jsonData.toolCallId)
                  if (existingToolCall) {
                    const output = normalizeLiveToolOutput(undefined, true)
                    existingToolCall.result = output.result
                    existingToolCall.isError = output.isError

                    updateThreadMessages([
                      ...resolvedMessagesToSend,
                      buildAssistantMessage(),
                    ])
                  }
                } else if (jsonData.type === 'error') {
                  // STREAM ERROR
                  console.error(
                    'Stream error:',
                    jsonData.errorText || 'Unknown error',
                    jsonData
                  )

                  hasStreamError = true

                  const errorContent = {
                    type: 'text',
                    text: `\n\n**${t('chat.response.errorLabel')}**: ${t('chat.response.genericError')}`,
                  }

                  orderedContentParts.push(errorContent)

                  updateThreadMessages([
                    ...resolvedMessagesToSend,
                    buildAssistantMessage(),
                  ])

                  // stop processing this chunk's remaining lines on error; the
                  // outer read loop is also stopped below so the
                  // connection-interrupted suffix doesn't stack on top of this
                  break
                } else if (jsonData.type === 'finish') {
                  finishReason = jsonData.messageMetadata?.finishReason ?? null
                  if (
                    typeof jsonData.messageMetadata === 'object' &&
                    jsonData.messageMetadata !== null
                  ) {
                    const metadata = jsonData.messageMetadata as Record<
                      string,
                      unknown
                    >
                    const reasoningEffort =
                      typeof metadata.reasoningEffort === 'string' &&
                      metadata.reasoningEffort.length > 0
                        ? metadata.reasoningEffort
                        : null

                    messageMetadata = {
                      chatMode:
                        typeof metadata.chatMode === 'string'
                          ? metadata.chatMode
                          : null,
                      modelId:
                        typeof metadata.modelId === 'string'
                          ? metadata.modelId
                          : null,
                      reasoningEffort,
                      reasoningContent:
                        typeof metadata.reasoningContent === 'string'
                          ? metadata.reasoningContent
                          : null,
                      creditsUsed:
                        typeof metadata.creditsUsed === 'number'
                          ? metadata.creditsUsed
                          : null,
                    }
                  } else {
                    messageMetadata = null
                  }
                  if (messageMetadata?.reasoningContent) {
                    currentReasoningContent = messageMetadata.reasoningContent
                  }
                  hasFinishEvent = true
                } else if (jsonData.type === 'message-metadata') {
                  // No UI update needed
                } else if (
                  [
                    'start', // stream started
                    'start-step', // processing step started
                    'finish-step', // processing step completed
                    'tool-input-delta', // tool argument building
                    'text-start', // text generation started
                    'text-end', // text generation ended
                    'reasoning-start', // reasoning generation started
                    'reasoning-end', // reasoning generation ended
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

            // a stream 'error' part already surfaced its own error bubble;
            // stop reading further chunks so the interrupted-connection
            // suffix below doesn't also stack onto the same message
            if (hasStreamError) break
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

          if (
            currentReasoningContent.trim() &&
            !orderedContentParts.some((part) => part.type === 'reasoning')
          ) {
            orderedContentParts.unshift({
              type: 'reasoning',
              text: currentReasoningContent,
            })
          }

          if (finishReason === 'length') {
            orderedContentParts.push({
              type: 'text',
              text: '\n\n_(Response truncated — ask “continue” or request a shorter answer.)_',
            })
          } else if (!hasFinishEvent && !hasStreamError) {
            // only append the interrupted-connection suffix when the stream
            // just cut out silently; a stream 'error' part already added its
            // own error bubble above, so don't stack this on top of it
            orderedContentParts.push({
              type: 'text',
              text: `\n\n_(${t('chat.response.connectionInterrupted')})_`,
            })
          }

          // create final message and update store
          if (orderedContentParts.length > 0) {
            const finalAssistantMessage: ExtendedThreadMessageLike = {
              id: assistantMessageId,
              role: 'assistant',
              content: orderedContentParts,
              createdAt: new Date(),
              parentId: triggerMessage?.id || null,
              chatMode: messageMetadata?.chatMode ?? null,
              modelId: messageMetadata?.modelId ?? null,
              reasoningEffort: messageMetadata?.reasoningEffort ?? null,
              reasoningContent:
                (messageMetadata?.reasoningContent ??
                  currentReasoningContent) ||
                null,
              creditsUsed: messageMetadata?.creditsUsed ?? null,
            }

            const updatedUserMessage = resolvedTriggerMessage
              ? {
                  ...resolvedTriggerMessage,
                  chatMode:
                    messageMetadata?.chatMode ??
                    resolvedTriggerMessage.chatMode,
                  modelId:
                    messageMetadata?.modelId ?? resolvedTriggerMessage.modelId,
                  reasoningEffort:
                    messageMetadata?.reasoningEffort ??
                    resolvedTriggerMessage.reasoningEffort,
                }
              : null

            const newCurrentPath = updatedUserMessage
              ? [
                  ...resolvedMessagesToSend.slice(0, -1),
                  updatedUserMessage,
                  finalAssistantMessage,
                ]
              : [...resolvedMessagesToSend, finalAssistantMessage]

            // update both current message path and complete message history
            const { threads } = useChatStore.getState()
            const activeThread = threads.find((t) => t.id === threadId)
            const baseAllMessages = activeThread
              ? activeThread.allMessages.map((message) =>
                  updatedUserMessage && message.id === updatedUserMessage.id
                    ? updatedUserMessage
                    : message
                )
              : newCurrentPath

            const updatedAllMessages = baseAllMessages.some(
              (message) => message.id === finalAssistantMessage.id
            )
              ? baseAllMessages.map((message) =>
                  message.id === finalAssistantMessage.id
                    ? finalAssistantMessage
                    : message
                )
              : [...baseAllMessages, finalAssistantMessage]

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

          // network-level send failure (fetch itself rejected, e.g. offline
          // or DNS/connection error) — show the same localized error bubble
          // as the !response.ok path instead of failing silently; any parts
          // that already streamed before a mid-stream drop are kept.
          const assistantMessage: ExtendedThreadMessageLike = {
            id: assistantMessageId,
            role: 'assistant',
            content: [
              ...orderedContentParts,
              {
                type: 'text',
                text: `\n\n**${t('chat.response.errorLabel')}**: ${t('chat.response.networkError')}`,
              },
            ],
            createdAt: new Date(),
            parentId: triggerMessage?.id || null,
          }
          updateThreadMessages([...resolvedMessagesToSend, assistantMessage])
        }
      } finally {
        updateThreadRunning(false)
        abortControllerRef.current = null

        // refresh credits after chat completion
        if (chatbotId) {
          try {
            await loadCredits(chatbotId)
          } catch (error) {
            console.error('Failed to refresh credits after chat:', error)
          }
        }
      }
    },
    [
      selectedModel,
      selectedMode,
      selectedReasoningEffort,
      chatbotId,
      loadCredits,
      t,
    ]
  )

  return {
    generateChatResponse,
    abortControllerRef,
  }
}
