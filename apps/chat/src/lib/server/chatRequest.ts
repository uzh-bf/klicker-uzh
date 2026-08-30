import { z } from 'zod'

const uuidSchema = z.string().uuid()
const MAX_IMAGE_DATA_URL_LENGTH = 7_000_000
const MAX_CHAT_TEXT_LENGTH = 100_000
const MAX_LEGACY_MESSAGES = 100
const IMAGE_DATA_URL_PATTERN =
  /^data:image\/(jpeg|png|gif|webp);base64,([A-Za-z0-9+/]+={0,2})$/i

const imageDataUrlSchema = z
  .string()
  .max(MAX_IMAGE_DATA_URL_LENGTH)
  .refine(
    (value) => {
      const payload = IMAGE_DATA_URL_PATTERN.exec(value)?.[2]
      return Boolean(payload && payload.length % 4 === 0)
    },
    {
      message: 'Must be a valid base64 data URL for jpeg, png, gif, or webp',
    }
  )

const commonBodySchema = z.object({
  threadId: uuidSchema.nullable().optional(),
  selectedModel: z.string().min(1),
  selectedMode: z
    .string()
    .trim()
    .min(1)
    .optional()
    .transform((value) => value?.toLowerCase())
    .default('tutor'),
  reasoningEffort: z.string().min(1).optional().default('none'),
  assistantMessageId: uuidSchema,
})

const triggerAttachmentSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('new-image'),
    imageBase64: imageDataUrlSchema,
  }),
  z.object({
    type: z.literal('persisted-image'),
    id: uuidSchema,
  }),
])

const canonicalBodySchema = commonBodySchema.extend({
  trigger: z.object({
    id: uuidSchema,
    parentId: uuidSchema.nullable().optional().default(null),
    text: z.string().max(MAX_CHAT_TEXT_LENGTH),
    attachments: z.array(triggerAttachmentSchema).max(3).optional().default([]),
  }),
})

const legacyBodySchema = commonBodySchema.extend({
  messages: z
    .array(
      z.object({
        id: uuidSchema,
        role: z.enum(['user', 'assistant']),
        content: z.string().max(MAX_CHAT_TEXT_LENGTH),
      })
    )
    .min(1)
    .max(MAX_LEGACY_MESSAGES),
  parentId: uuidSchema.nullable().optional(),
  images: z
    .array(
      z.union([
        imageDataUrlSchema,
        z.object({
          imageBase64: imageDataUrlSchema,
          imagePreviewBase64: imageDataUrlSchema.nullable(),
        }),
      ])
    )
    .max(3)
    .optional()
    .default([]),
})

export type ParsedChatRequest = {
  threadId: string | null
  selectedModel: string
  selectedMode: string
  reasoningEffort: string
  assistantMessageId: string
  trigger: {
    id: string
    parentId: string | null
    text: string
    attachments: Array<
      | { type: 'new-image'; imageBase64: string }
      | { type: 'persisted-image'; id: string }
    >
  }
  usedLegacyAdapter: boolean
}

class ChatRequestValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ChatRequestValidationError'
  }
}

function assertUniquePersistedAttachments(
  attachments: ParsedChatRequest['trigger']['attachments']
) {
  const persistedIds = attachments.flatMap((attachment) =>
    attachment.type === 'persisted-image' ? [attachment.id] : []
  )
  if (new Set(persistedIds).size !== persistedIds.length) {
    throw new ChatRequestValidationError(
      'Persisted attachment IDs must be unique'
    )
  }
}

export function parseChatRequestBody(value: unknown): ParsedChatRequest {
  const candidate = value as Record<string, unknown> | null
  if (
    candidate &&
    typeof candidate === 'object' &&
    !Array.isArray(candidate) &&
    'trigger' in candidate
  ) {
    const parsed = canonicalBodySchema.parse(value)
    if (
      parsed.trigger.text.trim().length === 0 &&
      parsed.trigger.attachments.length === 0
    ) {
      throw new ChatRequestValidationError(
        'A chat trigger requires text or an attachment'
      )
    }
    assertUniquePersistedAttachments(parsed.trigger.attachments)
    return {
      ...parsed,
      threadId: parsed.threadId ?? null,
      trigger: {
        ...parsed.trigger,
        parentId: parsed.trigger.parentId ?? null,
      },
      usedLegacyAdapter: false,
    }
  }

  const parsed = legacyBodySchema.parse(value)
  const finalMessage = parsed.messages.at(-1)
  if (
    finalMessage?.role !== 'user' ||
    (finalMessage.content.trim().length === 0 && parsed.images.length === 0)
  ) {
    throw new ChatRequestValidationError(
      'The final legacy message must be a non-empty user trigger'
    )
  }

  return {
    threadId: parsed.threadId ?? null,
    selectedModel: parsed.selectedModel,
    selectedMode: parsed.selectedMode,
    reasoningEffort: parsed.reasoningEffort,
    assistantMessageId: parsed.assistantMessageId,
    trigger: {
      id: finalMessage.id,
      parentId: parsed.parentId ?? null,
      text: finalMessage.content,
      attachments: parsed.images.map((image) => ({
        type: 'new-image' as const,
        imageBase64: typeof image === 'string' ? image : image.imageBase64,
      })),
    },
    usedLegacyAdapter: true,
  }
}
