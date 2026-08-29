import { z } from 'zod'

const uuidSchema = z.string().uuid()
const imageDataUrlSchema = z
  .string()
  .max(7_000_000)
  .refine((value) => /^data:image\/(jpeg|png|gif|webp);base64,/.test(value), {
    message: 'Must be a base64 data URL for jpeg, png, gif, or webp',
  })

const commonBodySchema = z.object({
  threadId: uuidSchema.nullable().optional(),
  selectedModel: z.string().min(1),
  selectedMode: z
    .string()
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
    text: z.string(),
    attachments: z.array(triggerAttachmentSchema).max(3).optional().default([]),
  }),
})

const legacyBodySchema = commonBodySchema.extend({
  messages: z
    .array(
      z.object({
        id: uuidSchema,
        role: z.enum(['user', 'assistant']),
        content: z.string(),
      })
    )
    .min(1),
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

function assertUniquePersistedAttachments(
  attachments: ParsedChatRequest['trigger']['attachments']
) {
  const persistedIds = attachments.flatMap((attachment) =>
    attachment.type === 'persisted-image' ? [attachment.id] : []
  )
  if (new Set(persistedIds).size !== persistedIds.length) {
    throw new z.ZodError([])
  }
}

export function parseChatRequestBody(value: unknown): ParsedChatRequest {
  const candidate = value as Record<string, unknown> | null
  if (candidate && 'trigger' in candidate) {
    const parsed = canonicalBodySchema.parse(value)
    if (
      parsed.trigger.text.trim().length === 0 &&
      parsed.trigger.attachments.length === 0
    ) {
      throw new z.ZodError([])
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
    throw new z.ZodError([])
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
