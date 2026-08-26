import { DEFAULT_PROMPT } from '@/src/lib/config/prompts'
import { type ReasoningEffort } from '@/src/lib/config/reasoning'
import { withChatbotAuth } from '@/src/lib/server/apiGuards'
import {
  getAllowedReasoningEffortsForModel,
  getAutomaticModelId,
  getChatModelRegistry,
  getModelsForChatbot,
  getParticipantFallbackModelId,
  type ChatModelConfig,
} from '@/src/lib/server/chatModelRegistry'
import { ensureImagePreviewBase64 } from '@/src/lib/server/imagePreview'
import {
  getParentSpanContext,
  getTraceIdForMessage,
  isAiTelemetryEnabled,
} from '@/src/lib/server/langfuseTracing'
import { compileSystemPrompt } from '@/src/lib/server/systemPromptCompiler'
import {
  REQUIRED_MCP_UNAVAILABLE_CODE,
  RequiredMCPUnavailableError,
} from '@/src/lib/server/mcpRuntimePolicy'
import { createOpenAIFetch } from '@/src/lib/server/openaiCachePolicy'
import { getOpenAIResponsesStore } from '@/src/lib/server/openaiResponsesOptions'
import { buildPromptCacheRequest } from '@/src/lib/server/promptCacheIdentity'
import {
  buildAbortedAssistantContent,
  mapAssistantStepContent,
} from '@/src/lib/server/persistedAssistantContent'
import {
  CHAT_TURN_ALREADY_COMPLETED_CODE,
  ChatTurnConflictError,
  claimChatTurn,
  failChatTurn,
  finalizeChatTurn,
  isChatAccountUsageEnforcementEnabled,
  isChatAccountUsageAvailable,
  roundChatUsageCredits,
} from '@/src/services/accountUsage'
import {
  formatKlickerChatContextForPrompt,
  sanitizeKlickerChatContext,
} from '@/src/services/chatContext'
import { CreditsService } from '@/src/services/credits'
import { DisclaimersService } from '@/src/services/disclaimers'
import {
  getAggregatedMCPTools,
  type MCPServerWithConfig,
} from '@/src/services/mcpClients'
import { resolveMcpScopeSessionId } from '@/src/services/mcpScope'
import {
  formatPracticeCandidatesForPrompt,
  getPracticeStackForQuiz,
  lookupRelevantPracticeStacks,
  STUDENT_PRACTICE_QUIZ_TOOL_NAME,
  toPracticeCandidateId,
} from '@/src/services/studentPracticeMcp'
import { ThreadService } from '@/src/services/threads'
import { createOpenAI } from '@ai-sdk/openai'
import { prisma } from '@klicker-uzh/prisma'
import { Chatbot, type Prisma } from '@klicker-uzh/prisma/client'
import { safeDecrypt } from '@klicker-uzh/util'
import { startActiveObservation } from '@langfuse/tracing'
import {
  consumeStream,
  generateText,
  isStepCount,
  streamText,
  tool,
  type ModelMessage,
  type StepResult,
  type ToolSet,
} from 'ai'
import { createHash, randomUUID } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

export const runtime = 'nodejs'

export const maxDuration = 60

type IncomingImageAttachment = {
  imageBase64: string
  imagePreviewBase64: string | null
}

type ChatRouteModelMessage = {
  role: 'user' | 'assistant'
  content:
    | string
    | Array<{ type: 'text'; text: string } | { type: 'image'; image: string }>
}

export const CHAT_MODEL_UNAVAILABLE_BASE = 'CHAT_MODEL_UNAVAILABLE_BASE'
export const CHAT_MODEL_UNAVAILABLE_ADVANCED = 'CHAT_MODEL_UNAVAILABLE_ADVANCED'

function chatModelUnavailableResponse(
  usageClass: ChatModelConfig['usageClass']
) {
  return NextResponse.json(
    {
      error: 'Chat model usage is unavailable',
      code:
        usageClass === 'BASE'
          ? CHAT_MODEL_UNAVAILABLE_BASE
          : CHAT_MODEL_UNAVAILABLE_ADVANCED,
    },
    { status: 403 }
  )
}

function completedTurnResponse() {
  return NextResponse.json(
    {
      error: 'Chat turn already completed',
      code: CHAT_TURN_ALREADY_COMPLETED_CODE,
    },
    { status: 409 }
  )
}

if (!process.env.OPENAI_BASE_URL) {
  console.warn(
    '[chat] OPENAI_BASE_URL is not set — model requests will use provider defaults'
  )
}
if (!process.env.OPENAI_API_KEY) {
  console.warn(
    '[chat] OPENAI_API_KEY is not set — model requests without per-chatbot keys will fail'
  )
}
const CHAT_LOG_PREFIX = '[chat:dev]'
const isDevLogging = process.env.NODE_ENV === 'development'
const MAX_LOG_STRING_LENGTH = 500
const HASH_DIGEST_LENGTH = 12

type ModelRouting = {
  source: 'custom' | 'default'
  hasCustomKey: boolean
  baseUrl: string | undefined
}

function getOpenAIModel(
  provider: ReturnType<typeof createOpenAI>,
  modelConfig: ChatModelConfig
) {
  return modelConfig.usesResponsesApi
    ? provider.responses(modelConfig.deploymentId)
    : provider.chat(modelConfig.deploymentId)
}

function getModel(chatbot: Chatbot, modelConfig: ChatModelConfig) {
  // Use per-chatbot configuration if available
  const hasCustomKey =
    typeof chatbot.openaiApiKey === 'string' && chatbot.openaiApiKey.length > 0
  const hasCustomBaseUrl =
    typeof chatbot.openaiBaseUrl === 'string' &&
    chatbot.openaiBaseUrl.length > 0
  const hasCustomConfig = hasCustomKey || hasCustomBaseUrl

  if (hasCustomConfig) {
    let apiKey: string | undefined
    if (hasCustomKey) {
      try {
        apiKey = safeDecrypt(chatbot.openaiApiKey!)
      } catch (error) {
        console.error('Failed to decrypt API key for chatbot:', {
          chatbotId: chatbot.id,
          error,
        })
        throw new Error(`Failed to decrypt API key for chatbot ${chatbot.id}`)
      }
    } else {
      apiKey = process.env.OPENAI_API_KEY
    }
    const baseUrl = hasCustomBaseUrl
      ? chatbot.openaiBaseUrl!
      : process.env.OPENAI_BASE_URL

    const routing: ModelRouting = {
      source: 'custom',
      hasCustomKey,
      baseUrl,
    }

    return {
      model: getOpenAIModel(
        createOpenAI({
          baseURL: baseUrl,
          apiKey: apiKey || 'no-key',
          fetch: createOpenAIFetch('custom'),
        }),
        modelConfig
      ),
      routing,
    }
  }

  // Default: route through OpenAI-compatible endpoint
  const routing: ModelRouting = {
    source: 'default',
    hasCustomKey: false,
    baseUrl: process.env.OPENAI_BASE_URL,
  }

  return {
    model: getOpenAIModel(
      createOpenAI({
        baseURL: process.env.OPENAI_BASE_URL,
        apiKey: process.env.OPENAI_API_KEY || 'no-key',
        fetch: createOpenAIFetch('default'),
      }),
      modelConfig
    ),
    routing,
  }
}

function asObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object') return null
  return value as Record<string, unknown>
}

function getSupportedChatModes(systemPrompts: unknown): Set<string> {
  const configuredModes = asObject(systemPrompts)
  const modeKeys = configuredModes ? Object.keys(configuredModes) : []
  return new Set(modeKeys.length > 0 ? modeKeys : Object.keys(DEFAULT_PROMPT))
}

function truncateString(
  value: string,
  maxLength = MAX_LOG_STRING_LENGTH
): string {
  if (value.length <= maxLength) return value
  return `${value.slice(0, maxLength - 3)}...`
}

function hashSnippet(value: string): string {
  return createHash('sha256')
    .update(value)
    .digest('hex')
    .slice(0, HASH_DIGEST_LENGTH)
}

function safeSerialize(value: unknown): string | null {
  try {
    return JSON.stringify(value)
  } catch {
    return null
  }
}

function safeSize(value: unknown): number | null {
  const serialized = safeSerialize(value)
  if (serialized === null) return null
  return Buffer.byteLength(serialized, 'utf8')
}

function toTokenCount(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

function extractReasoningTokens(providerMetadata: unknown): number | null {
  if (!providerMetadata) return null

  const queue: unknown[] = [providerMetadata]
  while (queue.length > 0) {
    const value = queue.shift()
    const record = asObject(value)
    if (!record) continue

    const directReasoningTokens = toTokenCount(record.reasoningTokens)
    if (directReasoningTokens !== null) {
      return directReasoningTokens
    }

    const outputTokensDetails = asObject(record.outputTokensDetails)
    const nestedReasoningTokens = toTokenCount(
      outputTokensDetails?.reasoningTokens
    )
    if (nestedReasoningTokens !== null) {
      return nestedReasoningTokens
    }

    for (const nestedValue of Object.values(record)) {
      if (nestedValue && typeof nestedValue === 'object') {
        queue.push(nestedValue)
      }
    }
  }

  return null
}

function getDefaultReasoningEffort(
  allowedReasoningEfforts: ReasoningEffort[]
): ReasoningEffort | null {
  if (allowedReasoningEfforts.length === 0) {
    return null
  }
  if (allowedReasoningEfforts.includes('medium')) {
    return 'medium'
  }
  return allowedReasoningEfforts[0]
}

function logChatDev(
  event: string,
  context: Record<string, unknown>,
  level: 'info' | 'error' = 'info'
) {
  if (!isDevLogging) return
  const message = `${CHAT_LOG_PREFIX} ${event}`
  if (level === 'error') {
    console.error(message, context)
  } else {
    console.info(message, context)
  }
}

type ToolDiagnostic = {
  toolName: string
  inputBytes: number | null
  outputBytes: number | null
  inputHash: string | null
  outputHash: string | null
}

function collectStepToolDiagnostics(
  step: Pick<StepResult<any>, 'content'>
): ToolDiagnostic[] {
  const diagnostics: ToolDiagnostic[] = []

  for (const part of step.content ?? []) {
    if (!part || typeof part !== 'object') continue
    if (!('type' in part)) continue

    const typedPart = part as {
      type?: unknown
      toolName?: unknown
      input?: unknown
      output?: unknown
      result?: unknown
      args?: unknown
    }

    if (
      typedPart.type !== 'tool-call' &&
      typedPart.type !== 'tool-result' &&
      typedPart.type !== 'tool-error'
    ) {
      continue
    }

    const toolName =
      typeof typedPart.toolName === 'string' ? typedPart.toolName : 'unknown'
    const inputValue = typedPart.input ?? typedPart.args ?? null
    const outputValue = typedPart.output ?? typedPart.result ?? null

    const inputSerialized = safeSerialize(inputValue)
    const outputSerialized = safeSerialize(outputValue)

    diagnostics.push({
      toolName,
      inputBytes: safeSize(inputValue),
      outputBytes: safeSize(outputValue),
      inputHash: inputSerialized ? hashSnippet(inputSerialized) : null,
      outputHash: outputSerialized ? hashSnippet(outputSerialized) : null,
    })
  }

  return diagnostics
}

function extractSafeHeaders(headers: unknown): Record<string, unknown> | null {
  const headerRecord = asObject(headers)
  if (!headerRecord) return null

  const allowedKeys = new Set([
    'x-request-id',
    'x-ms-request-id',
    'x-ms-client-request-id',
    'x-trace-id',
    'traceparent',
    'tracestate',
    'apim-request-id',
  ])

  const safeHeaders: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(headerRecord)) {
    const normalized = key.toLowerCase()
    if (allowedKeys.has(normalized)) {
      safeHeaders[key] = value
    }
  }

  return Object.keys(safeHeaders).length > 0 ? safeHeaders : null
}

type SerializedStreamError = {
  name: string | null
  message: string | null
  type: string | null
  code: string | null
  statusCode: number | null
  sequenceNumber: number | null
  providerType: string | null
  providerCode: string | null
  providerMessage: string | null
  providerParam: string | null
  safeHeaders: Record<string, unknown> | null
  raw: string | null
  messageHash: string | null
  providerMessageHash: string | null
}

function serializeStreamError(error: unknown): SerializedStreamError {
  const root = asObject(error)
  const nestedError = asObject(root?.error)
  const providerError = asObject(nestedError?.error)

  const message =
    (typeof root?.message === 'string' && root.message) ||
    (typeof nestedError?.message === 'string' && nestedError.message) ||
    (typeof providerError?.message === 'string' && providerError.message) ||
    null

  const statusCode =
    (typeof root?.statusCode === 'number' && root.statusCode) ||
    (typeof nestedError?.statusCode === 'number' && nestedError.statusCode) ||
    null

  const sequenceNumber =
    (typeof nestedError?.sequence_number === 'number' &&
      nestedError.sequence_number) ||
    (typeof root?.sequence_number === 'number' && root.sequence_number) ||
    null

  const raw =
    typeof error === 'string'
      ? truncateString(error)
      : root
        ? truncateString(
            `error object keys: ${Object.keys(root).join(', ') || '(none)'}`
          )
        : error instanceof Error
          ? truncateString(`${error.name}: ${error.message}`)
          : null

  return {
    name:
      (typeof root?.name === 'string' && root.name) ||
      (error instanceof Error ? error.name : null),
    message,
    type:
      (typeof root?.type === 'string' && root.type) ||
      (typeof nestedError?.type === 'string' && nestedError.type) ||
      null,
    code:
      (typeof root?.code === 'string' && root.code) ||
      (typeof nestedError?.code === 'string' && nestedError.code) ||
      null,
    statusCode,
    sequenceNumber,
    providerType:
      (typeof providerError?.type === 'string' && providerError.type) || null,
    providerCode:
      (typeof providerError?.code === 'string' && providerError.code) || null,
    providerMessage:
      (typeof providerError?.message === 'string' && providerError.message) ||
      null,
    providerParam:
      (typeof providerError?.param === 'string' && providerError.param) || null,
    safeHeaders:
      extractSafeHeaders(providerError?.headers) ||
      extractSafeHeaders(nestedError?.headers) ||
      extractSafeHeaders(root?.headers),
    raw,
    messageHash: message ? hashSnippet(message) : null,
    providerMessageHash:
      typeof providerError?.message === 'string'
        ? hashSnippet(providerError.message)
        : null,
  }
}

type StreamErrorClassification =
  | 'model_error'
  | 'rate_limit_or_quota'
  | 'auth_or_permission'
  | 'content_filter_or_policy'
  | 'unknown'

function classifyStreamError(serializedError: SerializedStreamError): {
  classification: StreamErrorClassification
  retryable: boolean
  suggestedAction: string
} {
  const code = (
    serializedError.providerCode ||
    serializedError.code ||
    ''
  ).toLowerCase()
  const type = (
    serializedError.providerType ||
    serializedError.type ||
    ''
  ).toLowerCase()
  const message = (
    serializedError.providerMessage ||
    serializedError.message ||
    ''
  ).toLowerCase()

  if (type === 'model_error') {
    return {
      classification: 'model_error',
      retryable: true,
      suggestedAction:
        'Check prompt/tool output structure, retry with reduced complexity, and compare with another model.',
    }
  }

  if (
    serializedError.statusCode === 429 ||
    code.includes('rate') ||
    code.includes('quota') ||
    message.includes('rate limit') ||
    message.includes('quota')
  ) {
    return {
      classification: 'rate_limit_or_quota',
      retryable: true,
      suggestedAction:
        'Retry with backoff and check rate limit/quota settings.',
    }
  }

  if (
    serializedError.statusCode === 401 ||
    serializedError.statusCode === 403 ||
    code.includes('unauthorized') ||
    code.includes('forbidden') ||
    message.includes('permission') ||
    message.includes('unauthorized')
  ) {
    return {
      classification: 'auth_or_permission',
      retryable: false,
      suggestedAction:
        'Verify API credentials, model access permissions, and endpoint configuration.',
    }
  }

  if (
    type.includes('content') ||
    type.includes('policy') ||
    code.includes('content_filter') ||
    code.includes('policy') ||
    message.includes('content filter') ||
    message.includes('policy')
  ) {
    return {
      classification: 'content_filter_or_policy',
      retryable: false,
      suggestedAction:
        'Review prompt/tool outputs for policy triggers and adjust instructions accordingly.',
    }
  }

  return {
    classification: 'unknown',
    retryable: true,
    suggestedAction:
      'Check serialized provider error details and retry while monitoring stream events.',
  }
}

const normalizeReasoningContent = (
  value: string | null | undefined
): string | null =>
  typeof value === 'string' && value.trim().length > 0 ? value : null

const extractReasoningTextPart = (rawPart: unknown): string | null => {
  if (!rawPart || typeof rawPart !== 'object') return null

  const part = rawPart as { type?: unknown; text?: unknown }
  if (part.type !== 'reasoning' || typeof part.text !== 'string') return null

  return normalizeReasoningContent(part.text.trimEnd())
}

const joinReasoningFromSteps = (
  steps: Array<{ content?: unknown[] }> | undefined
): string =>
  (steps ?? [])
    .flatMap((step) =>
      Array.isArray(step.content)
        ? step.content
            .map(extractReasoningTextPart)
            .filter((value): value is string => value !== null)
        : []
    )
    .join('\n\n')

/**
 * Main chat endpoint that processes AI conversations with streaming responses.
 * Handles thread creation, message persistence, and AI model interactions with tools.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ chatbotId: string }> }
) {
  const { chatbotId } = await params
  const requestId = randomUUID()
  const requestStartedAtMs = Date.now()
  const authResult = await withChatbotAuth(req, chatbotId)
  if ('response' in authResult) {
    return authResult.response
  }
  const { participantId, authMode, chatbot: authChatbot } = authResult

  // check disclaimer acceptance
  try {
    const disclaimerStatus = await DisclaimersService.checkDisclaimerStatus(
      chatbotId,
      participantId
    )

    if (disclaimerStatus.required && !disclaimerStatus.accepted) {
      return NextResponse.json(
        {
          error: 'Disclaimer must be accepted before using the chatbot',
          code: 'DISCLAIMER_NOT_ACCEPTED',
        },
        { status: 403 }
      )
    }
  } catch (error) {
    console.error('Error checking disclaimer status:', { requestId, error })
    return NextResponse.json(
      { error: 'Error checking disclaimer status' },
      { status: 500 }
    )
  }

  const imageDataUrlSchema = z
    .string()
    .max(7_000_000)
    .refine((value) => /^data:image\/(jpeg|png|gif|webp);base64,/.test(value), {
      message: 'Must be a base64 data URL for jpeg, png, gif, or webp',
    })

  const bodySchema = z.object({
    messages: z.array(
      z.object({
        id: z.string().min(1),
        role: z.enum(['user', 'assistant']),
        content: z.string(),
      })
    ),
    threadId: z.string().min(1).nullable().optional(),
    selectedModel: z.string().min(1),
    selectedMode: z
      .string()
      .optional()
      .transform((val) => val?.toLowerCase())
      .default('tutor'),
    reasoningEffort: z.string().min(1).optional().default('none'),
    chatContext: z.unknown().optional(),
    parentId: z.string().min(1).nullable().optional(),
    assistantMessageId: z.string().min(1),
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
  let parsed: z.infer<typeof bodySchema>
  try {
    parsed = bodySchema.parse(await req.json())
  } catch (e) {
    console.error('Invalid request body:', { requestId, error: e })
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }
  const {
    messages,
    threadId,
    selectedMode,
    reasoningEffort: requestedReasoningEffort,
    parentId,
    assistantMessageId,
    images,
    chatContext: rawChatContext,
  } = parsed

  const sanitizedChatContext = sanitizeKlickerChatContext(rawChatContext)
  const chatContext =
    authChatbot && sanitizedChatContext?.courseId === authChatbot.courseId
      ? sanitizedChatContext
      : null

  if (sanitizedChatContext && authChatbot && !chatContext) {
    console.warn('Ignoring chat context for unrelated course', {
      requestId,
      chatbotId,
      contextCourseId: sanitizedChatContext.courseId,
      chatbotCourseId: authChatbot.courseId,
    })
  }

  const normalizedImages: IncomingImageAttachment[] = images.map((image) =>
    typeof image === 'string'
      ? {
          imageBase64: image,
          imagePreviewBase64: null,
        }
      : image
  )

  const userPrompt = messages
    .filter((message) => message.role === 'user')
    .map((message) => message.content)
    .join('\n')

  logChatDev('request.received', {
    requestId,
    chatbotId,
    participantId,
    threadId,
    assistantMessageId,
    selectedModel: parsed.selectedModel,
    selectedMode,
    messageCount: messages.length,
    hasChatContext: Boolean(chatContext),
  })

  let selectedModel = parsed.selectedModel

  let currentThreadId = threadId
  let userMessageId: string | null = null

  // fetch the chatbot with its enabled MCP configurations (its stored
  // systemPrompts feed compileSystemPrompt once the tool set is known below)
  let mcpServersWithConfigs: MCPServerWithConfig[] = []
  let chatbot = null
  let enabledKnowledgeBaseId: string | undefined

  try {
    chatbot = await prisma.chatbot.findUnique({
      where: { id: chatbotId },
      include: {
        mcpConfigurations: {
          where: {
            isEnabled: true,
          },
          include: {
            mcpServer: true,
          },
          orderBy: { priority: 'asc' },
        },
        knowledgeBases: {
          where: { isEnabled: true },
          select: { kbId: true },
          take: 1,
        },
      },
    })
    enabledKnowledgeBaseId = chatbot?.knowledgeBases[0]?.kbId
  } catch (error) {
    console.error('Failed to fetch chatbot configuration:', {
      requestId,
      error,
    })
  }

  if (!chatbot) {
    return NextResponse.json({ error: 'Chatbot not found' }, { status: 404 })
  }

  if (!getSupportedChatModes(chatbot.systemPrompts).has(selectedMode)) {
    return NextResponse.json(
      { error: `Unsupported chat mode: ${selectedMode}` },
      { status: 400 }
    )
  }

  const modelRegistry = getChatModelRegistry()
  const allowedIds =
    chatbot.allowedModelIds.length > 0
      ? new Set(chatbot.allowedModelIds as string[])
      : null

  if (!chatbot.modelSelection) {
    const automaticModelId = getAutomaticModelId(
      chatbot.allowedModelIds as string[]
    )
    if (!automaticModelId) {
      return NextResponse.json(
        { error: 'No model is available for this chatbot' },
        { status: 400 }
      )
    }
    selectedModel = automaticModelId
  }

  let selectedModelConfig = modelRegistry.find((m) => m.id === selectedModel)
  if (!selectedModelConfig) {
    return NextResponse.json(
      { error: `Unknown model: ${selectedModel}` },
      { status: 400 }
    )
  }

  // Enforce per-chatbot model allow-list
  if (allowedIds && !allowedIds.has(selectedModelConfig.id)) {
    return NextResponse.json(
      { error: `Model not available for this chatbot: ${selectedModel}` },
      { status: 400 }
    )
  }

  // Anonymous LTI guests stay on the chatbot's allowed fallback model. Apply
  // this after automatic and explicit selection so later credit handling
  // cannot restore an advanced model for a guest with remaining credits.
  if (authMode === 'anonymous' && !selectedModelConfig.fallback) {
    const guestFallback = getModelsForChatbot(chatbot).find(
      (modelConfig) => modelConfig.fallback
    )
    if (!guestFallback) {
      return NextResponse.json(
        { error: 'No fallback model available for guest access' },
        { status: 503 }
      )
    }
    selectedModel = guestFallback.id
    selectedModelConfig = guestFallback
  }

  if (isChatAccountUsageEnforcementEnabled()) {
    let accountUsageAvailable = false
    try {
      accountUsageAvailable = await isChatAccountUsageAvailable({
        ownerId: chatbot.ownerId,
        usageClass: selectedModelConfig.usageClass,
      })
    } catch (error) {
      console.error('Failed to check account chat usage:', {
        requestId,
        error,
      })
    }
    if (!accountUsageAvailable) {
      return chatModelUnavailableResponse(selectedModelConfig.usageClass)
    }
  }

  const enabledMCPConfigurations = chatbot.mcpConfigurations ?? []
  const selectedMCPConfigurations = enabledMCPConfigurations.filter(
    (config) => config.chatMode === selectedMode
  )
  const chatbotHasRequiredMCP = enabledMCPConfigurations.some(
    (config) => asObject(config.parameters)?.required === true
  )
  const selectedModeHasRequiredMCP = selectedMCPConfigurations.some(
    (config) => asObject(config.parameters)?.required === true
  )
  if (chatbotHasRequiredMCP && !selectedModeHasRequiredMCP) {
    return NextResponse.json(
      {
        error: 'Required MCP tool unavailable',
        code: REQUIRED_MCP_UNAVAILABLE_CODE,
      },
      { status: 503 }
    )
  }

  mcpServersWithConfigs = selectedMCPConfigurations.map((config) => ({
    server: {
      id: config.mcpServer.id,
      name: config.mcpServer.name,
      url: config.mcpServer.url,
      authType: config.mcpServer.authType,
      authSecret: config.mcpServer.authSecret ?? '',
      parameters: config.mcpServer.parameters,
      isActive: config.mcpServer.isActive,
      passChatbotId: config.mcpServer.passChatbotId,
      chatbotIdHeader: config.mcpServer.chatbotIdHeader ?? undefined,
    },
    config: {
      allowedTools: config.allowedTools as string[] | undefined,
      parameters: config.parameters,
      priority: config.priority,
    },
  }))

  if (!selectedModelConfig.fallback) {
    const creditPreview = await CreditsService.previewUserCredits(
      participantId,
      chatbotId
    )
    if (
      creditPreview.current <= 0 &&
      !getParticipantFallbackModelId(
        selectedModelConfig.usageClass,
        chatbot.allowedModelIds as string[]
      )
    ) {
      return chatModelUnavailableResponse(selectedModelConfig.usageClass)
    }
  }

  if (!selectedModelConfig.fallback) {
    const userCredits = await CreditsService.getUserCredits(
      participantId,
      chatbotId
    )
    if (userCredits.current <= 0) {
      const fallbackModelId = getParticipantFallbackModelId(
        selectedModelConfig.usageClass,
        chatbot.allowedModelIds as string[]
      )
      if (!fallbackModelId) {
        return chatModelUnavailableResponse(selectedModelConfig.usageClass)
      }

      selectedModel = fallbackModelId
      selectedModelConfig = modelRegistry.find(
        (modelConfig) => modelConfig.id === fallbackModelId
      )!
    }
  }

  // Resolve the participant-owned thread before acquiring the provider-work
  // claim. The claim must exist before MCP discovery, image description, or
  // model streaming can begin.
  let createdThreadId: string | null = null
  if (!currentThreadId && messages.length > 0) {
    try {
      currentThreadId = await ThreadService.findFailedTurnThreadId(
        participantId,
        chatbotId,
        assistantMessageId
      )
      if (!currentThreadId) {
        const newThread = await ThreadService.createThread(
          participantId,
          chatbotId,
          null
        )
        currentThreadId = newThread.id
        createdThreadId = newThread.id
      }
    } catch (error) {
      console.error('Failed to resolve or create thread:', {
        requestId,
        error,
      })
    }
  }
  if (!currentThreadId) {
    return NextResponse.json(
      { error: 'Unable to resolve chat thread' },
      { status: 500 }
    )
  }

  const discardCreatedThread = async (phase: string): Promise<boolean> => {
    if (!createdThreadId) return false

    const threadIdToDelete = createdThreadId
    createdThreadId = null
    try {
      return await ThreadService.deleteThread(
        threadIdToDelete,
        participantId,
        chatbotId
      )
    } catch (error) {
      console.error('Failed to discard a newly created chat thread:', {
        requestId,
        phase,
        error,
      })
      return false
    }
  }

  let owningThread
  try {
    owningThread = await prisma.chatThread.findFirst({
      where: {
        id: currentThreadId,
        participantId,
        chatbotId,
      },
      select: { id: true },
    })
  } catch (error) {
    await discardCreatedThread('thread.ownership.error')
    throw error
  }
  if (!owningThread) {
    await discardCreatedThread('thread.ownership')
    return NextResponse.json(
      { error: 'Chat thread not found' },
      { status: 404 }
    )
  }

  const lastMessage = messages.length > 0 ? messages[messages.length - 1] : null
  if (lastMessage?.role === 'user') {
    userMessageId = lastMessage.id
  }

  let turnClaim
  try {
    turnClaim = await claimChatTurn({
      ownerId: chatbot.ownerId,
      chatbotId,
      threadId: owningThread.id,
      assistantMessageId,
      parentId: userMessageId,
    })
  } catch (error) {
    if (error instanceof ChatTurnConflictError) {
      await discardCreatedThread('claim.conflict')
      return completedTurnResponse()
    }
    await discardCreatedThread('claim.error')
    throw error
  }
  if (turnClaim.outcome === 'completed') {
    await discardCreatedThread('claim.completed')
    return completedTurnResponse()
  }
  if (turnClaim.outcome === 'in_progress') {
    await discardCreatedThread('claim.in_progress')
    return completedTurnResponse()
  }
  const lifecycleAttemptId = turnClaim.lifecycleAttemptId

  const failAssistantClaim = async (phase: string) => {
    try {
      await failChatTurn({
        assistantMessageId,
        threadId: owningThread.id,
        lifecycleAttemptId,
      })
    } catch (error) {
      console.error('Failed to mark assistant lifecycle attempt as failed:', {
        requestId,
        phase,
        error,
      })
    }
  }

  const failOrDiscardUnstartedClaim = async (phase: string) => {
    // Keep a transient claim IN_PROGRESS until its request-owned thread is
    // deleted. Marking it failed first would let a concurrent retry reclaim the
    // attempt while cleanup is still able to delete the shared thread.
    if (await discardCreatedThread(phase)) return
    await failAssistantClaim(phase)
  }

  let providerStreamStarted = false
  try {
    // Discover MCP tools only after read-only participant authorization.
    const mcpScopeSessionId = resolveMcpScopeSessionId({
      requestedThreadId: currentThreadId,
      owningThreadId: owningThread.id,
      fallbackId: requestId,
    })
    if (mcpScopeSessionId === null) {
      await failOrDiscardUnstartedClaim('mcp.scope')
      return NextResponse.json({ error: 'Thread not found' }, { status: 404 })
    }

    let mcpTools: ToolSet
    try {
      mcpTools = await getAggregatedMCPTools(mcpServersWithConfigs, {
        chatbotId,
        participantId,
        authMode,
        kbId: enabledKnowledgeBaseId,
        sessionId: mcpScopeSessionId,
      })
    } catch (error) {
      if (error instanceof RequiredMCPUnavailableError) {
        await failOrDiscardUnstartedClaim('mcp.discovery')
        return NextResponse.json(
          {
            error: 'Required MCP tool unavailable',
            code: REQUIRED_MCP_UNAVAILABLE_CODE,
          },
          { status: 503 }
        )
      }
      throw error
    }

    let practiceCandidatePrompt = ''
    let practiceCandidateCount = 0
    const practiceCandidateRefs = new Map<string, string>()

    if (selectedMode === 'tutor') {
      try {
        const lookupResult = await lookupRelevantPracticeStacks({
          authMode,
          chatbotId,
          courseId: authChatbot.courseId,
          messages,
          participantId,
        })
        const candidates = lookupResult?.candidates ?? []
        practiceCandidateCount = candidates.length
        candidates.forEach((candidate, index) => {
          practiceCandidateRefs.set(
            toPracticeCandidateId(index),
            candidate.questionRef
          )
        })
        practiceCandidatePrompt = formatPracticeCandidatesForPrompt(candidates)

        logChatDev('studentPractice.lookup', {
          requestId,
          chatbotId,
          participantId,
          candidateCount: practiceCandidateCount,
        })
      } catch (error) {
        console.warn(
          'Student practice lookup failed; continuing without quiz candidates',
          {
            requestId,
            chatbotId,
            error,
          }
        )
      }
    }

    const studentPracticeTools: Record<string, any> = {}
    if (practiceCandidatePrompt) {
      studentPracticeTools[STUDENT_PRACTICE_QUIZ_TOOL_NAME] = tool({
        description:
          'Show a selected answer-safe practice quiz question to the student. Use only candidateId values from the current relevant practice candidate context.',
        inputSchema: z.object({
          candidateId: z
            .string()
            .min(1)
            .describe(
              'Candidate id from the current practice candidate context'
            ),
        }),
        execute: async ({ candidateId }) => {
          const questionRef = practiceCandidateRefs.get(candidateId)
          if (!questionRef) {
            throw new Error('Unknown practice candidate id')
          }

          const payload = await getPracticeStackForQuiz({
            authMode,
            chatbotId,
            participantId,
            questionRef,
          })
          if (!payload) {
            throw new Error('Student practice MCP is not configured')
          }

          return {
            kind: 'student-practice-quiz',
            ...payload,
          }
        },
        toModelOutput: () => ({
          type: 'text' as const,
          value:
            'A practice quiz was shown to the student. Wait for the student answer or submission result before giving feedback.',
        }),
      })
    }

    const chatTools: Record<string, any> = {
      ...(mcpTools || {}),
      ...studentPracticeTools,
    }
    const toolNames = Object.keys(chatTools)

    // Compile the full system prompt now that `toolNames` is known: the resolved
    // base prompt plus the layered runtime contracts (conditional citation, then
    // unconditional Swiss High German language style — see compileSystemPrompt).
    // Assigning the finished value here (rather than a separate `instructions`
    // variable) keeps the `systemPromptLength` / `systemPromptHash` telemetry
    // below truthful to what is actually sent to the model.
    const systemPrompt = compileSystemPrompt(
      chatbot.systemPrompts,
      selectedMode,
      toolNames
    )
    const chatContextPrompt = formatKlickerChatContextForPrompt(chatContext)
    const contextAwareSystemPrompt = chatContextPrompt
      ? `${systemPrompt}\n\n${chatContextPrompt}`
      : systemPrompt
    const effectiveSystemPrompt = practiceCandidatePrompt
      ? `${contextAwareSystemPrompt}\n\n${practiceCandidatePrompt}`
      : contextAwareSystemPrompt

    // track partial content for cancelled streams
    let partialContent = ''
    let partialReasoningContent = ''
    let currentStepContent: Array<
      { type: 'text'; text: string } | { type: 'reasoning'; text: string }
    > = []
    let assistantReasoningContent: string | null = null

    const modelMessages: ChatRouteModelMessage[] = messages.map((msg) => ({
      role: msg.role,
      content: msg.content,
    }))

    const maxOutputTokens = selectedModelConfig.maxOutputTokens

    const allowedReasoningEfforts = getAllowedReasoningEffortsForModel(
      selectedModelConfig,
      chatbot.allowedReasoningEffortsByModel
    )
    const appliedReasoningEffort: ReasoningEffort | null =
      allowedReasoningEfforts.length > 0
        ? allowedReasoningEfforts.includes(requestedReasoningEffort)
          ? requestedReasoningEffort
          : getDefaultReasoningEffort(allowedReasoningEfforts)
        : null

    const providerReasoningEffort =
      appliedReasoningEffort && appliedReasoningEffort !== 'none'
        ? appliedReasoningEffort
        : undefined

    const { model, routing } = getModel(chatbot, selectedModelConfig)
    const promptCacheRequest =
      routing.source === 'default'
        ? await buildPromptCacheRequest({
            deploymentId: selectedModelConfig.deploymentId,
            transport: selectedModelConfig.usesResponsesApi
              ? 'responses'
              : 'chat',
            instructions: effectiveSystemPrompt,
            tools: chatTools,
          })
        : null

    const resolvedImages = await Promise.all(
      normalizedImages.map((image) => ensureImagePreviewBase64(image))
    )

    // create image descriptions if images attached
    let imageDescriptionCost: number = 0
    const imageAttachments: {
      imageBase64: string
      imagePreviewBase64: string | null
      imageDescription: string | null
    }[] = []
    if (normalizedImages.length > 0 && lastMessage?.role === 'user') {
      const descriptionPrompt = (userContent: string | undefined) =>
        `${userContent ? `User message context: ${userContent}\n\n` : ''}Describe this image in detail. Include all visible text, diagrams, charts, equations, labels, and notable visual elements. This description will serve as context for an ongoing conversation.`

      const results = await Promise.allSettled(
        resolvedImages.map(async (image) => {
          const descriptionResult = await generateText({
            model: model,
            messages: [
              {
                role: 'user',
                content: [
                  { type: 'image', image: image.imageBase64 },
                  {
                    type: 'text',
                    text: descriptionPrompt(lastMessage?.content),
                  },
                ],
              },
            ],
            maxOutputTokens: 1000,
          })
          return { image, descriptionResult }
        })
      )

      for (const result of results) {
        if (result.status === 'fulfilled') {
          const { image, descriptionResult } = result.value
          imageAttachments.push({
            imageBase64: image.imageBase64,
            imagePreviewBase64: image.imagePreviewBase64,
            imageDescription: descriptionResult.text,
          })
          if (descriptionResult.usage) {
            imageDescriptionCost += calcCost(
              selectedModelConfig.cost,
              descriptionResult.usage.inputTokens || 0,
              descriptionResult.usage.outputTokens || 0
            )
          }
        } else {
          console.error('Failed to generate image description:', {
            requestId,
            error: result.reason,
          })
          // find the corresponding image from the original array
          const idx = results.indexOf(result)
          imageAttachments.push({
            imageBase64: normalizedImages[idx].imageBase64,
            imagePreviewBase64: normalizedImages[idx].imagePreviewBase64,
            imageDescription:
              'The user attached an image that could not be described automatically.',
          })
        }
      }

      const lastMessageIndex = messages.length - 1
      if (lastMessageIndex >= 0) {
        const messageText = messages[lastMessageIndex]?.content

        modelMessages[lastMessageIndex] = {
          ...modelMessages[lastMessageIndex],
          content: [
            ...(messageText
              ? [{ type: 'text' as const, text: messageText }]
              : []),
            ...resolvedImages.map((image) => ({
              type: 'image' as const,
              image: image.imageBase64,
            })),
          ],
        }
      }
    }

    const logEvent = (
      event: string,
      context: Record<string, unknown>,
      level: 'info' | 'error' = 'info'
    ) => logChatDev(event, { requestId, ...context }, level)

    logEvent('request.context', {
      chatbotId,
      participantId,
      threadId: currentThreadId,
      assistantMessageId,
      selectedModel,
      resolvedModelId: selectedModelConfig.id,
      deploymentId: selectedModelConfig.deploymentId,
      routing,
      selectedMode,
      reasoningEffort: appliedReasoningEffort,
      allowedReasoningEfforts,
      maxOutputTokens: maxOutputTokens ?? null,
      toolCount: toolNames.length,
      toolNames,
      practiceCandidateCount,
      hasChatContext: Boolean(chatContextPrompt),
      systemPromptLength: effectiveSystemPrompt.length,
      systemPromptHash: effectiveSystemPrompt
        ? hashSnippet(effectiveSystemPrompt)
        : null,
      userPromptLengthTotal: userPrompt.length,
      userPromptHash: userPrompt ? hashSnippet(userPrompt) : null,
      imageAttachmentCount: images.length,
      imageAttachmentSizes: resolvedImages.map((image) =>
        Buffer.byteLength(image.imageBase64, 'utf8')
      ),
      elapsedMsFromRequestStart: Date.now() - requestStartedAtMs,
    })

    logEvent('thread.resolved', {
      hasOwningThread: true,
      elapsedMsFromRequestStart: Date.now() - requestStartedAtMs,
    })

    // inject image descriptions from prior messages into model context; fetch from DB
    const priorMessageIds = messages
      .filter(
        (m) =>
          m.role === 'user' &&
          !(imageAttachments.length > 0 && m.id === lastMessage?.id) // skip current
      )
      .map((m) => m.id)
    if (owningThread && priorMessageIds.length > 0) {
      try {
        const priorAttachments = await prisma.chatAttachment.findMany({
          where: {
            messageId: { in: priorMessageIds },
            imageDescription: { not: null },
            message: { threadId: owningThread.id },
          },
          select: { messageId: true, imageDescription: true },
          orderBy: [{ messageId: 'asc' }, { position: 'asc' }],
        })
        const descriptionsByMsgId = new Map<string, string[]>()
        for (const a of priorAttachments) {
          // get existing descriptions for this message, append if exist, or create new array
          const existing = descriptionsByMsgId.get(a.messageId) ?? []
          existing.push(a.imageDescription!)
          descriptionsByMsgId.set(a.messageId, existing)
        }
        for (let i = 0; i < messages.length; i++) {
          const descs = descriptionsByMsgId.get(messages[i].id)
          if (descs && descs.length > 0) {
            // append all descriptions for this message into the content
            const suffix =
              descs.length === 1
                ? `\n\n[Attached image description: ${descs[0]}]`
                : '\n\n' +
                  descs
                    .map(
                      (d, idx) =>
                        `[Attached image ${idx + 1} description: ${d}]`
                    )
                    .join('\n\n')
            modelMessages[i] = {
              ...modelMessages[i],
              content: `${modelMessages[i].content}${suffix}`,
            }
          }
        }
      } catch (error) {
        console.error('Failed to fetch prior image descriptions:', {
          requestId,
          error,
        })
      }
    }

    // save user message to database (after effective model selection)
    if (
      currentThreadId &&
      owningThread &&
      lastMessage?.role === 'user' &&
      userMessageId
    ) {
      try {
        const metadata = {
          chatMode: selectedMode,
          modelId: selectedModelConfig.id,
          reasoningEffort: appliedReasoningEffort,
        }

        const persistAttachments = async (messageId: string) => {
          if (imageAttachments.length === 0) return

          // delete existing attachments for this message, then create new ones
          await prisma.$transaction([
            prisma.chatAttachment.deleteMany({ where: { messageId } }),
            prisma.chatAttachment.createMany({
              data: imageAttachments.map((att, position) => ({
                type: 'IMAGE' as const,
                messageId,
                position,
                imageBase64: att.imageBase64 ?? null,
                imagePreviewBase64: att.imagePreviewBase64 ?? null,
                imageDescription: att.imageDescription ?? null,
              })),
            }),
          ])
        }

        const updated = await prisma.chatMessage.updateMany({
          where: { id: userMessageId, threadId: currentThreadId },
          data: metadata,
        })

        if (updated.count === 0) {
          const existingMessage = await prisma.chatMessage.findUnique({
            where: { id: userMessageId },
            select: { id: true },
          })
          if (existingMessage) {
            console.warn(
              'Skipping user message update: message exists outside current thread',
              {
                requestId,
                phase: 'persist.userMessage',
                messageId: userMessageId,
                threadId: currentThreadId,
              }
            )
          } else {
            await prisma.chatMessage.create({
              data: {
                id: lastMessage.id,
                threadId: currentThreadId,
                parentId: parentId || null,
                role: lastMessage.role,
                content: [{ type: 'text', text: lastMessage.content }],
                ...metadata,
              },
            })

            await persistAttachments(lastMessage.id)
          }
        } else {
          await persistAttachments(userMessageId)
        }

        // update thread's timestamp
        await prisma.chatThread.update({
          where: { id: currentThreadId },
          data: { updatedAt: new Date() },
        })
      } catch (error) {
        console.error('Failed to save user message:', {
          requestId,
          phase: 'persist.userMessage',
          error,
        })
      }
    } else if (currentThreadId && !owningThread && userMessageId) {
      console.warn('Skipping user message save: thread ownership mismatch', {
        requestId,
        phase: 'persist.userMessage',
        messageId: userMessageId,
        threadId: currentThreadId,
      })
    }

    const normalizeCredits = (
      rawCreditsUsed: number | null,
      phase: 'complete' | 'abort' | 'metadata'
    ) => {
      if (rawCreditsUsed === null) {
        return { rawCreditsUsed: null, creditsUsed: null }
      }

      try {
        return {
          rawCreditsUsed,
          creditsUsed: roundChatUsageCredits(rawCreditsUsed).toNumber(),
        }
      } catch (error) {
        console.error('Failed to normalize chat usage credits:', {
          requestId,
          phase,
          errorType: error instanceof Error ? error.name : typeof error,
        })
        return { rawCreditsUsed: null, creditsUsed: null }
      }
    }

    const streamStartedAtMs = Date.now()
    let hasLoggedFirstChunk = false
    let firstError: SerializedStreamError | null = null
    let sawAbort = false
    let sawFinish = false
    let finalEmitted = false

    const finalizeAssistantLifecycle = async ({
      content,
      reasoningContent,
      rawCreditsUsed,
      phase,
    }: {
      content: ReturnType<typeof mapAssistantStepContent>
      reasoningContent: string | null
      rawCreditsUsed: number | null
      phase: 'complete' | 'abort'
    }) => {
      let finalizationOutcome: 'completed' | 'duplicate' | 'failed' = 'failed'
      let participantCreditsUsed: number | null = null

      try {
        const result = await finalizeChatTurn({
          ownerId: chatbot.ownerId,
          chatbotId,
          usageClass: selectedModelConfig.usageClass,
          threadId: owningThread.id,
          assistantMessageId,
          lifecycleAttemptId,
          parentId: userMessageId,
          content: content as Prisma.InputJsonValue,
          chatMode: selectedMode,
          modelId: selectedModelConfig.id,
          reasoningEffort: appliedReasoningEffort,
          reasoningContent,
          rawCreditsUsed,
        })
        finalizationOutcome = result.outcome
        if (result.outcome === 'completed') {
          participantCreditsUsed = result.creditsUsed
        }
      } catch (error) {
        console.error(
          'Failed to finalize assistant message and account usage:',
          {
            requestId,
            phase,
            error,
          }
        )
        await failAssistantClaim(`finalize.${phase}`)
      }

      if (
        finalizationOutcome === 'completed' &&
        participantCreditsUsed !== null &&
        participantCreditsUsed > 0
      ) {
        try {
          await CreditsService.decrementCredits(
            participantId,
            chatbotId,
            participantCreditsUsed
          )
        } catch (error) {
          console.error('Failed to deduct credits:', {
            requestId,
            phase: 'credits.decrement',
            error,
          })
        }
      }
    }

    const emitFinalOnce = (
      status: 'success' | 'error' | 'aborted',
      payload: Record<string, unknown>
    ) => {
      if (finalEmitted) return
      finalEmitted = true
      logEvent('stream.final', {
        status,
        sawFinish,
        sawAbort,
        hadError: Boolean(firstError),
        ...payload,
      })
    }

    logEvent('stream.start', {
      elapsedMsFromRequestStart: Date.now() - requestStartedAtMs,
    })

    // Langfuse v4 addresses traces by OTel trace id, so the id is derived from the
    // assistant message id here and re-derived when a rating comes in later.
    const traceId = isAiTelemetryEnabled
      ? await getTraceIdForMessage(assistantMessageId)
      : null

    const startStream = () => {
      providerStreamStarted = true
      return streamText({
        model,
        maxOutputTokens,
        telemetry: { isEnabled: isAiTelemetryEnabled },
        providerOptions: {
          openai: {
            ...(promptCacheRequest
              ? { promptCacheKey: promptCacheRequest.promptCacheKey }
              : {}),
            ...(selectedModelConfig.usesResponsesApi && {
              store: getOpenAIResponsesStore(),
            }),
            ...(providerReasoningEffort && {
              reasoningEffort: providerReasoningEffort,
              reasoningSummary: 'auto',
            }),
          },
        },
        messages: modelMessages as ModelMessage[],
        tools: promptCacheRequest?.tools ?? chatTools,
        toolOrder: promptCacheRequest?.toolOrder,
        toolChoice: 'auto',
        stopWhen: isStepCount(5),
        instructions: effectiveSystemPrompt,

        abortSignal: req.signal,

        onChunk: ({ chunk }) => {
          if (!hasLoggedFirstChunk) {
            hasLoggedFirstChunk = true
            logEvent('stream.chunk.first', {
              firstChunkType: chunk.type,
              elapsedMsFromStreamStart: Date.now() - streamStartedAtMs,
            })
          }

          if (chunk.type === 'text-delta' && chunk.text) {
            partialContent += chunk.text
            const previous = currentStepContent.at(-1)
            if (previous?.type === 'text') {
              previous.text += chunk.text
            } else {
              currentStepContent.push({ type: 'text', text: chunk.text })
            }
          }
          if (chunk.type === 'reasoning-delta' && chunk.text) {
            partialReasoningContent += chunk.text
            const previous = currentStepContent.at(-1)
            if (previous?.type === 'reasoning') {
              previous.text += chunk.text
            } else {
              currentStepContent.push({
                type: 'reasoning',
                text: chunk.text,
              })
            }
          }
        },

        onEnd: async (result) => {
          sawFinish = true
          // ai@7 still flushes onEnd after an abort once at least one step
          // completed. onAbort already persisted the partial answer and charged
          // the per-step cost, so continuing here would overwrite it with
          // completed-steps-only content and re-run the credit deduction.
          if (sawAbort) {
            logEvent('stream.finish', {
              elapsedMsFromStreamStart: Date.now() - streamStartedAtMs,
              stepsCount: result.steps?.length ?? 0,
              hadPriorError: Boolean(firstError),
              hadAbort: true,
              skippedAfterAbort: true,
              // Keep the log shape stable for operators filtering on this
              // field; null means not-applicable on a cancelled turn.
              reasoningTokensIncludedInOutput: null,
            })
            return
          }
          const computedRawCreditsUsed = result.usage
            ? calcCost(
                selectedModelConfig.cost,
                result.usage.inputTokens || 0,
                result.usage.outputTokens || 0
              ) + imageDescriptionCost
            : null
          const { rawCreditsUsed, creditsUsed } = normalizeCredits(
            computedRawCreditsUsed,
            'complete'
          )
          const finishedReasoningContent =
            normalizeReasoningContent(joinReasoningFromSteps(result.steps)) ??
            normalizeReasoningContent(
              result.reasoningText ||
                result.steps
                  .map((step) => step.reasoningText || '')
                  .filter((value) => value.length > 0)
                  .join('\n\n')
            ) ??
            normalizeReasoningContent(partialReasoningContent)
          assistantReasoningContent = finishedReasoningContent
          const providerReasoningTokens = extractReasoningTokens(
            asObject(result)?.providerMetadata
          )
          const finishOutputTokens = result.usage?.outputTokens || 0

          logEvent('stream.finish', {
            elapsedMsFromStreamStart: Date.now() - streamStartedAtMs,
            usage: result.usage
              ? {
                  inputTokens: result.usage.inputTokens || 0,
                  outputTokens: result.usage.outputTokens || 0,
                  totalTokens: result.usage.totalTokens || 0,
                }
              : null,
            creditsUsed,
            reasoningTokens: providerReasoningTokens,
            reasoningTokensIncludedInOutput:
              providerReasoningTokens !== null
                ? finishOutputTokens >= providerReasoningTokens
                : null,
            stepsCount: result.steps?.length ?? 0,
            partialTextLength: partialContent.length,
            partialReasoningLength: partialReasoningContent.length,
            hadPriorError: Boolean(firstError),
            hadAbort: sawAbort,
          })

          await finalizeAssistantLifecycle({
            content: mapAssistantStepContent(result.steps),
            reasoningContent: finishedReasoningContent,
            rawCreditsUsed,
            phase: 'complete',
          })

          if (!firstError) {
            emitFinalOnce('success', {
              elapsedMsFromStreamStart: Date.now() - streamStartedAtMs,
              usage: result.usage
                ? {
                    inputTokens: result.usage.inputTokens || 0,
                    outputTokens: result.usage.outputTokens || 0,
                    totalTokens: result.usage.totalTokens || 0,
                  }
                : null,
              stepsCount: result.steps?.length ?? 0,
            })
          }
        },

        onAbort: async (steps) => {
          sawAbort = true
          let rawCreditsUsed: number | null = null
          if (steps && Array.isArray(steps.steps)) {
            let totalCost = 0
            let hasUsage = false
            const costBase = selectedModelConfig.cost

            for (const step of steps.steps) {
              if (step.usage) {
                hasUsage = true
                totalCost += calcCost(
                  costBase,
                  step.usage.inputTokens || 0,
                  step.usage.outputTokens || 0
                )
              }
            }

            if (hasUsage) {
              rawCreditsUsed = totalCost + imageDescriptionCost
            }
          }
          const { rawCreditsUsed: normalizedRawCreditsUsed, creditsUsed } =
            normalizeCredits(rawCreditsUsed, 'abort')

          const abortedAssistantContent = buildAbortedAssistantContent(
            Array.isArray(steps?.steps) ? steps.steps : undefined,
            currentStepContent
          )
          const abortedReasoningContent = normalizeReasoningContent(
            abortedAssistantContent
              .flatMap((part) => (part.type === 'reasoning' ? [part.text] : []))
              .join('\n\n')
          )
          assistantReasoningContent = abortedReasoningContent

          logEvent('stream.abort', {
            elapsedMsFromStreamStart: Date.now() - streamStartedAtMs,
            stepsCount: Array.isArray(steps?.steps) ? steps.steps.length : 0,
            creditsUsed,
            partialTextLength: partialContent.length,
            partialReasoningLength: partialReasoningContent.length,
          })

          // The marker-only result still closes an aborted lifecycle when the
          // provider reports no reliable usage.
          await finalizeAssistantLifecycle({
            content: abortedAssistantContent,
            reasoningContent: abortedReasoningContent,
            rawCreditsUsed: normalizedRawCreditsUsed,
            phase: 'abort',
          })

          emitFinalOnce('aborted', {
            elapsedMsFromStreamStart: Date.now() - streamStartedAtMs,
            stepsCount: Array.isArray(steps?.steps) ? steps.steps.length : 0,
          })
        },

        onStepEnd: async (step) => {
          currentStepContent = []
          const diagnostics = collectStepToolDiagnostics(step)
          const toolCallNames = Array.from(
            new Set(diagnostics.map((diagnostic) => diagnostic.toolName))
          )
          const toolCallsCount = diagnostics.length
          const providerReasoningTokens = extractReasoningTokens(
            asObject(step)?.providerMetadata
          )
          const stepOutputTokens = step.usage?.outputTokens || 0
          logEvent('stream.step.finish', {
            elapsedMsFromStreamStart: Date.now() - streamStartedAtMs,
            finishReason: step.finishReason,
            warningsCount: step.warnings?.length ?? 0,
            usage: step.usage
              ? {
                  inputTokens: step.usage.inputTokens || 0,
                  outputTokens: step.usage.outputTokens || 0,
                  totalTokens: step.usage.totalTokens || 0,
                }
              : null,
            reasoningTokens: providerReasoningTokens,
            reasoningTokensIncludedInOutput:
              providerReasoningTokens !== null
                ? stepOutputTokens >= providerReasoningTokens
                : null,
            toolCallsCount,
            toolCallNames,
            toolDiagnostics: diagnostics,
          })
        },

        onError: async (error) => {
          const serializedError = serializeStreamError(error)
          firstError = firstError ?? serializedError
          const classification = classifyStreamError(serializedError)

          logEvent(
            'stream.error',
            {
              elapsedMsFromStreamStart: Date.now() - streamStartedAtMs,
              ...serializedError,
              classification: classification.classification,
              retryable: classification.retryable,
              suggestedAction: classification.suggestedAction,
            },
            'error'
          )

          console.error('Error during streaming response:', {
            requestId,
            error: serializedError,
          })

          emitFinalOnce('error', {
            elapsedMsFromStreamStart: Date.now() - streamStartedAtMs,
            classification: classification.classification,
          })
          await failAssistantClaim('stream.error')
        },
      })
    }

    // The wrapper span only exists to put the derived trace id on the context the
    // AI SDK reads when it opens its own spans; it is created and closed around
    // the synchronous streamText call, while the spans it parents keep streaming.
    const result = traceId
      ? startActiveObservation('chat.stream', startStream, {
          parentSpanContext: getParentSpanContext(traceId),
        })
      : startStream()

    logEvent('response.stream.created', {
      stage: 'response-object-created',
      elapsedMsFromRequestStart: Date.now() - requestStartedAtMs,
    })

    return result.toUIMessageStreamResponse({
      sendReasoning: true,
      consumeSseStream: consumeStream,
      onError: (error) => {
        const serializedError = serializeStreamError(error)
        const classification = classifyStreamError(serializedError)

        console.error('Error while streaming UI message response:', {
          requestId,
          error: serializedError,
          classification: classification.classification,
          retryable: classification.retryable,
          suggestedAction: classification.suggestedAction,
        })
        void failAssistantClaim('response.stream.error')

        return 'An error occurred while processing the request.'
      },
      messageMetadata: ({ part }) => {
        if (part.type !== 'finish') {
          return undefined
        }

        const computedRawCreditsUsed = part.totalUsage
          ? calcCost(
              selectedModelConfig.cost,
              part.totalUsage.inputTokens || 0,
              part.totalUsage.outputTokens || 0
            ) + imageDescriptionCost
          : null
        const { creditsUsed } = normalizeCredits(
          computedRawCreditsUsed,
          'metadata'
        )

        return {
          finishReason: part.finishReason,
          chatMode: selectedMode,
          modelId: selectedModelConfig.id,
          reasoningEffort: appliedReasoningEffort,
          reasoningContent: assistantReasoningContent,
          creditsUsed,
        }
      },
    })
  } catch (error) {
    if (providerStreamStarted) await failAssistantClaim('request')
    else await failOrDiscardUnstartedClaim('request')
    throw error
  }
}

// Function to calculate cost based on token usage and model pricing
function calcCost(
  costBase: { input: number; output: number },
  inputTokens: number,
  outputTokens: number
) {
  return (
    (costBase.input * (inputTokens || 0) +
      costBase.output * (outputTokens || 0)) /
    1000000
  )
}
