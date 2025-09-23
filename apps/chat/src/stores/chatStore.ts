'use client'
import { ThreadMessageLike } from '@assistant-ui/react'
import { create } from 'zustand'
import {
  apiCall,
  convertApiMessageToMessage,
  convertApiThreadToThread,
  isApiError,
  type ApiMessage,
  type ApiThread,
} from '../lib/api/types'
import {
  extractThreadTitle,
  findBranchLeaf,
  findLeafMessages,
  getBranches,
  getPathToLeaf,
} from '../lib/api/utils'

/**
 * Extended thread message type that includes parentId for conversation branching
 */
export type ExtendedThreadMessageLike = ThreadMessageLike & {
  parentId?: string | null
}

export interface Thread {
  id: string
  messages: ExtendedThreadMessageLike[] // current conversation branch
  allMessages: ExtendedThreadMessageLike[] // all messages in the thread
  isRunning: boolean
  title?: string
  createdAt: Date
}

interface ChatState {
  threads: Thread[]
  activeThreadId: string | null
  isLoading: boolean
  participationRequired: boolean
  participationMessage: string | null

  // thread management actions
  createThread: (chatbotId: string) => Promise<string>
  loadThreads: (chatbotId: string) => Promise<void>
  switchToThread: (chatbotId: string, threadId: string) => Promise<void>
  deleteThread: (chatbotId: string, threadId: string) => Promise<void>
  updateThreadTitle: (
    chatbotId: string,
    threadId: string,
    title: string
  ) => Promise<void>

  // active thread message actions
  addMessage: (
    chatbotId: string,
    message: ExtendedThreadMessageLike
  ) => Promise<string | null>
  setMessages: (messages: ExtendedThreadMessageLike[]) => void
  setIsRunning: (isRunning: boolean) => void

  // tree navigation actions
  switchToBranch: (leafId: string) => void
  getMessageBranches: (messageId: string) => ExtendedThreadMessageLike[]
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
  const DEFAULT_PARTICIPATION_MESSAGE =
    'You need to join the corresponding KlickerUZH course before you can use this chatbot. Please enrol in the course or contact your instructor for access.'

  const markParticipationRequired = (message?: string) => {
    set({
      participationRequired: true,
      participationMessage: message?.trim()
        ? message
        : DEFAULT_PARTICIPATION_MESSAGE,
    })
  }

  const clearParticipationNotice = () => {
    set({ participationRequired: false, participationMessage: null })
  }

  const handleApiError = (error: unknown) => {
    if (isApiError(error) && error.status === 403) {
      const apiMessage =
        typeof error.body === 'object' &&
        error.body !== null &&
        'error' in error.body &&
        typeof (error.body as { error?: unknown }).error === 'string'
          ? ((error.body as { error?: string }).error ?? undefined)
          : undefined

      const friendlyMessage =
        apiMessage === 'No valid participation found for this chatbot'
          ? DEFAULT_PARTICIPATION_MESSAGE
          : apiMessage

      markParticipationRequired(friendlyMessage)
    }
  }

  return {
    threads: [],
    activeThreadId: null,
    isLoading: false,
    participationRequired: false,
    participationMessage: null,

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
            threads: [...state.threads, newThread],
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
      try {
        set({ isLoading: true })
        const apiThreads: ApiThread[] = await apiCall<ApiThread[]>(
          `/chatbots/${chatbotId}/threads`
        )

        const threads = apiThreads.map(convertApiThreadToThread)

        set({
          threads,
          activeThreadId: null,
          isLoading: false,
          participationRequired: false,
          participationMessage: null,
        })
      } catch (error) {
        console.error('Failed to load threads:', error)
        handleApiError(error)
        set({ isLoading: false })
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
      try {
        set({ isLoading: true })

        const state = get()
        const existingThread = state.threads.find((t) => t.id === threadId)

        set({ activeThreadId: threadId })

        if (existingThread && existingThread.allMessages.length > 0) {
          set({ isLoading: false })
          return
        }

        // Load all messages for the thread from the server
        const apiMessages: ApiMessage[] = await apiCall<ApiMessage[]>(
          `/chatbots/${chatbotId}/threads/${threadId}/messages`
        )
        const allMessages = apiMessages.map(convertApiMessageToMessage)

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
      } catch (error) {
        console.error('Failed to switch to thread:', error)
        handleApiError(error)
        set({ isLoading: false })
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
              ? filteredThreads.length > 0
                ? filteredThreads[0].id
                : null
              : state.activeThreadId

          return {
            threads: filteredThreads,
            activeThreadId: newActiveThreadId,
          }
        })
      } catch (error) {
        console.error('Failed to delete thread:', error)
        handleApiError(error)
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
    addMessage: async (chatbotId: string, message) => {
      const state = get()

      let currentThreadId = state.activeThreadId

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

    /**
     * Gets all alternative responses (branches) for a specific message
     * Used to show users different response options at any point in the conversation
     *
     * @param messageId - The ID of the message to find alternatives for
     * @returns Array of alternative messages (including the original)
     */
    getMessageBranches: (messageId) => {
      const state = get()
      const activeThread = state.threads.find(
        (t) => t.id === state.activeThreadId
      )

      if (!activeThread) return []

      return getBranches(activeThread.allMessages, messageId)
    },
  }
})
