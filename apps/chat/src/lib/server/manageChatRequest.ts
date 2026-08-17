import {
  MAX_IMAGE_DATA_URL_CHARACTERS,
  MAX_MANAGE_IMAGE_ATTACHMENTS,
} from '@/src/lib/config/attachmentLimits'
import { safeValidateUIMessages, type UIMessage } from 'ai'
import { z } from 'zod'

export const MANAGE_CHAT_MAX_BODY_BYTES = 16 * 1024 * 1024
export const MANAGE_CHAT_BODY_TIMEOUT_MS = 30_000
export const MANAGE_CHAT_TOTAL_TIMEOUT_MS = 60_000
export const MANAGE_CHAT_MAX_MESSAGES = 50
export const MANAGE_CHAT_MAX_PARTS = 500
export const MANAGE_CHAT_MAX_TEXT_CHARACTERS = 1_000_000
export const MANAGE_CHAT_MAX_DATA_PART_CHARACTERS = 7_000_000
export const MANAGE_CHAT_MAX_IN_FLIGHT_REQUESTS = 1

export type BoundedJsonResult =
  | { ok: true; value: unknown }
  | { ok: false; error: 'TOO_LARGE' | 'INVALID_JSON' | 'TIMEOUT' }

export type ValidatedManageChatRequest = {
  manageContext?: unknown
  messages: UIMessage[]
}

let inFlightRequestCount = 0

export function tryAcquireManageChatRequest(): (() => void) | null {
  if (inFlightRequestCount >= MANAGE_CHAT_MAX_IN_FLIGHT_REQUESTS) {
    return null
  }

  inFlightRequestCount += 1
  let released = false

  return () => {
    if (released) return
    released = true
    inFlightRequestCount = Math.max(0, inFlightRequestCount - 1)
  }
}

export function releaseWhenResponseCompletes(
  response: Response,
  release: () => void,
  signal?: AbortSignal
): Response {
  if (!response.body) {
    release()
    return response
  }

  try {
    const reader = response.body.getReader()
    let responseReleased = false
    const releaseAndDetach = () => {
      if (responseReleased) return
      responseReleased = true
      signal?.removeEventListener('abort', abortResponse)
      release()
    }
    const abortResponse = () => {
      void reader.cancel(signal?.reason).finally(releaseAndDetach)
    }
    if (signal?.aborted) {
      abortResponse()
    } else {
      signal?.addEventListener('abort', abortResponse, { once: true })
    }

    const body = new ReadableStream<Uint8Array>({
      async pull(controller) {
        try {
          const { done, value } = await reader.read()
          if (done) {
            releaseAndDetach()
            controller.close()
            return
          }
          controller.enqueue(value)
        } catch (error) {
          releaseAndDetach()
          controller.error(error)
        }
      },
      async cancel(reason) {
        try {
          await reader.cancel(reason)
        } finally {
          releaseAndDetach()
        }
      },
    })

    return new Response(body, {
      headers: response.headers,
      status: response.status,
      statusText: response.statusText,
    })
  } catch (error) {
    release()
    throw error
  }
}

const supportedImageDataUrl =
  /^data:image\/(?:gif|jpeg|png|webp);base64,([a-zA-Z0-9+/]+={0,2})$/

function isSupportedImageDataUrl(value: string): boolean {
  const match = supportedImageDataUrl.exec(value)
  return match !== null && match[1].length % 4 === 0
}

const uiMessageSchema = z.custom<UIMessage>((value) => {
  if (typeof value !== 'object' || value === null) return false

  const message = value as { parts?: unknown; role?: unknown }
  return (
    (message.role === 'assistant' || message.role === 'user') &&
    Array.isArray(message.parts) &&
    message.parts.every(
      (part) =>
        typeof part === 'object' &&
        part !== null &&
        typeof (part as { type?: unknown }).type === 'string'
    )
  )
})

export const manageChatRequestSchema = z
  .object({
    manageContext: z.unknown().optional(),
    messages: z.array(uiMessageSchema).min(1).max(MANAGE_CHAT_MAX_MESSAGES),
  })
  .superRefine(({ messages }, context) => {
    let partCount = 0
    let textCharacters = 0

    for (const [messageIndex, message] of messages.entries()) {
      let imageCount = 0

      for (const [partIndex, part] of message.parts.entries()) {
        partCount += 1
        if (partCount > MANAGE_CHAT_MAX_PARTS) {
          context.addIssue({
            code: 'custom',
            message: 'Too many message parts',
            path: ['messages'],
          })
          return
        }

        if (part.type === 'text') {
          if (typeof part.text !== 'string') {
            context.addIssue({
              code: 'custom',
              message: 'Invalid text part',
              path: ['messages', messageIndex, 'parts', partIndex],
            })
            continue
          }

          textCharacters += part.text.length
          if (textCharacters > MANAGE_CHAT_MAX_TEXT_CHARACTERS) {
            context.addIssue({
              code: 'custom',
              message: 'Message text is too large',
              path: ['messages'],
            })
            return
          }
        }

        if (
          message.role === 'user' &&
          part.type !== 'text' &&
          part.type !== 'file'
        ) {
          context.addIssue({
            code: 'custom',
            message: 'Unsupported user message part',
            path: ['messages', messageIndex, 'parts', partIndex],
          })
          continue
        }

        if (part.type === 'file') {
          if (message.role !== 'user') {
            context.addIssue({
              code: 'custom',
              message: 'Unsupported file message role',
              path: ['messages', messageIndex, 'parts', partIndex],
            })
            continue
          }

          if (
            typeof part.mediaType !== 'string' ||
            !part.mediaType.startsWith('image/') ||
            typeof part.url !== 'string'
          ) {
            context.addIssue({
              code: 'custom',
              message: 'Invalid image data',
              path: ['messages', messageIndex, 'parts', partIndex],
            })
            continue
          }

          imageCount += 1
          if (imageCount > MAX_MANAGE_IMAGE_ATTACHMENTS) {
            context.addIssue({
              code: 'custom',
              message: 'Too many images',
              path: ['messages', messageIndex, 'parts'],
            })
            continue
          }

          if (
            part.url.length > MAX_IMAGE_DATA_URL_CHARACTERS ||
            !isSupportedImageDataUrl(part.url)
          ) {
            context.addIssue({
              code: 'custom',
              message: 'Invalid image data',
              path: ['messages', messageIndex, 'parts', partIndex],
            })
          }
        }

        if (part.type.startsWith('data-')) {
          const serializedData = JSON.stringify(
            (part as { data: unknown }).data
          )
          if (
            typeof serializedData !== 'string' ||
            serializedData.length > MANAGE_CHAT_MAX_DATA_PART_CHARACTERS
          ) {
            context.addIssue({
              code: 'custom',
              message: 'Data part is too large',
              path: ['messages', messageIndex, 'parts', partIndex],
            })
          }
        }
      }
    }

    if (messages.at(-1)?.role !== 'user') {
      context.addIssue({
        code: 'custom',
        message: 'The final message must be from the user',
        path: ['messages'],
      })
    }
  })

export async function validateManageChatRequest(
  value: unknown
): Promise<ValidatedManageChatRequest | null> {
  const bounded = manageChatRequestSchema.safeParse(value)
  if (!bounded.success) return null

  const structurallyValid = await safeValidateUIMessages({
    messages: bounded.data.messages,
  })
  if (!structurallyValid.success) return null

  // Reconstruct the allowlisted browser contract instead of forwarding input
  // objects. This drops provider metadata and all other client-owned fields.
  // Current-request MCP results are supplied by streamText's server-owned tool
  // loop instead.
  const messages: UIMessage[] = []
  for (const message of structurallyValid.data) {
    if (message.role === 'assistant') {
      const parts: UIMessage['parts'] = []
      for (const part of message.parts) {
        if (part.type === 'text') {
          parts.push({ text: part.text, type: 'text' })
        }
      }
      if (parts.length > 0) {
        messages.push({ id: message.id, parts, role: 'assistant' })
      }
      continue
    }

    if (message.role !== 'user') continue

    const parts: UIMessage['parts'] = []
    for (const part of message.parts) {
      if (part.type === 'text') {
        parts.push({ text: part.text, type: 'text' })
      }
      if (part.type === 'file') {
        parts.push({
          ...(part.filename === undefined ? {} : { filename: part.filename }),
          mediaType: part.mediaType,
          type: 'file',
          url: part.url,
        })
      }
    }

    messages.push({ id: message.id, parts, role: 'user' })
  }

  return {
    manageContext: bounded.data.manageContext,
    messages,
  }
}

export async function readBoundedJson(
  request: Request,
  maxBytes = MANAGE_CHAT_MAX_BODY_BYTES,
  signal?: AbortSignal
): Promise<BoundedJsonResult> {
  const contentLength = request.headers.get('content-length')?.trim()
  if (/^\d+$/.test(contentLength ?? '')) {
    try {
      if (BigInt(contentLength!) > BigInt(maxBytes)) {
        await request.body?.cancel().catch(() => undefined)
        return { ok: false, error: 'TOO_LARGE' }
      }
    } catch {
      return { ok: false, error: 'INVALID_JSON' }
    }
  }

  if (!request.body) {
    return { ok: false, error: 'INVALID_JSON' }
  }

  const reader = request.body.getReader()
  const decoder = new TextDecoder('utf-8', { fatal: true })
  let text = ''
  let byteLength = 0

  try {
    while (true) {
      const { done, value } = await readWithSignal(reader, signal)
      if (done) break

      byteLength += value.byteLength
      if (byteLength > maxBytes) {
        await reader.cancel().catch(() => undefined)
        return { ok: false, error: 'TOO_LARGE' }
      }
      text += decoder.decode(value, { stream: true })
    }

    text += decoder.decode()
    return { ok: true, value: JSON.parse(text) }
  } catch {
    if (signal?.aborted) {
      await reader.cancel(signal.reason).catch(() => undefined)
      return { ok: false, error: 'TIMEOUT' }
    }
    return { ok: false, error: 'INVALID_JSON' }
  } finally {
    reader.releaseLock()
  }
}

async function readWithSignal(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  signal?: AbortSignal
): Promise<ReadableStreamReadResult<Uint8Array>> {
  if (!signal) return reader.read()
  if (signal.aborted) throw signal.reason

  return new Promise((resolve, reject) => {
    const abort = () => reject(signal.reason)
    signal.addEventListener('abort', abort, { once: true })
    reader
      .read()
      .then(resolve, reject)
      .finally(() => {
        signal.removeEventListener('abort', abort)
      })
  })
}
