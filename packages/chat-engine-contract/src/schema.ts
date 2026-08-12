import { z } from 'zod'

export const CHAT_ENGINE_CONTRACT_VERSION = 'v1' as const
export const MCP_EXECUTION_TOKEN_HEADER = 'x-mcp-execution-token'
export const TRACEPARENT_HEADER = 'traceparent'
export const TRACESTATE_HEADER = 'tracestate'

const MAX_DATA_URL_LENGTH = 7_000_000
const MAX_DECODED_IMAGE_BYTES = 5 * 1024 * 1024
const MAX_IMAGE_ATTACHMENTS = 3
const MAX_MESSAGES = 100
const MAX_TOOLS = 64
const IMAGE_MEDIA_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
] as const

const reasoningEffortSchema = z.string().min(1).max(32)
const boundedString = (max: number) => z.string().min(1).max(max)

function decodedBase64Bytes(payload: string): number {
  const padding = payload.endsWith('==') ? 2 : payload.endsWith('=') ? 1 : 0
  return Math.floor((payload.length * 3) / 4) - padding
}

function validProviderBaseUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return (
      (url.protocol === 'http:' || url.protocol === 'https:') &&
      url.username.length === 0 &&
      url.password.length === 0 &&
      url.search.length === 0 &&
      url.hash.length === 0
    )
  } catch {
    return false
  }
}

const providerBaseUrlSchema = z.string().url().refine(validProviderBaseUrl, {
  message:
    'Provider base URL must be HTTP(S) without credentials, query, or fragment.',
})

export const imageAttachmentSchema = z
  .object({
    id: boundedString(128),
    type: z.literal('image'),
    mediaType: z.enum(IMAGE_MEDIA_TYPES),
    dataUrl: z
      .string()
      .max(MAX_DATA_URL_LENGTH)
      .regex(/^data:image\/(jpeg|png|gif|webp);base64,[A-Za-z0-9+/]+={0,2}$/),
    description: z.string().max(20_000).optional(),
  })
  .strict()
  .superRefine((attachment, ctx) => {
    const match = attachment.dataUrl.match(
      /^data:(image\/(?:jpeg|png|gif|webp));base64,([A-Za-z0-9+/]+={0,2})$/
    )
    if (!match) return

    if (match[1] !== attachment.mediaType) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['mediaType'],
        message: 'Declared media type must match the data URL.',
      })
    }

    const payload = match[2]
    if (payload && decodedBase64Bytes(payload) > MAX_DECODED_IMAGE_BYTES) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['dataUrl'],
        message: 'Decoded image exceeds the 5 MiB limit.',
      })
    }
  })

const textPartSchema = z
  .object({
    type: z.literal('text'),
    text: z.string().max(200_000),
  })
  .strict()

const reasoningPartSchema = z
  .object({
    type: z.literal('reasoning'),
    text: z.string().max(200_000),
  })
  .strict()

const toolCallPartSchema = z
  .object({
    type: z.literal('tool-call'),
    toolCallId: boundedString(128),
    toolName: boundedString(256),
    input: z.unknown().optional(),
    output: z.unknown().optional(),
    isError: z.boolean().optional(),
  })
  .strict()

const messagePartSchema = z.union([
  textPartSchema,
  reasoningPartSchema,
  toolCallPartSchema,
  imageAttachmentSchema,
])

export const engineMessageSchema = z
  .object({
    id: boundedString(128),
    role: z.enum(['user', 'assistant']),
    parts: z.array(messagePartSchema).min(1).max(256),
  })
  .strict()

export const approvedToolSchema = z
  .object({
    name: z
      .string()
      .min(1)
      .max(128)
      .regex(/^[A-Za-z0-9_.-]+$/),
    description: z.string().max(2_000).optional(),
    inputSchema: z.record(z.unknown()),
    serverId: boundedString(128),
  })
  .strict()

const requestCredentialModeSchema = z
  .object({
    mode: z.literal('request'),
    providerBaseUrl: providerBaseUrlSchema,
  })
  .strict()

const deploymentCredentialModeSchema = z
  .object({
    mode: z.literal('deployment'),
  })
  .strict()

export const resolvedGenerationSchema = z
  .object({
    modelId: boundedString(128),
    deploymentId: boundedString(256),
    maxOutputTokens: z.number().int().positive().max(1_000_000).optional(),
    reasoningEffort: reasoningEffortSchema,
    reasoningSummary: z.enum(['auto', 'none']),
    responseStorage: z.boolean(),
    credentialMode: z.discriminatedUnion('mode', [
      requestCredentialModeSchema,
      deploymentCredentialModeSchema,
    ]),
  })
  .strict()
  .superRefine((generation, ctx) => {
    if (
      generation.reasoningEffort === 'none' &&
      generation.reasoningSummary !== 'none'
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['reasoningSummary'],
        message: 'Reasoning summary must be none when reasoning is disabled.',
      })
    }
    if (
      generation.reasoningEffort !== 'none' &&
      generation.reasoningSummary === 'none'
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['reasoningSummary'],
        message: 'Reasoning summary must be auto when reasoning is enabled.',
      })
    }
  })

export const engineChatRequestSchema = z
  .object({
    contractVersion: z.literal(CHAT_ENGINE_CONTRACT_VERSION),
    requestId: boundedString(128),
    participantId: boundedString(128),
    courseId: boundedString(128).nullable(),
    chatbotId: boundedString(128),
    threadId: boundedString(128),
    userMessageId: boundedString(128),
    assistantMessageId: boundedString(128),
    runId: boundedString(128),
    locale: z.string().min(2).max(16),
    systemPrompt: z.string().max(200_000),
    generation: resolvedGenerationSchema,
    messages: z.array(engineMessageSchema).min(1).max(MAX_MESSAGES),
    tools: z.array(approvedToolSchema).max(MAX_TOOLS),
  })
  .strict()
  .superRefine((request, ctx) => {
    const seenNames = new Set<string>()
    request.tools.forEach((tool, index) => {
      if (seenNames.has(tool.name)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['tools', index, 'name'],
          message: 'Tool names must be unique within a request.',
        })
      }
      seenNames.add(tool.name)
    })
    let imageCount = 0
    request.messages.forEach((message, messageIndex) => {
      message.parts.forEach((part) => {
        if (part.type !== 'image') return
        imageCount += 1
        if (message.role === 'assistant') {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['messages', messageIndex, 'parts'],
            message: 'Assistant messages cannot contain images.',
          })
        }
      })
    })
    if (imageCount > MAX_IMAGE_ATTACHMENTS) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['messages'],
        message: 'At most three image attachments are allowed.',
      })
    }
  })

const tokenSchema = z.number().int().nonnegative().nullable()

export const engineUsageSchema = z
  .object({
    inputTokens: tokenSchema,
    outputTokens: tokenSchema,
    reasoningTokens: tokenSchema,
    cacheReadTokens: tokenSchema,
    cacheWriteTokens: tokenSchema,
    totalTokens: tokenSchema,
  })
  .strict()

export const engineFinishMetadataSchema = z
  .object({
    contractVersion: z.literal(CHAT_ENGINE_CONTRACT_VERSION),
    engineId: boundedString(128),
    runId: boundedString(128),
    modelId: boundedString(128),
    deploymentId: boundedString(256),
    usage: engineUsageSchema,
    reasoningContent: z.string().max(200_000).nullable(),
    aborted: z.boolean(),
  })
  .strict()

const providerMetadataSchema = z.record(z.unknown()).optional()
const sparseProviderIndexSchema = z.number().int().nonnegative().optional()

const streamStartSchema = z
  .object({
    type: z.literal('start'),
    messageId: boundedString(128).optional(),
    messageMetadata: engineFinishMetadataSchema.optional(),
  })
  .strict()

const textStartSchema = z
  .object({
    type: z.literal('text-start'),
    id: boundedString(128),
    providerMetadata: providerMetadataSchema,
  })
  .strict()

const textDeltaSchema = z
  .object({
    type: z.literal('text-delta'),
    id: boundedString(128),
    delta: z.string(),
    providerMetadata: providerMetadataSchema,
  })
  .strict()

const textEndSchema = z
  .object({
    type: z.literal('text-end'),
    id: boundedString(128),
    providerMetadata: providerMetadataSchema,
  })
  .strict()

const reasoningStartSchema = z
  .object({
    type: z.literal('reasoning-start'),
    id: boundedString(128),
    providerMetadata: providerMetadataSchema,
  })
  .strict()

const reasoningDeltaSchema = z
  .object({
    type: z.literal('reasoning-delta'),
    id: boundedString(128),
    delta: z.string(),
    providerMetadata: providerMetadataSchema,
  })
  .strict()

const reasoningEndSchema = z
  .object({
    type: z.literal('reasoning-end'),
    id: boundedString(128),
    providerMetadata: providerMetadataSchema,
  })
  .strict()

const toolInputStartSchema = z
  .object({
    type: z.literal('tool-input-start'),
    toolCallId: boundedString(128),
    toolName: boundedString(128),
    providerExecuted: z.boolean().optional(),
    providerMetadata: providerMetadataSchema,
    toolMetadata: providerMetadataSchema,
    dynamic: z.boolean().optional(),
    title: z.string().max(256).optional(),
    providerToolCallIndex: sparseProviderIndexSchema,
  })
  .strict()

const toolInputDeltaSchema = z
  .object({
    type: z.literal('tool-input-delta'),
    toolCallId: boundedString(128),
    inputTextDelta: z.string(),
    providerToolCallIndex: sparseProviderIndexSchema,
  })
  .strict()

const toolInputErrorSchema = z
  .object({
    type: z.literal('tool-input-error'),
    toolCallId: boundedString(128),
    toolName: boundedString(128),
    input: z.unknown().refine((value) => value !== undefined),
    errorText: boundedString(4_000),
    providerExecuted: z.boolean().optional(),
    providerMetadata: providerMetadataSchema,
    toolMetadata: providerMetadataSchema,
    dynamic: z.boolean().optional(),
    title: z.string().max(256).optional(),
    providerToolCallIndex: sparseProviderIndexSchema,
  })
  .strict()

const toolInputAvailableSchema = z
  .object({
    type: z.literal('tool-input-available'),
    toolCallId: boundedString(128),
    toolName: boundedString(128),
    input: z.unknown().refine((value) => value !== undefined),
    providerExecuted: z.boolean().optional(),
    providerMetadata: providerMetadataSchema,
    toolMetadata: providerMetadataSchema,
    dynamic: z.boolean().optional(),
    title: z.string().max(256).optional(),
    providerToolCallIndex: sparseProviderIndexSchema,
  })
  .strict()

const toolOutputAvailableSchema = z
  .object({
    type: z.literal('tool-output-available'),
    toolCallId: boundedString(128),
    output: z.unknown().refine((value) => value !== undefined),
    providerExecuted: z.boolean().optional(),
    providerMetadata: providerMetadataSchema,
    toolMetadata: providerMetadataSchema,
    dynamic: z.boolean().optional(),
    preliminary: z.boolean().optional(),
    providerToolCallIndex: sparseProviderIndexSchema,
  })
  .strict()

const toolOutputErrorSchema = z
  .object({
    type: z.literal('tool-output-error'),
    toolCallId: boundedString(128),
    errorText: boundedString(4_000),
    providerExecuted: z.boolean().optional(),
    providerMetadata: providerMetadataSchema,
    toolMetadata: providerMetadataSchema,
    dynamic: z.boolean().optional(),
    providerToolCallIndex: sparseProviderIndexSchema,
  })
  .strict()

const finishSchema = z
  .object({
    type: z.literal('finish'),
    finishReason: z
      .enum([
        'stop',
        'length',
        'content-filter',
        'tool-calls',
        'error',
        'other',
      ])
      .optional(),
    messageMetadata: engineFinishMetadataSchema,
  })
  .strict()

const abortSchema = z
  .object({
    type: z.literal('abort'),
    reason: z.string().max(512).optional(),
  })
  .strict()

const errorSchema = z
  .object({
    type: z.literal('error'),
    errorText: boundedString(4_000),
    code: boundedString(128).optional(),
    retryable: z.boolean().optional(),
  })
  .strict()

export const engineStreamPartSchema = z.union([
  streamStartSchema,
  z.object({ type: z.literal('start-step') }).strict(),
  z.object({ type: z.literal('finish-step') }).strict(),
  textStartSchema,
  textDeltaSchema,
  textEndSchema,
  reasoningStartSchema,
  reasoningDeltaSchema,
  reasoningEndSchema,
  toolInputStartSchema,
  toolInputDeltaSchema,
  toolInputErrorSchema,
  toolInputAvailableSchema,
  toolOutputAvailableSchema,
  toolOutputErrorSchema,
  finishSchema,
  abortSchema,
  errorSchema,
  z
    .object({
      type: z.literal('message-metadata'),
      messageMetadata: engineFinishMetadataSchema,
    })
    .strict(),
])

export const engineManifestSchema = z
  .object({
    contractVersion: z.literal(CHAT_ENGINE_CONTRACT_VERSION),
    engineId: boundedString(128),
    features: z
      .object({
        text: z.literal(true),
        reasoning: z.boolean(),
        images: z.boolean(),
        tools: z.boolean(),
        cancellation: z.literal(true),
      })
      .strict(),
    providerCredentialModes: z.tuple([
      z.literal('request'),
      z.literal('deployment'),
    ]),
    limits: z
      .object({
        maxMessages: z.literal(MAX_MESSAGES),
        maxTools: z.literal(MAX_TOOLS),
        maxImageAttachments: z.literal(MAX_IMAGE_ATTACHMENTS),
        maxDecodedImageBytes: z.literal(MAX_DECODED_IMAGE_BYTES),
        maxDataUrlLength: z.literal(MAX_DATA_URL_LENGTH),
      })
      .strict(),
  })
  .strict()

export type ImageAttachment = z.infer<typeof imageAttachmentSchema>
export type EngineMessage = z.infer<typeof engineMessageSchema>
export type ApprovedTool = z.infer<typeof approvedToolSchema>
export type ResolvedGeneration = z.infer<typeof resolvedGenerationSchema>
export type EngineChatRequest = z.infer<typeof engineChatRequestSchema>
export type EngineUsage = z.infer<typeof engineUsageSchema>
export type EngineFinishMetadata = z.infer<typeof engineFinishMetadataSchema>
export type EngineStreamPart = z.infer<typeof engineStreamPartSchema>
export type EngineManifest = z.infer<typeof engineManifestSchema>

export function parseEngineChatRequest(value: unknown): EngineChatRequest {
  return engineChatRequestSchema.parse(value)
}

export function parseEngineStreamPart(value: unknown): EngineStreamPart {
  return engineStreamPartSchema.parse(value)
}

export function parseEngineManifest(value: unknown): EngineManifest {
  return engineManifestSchema.parse(value)
}

export function validateProviderCredentialHeaders(
  generation: ResolvedGeneration,
  headers: Headers
): { ok: true; providerApiKey?: string } | { ok: false; message: string } {
  const providerAuthorization = headers.get('provider-authorization')

  if (generation.credentialMode.mode === 'request') {
    if (!providerAuthorization?.startsWith('Bearer ')) {
      return {
        ok: false,
        message: 'Provider-Authorization bearer token is required.',
      }
    }
    const providerApiKey = providerAuthorization.slice('Bearer '.length).trim()
    if (!providerApiKey) {
      return {
        ok: false,
        message: 'Provider-Authorization bearer token is required.',
      }
    }
    return { ok: true, providerApiKey }
  }

  if (providerAuthorization) {
    return {
      ok: false,
      message:
        'Provider-Authorization is not allowed for deployment credentials.',
    }
  }
  return { ok: true }
}
