import {
  clearPendingDocumentPages,
  extractDocumentsForSending,
  extractLocalImageAttachments,
  getDocumentAttachmentKey,
  getEditedMessageSource,
  getImageAttachmentKey,
  setPendingDocumentPages,
} from '@/src/lib/attachments/attachmentState'
import {
  applyVisualReview,
  composeMessageText,
  type DocumentForSending,
  getDocumentBlocks,
  MAX_DOCUMENT_ATTACHMENTS,
} from '@/src/lib/attachments/documentText'
import { generateId } from '@/src/lib/utils/chatUtils'
import {
  type ExtendedThreadMessageLike,
  useChatStore,
} from '@/src/stores/chatStore'
import {
  MAX_IMAGE_ATTACHMENTS,
  useComposerStore,
} from '@/src/stores/composerStore'
import { useSettingsStore } from '@/src/stores/settingsStore'
import { type AppendMessage } from '@assistant-ui/react'
import { useTranslations } from 'next-intl'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { useCallback } from 'react'
import { truncateMessagesForReload } from '../components/message-parts-state'

const getTypedText = (message: AppendMessage): string =>
  message.content
    .map((part) => (part.type === 'text' ? part.text : ''))
    .join('')

/**
 * Hook for managing chat thread operations.
 *
 * Provides callbacks for:
 * - onNew: creating new messages and responses
 * - onEdit: editing existing messages and regenerating responses
 * - onReload: regenerating responses from a specific point
 * - onCancel: cancelling ongoing chat requests
 *
 * @param generateChatResponse - Function to generate AI responses
 * @param abortControllerRef - Ref to current abort controller for cancellation
 * @returns Object containing all thread management callbacks
 */
export function useThreadManagement(
  generateChatResponse: (
    messages: ExtendedThreadMessageLike[],
    threadId: string,
    options?: { allowRegeneration?: boolean }
  ) => Promise<void>,
  abortControllerRef: React.MutableRefObject<AbortController | null>,
  selectedModeOverride?: string
) {
  const t = useTranslations()
  const { chatbotId } = useParams<{ chatbotId: string }>()
  const router = useRouter()
  const searchParams = useSearchParams()
  const createThread = useChatStore((state) => state.createThread)
  const addMessage = useChatStore((state) => state.addMessage)
  const setIsRunning = useChatStore((state) => state.setIsRunning)
  const storedSelectedMode = useSettingsStore((state) => state.selectedMode)
  const selectedMode = selectedModeOverride ?? storedSelectedMode
  const selectedModel = useSettingsStore((state) => state.selectedModel)
  const selectedReasoningEffort = useSettingsStore(
    (state) => state.selectedReasoningEffort
  )
  const supportsImageAttachments = useSettingsStore(
    (state) =>
      state.modelOptions.find((model) => model.id === selectedModel)
        ?.supportsImageAttachments !== false
  )

  // Document text follows the typed question in a single text part, so it is
  // sent, stored and reloaded like typed text. A message with only files
  // gets a default question so the thread title and history stay readable.
  // Rendered PDF pages are held aside for the request of this message only.
  const buildContent = useCallback(
    (
      message: AppendMessage,
      messageId: string,
      documents: DocumentForSending[]
    ): ExtendedThreadMessageLike['content'] => {
      const { blocks, pageImages } = applyVisualReview(
        documents.slice(0, MAX_DOCUMENT_ATTACHMENTS),
        { supportsImages: supportsImageAttachments }
      )
      setPendingDocumentPages(messageId, pageImages)
      if (blocks.length === 0) return message.content
      const typedText = getTypedText(message).trim()
      return [
        {
          type: 'text',
          text: composeMessageText(
            typedText || t('chat.composer.documentDefaultQuestion'),
            blocks
          ),
        },
      ]
    },
    [supportsImageAttachments, t]
  )

  /**
   * Handles creation of new user messages and generates response
   *
   * @param message - user message that was sent
   */
  const onNew = useCallback(
    async (message: AppendMessage) => {
      const { activeThreadId: currentActiveThreadId } = useChatStore.getState()

      let threadId = currentActiveThreadId
      let shouldReplaceUrl = false

      // create new thread if none exists
      if (!threadId) {
        try {
          threadId = await createThread(chatbotId)
          shouldReplaceUrl = true
        } catch (error) {
          console.error('Failed to create thread', error)
          return
        }
        if (!threadId) {
          console.error('Failed to create thread')
          return
        }
      }

      const imageAttachments = extractLocalImageAttachments(
        message.attachments
      ).slice(0, MAX_IMAGE_ATTACHMENTS)

      // create user message with unique ID and metadata
      const userMessageId = generateId()
      const userMessage: ExtendedThreadMessageLike = {
        id: userMessageId,
        role: 'user',
        content: buildContent(
          message,
          userMessageId,
          extractDocumentsForSending(message.attachments)
        ),
        createdAt: new Date(),
        parentId: message.parentId || null,
        chatMode: selectedMode,
        modelId: selectedModel,
        reasoningEffort: selectedReasoningEffort,
        imageAttachments,
      }

      if (shouldReplaceUrl) {
        const qs = searchParams.toString()
        router.replace(`/${chatbotId}/threads/${threadId}${qs ? `?${qs}` : ''}`)
      }

      try {
        const addedThreadId = await addMessage(chatbotId, userMessage, threadId)
        if (!addedThreadId) {
          clearPendingDocumentPages(userMessageId)
          return
        }
      } catch (error) {
        console.error('Failed to add message', error)
        clearPendingDocumentPages(userMessageId)
        return
      }

      const currentMessages =
        useChatStore.getState().threads.find((t) => t.id === threadId)
          ?.messages || []

      // generate response based on current conversation
      await generateChatResponse(currentMessages, threadId)
    },
    [
      buildContent,
      createThread,
      addMessage,
      generateChatResponse,
      chatbotId,
      router,
      searchParams,
      selectedMode,
      selectedModel,
      selectedReasoningEffort,
    ]
  )

  /**
   * Handles editing of existing messages and regenerating responses.
   *
   * This creates a new conversation branch from the edit point.
   *
   * @param message - The edited message content
   */
  const onEdit = useCallback(
    async (message: AppendMessage) => {
      const { activeThreadId: threadId, threads } = useChatStore.getState()

      if (!threadId) {
        console.error('No active thread for edit')
        return
      }

      const activeThread = threads.find((t) => t.id === threadId)
      const parentId = message.parentId
      const sourceId =
        typeof message === 'object' &&
        message !== null &&
        'sourceId' in message &&
        typeof message.sourceId === 'string'
          ? message.sourceId
          : null
      const editedMessageId =
        typeof message === 'object' &&
        message !== null &&
        'id' in message &&
        typeof message.id === 'string'
          ? message.id
          : null
      const sourceMessageId = sourceId ?? editedMessageId

      // create edited message with new ID
      const editedMessageNewId = generateId()
      let editedMessage: ExtendedThreadMessageLike = {
        role: 'user',
        content: message.content,
        id: editedMessageNewId,
        createdAt: new Date(),
        parentId: parentId,
        chatMode: selectedMode,
        modelId: selectedModel,
        reasoningEffort: selectedReasoningEffort,
      }

      // build new conversation path up to the parent + edited message
      const parentIndex =
        parentId && activeThread
          ? activeThread.messages.findIndex((m) => m.id === parentId)
          : -1

      // carry over the attachments from the original message being edited
      const originalMessage = activeThread
        ? getEditedMessageSource({
            editedMessageId: sourceMessageId,
            messages: activeThread.messages,
          })
        : undefined
      const removedAttachmentKeysByMessageId =
        useComposerStore.getState().editRemovedAttachmentKeysByMessageId
      const removedAttachmentKeys = new Set(
        sourceMessageId
          ? (removedAttachmentKeysByMessageId[sourceMessageId] ?? [])
          : []
      )
      const keptAttachments =
        originalMessage?.imageAttachments &&
        originalMessage.imageAttachments.length > 0
          ? originalMessage.imageAttachments
              .filter(
                (attachment, index) =>
                  !removedAttachmentKeys.has(
                    getImageAttachmentKey(attachment, index)
                  )
              )
              .map((attachment) => ({ ...attachment }))
          : []

      const newImageAttachments = extractLocalImageAttachments(
        message.attachments
      )

      const mergedAttachments = [
        ...keptAttachments,
        ...newImageAttachments,
      ].slice(0, MAX_IMAGE_ATTACHMENTS)

      if (mergedAttachments.length > 0) {
        editedMessage.imageAttachments = mergedAttachments
      }

      const keptDocumentBlocks = originalMessage
        ? getDocumentBlocks(
            typeof originalMessage.content === 'string'
              ? originalMessage.content
              : originalMessage.content
                  .map((part) => (part.type === 'text' ? part.text : ''))
                  .join('')
          ).filter(
            (_block, index) =>
              !removedAttachmentKeys.has(getDocumentAttachmentKey(index))
          )
        : []
      // Kept documents have no page images any more, so applyVisualReview
      // marks their pages as not reviewed in the new message.
      editedMessage = {
        ...editedMessage,
        content: buildContent(message, editedMessageNewId, [
          ...keptDocumentBlocks.map((block) => ({ block, pageImages: [] })),
          ...extractDocumentsForSending(message.attachments),
        ]),
      }
      editedMessage.attachmentSourceMessageId =
        originalMessage?.attachmentSourceMessageId ??
        originalMessage?.id ??
        null

      if (sourceMessageId) {
        useComposerStore
          .getState()
          .clearEditRemovedAttachmentKeys(sourceMessageId)
      }

      const newCurrentPath =
        parentIndex >= 0 && activeThread
          ? [...activeThread.messages.slice(0, parentIndex + 1), editedMessage]
          : [editedMessage]

      // update complete message history
      const updatedAllMessages = activeThread
        ? [...activeThread.allMessages, editedMessage]
        : [editedMessage]

      // update thread state with both current path and full history
      useChatStore.setState((state) => ({
        threads: state.threads.map((thread) =>
          thread.id === threadId
            ? {
                ...thread,
                messages: newCurrentPath,
                allMessages: updatedAllMessages,
                updatedAt: new Date(),
              }
            : thread
        ),
      }))

      // generate new response from the edited conversation state
      await generateChatResponse(newCurrentPath, threadId)
    },
    [
      buildContent,
      generateChatResponse,
      selectedMode,
      selectedModel,
      selectedReasoningEffort,
    ]
  )

  /**
   * Handles regenerating responses from a specific message.
   *
   * @param parentId - ID of the message to reload from
   */
  const onReload = useCallback(
    async (parentId: string | null) => {
      const { activeThreadId: threadId, threads } = useChatStore.getState()

      if (!threadId) {
        console.error('No active thread for reload')
        return
      }

      const activeThread = threads.find((t) => t.id === threadId)
      if (!activeThread) {
        console.error('Active thread not found')
        return
      }

      const truncatedPath = truncateMessagesForReload(
        activeThread.messages,
        parentId
      )

      if (!truncatedPath) {
        console.error('Parent message not found for reload')
        return
      }

      // update thread with truncated message history
      useChatStore.setState((state) => ({
        threads: state.threads.map((thread) =>
          thread.id === threadId
            ? {
                ...thread,
                messages: truncatedPath,
                updatedAt: new Date(),
              }
            : thread
        ),
      }))

      // regenerate response from truncated state
      await generateChatResponse(truncatedPath, threadId, {
        allowRegeneration: true,
      })
    },
    [generateChatResponse]
  )

  /**
   * Cancels any ongoing chat request.
   *
   * Uses the AbortController to cancel the HTTP request
   */
  const onCancel = useCallback(async () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
    setIsRunning(false)
  }, [setIsRunning, abortControllerRef])

  return {
    onNew,
    onEdit,
    onReload,
    onCancel,
  }
}
