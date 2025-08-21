'use client'
import { ThreadMessageLike } from '@assistant-ui/react'
import { create } from 'zustand'

export interface Thread {
  id: string
  messages: ThreadMessageLike[]
  isRunning: boolean
  title?: string
  createdAt: Date
}

// API types
interface ApiThread {
  id: string
  title?: string
  created_at: string
  updated_at: string
  message_count?: number
}

interface ApiMessage {
  id: string
  thread_id: string
  role: string
  content: Array<{ type: string; text: string }>
  created_at: string
  updated_at: string
}

interface ChatState {
  threads: Thread[]
  activeThreadId: string | null
  isLoading: boolean

  // thread management
  createThread: () => Promise<string>
  loadThreads: () => Promise<void>
  switchToThread: (threadId: string) => Promise<void>
  deleteThread: (threadId: string) => Promise<void>
  updateThreadTitle: (threadId: string, title: string) => Promise<void>

  // active thread
  addMessage: (message: ThreadMessageLike) => Promise<string | null>
  setMessages: (messages: ThreadMessageLike[]) => void
  setIsRunning: (isRunning: boolean) => void
  updateMessage: (id: string, updates: Partial<ThreadMessageLike>) => void
  clearMessages: () => void
  setLoading: (loading: boolean) => void
}

const generateThreadId = () =>
  `thread-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

// API functions
const apiCall = async (url: string, options: RequestInit = {}) => {
  const response = await fetch(`/api${url}`, {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  })

  if (!response.ok) {
    const errorText = await response.text()
    console.error(
      `API call failed for ${url}: ${response.statusText} (${response.status}) - ${errorText}`
    )
    throw new Error(
      `API call failed for ${url}: ${response.statusText} (${response.status})`
    )
  }

  return await response.json()
}

const convertApiThreadToThread = (apiThread: ApiThread): Thread => ({
  id: apiThread.id,
  title: apiThread.title,
  messages: [],
  isRunning: false,
  createdAt: new Date(apiThread.created_at),
})

const convertApiMessageToMessage = (
  apiMessage: ApiMessage
): ThreadMessageLike => ({
  id: apiMessage.id,
  role: apiMessage.role as 'user' | 'assistant',
  content: apiMessage.content.map((item) => ({
    type: item.type as 'text',
    text: item.text,
  })),
  createdAt: new Date(apiMessage.created_at),
})

export const useChatStore = create<ChatState>((set, get) => {
  return {
    threads: [],
    activeThreadId: null,
    isLoading: false,

    createThread: async () => {
      try {
        set({ isLoading: true })
        const apiThread = await apiCall('/threads', {
          method: 'POST',
          body: JSON.stringify({ title: null }),
        })

        const newThread = convertApiThreadToThread(apiThread)

        set((state) => {
          return {
            threads: [...state.threads, newThread],
            activeThreadId: newThread.id,
            isLoading: false,
          }
        })

        return newThread.id
      } catch (error) {
        console.error('Failed to create thread:', error)
        set({ isLoading: false })
        // Fallback to local thread creation
        const threadId = generateThreadId()
        const newThread: Thread = {
          id: threadId,
          messages: [],
          isRunning: false,
          createdAt: new Date(),
        }

        set((state) => ({
          threads: [...state.threads, newThread],
          activeThreadId: threadId,
        }))

        return threadId
      }
    },

    loadThreads: async () => {
      try {
        set({ isLoading: true })
        const apiThreads: ApiThread[] = await apiCall('/threads')

        const threads = apiThreads.map(convertApiThreadToThread)

        set({
          threads,
          activeThreadId: null,
          isLoading: false,
        })
      } catch (error) {
        console.error('Failed to load threads:', error)
        set({ isLoading: false })
      }
    },

    switchToThread: async (threadId) => {
      try {
        set({ isLoading: true })

        const state = get()
        const existingThread = state.threads.find((t) => t.id === threadId)

        set({ activeThreadId: threadId })

        if (existingThread && existingThread.messages.length > 0) {
          set({ isLoading: false })
          return
        }

        // Load messages for the thread
        const apiMessages: ApiMessage[] = await apiCall(
          `/threads/${threadId}/messages`
        )
        const messages = apiMessages.map(convertApiMessageToMessage)

        set((state) => ({
          threads: state.threads.map((thread) =>
            thread.id === threadId ? { ...thread, messages } : thread
          ),
          isLoading: false,
        }))
      } catch (error) {
        console.error('Failed to switch to thread:', error)
        set({ isLoading: false })
      }
    },

    deleteThread: async (threadId) => {
      try {
        await apiCall(`/threads/${threadId}`, { method: 'DELETE' })

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
      }
    },

    updateThreadTitle: async (threadId, title) => {
      try {
        await apiCall(`/threads/${threadId}/title`, {
          method: 'PUT',
          body: JSON.stringify({ title }),
        })

        set((state) => ({
          threads: state.threads.map((thread) =>
            thread.id === threadId ? { ...thread, title } : thread
          ),
        }))
      } catch (error) {
        console.error('Failed to update thread title:', error)
      }
    },

    addMessage: async (message) => {
      const state = get()

      let currentThreadId = state.activeThreadId

      // check if active thread exists, else create one
      if (!currentThreadId) {
        currentThreadId = await get().createThread()
        if (!currentThreadId) {
          console.error('Failed to create thread for message')
          return null
        }
      }

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

      set((state) => ({
        threads: state.threads.map((thread) =>
          thread.id === currentThreadId
            ? { ...thread, messages: [...thread.messages, message] }
            : thread
        ),
      }))

      // use first user message as default title
      if (
        activeThread &&
        !activeThread.title &&
        message.role === 'user' &&
        activeThread.messages.length === 0
      ) {
        const content = Array.isArray(message.content)
          ? message.content.find(
              (c: { type: string; text?: string }) => c.type === 'text'
            )?.text
          : message.content

        if (content && typeof content === 'string') {
          const title =
            content.slice(0, 50) + (content.length > 50 ? '...' : '')

          // update title in store
          set((state) => ({
            threads: state.threads.map((thread) =>
              thread.id === currentThreadId ? { ...thread, title } : thread
            ),
          }))

          // update title in backend
          try {
            await apiCall(`/threads/${currentThreadId}/title`, {
              method: 'PUT',
              body: JSON.stringify({ title }),
            })
          } catch (error) {
            console.error('Failed to update thread title:', error)
          }
        }
      }

      return currentThreadId
    },

    setMessages: (messages) => {
      set((state) => ({
        threads: state.threads.map((thread) =>
          thread.id === state.activeThreadId ? { ...thread, messages } : thread
        ),
      }))
    },

    setIsRunning: (isRunning) => {
      set((state) => ({
        threads: state.threads.map((thread) =>
          thread.id === state.activeThreadId ? { ...thread, isRunning } : thread
        ),
      }))
    },

    updateMessage: (id, updates) => {
      set((state) => ({
        threads: state.threads.map((thread) =>
          thread.id === state.activeThreadId
            ? {
                ...thread,
                messages: thread.messages.map((m) =>
                  m.id === id ? { ...m, ...updates } : m
                ),
              }
            : thread
        ),
      }))
    },

    clearMessages: () => {
      set((state) => ({
        threads: state.threads.map((thread) =>
          thread.id === state.activeThreadId
            ? { ...thread, messages: [] }
            : thread
        ),
      }))
    },

    setLoading: (loading) => {
      set({ isLoading: loading })
    },
  }
})
