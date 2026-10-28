import { createHash, randomUUID } from 'node:crypto'
import {
  CHAT_ENGINE_CONTRACT_VERSION,
  type EngineChatRequest,
  engineChatRequestSchema,
  type ImageAttachment,
  imageAttachmentSchema,
  parseProviderAllowedOrigins,
  providerOriginIsAllowed,
} from '@klicker-uzh/chat-engine-contract'
import { safeDecrypt } from '@klicker-uzh/util'
import { Hono, type Context } from 'hono'
import { prisma } from '@klicker-uzh/prisma'
import { ChatMessageRating } from '@klicker-uzh/prisma/client'
import { getChatbotOr404 } from './runtime/auth.js'
import { getModelsForChatbot } from './host/lib/server/chatModelRegistry.js'
import { getNextResetTime } from './host/utils/creditPeriods.js'
import { ThreadService } from './host/services/threads.js'
import { DisclaimersService } from './host/services/disclaimers.js'
import { bodyLimit } from 'hono/body-limit'
import { getCookie } from 'hono/cookie'
import { z } from 'zod'
import {
  createEngineClient,
  type EngineClient,
  type EngineReadiness,
  EngineReadinessProbe,
} from './engine/client.js'
import {
  createValidatedPlatformStream,
  type PlatformMetadata,
  usageIsChargeable,
} from './engine/stream.js'
import {
  type ChatModelConfig,
  calculateCost,
  getAllowedReasoningEffortsForModel,
  getAutomaticModelId,
  getParticipantFallbackModelId,
  getChatModelRegistry,
} from './policy/modelRegistry.js'
import {
  type AuthFailure,
  authenticateParticipant,
  isFailure,
} from './runtime/auth.js'
import {
  type ChatbotRecord,
  checkDisclaimer,
  type FinalizeAssistantInput,
  type FinalizeAssistantResult,
  finalizeAssistantTurn,
  getChatbot,
  getCredits,
  getSystemPrompt,
  getThread,
  loadEngineMessages,
  persistUserMessage,
} from './runtime/defaultDependencies.js'

import {
  answerStyleSchema,
  answerToneSchema,
} from './host/lib/server/answerStyleInstructions.js'
import {
  DEFAULT_ANSWER_STYLE,
  DEFAULT_ANSWER_TONE,
} from './host/lib/config/answerStyles.js'
import {
  resolveEffectiveChatModeOptions,
  resolveRequestedChatMode,
  resolveEffectiveMCPConfigurations,
} from './host/lib/server/effectiveChatModes.js'
import {
  claimChatTurn,
  failChatTurn,
  isChatAccountUsageEnforcementEnabled,
  isChatAccountUsageAvailable,
  ChatTurnConflictError,
} from './host/services/accountUsage.js'
import { createCodeApiAuthorization } from './runtime/codeapi.js'

const MAX_BODY_BYTES = 32 * 1024 * 1024

const imageInputSchema = z.union([
  z
    .string()
    .max(7_000_000)
    .regex(/^data:image\/(jpeg|png|gif|webp);base64,[A-Za-z0-9+/]+={0,2}$/),
  z.object({
    imageBase64: z
      .string()
      .max(7_000_000)
      .regex(/^data:image\/(jpeg|png|gif|webp);base64,[A-Za-z0-9+/]+={0,2}$/),
    imagePreviewBase64: z.string().nullable().optional(),
  }),
])

const bodySchema = z.object({
  messages: z
    .array(
      z.object({
        id: z.string().min(1).max(128),
        role: z.enum(['user', 'assistant']),
        content: z.string().max(200_000),
      })
    )
    .min(1)
    .max(100),
  threadId: z.string().min(1).max(128),
  selectedModel: z.string().min(1).max(128),
  selectedMode: z.string().min(1).max(64).default('tutor'),
  reasoningEffort: z.string().min(1).max(32).default('none'),
  parentId: z.string().min(1).max(128).nullable().optional(),
  assistantMessageId: z.string().min(1).max(128),
  locale: z.string().min(2).max(16).optional(),
  images: z.array(imageInputSchema).max(3).default([]),
  documentPages: z.array(z.string()).max(20).default([]),
  handoffSource: z.string().optional(),
  answerStyle: answerStyleSchema,
  answerTone: answerToneSchema,
  allowRegeneration: z.boolean().default(false),
})

export type ChatApiDependencies = {
  claimChatTurn: typeof claimChatTurn
  failChatTurn: typeof failChatTurn
  isChatAccountUsageAvailable: typeof isChatAccountUsageAvailable
  authenticate: (
    participantToken: string | undefined,
    chatbotId: string
  ) => Promise<{ participantId: string; courseId: string } | AuthFailure>
  getChatbot: (chatbotId: string) => Promise<ChatbotRecord | null>
  checkDisclaimer: (
    participantId: string,
    chatbotId: string
  ) => Promise<{ required: boolean; accepted: boolean }>
  getCredits: (
    participantId: string,
    chatbotId: string
  ) => Promise<{ current: number; total: number }>
  getThread: (
    threadId: string,
    participantId: string,
    chatbotId: string
  ) => Promise<{ id: string } | null>
  loadEngineMessages: typeof loadEngineMessages
  persistUserMessage: (input: {
    threadId: string
    messageId: string
    parentId: string | null
    content: string
    chatMode: string
    modelId: string
    reasoningEffort: string | null
    attachments: ImageAttachment[]
  }) => Promise<void>
  finalizeAssistantTurn: (
    input: FinalizeAssistantInput
  ) => Promise<FinalizeAssistantResult>
  engine: EngineClient
  readiness?: { get: () => Promise<EngineReadiness> }
  authorizeTools?: (input: {
    chatbot: ChatbotRecord
    mode: string
    participantId: string
    runId: string
  }) => Promise<{
    tools: EngineChatRequest['tools']
    executionToken: string
  } | null>
}

function mediaType(dataUrl: string): ImageAttachment['mediaType'] {
  const match = dataUrl.match(/^data:(image\/(?:jpeg|png|gif|webp));/)
  if (!match) throw new Error('Invalid image media type.')
  return match[1] as ImageAttachment['mediaType']
}

function toImageAttachments(
  images: Array<z.infer<typeof imageInputSchema>>
): ImageAttachment[] {
  return images.map((image, index) => {
    const dataUrl = typeof image === 'string' ? image : image.imageBase64
    return imageAttachmentSchema.parse({
      id: `image-${index + 1}`,
      type: 'image',
      mediaType: mediaType(dataUrl),
      dataUrl,
    })
  })
}

function defaultReasoningEffort(allowed: string[]): string | null {
  if (allowed.length === 0) return null
  return allowed.includes('medium') ? 'medium' : allowed[0]!
}

function traceParentForAssistant(messageId: string): string {
  const traceId = createHash('sha256')
    .update(messageId)
    .digest('hex')
    .slice(0, 32)
  const spanId = traceId.slice(0, 16)
  return `00-${traceId}-${spanId}-01`
}

function traceContextForRequest(
  request: Request,
  assistantMessageId: string
): { traceparent: string; tracestate?: string } {
  const incomingTraceParent = request.headers.get('traceparent')
  const traceparent =
    incomingTraceParent &&
    /^00-[0-9a-f]{32}-[0-9a-f]{16}-[0-9a-f]{2}$/.test(incomingTraceParent) &&
    !/^00-0{32}-0{16}-00$/.test(incomingTraceParent)
      ? incomingTraceParent
      : traceParentForAssistant(assistantMessageId)
  const tracestate = request.headers.get('tracestate')
  return {
    traceparent,
    ...(tracestate && tracestate.length <= 512 ? { tracestate } : {}),
  }
}

function resolveCredentialMode(
  chatbot: ChatbotRecord,
  model: ChatModelConfig,
  providerAllowedOrigins: ReadonlySet<string>
): {
  generation: EngineChatRequest['generation']
  providerAuthorization?: string
} {
  const hasCustomKey = Boolean(chatbot.openaiApiKey)
  const hasCustomBase = Boolean(chatbot.openaiBaseUrl)
  if (hasCustomBase && !hasCustomKey) {
    throw new Error(
      'A custom provider base URL requires a chatbot-specific provider credential.'
    )
  }
  const custom = hasCustomKey || hasCustomBase
  if (!custom) {
    return {
      generation: {
        modelId: model.id,
        deploymentId: model.deploymentId,
        ...(model.maxOutputTokens
          ? { maxOutputTokens: model.maxOutputTokens }
          : {}),
        reasoningEffort: 'none',
        reasoningSummary: 'none',
        responseStorage: false,
        credentialMode: { mode: 'deployment' },
      },
    }
  }

  const providerBaseUrl = chatbot.openaiBaseUrl ?? process.env.OPENAI_BASE_URL
  if (!providerBaseUrl)
    throw new Error('Request provider base URL is not configured.')
  if (!providerOriginIsAllowed(providerBaseUrl, providerAllowedOrigins)) {
    throw new Error('Request provider origin is not allowed.')
  }
  let providerApiKey = process.env.OPENAI_API_KEY
  if (chatbot.openaiApiKey) providerApiKey = safeDecrypt(chatbot.openaiApiKey)
  if (!providerApiKey)
    throw new Error('Request provider credential is not configured.')

  return {
    generation: {
      modelId: model.id,
      deploymentId: model.deploymentId,
      ...(model.maxOutputTokens
        ? { maxOutputTokens: model.maxOutputTokens }
        : {}),
      reasoningEffort: 'none',
      reasoningSummary: 'none',
      responseStorage: false,
      credentialMode: { mode: 'gateway', gatewayOrigin: providerBaseUrl },
    },
    providerAuthorization: `Bearer ${providerApiKey}`,
  }
}

function withReasoning(
  generation: EngineChatRequest['generation'],
  appliedReasoningEffort: string | null
) {
  const effort = appliedReasoningEffort ?? 'none'
  return {
    ...generation,
    reasoningEffort: effort,
    reasoningSummary: effort === 'none' ? ('none' as const) : ('auto' as const),
    responseStorage: process.env.CHAT_OPENAI_STORE_RESPONSES === 'true',
  }
}

function jsonError(
  error: string,
  code: string,
  status: 400 | 403 | 404 | 409 | 413 | 500 | 503
) {
  return { error, code, status }
}

export function createChatApiApp(
  overrides: Partial<ChatApiDependencies> = {},
  configuration: {
    providerAllowedOrigins?: ReadonlySet<string>
    browserAllowedOrigins?: ReadonlySet<string>
  } = {}
) {
  const providerAllowedOrigins =
    configuration.providerAllowedOrigins ??
    parseProviderAllowedOrigins(process.env.CHAT_PROVIDER_ALLOWED_ORIGINS)
  const engine = overrides.engine ?? createEngineClient()
  const dependencies: ChatApiDependencies = {
    authenticate: authenticateParticipant,
    claimChatTurn,
    failChatTurn,
    isChatAccountUsageAvailable,
    authorizeTools: createCodeApiAuthorization(),
    getChatbot,
    checkDisclaimer,
    getCredits,
    getThread,
    loadEngineMessages,
    persistUserMessage,
    finalizeAssistantTurn,
    engine,
    ...overrides,
  }
  const readiness = overrides.readiness ?? new EngineReadinessProbe(engine)
  const app = new Hono()
  const allowedOrigins =
    configuration.browserAllowedOrigins ??
    parseProviderAllowedOrigins(process.env.CHAT_BROWSER_ALLOWED_ORIGINS)
  app.use('/api/*', async (c, next) => {
    const origin = c.req.header('origin')
    const accepted =
      origin !== undefined &&
      (origin === new URL(c.req.url).origin || allowedOrigins.has(origin))
    if (origin && accepted) {
      c.header('access-control-allow-origin', origin)
      c.header('access-control-allow-credentials', 'true')
      c.header('vary', 'Origin')
    }
    if (c.req.method === 'OPTIONS') {
      if (!accepted) return c.json({ code: 'ORIGIN_NOT_ALLOWED' }, 403)
      c.header(
        'access-control-allow-methods',
        'GET, POST, PUT, PATCH, DELETE, OPTIONS'
      )
      c.header(
        'access-control-allow-headers',
        'Content-Type, Traceparent, Tracestate'
      )
      return c.body(null, 204)
    }
    if (!['GET', 'HEAD'].includes(c.req.method) && !accepted)
      return c.json({ code: 'ORIGIN_NOT_ALLOWED' }, 403)
    await next()
  })

  app.onError((_error, c) =>
    c.json({ error: 'Chat request could not be completed' }, 500)
  )
  app.use(
    '/api/*',
    bodyLimit({
      maxSize: MAX_BODY_BYTES,
      onError: (c) => c.json({ code: 'BODY_TOO_LARGE' }, 413),
    })
  )

  const participantRoute =
    (
      handler: (
        c: Context,
        participantId: string,
        chatbotId: string
      ) => Promise<Response>
    ) =>
    async (c: Context) => {
      const chatbotId = c.req.param('chatbotId')!
      const auth = await dependencies.authenticate(
        getCookie(c, 'participant_token'),
        chatbotId
      )
      if (isFailure(auth)) return c.json({ error: auth.error }, auth.status)
      c.header('cache-control', 'private, no-store')
      return handler(c, auth.participantId, chatbotId)
    }
  app.get(
    '/api/chatbots/:chatbotId',
    participantRoute(async (c, _participant, id) => {
      const bot = await dependencies.getChatbot(id)
      if (!bot) return c.json({ error: 'Chatbot not found' }, 404)
      return c.json({
        modelSelection: bot.modelSelection,
        answerPreferencesEnabled: bot.answerPreferencesEnabled,
        modeOptions: resolveEffectiveChatModeOptions(
          bot.systemPrompts,
          bot.mcpConfigurations,
          bot.standardModeConfig
        ),
      })
    })
  )
  app.get(
    '/api/chatbots/:chatbotId/credits',
    participantRoute(async (c, participant, id) => {
      const result = await getChatbotOr404(id, {
        allowedModelIds: true,
        allowedReasoningEffortsByModel: true,
        creditResetPeriod: true,
      })
      if (isFailure(result))
        return c.json({ error: result.error }, result.status)
      const bot = result.chatbot
      const availableModels = getModelsForChatbot(bot).map(
        ({
          id,
          name,
          description,
          fallback,
          supportsReasoning,
          supportsImageAttachments,
          supportedReasoningEfforts,
        }) => ({
          id,
          name,
          description,
          fallback,
          supportsReasoning,
          supportsImageAttachments,
          allowedReasoningEfforts: supportedReasoningEfforts,
        })
      )
      return c.json({
        ...(await dependencies.getCredits(participant, id)),
        availableModels,
        automaticModelId: getAutomaticModelId(bot.allowedModelIds),
        nextResetAt:
          getNextResetTime(bot.creditResetPeriod)?.toISOString() ?? null,
      })
    })
  )
  app.get(
    '/api/chatbots/:chatbotId/disclaimer',
    participantRoute(async (c, participant, id) =>
      c.json({
        disclaimer: await DisclaimersService.getDisclaimerForChatbot(id),
        status: await DisclaimersService.checkDisclaimerStatus(id, participant),
      })
    )
  )
  app.post(
    '/api/chatbots/:chatbotId/disclaimer',
    participantRoute(async (c, participant, id) => {
      const parsed = z
        .object({
          action: z.enum(['accept', 'decline']),
          disclaimerId: z.string().uuid().optional(),
        })
        .safeParse(await c.req.json())
      if (!parsed.success)
        return c.json({ error: 'Invalid disclaimer action' }, 400)
      if (parsed.data.action === 'decline')
        return c.json(
          await DisclaimersService.declineDisclaimer(id, participant)
        )
      const current = await DisclaimersService.getDisclaimerForChatbot(id)
      if (!current || current.id !== parsed.data.disclaimerId)
        return c.json({ error: 'Disclaimer not found' }, 404)
      return c.json(
        await DisclaimersService.acceptDisclaimer(id, participant, current.id)
      )
    })
  )
  app.get(
    '/api/chatbots/:chatbotId/threads',
    participantRoute(async (c, participant, id) =>
      c.json(await ThreadService.getAllThreads(participant, id))
    )
  )
  app.post(
    '/api/chatbots/:chatbotId/threads',
    participantRoute(async (c, participant, id) => {
      const parsed = z
        .object({ title: z.string().max(500).nullable().optional() })
        .safeParse(await c.req.json())
      if (!parsed.success) return c.json({ error: 'Invalid thread' }, 400)
      return c.json(
        await ThreadService.createThread(participant, id, parsed.data.title)
      )
    })
  )
  app.delete(
    '/api/chatbots/:chatbotId/threads/:threadId',
    participantRoute(async (c, participant, id) => {
      const removed = await ThreadService.deleteThread(
        c.req.param('threadId')!,
        participant,
        id
      )
      return removed
        ? c.json({ message: 'Thread deleted' })
        : c.json({ error: 'Thread not found' }, 404)
    })
  )
  app.put(
    '/api/chatbots/:chatbotId/threads/:threadId/title',
    participantRoute(async (c, participant, id) => {
      const parsed = z
        .object({ title: z.string().max(500) })
        .safeParse(await c.req.json())
      if (!parsed.success) return c.json({ error: 'Invalid thread title' }, 400)
      const thread = await ThreadService.updateThreadTitle(
        c.req.param('threadId')!,
        participant,
        id,
        parsed.data.title
      )
      return thread
        ? c.json({ message: 'Thread title updated', thread })
        : c.json({ error: 'Thread not found' }, 404)
    })
  )
  app.get(
    '/api/chatbots/:chatbotId/threads/:threadId/messages',
    participantRoute(async (c, participant, id) => {
      const messages = await prisma.chatMessage.findMany({
        where: {
          threadId: c.req.param('threadId')!,
          lifecycleStatus: 'COMPLETED',
          thread: { participantId: participant, chatbotId: id },
        },
        include: {
          attachments: {
            where: { imageBase64: { not: null } },
            orderBy: { position: 'asc' },
          },
        },
        orderBy: { createdAt: 'asc' },
      })
      return c.json(
        messages.map(
          ({
            attachments,
            creditsUsed,
            lifecycleStatus: _status,
            lifecycleAttemptId: _attempt,
            ...message
          }) => ({
            ...message,
            creditsUsed: creditsUsed?.toNumber() ?? null,
            imageAttachments: attachments.map((image) => ({
              id: image.id,
              type: 'image',
              position: image.position,
              imagePreviewBase64: image.imagePreviewBase64,
              imageDescription: image.imageDescription,
              hasFullImage: image.imageBase64 !== null,
            })),
          })
        )
      )
    })
  )
  app.get(
    '/api/chatbots/:chatbotId/threads/:threadId/messages/:messageId/attachments',
    participantRoute(async (c, participant, id) => {
      const message = await prisma.chatMessage.findFirst({
        where: {
          id: c.req.param('messageId')!,
          threadId: c.req.param('threadId')!,
          thread: { participantId: participant, chatbotId: id },
        },
        include: {
          attachments: {
            where: { imageBase64: { not: null } },
            orderBy: { position: 'asc' },
          },
        },
      })
      if (!message || message.attachments.length === 0)
        return c.json({ error: 'Message attachments not found' }, 404)
      return c.json(
        message.attachments.map((image) => ({
          id: image.id,
          type: 'image',
          position: image.position,
          imageBase64: image.imageBase64,
          imagePreviewBase64: image.imagePreviewBase64,
          imageDescription: image.imageDescription,
          hasFullImage: true,
        }))
      )
    })
  )
  app.post(
    '/api/chatbots/:chatbotId/threads/:threadId/messages/:messageId/feedback',
    participantRoute(async (c, participant, id) => {
      const parsed = z
        .object({ rating: z.nativeEnum(ChatMessageRating).nullable() })
        .safeParse(await c.req.json())
      if (!parsed.success) return c.json({ error: 'Invalid rating' }, 400)
      const message = await prisma.chatMessage.findFirst({
        where: {
          id: c.req.param('messageId')!,
          threadId: c.req.param('threadId')!,
          role: 'assistant',
          thread: { participantId: participant, chatbotId: id },
        },
        select: { id: true },
      })
      if (!message) return c.json({ error: 'Message not found' }, 404)
      await prisma.chatMessage.update({
        where: { id: message.id },
        data: { rating: parsed.data.rating },
      })
      return c.json({ rating: parsed.data.rating })
    })
  )

  app.get('/health', (c) =>
    c.json({
      ok: true,
      service: 'chat-api',
      contractVersion: CHAT_ENGINE_CONTRACT_VERSION,
    })
  )

  app.get('/ready', async (c) => {
    const state = await readiness.get()
    return c.json(
      {
        ok: state.ok,
        generation: state.ok ? 'ready' : 'degraded',
        contractVersion: state.contractVersion,
        engineId: state.engineId,
        reason: state.reason,
      },
      state.ok ? 200 : 503
    )
  })

  app.post(
    '/api/chatbots/:chatbotId/chat',
    bodyLimit({
      maxSize: MAX_BODY_BYTES,
      onError: (c) =>
        c.json(
          { error: 'Request body too large', code: 'BODY_TOO_LARGE' },
          413
        ),
    }),
    async (c) => {
      const chatbotId = c.req.param('chatbotId')
      const auth = await dependencies.authenticate(
        getCookie(c, 'participant_token'),
        chatbotId
      )
      if (isFailure(auth)) return c.json({ error: auth.error }, auth.status)

      const chatbot = await dependencies.getChatbot(chatbotId)
      if (!chatbot) return c.json({ error: 'Chatbot not found' }, 404)
      if (!chatbot.owner.aiFeaturesEnabled)
        return c.json(
          { code: 'AI_FEATURES_DISABLED', error: 'AI usage is not authorized' },
          403
        )

      let input: z.infer<typeof bodySchema>
      try {
        input = bodySchema.parse(await c.req.json())
      } catch {
        return c.json(
          { error: 'Invalid request body', code: 'INVALID_REQUEST' },
          400
        )
      }

      if (input.documentPages.length > 0 || input.handoffSource !== undefined)
        return c.json({ code: 'UNSUPPORTED_REQUEST_CAPABILITY' }, 400)
      const modes = resolveEffectiveChatModeOptions(
        chatbot.systemPrompts,
        chatbot.mcpConfigurations,
        chatbot.standardModeConfig
      )
      const mode = resolveRequestedChatMode(modes, input.selectedMode)
      if (!Object.hasOwn(modes, mode))
        return c.json({ code: 'MODE_NOT_AVAILABLE' }, 400)
      input.selectedMode = mode
      // The Python-only pilot cannot silently omit an existing course tool.
      if (
        resolveEffectiveMCPConfigurations(chatbot.mcpConfigurations, mode)
          .length > 0
      )
        return c.json({ code: 'COURSE_TOOLS_NOT_SUPPORTED' }, 503)
      const lastMessage = input.messages[input.messages.length - 1]
      if (lastMessage?.role !== 'user') {
        return c.json(
          {
            error: 'The final message must be from the user',
            code: 'INVALID_MESSAGE_ORDER',
          },
          400
        )
      }

      const disclaimer = await dependencies.checkDisclaimer(
        auth.participantId,
        chatbotId
      )
      if (disclaimer.required && !disclaimer.accepted) {
        const error = jsonError(
          'Disclaimer must be accepted before using the chatbot',
          'DISCLAIMER_NOT_ACCEPTED',
          403
        )
        return c.json({ error: error.error, code: error.code }, error.status)
      }

      const thread = await dependencies.getThread(
        input.threadId,
        auth.participantId,
        chatbotId
      )
      if (!thread) {
        const error = jsonError('Thread not found', 'THREAD_REQUIRED', 404)
        return c.json({ error: error.error, code: error.code }, error.status)
      }

      const credits = await dependencies.getCredits(
        auth.participantId,
        chatbotId
      )
      const registry = getChatModelRegistry()
      let selectedModel = input.selectedModel
      if (!chatbot.modelSelection) {
        selectedModel = getAutomaticModelId(chatbot.allowedModelIds) ?? ''
      }
      let model = registry.find((candidate) => candidate.id === selectedModel)
      if (!model) {
        return c.json(
          { error: `Unknown model: ${selectedModel}`, code: 'UNKNOWN_MODEL' },
          400
        )
      }
      const allowedIds =
        chatbot.allowedModelIds.length > 0
          ? new Set(chatbot.allowedModelIds)
          : null
      const hasActiveAllowedModel =
        allowedIds === null ||
        registry.some((candidate) => allowedIds.has(candidate.id))
      const automaticModel = !chatbot.modelSelection
        ? getAutomaticModelId(chatbot.allowedModelIds)
        : null
      if (
        allowedIds &&
        !allowedIds.has(model.id) &&
        model.id !== automaticModel &&
        (hasActiveAllowedModel || model.id !== getParticipantFallbackModelId())
      ) {
        return c.json(
          {
            error: 'Model not available for this chatbot',
            code: 'MODEL_NOT_ALLOWED',
          },
          400
        )
      }
      if (credits.current <= 0 && !model.fallback) {
        selectedModel = getParticipantFallbackModelId() ?? ''
        model = registry.find((candidate) => candidate.id === selectedModel)
        if (!model)
          return c.json(
            {
              error: 'No fallback model is configured',
              code: 'FALLBACK_MODEL_MISSING',
            },
            503
          )
      }

      if (
        isChatAccountUsageEnforcementEnabled() &&
        !(await dependencies.isChatAccountUsageAvailable({
          ownerId: chatbot.ownerId,
          usageClass: model.usageClass,
        }))
      )
        return c.json(
          {
            code:
              model.usageClass === 'BASE'
                ? 'CHAT_MODEL_UNAVAILABLE_BASE'
                : 'CHAT_MODEL_UNAVAILABLE_ADVANCED',
          },
          403
        )
      const allowedReasoning = getAllowedReasoningEffortsForModel(
        model,
        chatbot.allowedReasoningEffortsByModel
      )
      const appliedReasoningEffort =
        allowedReasoning.length === 0
          ? null
          : allowedReasoning.includes(input.reasoningEffort)
            ? input.reasoningEffort
            : defaultReasoningEffort(allowedReasoning)

      let credential: ReturnType<typeof resolveCredentialMode>
      try {
        credential = resolveCredentialMode(
          chatbot,
          model,
          providerAllowedOrigins
        )
      } catch {
        return c.json(
          {
            error: 'The selected provider is not configured',
            code: 'PROVIDER_NOT_CONFIGURED',
          },
          503
        )
      }
      const generation = withReasoning(
        credential.generation,
        appliedReasoningEffort
      )
      const images = (() => {
        try {
          return toImageAttachments(input.images)
        } catch {
          return null
        }
      })()
      if (!images)
        return c.json(
          { error: 'Invalid image attachment', code: 'INVALID_IMAGE' },
          400
        )

      const engineReady = await readiness.get()
      if (!engineReady.ok) {
        return c.json(
          {
            error: 'Chat generation is temporarily unavailable',
            code: 'ENGINE_UNAVAILABLE',
          },
          503
        )
      }

      const userMessageId = lastMessage.id
      const runId = randomUUID()
      const toolAuthorization = dependencies.authorizeTools
        ? await dependencies.authorizeTools({
            chatbot,
            mode: input.selectedMode,
            participantId: auth.participantId,
            runId,
          })
        : null
      if (
        toolAuthorization &&
        (toolAuthorization.tools.length === 0 ||
          toolAuthorization.executionToken.length === 0)
      ) {
        return c.json(
          {
            error: 'MCP execution is not configured',
            code: 'MCP_EXECUTION_NOT_CONFIGURED',
          },
          503
        )
      }
      const tools = toolAuthorization?.tools ?? []
      if (
        (images.length > 0 && !engineReady.features?.images) ||
        (tools.length > 0 && !engineReady.features?.tools)
      )
        return c.json({ code: 'ENGINE_CAPABILITY_UNAVAILABLE' }, 503)
      const engineMessages = await dependencies.loadEngineMessages(
        input.threadId,
        input.messages,
        images
      )
      const requestId = randomUUID()
      const assistantMessageId = input.assistantMessageId
      const traceContext = traceContextForRequest(c.req.raw, assistantMessageId)
      const engineRequest: EngineChatRequest = {
        contractVersion: CHAT_ENGINE_CONTRACT_VERSION,
        requestId,
        participantId: auth.participantId,
        courseId: chatbot.courseId,
        chatbotId,
        threadId: input.threadId,
        userMessageId,
        assistantMessageId,
        runId,
        locale:
          input.locale ??
          c.req
            .header('accept-language')
            ?.split(',')
            .map((entry) => entry.split(';')[0]?.trim())
            .find(
              (entry) =>
                entry &&
                /^[a-z]{2,3}(?:-[a-z0-9]{2,8})*$/i.test(entry) &&
                entry.length <= 16
            ) ??
          'en',
        systemPrompt: getSystemPrompt(chatbot, input.selectedMode, {
          toolNames: tools.map((tool) => tool.name),
          answerStyle: chatbot.answerPreferencesEnabled
            ? input.answerStyle
            : DEFAULT_ANSWER_STYLE,
          answerTone: chatbot.answerPreferencesEnabled
            ? input.answerTone
            : DEFAULT_ANSWER_TONE,
        }),
        generation,
        messages: engineMessages,
        tools,
      }
      try {
        engineChatRequestSchema.parse(engineRequest)
      } catch {
        return c.json(
          {
            error: 'The adapted engine request is invalid',
            code: 'INVALID_ENGINE_REQUEST',
          },
          400
        )
      }

      let claim: Awaited<ReturnType<typeof claimChatTurn>>
      try {
        claim = await dependencies.claimChatTurn({
          ownerId: chatbot.ownerId,
          chatbotId,
          threadId: input.threadId,
          assistantMessageId,
          parentId: userMessageId,
          allowRegeneration: input.allowRegeneration,
        })
      } catch (error) {
        if (error instanceof ChatTurnConflictError)
          return c.json({ code: 'CHAT_TURN_ALREADY_COMPLETED' }, 409)
        throw error
      }
      if (claim.outcome !== 'claimed')
        return c.json(
          {
            code:
              claim.outcome === 'completed'
                ? 'CHAT_TURN_ALREADY_COMPLETED'
                : 'CHAT_TURN_IN_PROGRESS',
          },
          409
        )
      const failClaim = () =>
        dependencies.failChatTurn({
          assistantMessageId,
          threadId: input.threadId,
          lifecycleAttemptId: claim.lifecycleAttemptId,
        })
      try {
        await dependencies.persistUserMessage({
          threadId: input.threadId,
          messageId: userMessageId,
          parentId: input.parentId ?? null,
          content: lastMessage.content,
          chatMode: input.selectedMode,
          modelId: model.id,
          reasoningEffort: appliedReasoningEffort,
          attachments: images,
        })
      } catch {
        await failClaim()
        return c.json({ code: 'MESSAGE_PERSISTENCE_FAILED' }, 500)
      }

      const engineAbort = new AbortController()
      const abortIncomingEngine = () => engineAbort.abort()
      c.req.raw.signal.addEventListener('abort', abortIncomingEngine, {
        once: true,
      })
      if (c.req.raw.signal.aborted) engineAbort.abort()
      let engineResponse: Response
      try {
        engineResponse = await dependencies.engine.chat(engineRequest, {
          providerAuthorization: credential.providerAuthorization,
          mcpExecutionToken: toolAuthorization?.executionToken,
          traceContext,
          signal: engineAbort.signal,
        })
      } catch {
        abortIncomingEngine()
        c.req.raw.signal.removeEventListener('abort', abortIncomingEngine)
        await failClaim()
        return c.json(
          {
            error: 'The selected chat engine failed before streaming',
            code: 'ENGINE_REQUEST_FAILED',
          },
          503
        )
      }

      try {
        await dependencies.persistUserMessage({
          threadId: input.threadId,
          messageId: userMessageId,
          parentId: input.parentId ?? null,
          content: lastMessage.content,
          chatMode: input.selectedMode,
          modelId: model.id,
          reasoningEffort: appliedReasoningEffort,
          attachments: images,
        })
      } catch {
        abortIncomingEngine()
        c.req.raw.signal.removeEventListener('abort', abortIncomingEngine)
        await engineResponse.body?.cancel().catch(() => undefined)
        return c.json(
          {
            error: 'The user message could not be persisted',
            code: 'MESSAGE_PERSISTENCE_FAILED',
          },
          500
        )
      }

      const stream = createValidatedPlatformStream(engineResponse, {
        onCancel: abortIncomingEngine,
        expected: {
          assistantMessageId,
          engineId: engineReady.engineId ?? undefined,
          toolNames: tools.map((tool) => tool.name),
          runId: engineRequest.runId,
          modelId: model.id,
          deploymentId: model.deploymentId,
        },
        metadata: (state): PlatformMetadata => ({
          chatMode: input.selectedMode,
          modelId: model.id,
          reasoningEffort: appliedReasoningEffort,
          userMessageId,
          assistantMessageId,
          creditsUsed: null,
          finalPersistenceStatus:
            state.status === 'streaming' ? 'not-applicable' : 'not-persisted',
        }),
        finalize: async (state) => {
          c.req.raw.signal.removeEventListener('abort', abortIncomingEngine)
          try {
            const usage = usageIsChargeable(state.usage) ? state.usage : null
            const creditsUsed = usage
              ? calculateCost(
                  model.cost,
                  usage.inputTokens!,
                  usage.outputTokens!
                )
              : null
            const content =
              state.status === 'aborted'
                ? [
                    ...state.parts,
                    { type: 'data', name: 'chat-stopped', data: {} },
                  ]
                : state.parts
            const result =
              content.length > 0
                ? await dependencies.finalizeAssistantTurn({
                    ownerId: chatbot.ownerId,
                    usageClass: model.usageClass,
                    lifecycleAttemptId: claim.lifecycleAttemptId,
                    participantId: auth.participantId,
                    chatbotId,
                    threadId: input.threadId,
                    assistantMessageId,
                    userMessageId,
                    chatMode: input.selectedMode,
                    modelId: model.id,
                    reasoningEffort: appliedReasoningEffort,
                    reasoningContent:
                      state.engineMetadata?.reasoningContent ??
                      (state.reasoning || null),
                    content,
                    creditsUsed,
                  })
                : { persisted: false, creditsUsed: null }
            if (!result.persisted) await failClaim()
            return {
              creditsUsed: result.persisted
                ? result.creditsUsed === undefined
                  ? creditsUsed
                  : result.creditsUsed
                : null,
              finalPersistenceStatus: result.persisted
                ? 'persisted'
                : 'not-persisted',
            }
          } catch {
            await failClaim()
            return {
              creditsUsed: null,
              finalPersistenceStatus: 'not-persisted',
            }
          }
        },
      })

      return new Response(stream, {
        status: 200,
        headers: {
          'content-type': 'text/event-stream; charset=utf-8',
          'cache-control': 'no-cache, no-transform',
          connection: 'keep-alive',
        },
      })
    }
  )

  return app
}

export const app = createChatApiApp()
