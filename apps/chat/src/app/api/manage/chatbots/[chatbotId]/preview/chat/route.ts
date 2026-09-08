import { randomUUID } from 'node:crypto'
import { prisma } from '@klicker-uzh/prisma'
import {
  consumeStream,
  convertToModelMessages,
  isStepCount,
  streamText,
  type ToolSet,
} from 'ai'
import { type NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { resolveOwnerPreviewModel } from '@/src/lib/ownerPreviewPolicy'
import { getChatModel } from '@/src/lib/server/chatModelProvider'
import {
  getAutomaticModelId,
  getModelsForChatbot,
} from '@/src/lib/server/chatModelRegistry'
import {
  resolveEffectiveChatModeOptions,
  resolveEffectiveMCPConfigurations,
  resolveRequestedChatMode,
} from '@/src/lib/server/effectiveChatModes'
import {
  MANAGE_CHAT_BODY_TIMEOUT_MS,
  MANAGE_CHAT_TOTAL_TIMEOUT_MS,
  readBoundedJson,
  validateManageChatRequest,
} from '@/src/lib/server/manageChatRequest'
import { REQUIRED_MCP_UNAVAILABLE_CODE } from '@/src/lib/server/mcpRuntimePolicy'
import { getOpenAIResponsesStore } from '@/src/lib/server/openaiResponsesOptions'
import { withOwnerPreviewAuth } from '@/src/lib/server/ownerPreviewAuth'
import { buildPromptCacheRequest } from '@/src/lib/server/promptCacheIdentity'
import { compileSystemPrompt } from '@/src/lib/server/systemPromptCompiler'
import { isDocQueryToolName } from '@/src/lib/sources/normalizeSources'
import {
  getAggregatedMCPTools,
  type MCPServerWithConfig,
  type MCPToolsHandle,
} from '@/src/services/mcpClients'
import { DOC_QUERY_MCP_SERVER_NAME } from '@/src/services/mcpScope'
import { createRateLimiter } from '@/src/services/rateLimiter'

export const runtime = 'nodejs'
export const maxDuration = 60

const PREVIEW_MAX_BODY_BYTES = 512 * 1024
const previewRateLimiter = createRateLimiter(20, 5 * 60 * 1000)

const previewOptionsSchema = z.object({
  selectedMode: z
    .string()
    .trim()
    .min(1)
    .max(100)
    .transform((value) => value.toLowerCase())
    .default('tutor'),
  selectedModel: z.string().trim().min(1).max(100).optional(),
  reasoningEffort: z.string().trim().min(1).max(100).nullable().optional(),
})

function isRequiredMcp(parameters: unknown): boolean {
  return Boolean(
    parameters &&
      typeof parameters === 'object' &&
      !Array.isArray(parameters) &&
      (parameters as Record<string, unknown>).required === true
  )
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ chatbotId: string }> }
) {
  const { chatbotId } = await params
  const auth = await withOwnerPreviewAuth(chatbotId)
  if ('response' in auth) return auth.response

  const rateLimit = previewRateLimiter.check(auth.userId)
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: 'Too many requests' },
      {
        status: 429,
        headers: {
          'Retry-After': String(Math.ceil(rateLimit.retryAfterMs / 1000)),
        },
      }
    )
  }

  const requestSignal = AbortSignal.any([
    req.signal,
    AbortSignal.timeout(MANAGE_CHAT_TOTAL_TIMEOUT_MS),
  ])
  const bodySignal = AbortSignal.any([
    requestSignal,
    AbortSignal.timeout(MANAGE_CHAT_BODY_TIMEOUT_MS),
  ])
  const body = await readBoundedJson(req, PREVIEW_MAX_BODY_BYTES, bodySignal)
  if (!body.ok) {
    return NextResponse.json(
      {
        error:
          body.error === 'TOO_LARGE'
            ? 'Request body too large'
            : body.error === 'TIMEOUT'
              ? 'Request timed out'
              : 'Invalid request body',
      },
      {
        status:
          body.error === 'TOO_LARGE'
            ? 413
            : body.error === 'TIMEOUT'
              ? 408
              : 400,
      }
    )
  }

  const options = previewOptionsSchema.safeParse(body.value)
  const parsed = await validateManageChatRequest(body.value)
  if (!options.success || !parsed) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }
  if (
    parsed.messages.some((message) =>
      message.parts.some((part) => part.type === 'file')
    )
  ) {
    return NextResponse.json(
      { error: 'Attachments are not available in preview' },
      { status: 400 }
    )
  }

  const chatbot = await prisma.chatbot.findUnique({
    where: { id: chatbotId, ownerId: auth.userId },
    include: {
      course: {
        select: { displayName: true },
      },
      knowledgeBases: {
        where: { isEnabled: true },
        select: { kbId: true },
        take: 1,
      },
      mcpConfigurations: {
        include: { mcpServer: true },
        orderBy: { priority: 'asc' },
      },
    },
  })
  if (!chatbot) {
    return NextResponse.json({ error: 'Chatbot not found' }, { status: 404 })
  }

  const modeOptions = resolveEffectiveChatModeOptions(
    chatbot.systemPrompts,
    chatbot.mcpConfigurations,
    chatbot.standardModeConfig
  )
  const selectedMode = resolveRequestedChatMode(
    modeOptions,
    options.data.selectedMode
  )
  if (!Object.hasOwn(modeOptions, selectedMode)) {
    return NextResponse.json(
      { error: `Unsupported chat mode: ${selectedMode}` },
      { status: 400 }
    )
  }

  const modeConfigurations = resolveEffectiveMCPConfigurations(
    chatbot.mcpConfigurations,
    selectedMode
  )
  if (
    modeConfigurations.some(
      (configuration) =>
        configuration.mcpServer.name !== DOC_QUERY_MCP_SERVER_NAME &&
        isRequiredMcp(configuration.parameters)
    )
  ) {
    return NextResponse.json(
      { error: 'This chatbot mode cannot be previewed yet' },
      { status: 503 }
    )
  }

  const models = getModelsForChatbot(chatbot).map((model) => {
    return {
      ...model,
      // getModelsForChatbot applies the saved reasoning allow-list and keeps
      // the normalized capabilities under supportedReasoningEfforts. The
      // preview helper uses the public ModelOption name for the same list.
      allowedReasoningEfforts: model.supportedReasoningEfforts,
    }
  })
  const modelResolution = resolveOwnerPreviewModel({
    modelSelection: chatbot.modelSelection,
    models,
    automaticModelId: getAutomaticModelId(chatbot.allowedModelIds),
    requestedModelId: options.data.selectedModel,
    requestedReasoningEffort: options.data.reasoningEffort,
  })
  if (!modelResolution.model) {
    const isExplicitStudentModelRequest =
      chatbot.modelSelection && options.data.selectedModel !== undefined
    const status =
      modelResolution.reason === 'MODEL_UNAVAILABLE' &&
      !isExplicitStudentModelRequest
        ? 503
        : 400
    return NextResponse.json(
      {
        error:
          modelResolution.reason === 'MODEL_UNAVAILABLE'
            ? 'Model is not available for this chatbot'
            : modelResolution.reason === 'REASONING_EFFORT_NOT_SUPPORTED'
              ? 'This model does not support reasoning effort selection'
              : 'Reasoning effort is not available for this model',
      },
      { status }
    )
  }

  const { model: selectedModel, reasoningEffort } = modelResolution

  const kbConfigurations: MCPServerWithConfig[] = modeConfigurations
    .filter(
      (configuration) =>
        configuration.mcpServer.name === DOC_QUERY_MCP_SERVER_NAME
    )
    .map((configuration) => ({
      server: {
        id: configuration.mcpServer.id,
        name: configuration.mcpServer.name,
        url: configuration.mcpServer.url,
        authType: configuration.mcpServer.authType,
        authSecret: configuration.mcpServer.authSecret ?? '',
        parameters: configuration.mcpServer.parameters,
        isActive: configuration.mcpServer.isActive,
        passChatbotId: configuration.mcpServer.passChatbotId,
        chatbotIdHeader: configuration.mcpServer.chatbotIdHeader ?? undefined,
      },
      config: {
        allowedTools: ['doc_query'],
        parameters: configuration.parameters,
        priority: configuration.priority,
      },
    }))

  let mcpToolsHandle: MCPToolsHandle | undefined
  const closeMcpTools = async () => {
    const activeHandle = mcpToolsHandle
    mcpToolsHandle = undefined
    await activeHandle?.close()
  }

  let tools: ToolSet
  try {
    mcpToolsHandle = await getAggregatedMCPTools(kbConfigurations, {
      chatbotId,
      authMode: 'account',
      kbIds: chatbot.knowledgeBases.map(({ kbId }) => kbId),
      sessionId: randomUUID(),
    })
    tools = mcpToolsHandle.tools
  } catch (error) {
    await closeMcpTools()
    console.error('Owner preview MCP discovery failed:', {
      chatbotId,
      errorType: error instanceof Error ? error.name : typeof error,
    })
    return NextResponse.json(
      { error: 'Required chatbot tools are unavailable' },
      { status: 503 }
    )
  }

  try {
    const toolNames = Object.keys(tools)
    const quizzerDocQueryToolName =
      selectedMode === 'quizzer'
        ? toolNames.find(isDocQueryToolName)
        : undefined

    if (selectedMode === 'quizzer' && !quizzerDocQueryToolName) {
      await closeMcpTools()
      return NextResponse.json(
        {
          error: 'Required MCP tool unavailable',
          code: REQUIRED_MCP_UNAVAILABLE_CODE,
        },
        { status: 503 }
      )
    }
    const systemPrompt = compileSystemPrompt(
      chatbot.systemPrompts,
      selectedMode,
      {
        courseDisplayName: chatbot.course.displayName,
        toolNames,
        standardModeConfig: chatbot.standardModeConfig,
      }
    )

    const modelMessages = await convertToModelMessages(parsed.messages, {
      ignoreIncompleteToolCalls: true,
    })
    const { model, routing } = getChatModel(chatbot, selectedModel)
    const promptCacheRequest =
      routing.source === 'default'
        ? await buildPromptCacheRequest({
            deploymentId: selectedModel.deploymentId,
            transport: selectedModel.usesResponsesApi ? 'responses' : 'chat',
            instructions: systemPrompt,
            tools,
          })
        : null

    const result = streamText({
      abortSignal: requestSignal,
      maxOutputTokens: selectedModel.maxOutputTokens,
      messages: modelMessages,
      model,
      instructions: systemPrompt,
      providerOptions: {
        openai: {
          ...(promptCacheRequest
            ? { promptCacheKey: promptCacheRequest.promptCacheKey }
            : {}),
          ...(selectedModel.usesResponsesApi && {
            // Multi-step retrieval can reference provider response items. Keep
            // the platform policy here while leaving KlickerUZH conversations
            // stateless: this route never writes threads or messages.
            store: getOpenAIResponsesStore(),
          }),
          ...(reasoningEffort && reasoningEffort !== 'none'
            ? {
                reasoningEffort,
                reasoningSummary: 'auto' as const,
              }
            : {}),
        },
      },
      stopWhen: isStepCount(5),
      toolChoice: 'auto',
      prepareStep: quizzerDocQueryToolName
        ? ({ stepNumber }) =>
            stepNumber === 0
              ? {
                  toolChoice: {
                    type: 'tool' as const,
                    toolName: quizzerDocQueryToolName,
                  },
                }
              : {}
        : undefined,
      tools: promptCacheRequest?.tools ?? tools,
      toolOrder: promptCacheRequest?.toolOrder,
      onEnd: closeMcpTools,
      onAbort: closeMcpTools,
      onError: async (error) => {
        await closeMcpTools()
        console.error('Owner preview stream failed:', {
          chatbotId,
          errorType: error instanceof Error ? error.name : typeof error,
        })
      },
    })

    return result.toUIMessageStreamResponse({
      originalMessages: parsed.messages,
      sendReasoning: true,
      consumeSseStream: consumeStream,
      onError: (error) => {
        void closeMcpTools()
        console.error('Owner preview UI stream failed:', {
          chatbotId,
          errorType: error instanceof Error ? error.name : typeof error,
        })
        return 'Chatbot preview request failed'
      },
      messageMetadata: ({ part }) =>
        part.type === 'finish'
          ? {
              chatMode: selectedMode,
              modelId: selectedModel.id,
              reasoningEffort,
            }
          : undefined,
    })
  } catch (error) {
    await closeMcpTools()
    console.error('Owner preview request failed:', {
      chatbotId,
      errorType: error instanceof Error ? error.name : typeof error,
    })
    return NextResponse.json(
      { error: 'Chatbot preview request failed' },
      { status: 500 }
    )
  }
}
