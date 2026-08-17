'use client'
import { ThreadMessageLike } from '@assistant-ui/react'
import type { ChatMessageRating } from '@klicker-uzh/prisma/client'
import { create } from 'zustand'
import {
  apiCall,
  convertApiMessageToMessage,
  convertApiThreadToThread,
  isApiError,
  type ApiHydratedImageAttachment,
  type ApiImageAttachment,
  type ApiMessage,
  type ApiThread,
} from '../lib/api/types'
import {
  extractThreadTitle,
  findBranchLeaf,
  findLeafMessages,
  getPathToLeaf,
} from '../lib/api/utils'
import {
  hasAllImageAttachmentsHydrated,
  mergeHydratedAttachments,
  sortAttachmentsByPosition,
} from '../lib/attachments/attachmentState'
import { type ReasoningEffort } from '../lib/config/reasoning'
import { createRatingRequestCoordinator } from './ratingRequestCoordinator'
import { useSettingsStore } from './settingsStore'

/**
 * Participant feedback on an assistant answer. Aliased from the Prisma enum
 * rather than re-typed so a new rating value cannot silently drift out of sync
 * here; `import type` is erased at build time, so no server code is pulled in.
 */
export type MessageRating = ChatMessageRating
const runRatingRequest = createRatingRequestCoordinator<MessageRating | null>()

/**
 * Extended thread message type that includes parentId for conversation branching
 */
export type ExtendedThreadMessageLike = ThreadMessageLike & {
  parentId?: string | null
  attachmentSourceMessageId?: string | null
  chatMode?: string | null
  modelId?: string | null
  reasoningEffort?: ReasoningEffort | null
  reasoningContent?: string | null
  creditsUsed?: number | null
  rating?: MessageRating | null
  imageAttachments?: {
    id?: string
    type: 'image'
    position?: number
    imageBase64?: string | null
    imagePreviewBase64?: string | null
    imageDescription?: string | null
    hasFullImage?: boolean
  }[]
}

export interface Thread {
  id: string
  messages: ExtendedThreadMessageLike[] // current conversation branch
  allMessages: ExtendedThreadMessageLike[] // all messages in the thread
  isRunning: boolean
  title?: string
  createdAt: Date
  updatedAt: Date
  lastChatMode?: string | null // mode of the thread's most recent message (D6)
}

interface ChatState {
  threads: Thread[]
  activeThreadId: string | null
  isLoading: boolean
  participationRequired: boolean
  participationMessage: string | null
  /**
   * KG workspace entry point: a 403 on the knowledge-graph read means the
   * guest/participant has no course participation. Delegates to the shared
   * participation notice (or clears it when the read succeeds again).
   */
  setParticipationRequired: (required: boolean, message?: string) => void
  /**
   * Set when `loadThreads` fails for a reason other than the 403
   * participation case (which `handleApiError` already surfaces via
   * `participationRequired`). Lets the thread list distinguish "no threads
   * yet" from "we don't actually know, the fetch failed" and offer a retry.
   */
  threadsLoadError: boolean

  // thread management actions
  createThread: (chatbotId: string) => Promise<string>
  loadThreads: (chatbotId: string) => Promise<void>
  switchToThread: (chatbotId: string, threadId: string) => Promise<boolean>
  /**
   * Resyncs the composer mode to a given thread's own `lastChatMode` (D6).
   * Extracted from `switchToThread` so callers that activate a thread without
   * going through `switchToThread` (e.g. a direct URL load that already has
   * the thread's messages cached) can still trigger the resync.
   */
  resyncModeFromThread: (threadId: string) => void
  deleteThread: (chatbotId: string, threadId: string) => Promise<boolean>
  updateThreadTitle: (
    chatbotId: string,
    threadId: string,
    title: string
  ) => Promise<void>

  // active thread message actions
  addMessage: (
    chatbotId: string,
    message: ExtendedThreadMessageLike,
    targetThreadId?: string
  ) => Promise<string | null>
  ensureFullImageAttachments: (
    chatbotId: string,
    threadId: string,
    messageId: string,
    sourceMessageId?: string
  ) => Promise<ExtendedThreadMessageLike | undefined>
  setMessages: (messages: ExtendedThreadMessageLike[]) => void
  rateMessage: (
    chatbotId: string,
    messageId: string,
    rating: MessageRating | null
  ) => Promise<void>
  setIsRunning: (isRunning: boolean) => void
  resetSession: () => void

  // tree navigation actions
  switchToBranch: (leafId: string) => void
}

/**
 * Chat Store Implementation
 *
 * This Zustand store manages the entire chat application state including:
 * - Multiple conversation threads
 * - Thread switching and management
 * - Message handling within threads
 * - Tree-like conversation branching
 * - API integration for persistence
 */
export const useChatStore = create<ChatState>((set, get) => {
  // The generic 403 body the API returns when a participant is not enrolled.
  // It is a server-side identifier, not display text — see below.
  const GENERIC_PARTICIPATION_ERROR =
    'No valid participation found for this chatbot'
  const attachmentHydrationRequests = new Map<
    string,
    Promise<ExtendedThreadMessageLike | undefined>
  >()
  const markParticipationRequired = (message?: string) => {
    set({
      participationRequired: true,
      // null means "the server gave no specific reason", which lets the notice
      // render the localized `chat.assistant.participationRequiredDefaultMessage`
      // instead of an English string the store cannot translate.
      participationMessage: message?.trim() ? message : null,
    })
  }

  const setParticipationRequired = (required: boolean, message?: string) => {
    if (required) {
      markParticipationRequired(message)
      return
    }

    clearParticipationNotice()
  }

  const clearParticipationNotice = () => {
    set({ participationRequired: false, participationMessage: null })
  }

  const mergeMessageAttachments = (
    message: ExtendedThreadMessageLike,
    hydratedAttachments: ApiHydratedImageAttachment[]
  ): ExtendedThreadMessageLike => {
    const allAttachments = message.imageAttachments ?? []
    const persistedAttachments = sortAttachmentsByPosition(
      allAttachments.filter(
        (attachment): attachment is ApiImageAttachment =>
          typeof attachment.id === 'string' &&
          typeof attachment.position === 'number'
      )
    )
    const localOnlyAttachments = allAttachments.filter(
      (attachment) =>
        typeof attachment.id !== 'string' ||
        typeof attachment.position !== 'number'
    )

    if (persistedAttachments.length === 0) {
      return message
    }

    return {
      ...message,
      imageAttachments: [
        ...mergeHydratedAttachments(persistedAttachments, hydratedAttachments),
        ...localOnlyAttachments,
      ],
    }
  }

  const updateMessageInCollection = (
    messages: ExtendedThreadMessageLike[],
    messageId: string,
    hydratedAttachments: ApiHydratedImageAttachment[]
  ): ExtendedThreadMessageLike[] =>
    messages.map((message) =>
      message.id === messageId
        ? mergeMessageAttachments(message, hydratedAttachments)
        : message
    )

  const updateMessageIdsInCollection = (
    messages: ExtendedThreadMessageLike[],
    messageIds: string[],
    hydratedAttachments: ApiHydratedImageAttachment[]
  ): ExtendedThreadMessageLike[] => {
    const targetIds = new Set(messageIds)

    return messages.map((message) =>
      typeof message.id === 'string' && targetIds.has(message.id)
        ? mergeMessageAttachments(message, hydratedAttachments)
        : message
    )
  }

  // Monotonic id for loadThreads invocations; see the guard in loadThreads.
  let loadThreadsGeneration = 0

  /**
   * Handles the participation/403 case shared by thread actions. Returns
   * true when the error was a participation error (already surfaced via
   * `participationRequired`), so callers can decide whether a generic
   * error state is still needed.
   */
  const handleApiError = (error: unknown): boolean => {
    if (isApiError(error) && error.status === 403) {
      const apiMessage =
        typeof error.body === 'object' &&
        error.body !== null &&
        'error' in error.body &&
        typeof (error.body as { error?: unknown }).error === 'string'
          ? ((error.body as { error?: string }).error ?? undefined)
          : undefined

      // The generic enrolment error is dropped rather than shown: it is
      // untranslated English aimed at API consumers, and dropping it hands the
      // notice back to the localized default.
      markParticipationRequired(
        apiMessage === GENERIC_PARTICIPATION_ERROR ? undefined : apiMessage
      )
      return true
    }
    return false
  }

  return {
    threads: [],
    activeThreadId: null,
    isLoading: false,
    participationRequired: false,
    participationMessage: null,
    setParticipationRequired,
    threadsLoadError: false,

    /**
     * Creates a new conversation thread
     * Attempts to create the thread on the server, falls back to local creation if it fails
     *
     * @param chatbotId - The ID of the chatbot to create the thread for
     * @returns Promise<string> The ID of the created thread
     */
    createThread: async (chatbotId: string) => {
      try {
        set({ isLoading: true })
        const apiThread = await apiCall<ApiThread>(
          `/chatbots/${chatbotId}/threads`,
          {
            method: 'POST',
            body: JSON.stringify({ title: null }),
          }
        )

        const newThread = convertApiThreadToThread(apiThread)

        set((state) => {
          return {
            threads: [newThread, ...state.threads],
            activeThreadId: newThread.id,
            isLoading: false,
          }
        })

        clearParticipationNotice()

        return newThread.id
      } catch (error) {
        console.error('Failed to create thread:', error)
        handleApiError(error)
        set({ isLoading: false })
        throw error
      }
    },

    /**
     * Loads all conversation threads from the server
     * Fetches thread metadata (without messages) for sidebar display
     */
    loadThreads: async (chatbotId: string) => {
      // Overlapping calls (fast chatbot switches, retry during a slow load)
      // resolve in arbitrary order; only the latest invocation may write the
      // result, otherwise a stale failure can overwrite a newer success (or
      // vice versa) and leave `threadsLoadError`/`threads` wrong.
      const generation = ++loadThreadsGeneration
      try {
        set({ isLoading: true, threadsLoadError: false })
        const apiThreads: ApiThread[] = await apiCall<ApiThread[]>(
          `/chatbots/${chatbotId}/threads`
        )
        if (generation !== loadThreadsGeneration) return

        const freshThreads = apiThreads.map(convertApiThreadToThread)

        set((state) => {
          // Preserve cached messages for threads that already exist
          const existingMap = new Map(state.threads.map((t) => [t.id, t]))
          const merged = freshThreads.map((fresh) => {
            const existing = existingMap.get(fresh.id)
            if (
              existing &&
              (existing.allMessages.length > 0 || existing.messages.length > 0)
            ) {
              return {
                ...fresh,
                messages: existing.messages,
                allMessages: existing.allMessages,
                isRunning: existing.isRunning,
              }
            }
            return fresh
          })

          // Keep activeThreadId if the thread still exists in the new list
          const activeStillExists =
            state.activeThreadId != null &&
            merged.some((t) => t.id === state.activeThreadId)

          return {
            threads: merged,
            activeThreadId: activeStillExists ? state.activeThreadId : null,
            isLoading: false,
            participationRequired: false,
            participationMessage: null,
            threadsLoadError: false,
          }
        })
      } catch (error) {
        console.error('Failed to load threads:', error)
        if (generation !== loadThreadsGeneration) return
        // The 403/participation case is already surfaced via
        // `participationRequired`; only flag the generic error state for
        // failures that leave the student without any explanation.
        const isParticipationError = handleApiError(error)
        set({ isLoading: false, threadsLoadError: !isParticipationError })
      }
    },

    /**
     * D6: resyncs the composer mode to the mode a thread was last used in,
     * but only when that mode is offered by this chatbot and actually
     * differs from the currently selected one.
     *
     * Extracted from `switchToThread` (D6) so a thread activation that
     * bypasses `switchToThread` — e.g. the RuntimeProvider URL-sync effect's
     * early-return when the persisted `activeThreadId` already matches the
     * URL and the thread's messages are already cached — still resyncs the
     * mode instead of leaving whatever mode was previously selected.
     *
     * @param threadId - The thread whose `lastChatMode` should be applied
     */
    resyncModeFromThread: (threadId: string) => {
      const existingThread = get().threads.find((t) => t.id === threadId)
      const lastMode = existingThread?.lastChatMode
      if (!lastMode) return

      const { modeOptions, selectedMode, setSelectedMode } =
        useSettingsStore.getState()
      // `in` (not truthiness): a mode may have an empty description string.
      // An empty `modeOptions` means the chatbot's modes have simply not
      // arrived yet — on a hard refresh into a thread URL, `loadThreads`
      // and `loadModeOptions` race and the former often wins, which used to
      // make this resync silently no-op for the rest of the page load.
      // Trusting the thread's own mode in that window is safe because
      // `loadModeOptions` re-validates `selectedMode` against the resolved
      // options and falls back to the first one if it does not exist.
      const optionsLoaded = Object.keys(modeOptions).length > 0
      if (
        (!optionsLoaded || lastMode in modeOptions) &&
        lastMode !== selectedMode
      ) {
        setSelectedMode(lastMode)
      }
    },

    /**
     * Switches to a different conversation thread
     * Loads all messages for the thread if not already loaded
     * Automatically sets the current conversation path to the most recent branch
     *
     * @param threadId - The ID of the thread to switch to
     */
    switchToThread: async (chatbotId: string, threadId: string) => {
      const previousActiveThreadId = get().activeThreadId
      try {
        set({ isLoading: true })

        const state = get()
        const existingThread = state.threads.find((t) => t.id === threadId)

        set({ activeThreadId: threadId })

        // D6: resync the composer mode to the mode the thread was last used in.
        get().resyncModeFromThread(threadId)

        if (existingThread && existingThread.allMessages.length > 0) {
          set({ isLoading: false })
          return true
        }

        // Load all messages for the thread from the server
        const apiMessages: ApiMessage[] = await apiCall<ApiMessage[]>(
          `/chatbots/${chatbotId}/threads/${threadId}/messages`
        )
        const allMessages = apiMessages.map(convertApiMessageToMessage)

        if (allMessages.length === 0) {
          set((state) => ({
            threads: state.threads.map((thread) =>
              thread.id === threadId
                ? {
                    ...thread,
                    allMessages: [],
                    messages: [],
                  }
                : thread
            ),
            isLoading: false,
          }))
          return true
        }

        // find most recent leaf message to set as current conversation branch
        const leafMessages = findLeafMessages(allMessages)
        const latestLeaf = leafMessages.reduce(
          (latest, current) =>
            new Date(current.createdAt || 0) > new Date(latest.createdAt || 0)
              ? current
              : latest,
          leafMessages[0]
        )

        // get the path from root to  latest leaf
        const currentPath = latestLeaf?.id
          ? getPathToLeaf(allMessages, latestLeaf.id)
          : allMessages

        set((state) => ({
          threads: state.threads.map((thread) =>
            thread.id === threadId
              ? {
                  ...thread,
                  allMessages,
                  messages: currentPath,
                }
              : thread
          ),
          isLoading: false,
        }))
        return true
      } catch (error) {
        console.error('Failed to switch to thread:', error)
        handleApiError(error)
        set({ activeThreadId: previousActiveThreadId, isLoading: false })
        return false
      }
    },

    /**
     * Deletes a conversation thread and all its messages
     *
     * @param threadId - The ID of the thread to delete
     */
    deleteThread: async (chatbotId: string, threadId: string) => {
      try {
        await apiCall<void>(`/chatbots/${chatbotId}/threads/${threadId}`, {
          method: 'DELETE',
        })

        set((state) => {
          const filteredThreads = state.threads.filter((t) => t.id !== threadId)
          const newActiveThreadId =
            state.activeThreadId === threadId
              ? (filteredThreads[0]?.id ?? null)
              : state.activeThreadId

          return {
            threads: filteredThreads,
            activeThreadId: newActiveThreadId,
          }
        })
        return true
      } catch (error) {
        console.error('Failed to delete thread:', error)
        handleApiError(error)
        return false
      }
    },

    /**
     * Updates title of a conversation thread
     *
     * @param threadId - The ID of the thread to update
     * @param title - The new title for the thread
     */
    updateThreadTitle: async (
      chatbotId: string,
      threadId: string,
      title: string
    ) => {
      try {
        await apiCall<void>(
          `/chatbots/${chatbotId}/threads/${threadId}/title`,
          {
            method: 'PUT',
            body: JSON.stringify({ title }),
          }
        )

        set((state) => ({
          threads: state.threads.map((thread) =>
            thread.id === threadId ? { ...thread, title } : thread
          ),
        }))
      } catch (error) {
        console.error('Failed to update thread title:', error)
        handleApiError(error)
      }
    },

    /**
     * Adds new message to active conversation thread
     * Creates new thread if none is active
     * Automatically generates a title from the first user message
     *
     * @param chatbotId - The chatbot ID for thread operations
     * @param message - The message to add to the conversation
     * @returns Promise<string | null> The ID of the thread the message was added to
     */
    addMessage: async (chatbotId: string, message, targetThreadId?: string) => {
      const state = get()

      let currentThreadId = targetThreadId ?? state.activeThreadId

      // create a new thread if none is active
      if (!currentThreadId) {
        currentThreadId = await get().createThread(chatbotId)
        if (!currentThreadId) {
          console.error('Failed to create thread for message')
          return null
        }
      }

      // verify active thread exists in our state
      const updatedState = get()
      const activeThread = updatedState.threads.find(
        (t) => t.id === currentThreadId
      )
      if (!activeThread) {
        console.error('Active thread not found in threads array', {
          currentThreadId,
          availableThreads: updatedState.threads.map((t) => t.id),
        })
        return null
      }

      // add message to both current path and all messages
      set((state) => ({
        threads: state.threads.map((thread) =>
          thread.id === currentThreadId
            ? {
                ...thread,
                messages: [...thread.messages, message],
                allMessages: [...thread.allMessages, message],
                updatedAt: new Date(),
                // Keep the thread's mode in sync with the message just sent so
                // the sidebar icon and the switch-back resync (D6) stay correct
                // within the session, before the next full loadThreads().
                lastChatMode: message.chatMode ?? thread.lastChatMode,
              }
            : thread
        ),
      }))

      // auto-generate thread title from first user message
      if (
        activeThread &&
        !activeThread.title &&
        message.role === 'user' &&
        activeThread.messages.length === 0
      ) {
        const title = extractThreadTitle(message)

        if (title) {
          set((state) => ({
            threads: state.threads.map((thread) =>
              thread.id === currentThreadId ? { ...thread, title } : thread
            ),
          }))

          try {
            await apiCall<void>(
              `/chatbots/${chatbotId}/threads/${currentThreadId}/title`,
              {
                method: 'PUT',
                body: JSON.stringify({ title }),
              }
            )
          } catch (error) {
            console.error('Failed to update thread title:', error)
            handleApiError(error)
          }
        }
      }

      return currentThreadId
    },

    ensureFullImageAttachments: async (
      chatbotId,
      threadId,
      messageId,
      sourceMessageId
    ) => {
      const state = get()
      const thread = state.threads.find(
        (candidate) => candidate.id === threadId
      )
      const fetchMessageId = sourceMessageId ?? messageId

      if (!thread) {
        return undefined
      }

      const cachedMessage = thread.allMessages.find(
        (message) => message.id === messageId
      )
      const activePathMessage = thread.messages.find(
        (message) => message.id === messageId
      )
      const sourceCachedMessage = thread.allMessages.find(
        (message) => message.id === fetchMessageId
      )
      const sourceActivePathMessage = thread.messages.find(
        (message) => message.id === fetchMessageId
      )

      const cachedIsHydrated = hasAllImageAttachmentsHydrated(
        cachedMessage?.imageAttachments
      )
      const activeIsHydrated = hasAllImageAttachmentsHydrated(
        activePathMessage?.imageAttachments
      )
      const sourceCachedIsHydrated = hasAllImageAttachmentsHydrated(
        sourceCachedMessage?.imageAttachments
      )
      const sourceActiveIsHydrated = hasAllImageAttachmentsHydrated(
        sourceActivePathMessage?.imageAttachments
      )

      const attachmentTargetIds =
        fetchMessageId === messageId ? [messageId] : [messageId, fetchMessageId]

      if (cachedIsHydrated && cachedMessage) {
        if (activePathMessage && !activeIsHydrated) {
          const hydratedAttachments =
            (cachedMessage.imageAttachments as ApiHydratedImageAttachment[]) ??
            []

          set((currentState) => ({
            threads: currentState.threads.map((candidate) =>
              candidate.id === threadId
                ? {
                    ...candidate,
                    messages: updateMessageInCollection(
                      candidate.messages,
                      messageId,
                      hydratedAttachments
                    ),
                  }
                : candidate
            ),
          }))

          return mergeMessageAttachments(activePathMessage, hydratedAttachments)
        }

        return cachedMessage
      }

      if (
        sourceCachedIsHydrated &&
        sourceCachedMessage?.imageAttachments?.length
      ) {
        const hydratedAttachments =
          (sourceCachedMessage.imageAttachments as ApiHydratedImageAttachment[]) ??
          []

        set((currentState) => ({
          threads: currentState.threads.map((candidate) =>
            candidate.id === threadId
              ? {
                  ...candidate,
                  allMessages: updateMessageIdsInCollection(
                    candidate.allMessages,
                    attachmentTargetIds,
                    hydratedAttachments
                  ),
                  messages: updateMessageIdsInCollection(
                    candidate.messages,
                    attachmentTargetIds,
                    hydratedAttachments
                  ),
                }
              : candidate
          ),
        }))

        return (
          mergeMessageAttachments(
            activePathMessage ?? cachedMessage ?? sourceCachedMessage,
            hydratedAttachments
          ) ?? sourceCachedMessage
        )
      }

      if (activeIsHydrated && activePathMessage) {
        const hydratedAttachments =
          (activePathMessage.imageAttachments as ApiHydratedImageAttachment[]) ??
          []

        set((currentState) => ({
          threads: currentState.threads.map((candidate) =>
            candidate.id === threadId
              ? {
                  ...candidate,
                  allMessages: updateMessageInCollection(
                    candidate.allMessages,
                    messageId,
                    hydratedAttachments
                  ),
                }
              : candidate
          ),
        }))

        return activePathMessage
      }

      if (
        sourceActiveIsHydrated &&
        sourceActivePathMessage?.imageAttachments?.length
      ) {
        const hydratedAttachments =
          (sourceActivePathMessage.imageAttachments as ApiHydratedImageAttachment[]) ??
          []

        set((currentState) => ({
          threads: currentState.threads.map((candidate) =>
            candidate.id === threadId
              ? {
                  ...candidate,
                  allMessages: updateMessageIdsInCollection(
                    candidate.allMessages,
                    attachmentTargetIds,
                    hydratedAttachments
                  ),
                  messages: updateMessageIdsInCollection(
                    candidate.messages,
                    attachmentTargetIds,
                    hydratedAttachments
                  ),
                }
              : candidate
          ),
        }))

        return mergeMessageAttachments(
          activePathMessage ?? cachedMessage ?? sourceActivePathMessage,
          hydratedAttachments
        )
      }

      if (
        !cachedMessage?.imageAttachments?.length &&
        !activePathMessage?.imageAttachments?.length &&
        !sourceCachedMessage?.imageAttachments?.length &&
        !sourceActivePathMessage?.imageAttachments?.length
      ) {
        return cachedMessage ?? activePathMessage
      }

      const hydrationRequestKey = `${chatbotId}:${threadId}:${messageId}:${fetchMessageId}`
      const inFlightRequest =
        attachmentHydrationRequests.get(hydrationRequestKey)

      if (inFlightRequest) {
        return inFlightRequest
      }

      const hydrationRequest = (async () => {
        try {
          const hydratedAttachments = await apiCall<
            ApiHydratedImageAttachment[]
          >(
            `/chatbots/${chatbotId}/threads/${threadId}/messages/${fetchMessageId}/attachments`
          )

          set((currentState) => ({
            threads: currentState.threads.map((candidate) =>
              candidate.id === threadId
                ? {
                    ...candidate,
                    allMessages: updateMessageIdsInCollection(
                      candidate.allMessages,
                      attachmentTargetIds,
                      hydratedAttachments
                    ),
                    messages: updateMessageIdsInCollection(
                      candidate.messages,
                      attachmentTargetIds,
                      hydratedAttachments
                    ),
                  }
                : candidate
            ),
          }))

          const updatedThread = get().threads.find(
            (candidate) => candidate.id === threadId
          )

          return (
            updatedThread?.messages.find(
              (message) => message.id === messageId
            ) ??
            updatedThread?.allMessages.find(
              (message) => message.id === messageId
            )
          )
        } catch (error) {
          console.error('Failed to hydrate message attachments:', error)
          handleApiError(error)
          return cachedMessage ?? activePathMessage
        } finally {
          attachmentHydrationRequests.delete(hydrationRequestKey)
        }
      })()

      attachmentHydrationRequests.set(hydrationRequestKey, hydrationRequest)

      return hydrationRequest
    },

    /**
     * Sets current conversation messages
     * Used when switching between different conversation branches
     *
     * @param messages - The messages to set as the current conversation branch
     */
    setMessages: (messages) => {
      set((state) => ({
        threads: state.threads.map((thread) =>
          thread.id === state.activeThreadId ? { ...thread, messages } : thread
        ),
      }))
    },

    /**
     * Records the participant's thumbs up/down on an assistant message.
     *
     * Applied optimistically and rolled back on failure: the vote is a
     * throwaway gesture, so waiting on a round-trip costs more than the rare
     * revert. Passing null clears an existing vote.
     */
    rateMessage: async (chatbotId, messageId, rating) => {
      const threadId = get().activeThreadId
      if (!threadId) return
      const requestKey = `${threadId}:${messageId}`

      const applyRating = (next: MessageRating | null) => {
        const setRating = (messages: ExtendedThreadMessageLike[]) =>
          messages.map((message) =>
            message.id === messageId ? { ...message, rating: next } : message
          )

        set((state) => ({
          threads: state.threads.map((thread) =>
            thread.id !== threadId
              ? thread
              : {
                  ...thread,
                  messages: setRating(thread.messages),
                  allMessages: setRating(thread.allMessages),
                }
          ),
        }))
      }

      const readRating = () =>
        get()
          .threads.find((thread) => thread.id === threadId)
          ?.messages.find((message) => message.id === messageId)?.rating ?? null

      await runRatingRequest({
        key: requestKey,
        rating,
        readRating,
        applyRating,
        send: () =>
          apiCall(
            `/chatbots/${chatbotId}/threads/${threadId}/messages/${messageId}/feedback`,
            { method: 'POST', body: JSON.stringify({ rating }) }
          ).then(() => undefined),
        onError: (error) =>
          console.error('Failed to save message feedback:', error),
      })
    },

    /**
     * Updates the running state of active thread
     * Used to show/hide loading indicators during AI response generation
     *
     * @param isRunning - Whether the thread is currently processing a response
     */
    setIsRunning: (isRunning) => {
      set((state) => ({
        threads: state.threads.map((thread) =>
          thread.id === state.activeThreadId ? { ...thread, isRunning } : thread
        ),
      }))
    },

    /**
     * Clears local chat session state.
     * Used by embedded mode to avoid preloading existing chat history in UI.
     */
    resetSession: () => {
      set({
        threads: [],
        activeThreadId: null,
        isLoading: false,
      })
    },

    /**
     * Switches current conversation view to a different branch
     * Finds the actual leaf of the selected branch and reconstructs the conversation path
     *
     * @param leafId - The ID of a message in the desired branch
     */
    switchToBranch: (leafId) => {
      const state = get()
      const activeThread = state.threads.find(
        (t) => t.id === state.activeThreadId
      )
      if (!activeThread) return

      const allMessages = activeThread.allMessages

      const actualLeaf = findBranchLeaf(allMessages, leafId)
      const targetLeafId = actualLeaf?.id || leafId

      // Reconstruct conversation path to this leaf
      const pathMessages = getPathToLeaf(allMessages, targetLeafId)

      // update the current conversation branch
      set((state) => ({
        threads: state.threads.map((thread) =>
          thread.id === state.activeThreadId
            ? {
                ...thread,
                messages: pathMessages,
              }
            : thread
        ),
      }))
    },
  }
})
