import { createHash, randomUUID } from 'node:crypto'
import {
  CHAT_ENGINE_CONTRACT_V2,
  CHAT_ENGINE_MAX_V2_REQUEST_BYTES,
  type EngineV2ChatRequest,
  engineV2ChatRequestSchema,
  type ImageAttachment,
  imageAttachmentSchema,
  parseProviderAllowedOrigins,
  providerOriginIsAllowed,
} from '@klicker-uzh/chat-engine-contract'
import { prisma } from '@klicker-uzh/prisma'
import { ChatMessageRating, type Prisma } from '@klicker-uzh/prisma/client'
import { isChatUsageClassEntitled, safeDecrypt } from '@klicker-uzh/util'
import { extractBearerToken } from '@klicker-uzh/util/auth'
import { type Context, Hono } from 'hono'
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
  buildHistoryAttachmentDto,
  IMAGE_ROW_FILTER,
} from './host/lib/attachments/attachmentState.js'
import {
  DEFAULT_ANSWER_STYLE,
  DEFAULT_ANSWER_TONE,
} from './host/lib/config/answerStyles.js'
import { DEFAULT_PROMPT } from './host/lib/config/prompts.js'
import { PWA_CHAT_EMBED_SESSION_COOKIE } from './host/lib/pwaEmbedAuth.js'
import {
  answerStyleSchema,
  answerToneSchema,
} from './host/lib/server/answerStyleInstructions.js'
import type { AuthMode } from './host/lib/server/chatGuestToken.js'
import { getModelsForChatbot } from './host/lib/server/chatModelRegistry.js'
import {
  getCustomModeTurnSettings,
  isParticipantReasoningVisible,
  resolveEffectiveChatModeOptions,
  resolveRequestedChatMode,
} from './host/lib/server/effectiveChatModes.js'
import { trailingStepMessage } from './host/lib/server/feedbackEvidence.js'
import {
  formatMeetingClock,
  replyLanguageReminder,
} from './host/lib/server/languageInstructions.js'
import { getOpenAIResponsesStore } from './host/lib/server/openaiResponsesOptions.js'
import { withoutReasoningParts } from './host/lib/server/persistedAssistantContent.js'
import { providerRefusalDeflection } from './host/lib/server/providerRefusal.js'
import { isDocQueryToolName } from './host/lib/sources/normalizeSources.js'
import {
  ChatTurnConflictError,
  claimChatTurn,
  failChatTurn,
  isChatAccountUsageAvailable,
  isChatAccountUsageEnforcementEnabled,
} from './host/services/accountUsage.js'
import { DisclaimersService } from './host/services/disclaimers.js'
import { ThreadService } from './host/services/threads.js'
import { getNextResetTime } from './host/utils/creditPeriods.js'
import {
  type ChatModelConfig,
  calculateCost,
  getAllowedReasoningEffortsForModel,
  getAutomaticModelId,
  getChatModelRegistry,
  getParticipantFallbackModelId,
  selectReplyContext,
} from './policy/modelRegistry.js'
import {
  type AuthFailure,
  authenticateParticipant,
  type ChatTransportTokens,
  getChatbotOr404,
  isFailure,
} from './runtime/auth.js'
import { createCodeApiAuthorization } from './runtime/codeapi.js'
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
  loadTurnContext,
  persistUserMessage,
  prepareAttachmentContext,
  previewCredits,
} from './runtime/defaultDependencies.js'
import {
  createHostToolDispatcher,
  type HostToolInput,
  type HostToolSession,
  type HostToolSet,
  prepareHostTools,
  projectHistoricalToolResults,
} from './runtime/mcp.js'

const MAX_BODY_BYTES = CHAT_ENGINE_MAX_V2_REQUEST_BYTES

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
        content: z.string().max(1_000_000),
      })
    )
    .min(1)
    .max(500),
  threadId: z.string().min(1).max(128),
  selectedModel: z.string().min(1).max(128),
  selectedMode: z.string().min(1).max(64).default('tutor'),
  reasoningEffort: z.string().min(1).max(32).default('none'),
  parentId: z.string().min(1).max(128).nullable().optional(),
  assistantMessageId: z.string().min(1).max(128),
  locale: z.string().min(2).max(16).optional(),
  images: z.array(imageInputSchema).max(3).default([]),
  documentPages: z
    .array(
      z
        .string()
        .max(2_000_000)
        .regex(/^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/)
    )
    .max(10)
    .default([]),
  handoffSource: z.literal('askuzh').optional(),
  chatContext: z.unknown().optional(),
  sourceMessageId: z.string().min(1).max(128).optional(),
  answerStyle: answerStyleSchema,
  answerTone: answerToneSchema,
  allowRegeneration: z.boolean().default(false),
})

export type ChatApiDependencies = {
  getMeetingClockStart: (threadId: string) => Promise<Date | null>
  prepareAttachmentContext: typeof prepareAttachmentContext
  prepareTools: (input: HostToolInput) => Promise<HostToolSet>
  claimChatTurn: typeof claimChatTurn
  failChatTurn: typeof failChatTurn
  isChatAccountUsageAvailable: typeof isChatAccountUsageAvailable
  authenticate: (
    tokens: ChatTransportTokens,
    chatbotId: string
  ) => Promise<
    | {
        participantId: string
        courseId: string
        authMode?: AuthMode
        learnerBinding?: string
      }
    | AuthFailure
  >
  getChatbot: (chatbotId: string) => Promise<ChatbotRecord | null>
  checkDisclaimer: (
    participantId: string,
    chatbotId: string
  ) => Promise<{ required: boolean; accepted: boolean }>
  previewCredits: typeof previewCredits
  getCredits: (
    participantId: string,
    chatbotId: string
  ) => Promise<{ current: number; total: number }>
  getThread: (
    threadId: string,
    participantId: string,
    chatbotId: string
  ) => Promise<{ id: string; origin?: string | null } | null>
  loadTurnContext: typeof loadTurnContext
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
    learningContext?: Prisma.InputJsonValue | null
    documentPageSummary?: string | null
    imagePreviews?: Array<string | null>
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
    tools: EngineV2ChatRequest['tools']
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
  generation: EngineV2ChatRequest['generation']
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
        providerApi: model.usesResponsesApi ? 'responses' : 'chat',
        ...(model.maxOutputTokens
          ? { maxOutputTokens: model.maxOutputTokens }
          : {}),
        reasoningEffort: 'none',
        reasoningSummary: 'none',
        responseStorage: model.usesResponsesApi && getOpenAIResponsesStore(),
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
      providerApi: model.usesResponsesApi ? 'responses' : 'chat',
      ...(model.maxOutputTokens
        ? { maxOutputTokens: model.maxOutputTokens }
        : {}),
      reasoningEffort: 'none',
      reasoningSummary: 'none',
      responseStorage: model.usesResponsesApi && getOpenAIResponsesStore(),
      credentialMode: { mode: 'gateway', gatewayOrigin: providerBaseUrl },
    },
    providerAuthorization: `Bearer ${providerApiKey}`,
  }
}

function withReasoning(
  generation: EngineV2ChatRequest['generation'],
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
  const engine =
    overrides.engine ??
    createEngineClient({ contractVersion: CHAT_ENGINE_CONTRACT_V2 })
  const dependencies: ChatApiDependencies = {
    getMeetingClockStart: async (threadId) =>
      (
        await prisma.chatMessage.findFirst({
          where: { threadId, role: 'user', lifecycleStatus: 'COMPLETED' },
          orderBy: { createdAt: 'asc' },
          select: { createdAt: true },
        })
      )?.createdAt ?? null,
    authenticate: authenticateParticipant,
    prepareTools: prepareHostTools,
    claimChatTurn,
    failChatTurn,
    isChatAccountUsageAvailable,
    authorizeTools: createCodeApiAuthorization(),
    getChatbot,
    checkDisclaimer,
    getCredits,
    previewCredits,
    getThread,
    loadEngineMessages,
    loadTurnContext,
    persistUserMessage,
    prepareAttachmentContext,
    finalizeAssistantTurn,
    engine,
    ...overrides,
  }
  const readiness =
    overrides.readiness ??
    new EngineReadinessProbe(
      engine,
      15_000,
      5_000,
      process.env.CHAT_ENGINE_ID,
      CHAT_ENGINE_CONTRACT_V2
    )
  const app = new Hono()
  const toolDispatcher = createHostToolDispatcher()
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
        'Content-Type, Authorization, Traceparent, Tracestate'
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
        chatbotId: string,
        identity: { learnerBinding?: string }
      ) => Promise<Response>
    ) =>
    async (c: Context) => {
      const chatbotId = c.req.param('chatbotId')!
      const auth = await dependencies.authenticate(
        {
          participantToken: getCookie(c, 'participant_token'),
          chatGuestToken: getCookie(c, 'chat_participant_token'),
          pwaEmbedToken: getCookie(c, PWA_CHAT_EMBED_SESSION_COOKIE),
          scopedFallbackToken:
            extractBearerToken(c.req.header('authorization') ?? null) ??
            undefined,
        },
        chatbotId
      )
      if (isFailure(auth)) return c.json({ error: auth.error }, auth.status)
      c.header('cache-control', 'private, no-store')
      return handler(c, auth.participantId, chatbotId, auth)
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
          bot.standardModeConfig,
          { customModeConfig: bot.customModeConfig }
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
    participantRoute(async (c, participant, id, identity) => {
      const parsed = z
        .object({ title: z.string().max(200).nullable().optional() })
        .safeParse(await c.req.json())
      if (!parsed.success) return c.json({ error: 'Invalid thread' }, 400)
      return c.json(
        await ThreadService.createThread(
          participant,
          id,
          parsed.data.title,
          undefined,
          identity.learnerBinding ? 'elearning' : undefined
        )
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
        .object({ title: z.string().max(200) })
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
      const chatbot = await dependencies.getChatbot(id)
      const messages = await prisma.chatMessage.findMany({
        where: {
          threadId: c.req.param('threadId')!,
          lifecycleStatus: 'COMPLETED',
          thread: { participantId: participant, chatbotId: id },
        },
        include: {
          attachments: {
            where: IMAGE_ROW_FILTER,
            orderBy: { position: 'asc' },
          },
        },
        orderBy: { createdAt: 'asc' },
      })
      return c.json(
        messages.map((message) => {
          const showReasoning = isParticipantReasoningVisible(
            chatbot?.customModeConfig,
            message.chatMode
          )
          return {
            id: message.id,
            threadId: message.threadId,
            role: message.role,
            content: showReasoning
              ? message.content
              : withoutReasoningParts(message.content),
            chatMode: message.chatMode ?? null,
            modelId: message.modelId ?? null,
            reasoningEffort: message.reasoningEffort ?? null,
            reasoningContent: showReasoning
              ? (message.reasoningContent ?? null)
              : null,
            learningContext: message.learningContext ?? null,
            rating: message.rating ?? null,
            creditsUsed: message.creditsUsed?.toNumber() ?? null,
            imageAttachments: message.attachments.map(
              buildHistoryAttachmentDto
            ),
            parentId: message.parentId || null,
            createdAt: message.createdAt.toISOString(),
            updatedAt: message.updatedAt.toISOString(),
          }
        })
      )
    })
  )
  app.get(
    '/api/chatbots/:chatbotId/threads/:threadId/messages/:messageId/attachments',
    participantRoute(async (c, participant, id) => {
      c.header('Cache-Control', 'private, no-store')
      const message = await prisma.chatMessage.findFirst({
        where: {
          id: c.req.param('messageId')!,
          threadId: c.req.param('threadId')!,
          thread: { participantId: participant, chatbotId: id },
        },
        include: {
          attachments: {
            where: IMAGE_ROW_FILTER,
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

  app.post(
    '/v2/tools/execute',
    async (c, next) => {
      const token =
        extractBearerToken(c.req.header('authorization') ?? null) ?? undefined
      if (!toolDispatcher.isAuthorized(token))
        return c.json({ code: 'UNAUTHORIZED' }, 401)
      await next()
    },
    bodyLimit({
      maxSize: 1024 * 1024,
      onError: (c) => c.json({ code: 'BODY_TOO_LARGE' }, 413),
    }),
    async (c) => {
      try {
        const token =
          extractBearerToken(c.req.header('authorization') ?? null) ?? undefined
        const result = await toolDispatcher.execute(
          token,
          await c.req.json(),
          c.req.raw.signal
        )
        return result ? c.json(result) : c.json({ code: 'UNAUTHORIZED' }, 401)
      } catch {
        return c.json({ code: 'TOOL_EXECUTION_FAILED' }, 400)
      }
    }
  )

  app.get('/health', (c) =>
    c.json({
      ok: true,
      service: 'chat-api',
      contractVersion: CHAT_ENGINE_CONTRACT_V2,
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
      let hostTools: HostToolSet | undefined
      let hostToolSession: HostToolSession | undefined
      let streamStarted = false
      let releaseUnstartedClaim: (() => Promise<void>) | undefined
      const engineAbort = new AbortController()
      const abortIncomingEngine = () => engineAbort.abort()
      c.req.raw.signal.addEventListener('abort', abortIncomingEngine, {
        once: true,
      })
      if (c.req.raw.signal.aborted) engineAbort.abort()
      try {
        const chatbotId = c.req.param('chatbotId')
        const auth = await dependencies.authenticate(
          {
            participantToken: getCookie(c, 'participant_token'),
            chatGuestToken: getCookie(c, 'chat_participant_token'),
            pwaEmbedToken: getCookie(c, PWA_CHAT_EMBED_SESSION_COOKIE),
            scopedFallbackToken:
              extractBearerToken(c.req.header('authorization') ?? null) ??
              undefined,
          },
          chatbotId
        )
        if (isFailure(auth)) return c.json({ error: auth.error }, auth.status)

        const chatbot = await dependencies.getChatbot(chatbotId)
        if (!chatbot) return c.json({ error: 'Chatbot not found' }, 404)
        if (!chatbot.owner.aiFeaturesEnabled)
          return c.json(
            {
              code: 'AI_FEATURES_DISABLED',
              error: 'AI usage is not authorized',
            },
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

        const modes = resolveEffectiveChatModeOptions(
          chatbot.systemPrompts,
          chatbot.mcpConfigurations,
          chatbot.standardModeConfig,
          { customModeConfig: chatbot.customModeConfig }
        )
        const mode = resolveRequestedChatMode(modes, input.selectedMode)
        if (!Object.hasOwn(modes, mode))
          return c.json({ code: 'MODE_NOT_AVAILABLE' }, 400)
        input.selectedMode = mode
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

        const turnContext = await dependencies.loadTurnContext({
          chatbotId,
          courseId: chatbot.courseId,
          threadId: input.threadId,
          origin: thread.origin,
          learnerBinding: auth.learnerBinding,
          rawContext: input.chatContext,
          userMessageId: lastMessage.id,
          sourceMessageId: input.sourceMessageId,
          messages: input.messages,
        })
        if ('error' in turnContext)
          return c.json({ code: turnContext.error }, 400)

        const credits = await dependencies.previewCredits(
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
          (hasActiveAllowedModel ||
            model.id !== getParticipantFallbackModelId())
        ) {
          return c.json(
            {
              error: 'Model not available for this chatbot',
              code: 'MODEL_NOT_ALLOWED',
            },
            400
          )
        }
        if (auth.authMode === 'anonymous' && !model.fallback) {
          const fallback = getModelsForChatbot(chatbot).find(
            (candidate) => candidate.fallback
          )
          if (!fallback)
            return c.json({ code: 'CHAT_MODEL_UNAVAILABLE_BASE' }, 503)
          model = fallback
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
          !isChatUsageClassEntitled({
            usageClass: model.usageClass,
            aiFeaturesEnabled: chatbot.owner.aiFeaturesEnabled,
            aiSubscriptionTier: chatbot.owner.aiSubscriptionTier,
            aiChatbotCostCenter: chatbot.owner.aiChatbotCostCenter,
          })
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
        if (!model.fallback) {
          const currentCredits = await dependencies.getCredits(
            auth.participantId,
            chatbotId
          )
          if (currentCredits.current <= 0) {
            const fallback = registry.find(
              (candidate) => candidate.id === getParticipantFallbackModelId()
            )
            if (!fallback)
              return c.json({ code: 'CHAT_MODEL_UNAVAILABLE_BASE' }, 503)
            model = fallback
            if (
              isChatAccountUsageEnforcementEnabled() &&
              !(await dependencies.isChatAccountUsageAvailable({
                ownerId: chatbot.ownerId,
                usageClass: model.usageClass,
              }))
            )
              return c.json({ code: 'CHAT_MODEL_UNAVAILABLE_BASE' }, 403)
          }
        }
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
        const pythonAuthorization = dependencies.authorizeTools
          ? await dependencies.authorizeTools({
              chatbot,
              mode: input.selectedMode,
              participantId: auth.participantId,
              runId,
            })
          : null
        if (
          pythonAuthorization &&
          (pythonAuthorization.tools.length === 0 ||
            pythonAuthorization.executionToken.length === 0)
        ) {
          return c.json(
            {
              error: 'MCP execution is not configured',
              code: 'MCP_EXECUTION_NOT_CONFIGURED',
            },
            503
          )
        }
        let engineMessages: Awaited<
          ReturnType<typeof dependencies.loadEngineMessages>
        >
        try {
          engineMessages = await dependencies.loadEngineMessages(
            input.threadId,
            input.messages,
            images
          )
        } catch {
          return c.json({ code: 'INVALID_CHAT_HISTORY' }, 400)
        }
        const assistantMessageId = input.assistantMessageId
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
        let claimFailure: Promise<void> | undefined
        const failClaim = () =>
          (claimFailure ??= dependencies.failChatTurn({
            assistantMessageId,
            threadId: input.threadId,
            lifecycleAttemptId: claim.lifecycleAttemptId,
          }))
        releaseUnstartedClaim = failClaim
        try {
          hostTools = await dependencies.prepareTools({
            chatbot,
            mode: input.selectedMode,
            participantId: auth.participantId,
            authMode: auth.authMode ?? 'account',
            runId,
            threadId: input.threadId,
            messages: input.messages,
            isElearningThread: thread.origin === 'elearning',
          })
          hostToolSession = await toolDispatcher.register({
            tools: hostTools,
            signal: engineAbort.signal,
            python: pythonAuthorization,
            executePython: async (body, token, signal) => {
              const endpoint = process.env.CHAT_CODEAPI_EXECUTION_URL
              if (!endpoint)
                throw new Error('Python execution is not configured')
              const url = new URL(endpoint)
              if (
                !['http:', 'https:'].includes(url.protocol) ||
                url.username ||
                url.password ||
                url.search ||
                url.hash
              )
                throw new Error('Python execution destination is invalid')
              const response = await fetch(url, {
                method: 'POST',
                headers: {
                  'content-type': 'application/json',
                  authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                  serverId: body.serverId,
                  toolName: body.toolName,
                  input: body.input,
                }),
                redirect: 'error',
                signal,
              })
              if (!response.ok) throw new Error('Python execution failed')
              return response.json()
            },
          })
        } catch {
          return c.json({ code: 'REQUIRED_MCP_UNAVAILABLE' }, 503)
        }
        const tools = hostToolSession.tools
        if (
          (images.length > 0 && !engineReady.features?.images) ||
          (tools.length > 0 && !engineReady.features?.tools)
        )
          return c.json({ code: 'ENGINE_CAPABILITY_UNAVAILABLE' }, 503)
        try {
          engineMessages = await projectHistoricalToolResults(
            engineMessages,
            hostTools.tools
          )
        } catch {
          return c.json({ code: 'INVALID_CHAT_HISTORY' }, 400)
        }
        const currentMessage = engineMessages.at(-1)
        if (currentMessage) {
          for (const [index, page] of input.documentPages.entries())
            currentMessage.parts.push({
              id: `document-page-${index + 1}`,
              type: 'image',
              source: 'document-page',
              mediaType: 'image/jpeg',
              dataUrl: page,
            })
        }
        const requestId = randomUUID()
        const traceContext = traceContextForRequest(
          c.req.raw,
          assistantMessageId
        )
        const turnSettings = getCustomModeTurnSettings(
          chatbot.customModeConfig,
          input.selectedMode
        )
        const turnStartedAt = new Date()
        const meetingClockStartedAt = turnSettings.meetingClock
          ? ((await dependencies.getMeetingClockStart(input.threadId)) ??
            turnStartedAt)
          : null
        const stepReminder = trailingStepMessage(
          input.selectedMode,
          input.messages,
          replyLanguageReminder(
            turnSettings.replyLanguage ?? null,
            formatMeetingClock(
              turnSettings.meetingClock ?? null,
              meetingClockStartedAt,
              turnStartedAt
            )
          )
        )
        const firstToolName = Object.hasOwn(DEFAULT_PROMPT, input.selectedMode)
          ? tools.find((tool) => isDocQueryToolName(tool.name))?.name
          : undefined
        const engineRequest: EngineV2ChatRequest = {
          contractVersion: CHAT_ENGINE_CONTRACT_V2,
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
            toolNames: hostTools.promptToolNames,
            answerStyle: chatbot.answerPreferencesEnabled
              ? input.answerStyle
              : DEFAULT_ANSWER_STYLE,
            answerTone: chatbot.answerPreferencesEnabled
              ? input.answerTone
              : DEFAULT_ANSWER_TONE,
          }),
          generation,
          stepPolicy: {
            ...(firstToolName ? { firstToolName } : {}),
            trailingSystemMessage: stepReminder.content,
            unbilledReplyReplacement: providerRefusalDeflection(
              turnSettings.replyLanguage ?? null,
              input.locale ?? getCookie(c, 'NEXT_LOCALE')
            ),
          },
          messages: engineMessages,
          tools,
        }
        engineRequest.systemPrompt += turnContext.prompt
          ? `\n\n${turnContext.prompt}`
          : ''
        engineRequest.systemPrompt += hostTools.promptContext
          ? `\n\n${hostTools.promptContext}`
          : ''
        const context = selectReplyContext(engineMessages, {
          maxInputTokens: model.maxInputTokens ?? 128_000,
          systemPrompt: `${engineRequest.systemPrompt}\n\n${stepReminder.content}`,
          tools: engineRequest.tools,
          maxOutputTokens: model.maxOutputTokens,
        })
        if (!context) return c.json({ code: 'CONTEXT_LIMIT_EXCEEDED' }, 400)
        engineRequest.messages = context.messages
        try {
          engineV2ChatRequestSchema.parse(engineRequest)
        } catch {
          return c.json(
            {
              error: 'The adapted engine request is invalid',
              code: 'INVALID_ENGINE_REQUEST',
            },
            400
          )
        }

        const persistQuestion = (
          attachments: ImageAttachment[],
          documentPageSummary?: string | null
        ) =>
          dependencies.persistUserMessage({
            threadId: input.threadId,
            messageId: userMessageId,
            parentId: input.parentId ?? null,
            content: lastMessage.content,
            chatMode: input.selectedMode,
            modelId: model.id,
            reasoningEffort: appliedReasoningEffort,
            attachments,
            documentPageSummary,
            imagePreviews: input.images.map((image) =>
              typeof image === 'string'
                ? null
                : (image.imagePreviewBase64 ?? null)
            ),
            learningContext: turnContext.learningContext,
          })
        try {
          await persistQuestion(images)
        } catch {
          await failClaim()
          return c.json({ code: 'MESSAGE_PERSISTENCE_FAILED' }, 500)
        }
        let attachmentContext: Awaited<
          ReturnType<typeof prepareAttachmentContext>
        >
        try {
          attachmentContext =
            images.length > 0 || input.documentPages.length > 0
              ? await dependencies.prepareAttachmentContext({
                  request: engineRequest,
                  images,
                  documentPages: input.documentPages,
                  engine: dependencies.engine,
                  signal: engineAbort.signal,
                  engineId: engineReady.engineId!,
                  providerAuthorization: credential.providerAuthorization,
                  cost: model.cost,
                })
              : { images, documentPageSummary: null, creditsUsed: 0 }
        } catch {
          await failClaim()
          return c.json({ code: 'ATTACHMENT_PREPARATION_FAILED' }, 503)
        }
        if (attachmentContext.aborted || engineAbort.signal.aborted) {
          const result = await dependencies.finalizeAssistantTurn({
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
            reasoningContent: null,
            content: [{ type: 'data', name: 'chat-stopped', data: {} }],
            creditsUsed:
              attachmentContext.creditsUsed > 0
                ? attachmentContext.creditsUsed
                : null,
          })
          if (result.persisted) releaseUnstartedClaim = undefined
          return c.json({ code: 'REQUEST_ABORTED' }, 503)
        }
        if (images.length > 0 || attachmentContext.documentPageSummary) {
          try {
            await persistQuestion(
              attachmentContext.images,
              attachmentContext.documentPageSummary
            )
          } catch {
            await failClaim()
            return c.json({ code: 'MESSAGE_PERSISTENCE_FAILED' }, 500)
          }
        }

        let engineResponse: Response
        try {
          engineResponse = await dependencies.engine.chat(engineRequest, {
            providerAuthorization: credential.providerAuthorization,
            mcpExecutionToken: hostToolSession.executionToken,
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

        const stream = createValidatedPlatformStream(engineResponse, {
          contractVersion: CHAT_ENGINE_CONTRACT_V2,
          showReasoning: isParticipantReasoningVisible(
            chatbot.customModeConfig,
            input.selectedMode
          ),
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
            contextOmittedMessages: context.omittedMessages,
            ...(meetingClockStartedAt
              ? {
                  meetingClockStartedAt: meetingClockStartedAt.toISOString(),
                  serverNow: new Date().toISOString(),
                }
              : {}),
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
                  ) + attachmentContext.creditsUsed
                : attachmentContext.creditsUsed > 0
                  ? attachmentContext.creditsUsed
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
            } finally {
              await hostToolSession?.close()
            }
          },
        })

        streamStarted = true
        return c.body(stream, 200, {
          'content-type': 'text/event-stream; charset=utf-8',
          'cache-control': 'no-cache, no-transform',
          connection: 'keep-alive',
        })
      } finally {
        if (!streamStarted) {
          c.req.raw.signal.removeEventListener('abort', abortIncomingEngine)
          engineAbort.abort()
          try {
            await releaseUnstartedClaim?.()
          } finally {
            if (hostToolSession) await hostToolSession.close()
            else await hostTools?.close()
          }
        }
      }
    }
  )

  return app
}

export const app = createChatApiApp()
