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
import { Hono } from 'hono'
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
})

export type ChatApiDependencies = {
  authenticate: (
    participantToken: string | undefined,
    chatbotId: string
  ) => Promise<{ participantId: string; courseId: string } | AuthFailure>
  getChatbot: (chatbotId: string) => Promise<ChatbotRecord | null>
  checkDisclaimer: (
    participantId: string,
    chatbotId: string,
    disclaimerId: string | null
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
      credentialMode: { mode: 'request', providerBaseUrl },
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
  configuration: { providerAllowedOrigins?: ReadonlySet<string> } = {}
) {
  const providerAllowedOrigins =
    configuration.providerAllowedOrigins ??
    parseProviderAllowedOrigins(process.env.CHAT_PROVIDER_ALLOWED_ORIGINS)
  const engine = overrides.engine ?? createEngineClient()
  const dependencies: ChatApiDependencies = {
    authenticate: authenticateParticipant,
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

      let input: z.infer<typeof bodySchema>
      try {
        input = bodySchema.parse(await c.req.json())
      } catch {
        return c.json(
          { error: 'Invalid request body', code: 'INVALID_REQUEST' },
          400
        )
      }

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
        chatbotId,
        chatbot.disclaimerId
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
        selectedModel = getAutomaticModelId(credits, chatbot.allowedModelIds)
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
      if (allowedIds && !allowedIds.has(model.id) && !model.fallback) {
        return c.json(
          {
            error: `Model not available for this chatbot: ${selectedModel}`,
            code: 'MODEL_NOT_ALLOWED',
          },
          400
        )
      }
      if (credits.current <= 0 && !model.fallback) {
        selectedModel = getAutomaticModelId(credits, chatbot.allowedModelIds)
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
          c.req.header('accept-language')?.split(',')[0] ??
          'en',
        systemPrompt: getSystemPrompt(chatbot, input.selectedMode),
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
        return c.json(
          {
            error: 'The selected chat engine failed before streaming',
            code: 'ENGINE_REQUEST_FAILED',
          },
          503
        )
      }

      const stream = createValidatedPlatformStream(engineResponse, {
        onCancel: abortIncomingEngine,
        expected: {
          assistantMessageId,
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
          const usage = usageIsChargeable(state.usage) ? state.usage : null
          const creditsUsed = usage
            ? calculateCost(model.cost, usage.inputTokens!, usage.outputTokens!)
            : null
          const result =
            state.parts.length > 0
              ? await dependencies.finalizeAssistantTurn({
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
                  content: state.parts,
                  creditsUsed,
                })
              : { persisted: false, creditsCharged: false }
          return {
            creditsUsed,
            finalPersistenceStatus: result.persisted
              ? 'persisted'
              : 'not-persisted',
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
