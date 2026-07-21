import {
  ExtendedThreadMessageLike,
  MessageRating,
  Thread,
} from '../../stores/chatStore'
import { sortAttachmentsByPosition } from '../attachments/attachmentState'
import { type ReasoningEffort } from '../config/reasoning'

export interface ApiError extends Error {
  status: number
  body?: unknown
}

export const isApiError = (error: unknown): error is ApiError =>
  typeof error === 'object' &&
  error !== null &&
  'status' in error &&
  typeof (error as { status?: unknown }).status === 'number'

export interface ApiThread {
  id: string
  title?: string
  createdAt: string
  updatedAt: string
  lastChatMode?: string | null
}

/**
 * API message content part
 */
export type ApiContentPart =
  | { type: 'text'; text: string }
  | { type: 'reasoning'; text: string }
  | {
      type: 'tool-call'
      toolCallId: string
      toolName: string
      args?: Record<string, unknown>
      result?: {
        content?: Array<{ text: string; type: string }>
        isError?: boolean
      }
    }

export interface ApiHydratedImageAttachment {
  id: string
  type: 'image'
  position: number
  imageBase64: string
  imagePreviewBase64?: string | null
  imageDescription?: string | null
  hasFullImage: true
}

export interface ApiHistoryImageAttachment {
  id: string
  type: 'image'
  position: number
  imagePreviewBase64?: string | null
  imageDescription?: string | null
  hasFullImage: boolean
}

export type ApiImageAttachment =
  | ApiHydratedImageAttachment
  | ApiHistoryImageAttachment

export interface ApiMessage {
  id: string
  threadId: string
  role: 'user' | 'assistant'
  content: ApiContentPart[]
  chatMode?: string | null
  modelId?: string | null
  reasoningEffort?: ReasoningEffort | null
  reasoningContent?: string | null
  creditsUsed?: number | null
  rating?: MessageRating | null
  imageAttachments?: ApiImageAttachment[]
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
    let errorBody: unknown = undefined

    try {
      errorBody = errorText ? JSON.parse(errorText) : undefined
    } catch {
      errorBody = errorText || undefined
    }

    console.error(
      `API call failed for ${url}: ${response.statusText} (${response.status}) - ${errorText}`
    )

    const error: ApiError = Object.assign(
      new Error(
        `API call failed for ${url}: ${response.statusText} (${response.status})`
      ),
      {
        status: response.status,
        body: errorBody,
      }
    )

    throw error
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
  updatedAt: new Date(apiThread.updatedAt),
  lastChatMode: apiThread.lastChatMode ?? null,
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
): ExtendedThreadMessageLike => {
  const normalizedReasoningContent =
    typeof apiMessage.reasoningContent === 'string' &&
    apiMessage.reasoningContent.trim().length > 0
      ? apiMessage.reasoningContent
      : null

  const content: ApiContentPart[] = apiMessage.content.map((item) => {
    if (item.type === 'text' || item.type === 'reasoning') {
      return {
        type: item.type,
        text: item.text,
      }
    } else if (item.type === 'tool-call') {
      return {
        type: item.type,
        toolCallId: item.toolCallId,
        toolName: item.toolName,
        args: item.args,
        result: item.result,
      }
    }
    // fallback for unknown types
    return item
  })

  const hasReasoningPart =
    apiMessage.role === 'assistant' &&
    content.some((item) => item.type === 'reasoning')

  const contentWithLegacyFallback: ApiContentPart[] =
    apiMessage.role === 'assistant' &&
    !hasReasoningPart &&
    normalizedReasoningContent
      ? [{ type: 'reasoning', text: normalizedReasoningContent }, ...content]
      : content

  return {
    id: apiMessage.id,
    role: apiMessage.role,
    content: contentWithLegacyFallback as ExtendedThreadMessageLike['content'],
    chatMode: apiMessage.chatMode ?? null,
    modelId: apiMessage.modelId ?? null,
    reasoningEffort: apiMessage.reasoningEffort ?? null,
    reasoningContent: apiMessage.reasoningContent ?? null,
    creditsUsed: apiMessage.creditsUsed ?? null,
    rating: apiMessage.rating ?? null,
    imageAttachments: sortAttachmentsByPosition(
      apiMessage.imageAttachments ?? []
    ),
    createdAt: new Date(apiMessage.createdAt),
    parentId: apiMessage.parentId || undefined,
  }
}
