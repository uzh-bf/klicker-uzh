import { ExtendedThreadMessageLike, Thread } from '../../app/stores/chatStore'

export interface ApiThread {
  id: string
  title?: string
  createdAt: string
  updatedAt: string
}

/**
 * API message content part
 */
export interface ApiContentPart {
  type: 'text'
  text: string
}

/** TODO: Extend with other content types (tool calls, images, ...)
 * export type ApiContentPart =
 *   | { type: 'text'; text: string }
 *   | { type: 'tool-call'; toolCallId: string; toolName: string; args: any; result?: string }
 *  */

export interface ApiMessage {
  id: string
  threadId: string
  role: 'user' | 'assistant'
  content: ApiContentPart[]
  parentId?: string | null
  createdAt: string
  updatedAt: string
}

/**
 * Makes API call to the chat backend
 * Handles error responses and JSON parsing
 *
 * @param url - The API endpoint (relative to /api)
 * @param options - Fetch options (method, headers, body, etc.)
 * @returns Parsed JSON response
 * @throws Error if the API call fails
 */
export const apiCall = async <T = unknown>(
  url: string,
  options: RequestInit = {}
): Promise<T> => {
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

/**
 * Converts API thread response to internal Thread format
 * Initializes empty message arrays and sets default values
 *
 * @param apiThread - Thread data from the API
 * @returns Thread object ready for use in the store
 */
export const convertApiThreadToThread = (apiThread: ApiThread): Thread => ({
  id: apiThread.id,
  title: apiThread.title,
  messages: [],
  allMessages: [],
  isRunning: false,
  createdAt: new Date(apiThread.createdAt),
})

/**
 * Converts API message response to internal ExtendedThreadMessageLike format
 * Handles content transformation and parent ID mapping
 *
 * @param apiMessage - Message data from API
 * @returns Message object ready for use in the store
 */
export const convertApiMessageToMessage = (
  apiMessage: ApiMessage
): ExtendedThreadMessageLike => ({
  id: apiMessage.id,
  role: apiMessage.role,
  content: apiMessage.content.map((item) => ({
    type: item.type,
    text: item.text,
  })),
  createdAt: new Date(apiMessage.createdAt),
  parentId: apiMessage.parentId || undefined,
})
