'use client'
import { ThreadMessageLike } from '@assistant-ui/react'
import { create } from 'zustand'

// extended type to include parentId for conversation branching
export type ExtendedThreadMessageLike = ThreadMessageLike & {
  parentId?: string | null
}

export interface Thread {
  id: string
  messages: ExtendedThreadMessageLike[] // current branch
  allMessages: ExtendedThreadMessageLike[] // all messages in the thread
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
  parent_id?: string | null
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
  addMessage: (message: ExtendedThreadMessageLike) => Promise<string | null>
  setMessages: (messages: ExtendedThreadMessageLike[]) => void
  setIsRunning: (isRunning: boolean) => void
  updateMessage: (
    id: string,
    updates: Partial<ExtendedThreadMessageLike>
  ) => void
  clearMessages: () => void
  setLoading: (loading: boolean) => void

  // tree navigation
  switchToBranch: (leafId: string) => void
  getMessageBranches: (messageId: string) => ExtendedThreadMessageLike[]
}

const generateThreadId = () =>
  `thread-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

// tree traversal helpers
const getPathToLeaf = (
  messages: ExtendedThreadMessageLike[],
  leafId: string
): ExtendedThreadMessageLike[] => {
  const messageMap = new Map(messages.map((m) => [m.id, m]))
  const path: ExtendedThreadMessageLike[] = []

  let current = messageMap.get(leafId)

  // build path from leaf to root
  while (current) {
    path.unshift(current)

    if (current.parentId) {
      const parent = messageMap.get(current.parentId)
      current = parent
    } else {
      current = undefined
    }
  }

  return path
}

const getBranches = (
  messages: ExtendedThreadMessageLike[],
  messageId: string
): ExtendedThreadMessageLike[] => {
  const message = messages.find((m) => m.id === messageId)
  if (!message) {
    return []
  }

  // find all siblings of the given message
  const siblings = messages.filter(
    (m) =>
      m.parentId === message.parentId &&
      m.role === message.role &&
      m.id !== message.id
  )

  // return all messages (current + siblings) sorted by creation time
  const allMessages = [message, ...siblings].sort(
    (a, b) =>
      new Date(a.createdAt || 0).getTime() -
      new Date(b.createdAt || 0).getTime()
  )

  return allMessages
}

const findLeafMessages = (
  messages: ExtendedThreadMessageLike[]
): ExtendedThreadMessageLike[] => {
  const parentIds = new Set<string>()
  messages.forEach((m) => {
    if (m.parentId) parentIds.add(m.parentId)
  })

  // get all messages that are not parents
  return messages.filter(
    (m) => typeof m.id === 'string' && !parentIds.has(m.id)
  )
}

const findBranchLeaf = (
  messages: ExtendedThreadMessageLike[],
  startMessageId: string
): ExtendedThreadMessageLike | null => {
  const messageMap = new Map(messages.map((m) => [m.id, m]))
  let current = messageMap.get(startMessageId)

  if (!current) return null

  // parentId -> children[] map
  const childrenMap: Map<string, ExtendedThreadMessageLike[]> = new Map()
  for (const m of messages) {
    if (m.parentId) {
      const arr = childrenMap.get(m.parentId) || []
      arr.push(m)
      childrenMap.set(m.parentId, arr)
    }
  }

  // traverse down using the childrenMap
  while (current) {
    const id = typeof current.id === 'string' ? current.id : undefined
    const children: ExtendedThreadMessageLike[] = id
      ? childrenMap.get(id) || []
      : []
    if (children.length === 0) return current
    if (children.length === 1) {
      current = children[0]
      continue
    }

    // pick most recent child
    let latest = children[0]
    for (let i = 1; i < children.length; i++) {
      const c = children[i]
      if (new Date(c.createdAt || 0) > new Date(latest.createdAt || 0)) {
        latest = c
      }
    }
    current = latest
  }

  return null
}

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
  allMessages: [],
  isRunning: false,
  createdAt: new Date(apiThread.created_at),
})

const convertApiMessageToMessage = (
  apiMessage: ApiMessage
): ExtendedThreadMessageLike => ({
  id: apiMessage.id,
  role: apiMessage.role as 'user' | 'assistant',
  content: apiMessage.content.map((item) => ({
    type: item.type as 'text',
    text: item.text,
  })),
  createdAt: new Date(apiMessage.created_at),
  parentId: apiMessage.parent_id || undefined,
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
          allMessages: [],
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

        if (existingThread && existingThread.allMessages.length > 0) {
          set({ isLoading: false })
          return
        }

        // Load ALL messages for the thread
        const apiMessages: ApiMessage[] = await apiCall(
          `/threads/${threadId}/messages`
        )
        const allMessages = apiMessages.map(convertApiMessageToMessage)

        // find latest leaf message to set as current path
        const leafMessages = findLeafMessages(allMessages)
        const latestLeaf = leafMessages.reduce(
          (latest, current) =>
            new Date(current.createdAt || 0) > new Date(latest.createdAt || 0)
              ? current
              : latest,
          leafMessages[0]
        )

        // get the path from root to latest leaf
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
            ? {
                ...thread,
                messages: [...thread.messages, message],
                allMessages: [...thread.allMessages, message],
              }
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

    switchToBranch: (leafId) => {
      const state = get()
      const activeThread = state.threads.find(
        (t) => t.id === state.activeThreadId
      )
      if (!activeThread) return

      const allMessages = activeThread.allMessages

      const actualLeaf = findBranchLeaf(allMessages, leafId)
      const targetLeafId = actualLeaf?.id || leafId

      const pathMessages = getPathToLeaf(allMessages, targetLeafId)

      // update thread with new path
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
