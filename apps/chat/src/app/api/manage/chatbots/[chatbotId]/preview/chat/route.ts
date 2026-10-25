import { randomUUID } from 'node:crypto'
import { prisma } from '@klicker-uzh/prisma'
import { isChatUsageClassEntitled } from '@klicker-uzh/util'
import {
  consumeStream,
  convertToModelMessages,
  isStepCount,
  streamText,
  type ToolSet,
} from 'ai'
import { type NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import {
  DEFAULT_ANSWER_STYLE,
  DEFAULT_ANSWER_TONE,
} from '@/src/lib/config/answerStyles'
import {
  answerStyleSchema,
  answerToneSchema,
} from '@/src/lib/server/answerStyleInstructions'
import { resolveOwnerPreviewModel } from '@/src/lib/ownerPreviewPolicy'
import { getChatModel } from '@/src/lib/server/chatModelProvider'
import {
  getAutomaticModelId,
  getModelsForChatbot,
} from '@/src/lib/server/chatModelRegistry'
import { withModelCitationIndices } from '@/src/lib/server/citationInstructions'
import {
  getCustomModeTurnSettings,
  resolveEffectiveChatModeOptions,
  resolveEffectiveMCPConfigurations,
  resolveRequestedChatMode,
} from '@/src/lib/server/effectiveChatModes'
import {
  formatMeetingClock,
  replyLanguageReminder,
} from '@/src/lib/server/languageInstructions'
import {
  MANAGE_CHAT_BODY_TIMEOUT_MS,
  MANAGE_CHAT_TOTAL_TIMEOUT_MS,
  readBoundedJson,
  validateManageChatRequest,
} from '@/src/lib/server/manageChatRequest'
import { REQUIRED_MCP_UNAVAILABLE_CODE } from '@/src/lib/server/mcpRuntimePolicy'
import { getOpenAIResponsesStore } from '@/src/lib/server/openaiResponsesOptions'
import { withOwnerPreviewAuth } from '@/src/lib/server/ownerPreviewAuth'
import { resolveOwnerPreviewModeConfiguration } from '@/src/lib/server/previewAuthoringConfig'
import { buildPromptCacheRequest } from '@/src/lib/server/promptCacheIdentity'
import {
  providerRefusalDeflection,
  providerRefusalTransform,
} from '@/src/lib/server/providerRefusal'
import { compileSystemPrompt } from '@/src/lib/server/systemPromptCompiler'
import { isDocQueryToolName } from '@/src/lib/sources/normalizeSources'
import { chatModelUnavailableResponse } from '@/src/services/accountUsage'
import {
  getAggregatedMCPTools,
  type MCPServerWithConfig,
  type MCPToolsHandle,
} from '@/src/services/mcpClients'
import {
  DOC_QUERY_MCP_SERVER_NAME,
  resolveMcpScope,
} from '@/src/services/mcpScope'
import { createRateLimiter } from '@/src/services/rateLimiter'

export const runtime = 'nodejs'
export const maxDuration = 60

const PREVIEW_MAX_BODY_BYTES = 512 * 1024
const previewRateLimiter = createRateLimiter(20, 5 * 60 * 1000)

const previewOptionsSchema = z.object({
  answerStyle: answerStyleSchema,
  answerTone: answerToneSchema,
  selectedMode: z.string().trim().min(1).max(100).default('tutor'),
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
      owner: {
        select: {
          aiFeaturesEnabled: true,
          aiSubscriptionTier: true,
          aiChatbotCostCenter: true,
        },
      },
      course: {
        select: { displayName: true },
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
  if (!chatbot.owner.aiFeaturesEnabled) {
    return NextResponse.json(
      { error: 'Account AI approval is required for preview' },
      { status: 403 }
    )
  }

  const enabledMCPConfigurations = chatbot.mcpConfigurations.filter(
    (configuration) => configuration.isEnabled !== false
  )
  const modeOptions = resolveEffectiveChatModeOptions(
    chatbot.systemPrompts,
    chatbot.mcpConfigurations,
    chatbot.standardModeConfig,
    {
      allowUnapprovedModes: true,
      customModeConfig: resolveOwnerPreviewModeConfiguration(chatbot),
    }
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

  // Preview is owner-funded and writes no usage row, so it skips the budget
  // pre-check. Class admission still applies: an account without the advanced
  // tier and a cost center cannot start an advanced preview turn, exactly as in
  // the participant route.
  if (
    !isChatUsageClassEntitled({
      usageClass: selectedModel.usageClass,
      aiFeaturesEnabled: chatbot.owner.aiFeaturesEnabled,
      aiSubscriptionTier: chatbot.owner.aiSubscriptionTier,
      aiChatbotCostCenter: chatbot.owner.aiChatbotCostCenter,
    })
  ) {
    return chatModelUnavailableResponse(selectedModel.usageClass)
  }

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
    const kbIds = resolveMcpScope(
      enabledMCPConfigurations,
      selectedMode,
      modeConfigurations
    )
    mcpToolsHandle = await getAggregatedMCPTools(kbConfigurations, {
      chatbotId,
      authMode: 'account',
      ownerPreviewUserId: auth.userId,
      kbIds,
      sessionId: randomUUID(),
      knowledgeGraphRetrievalEnabled: chatbot.knowledgeGraphRetrievalEnabled,
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
    const docQueryToolName = toolNames.find(isDocQueryToolName)
    const quizzerDocQueryToolName =
      selectedMode === 'quizzer' ? docQueryToolName : undefined

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
    const draftConfig = chatbot.draftConfig
    const savedAnswerPreferencesEnabled =
      draftConfig &&
      typeof draftConfig === 'object' &&
      !Array.isArray(draftConfig)
        ? (draftConfig as Record<string, unknown>).answerPreferencesEnabled
        : undefined
    const answerPreferencesEnabled =
      typeof savedAnswerPreferencesEnabled === 'boolean'
        ? savedAnswerPreferencesEnabled
        : chatbot.answerPreferencesEnabled
    const systemPrompt = compileSystemPrompt(
      chatbot.systemPrompts,
      selectedMode,
      {
        courseDisplayName: chatbot.course.displayName,
        toolNames,
        answerStyle: answerPreferencesEnabled
          ? options.data.answerStyle
          : DEFAULT_ANSWER_STYLE,
        answerTone: answerPreferencesEnabled
          ? options.data.answerTone
          : DEFAULT_ANSWER_TONE,
        standardModeConfig: chatbot.standardModeConfig,
        // Owner preview is an authoring surface, so it compiles the saved
        // revision's custom modes rather than the currently approved set.
        customModeConfig: resolveOwnerPreviewModeConfiguration(chatbot),
      }
    )
    // Preview persists no thread and its messages carry no timestamps, so a
    // meeting clock reports zero elapsed minutes here.
    const turnSettings = getCustomModeTurnSettings(
      resolveOwnerPreviewModeConfiguration(chatbot),
      selectedMode
    )
    const languageReminder = replyLanguageReminder(
      turnSettings.replyLanguage ?? null,
      formatMeetingClock(turnSettings.meetingClock ?? null, null, new Date())
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
            // Owner previews have no persisted thread, so one preview scope per
            // chatbot and mode shares the cached prefix.
            cacheScope: {
              chatbotId,
              mode: selectedMode,
              threadId: 'owner-preview',
            },
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
                // See the participant chat route: deployment ids defeat the
                // SDK's model-id based reasoning detection.
                forceReasoning: true,
                reasoningEffort,
                reasoningSummary: 'auto' as const,
              }
            : {}),
        },
      },
      stopWhen: isStepCount(5),
      // Same provider-refusal replacement as the participant chat.
      experimental_transform: providerRefusalTransform(
        providerRefusalDeflection(
          turnSettings.replyLanguage ?? null,
          req.cookies.get('NEXT_LOCALE')?.value
        ),
        (finish) =>
          console.warn('Owner preview provider refusal replaced:', {
            chatbotId,
            chatMode: selectedMode,
            ...finish,
          })
      ),
      toolChoice: 'auto',
      // The reply-language reminder ends every step, after tool output, so
      // retrieved material in another language cannot set the reply language.
      allowSystemInMessages: true,
      // Step continuations carry the canonical citation indices, the same
      // contract the participant chat applies. Without them the model has no
      // index to cite and falls back to prose citations without chips.
      prepareStep: ({
        stepNumber,
        steps,
        initialMessages,
        responseMessages,
      }) => ({
        ...(quizzerDocQueryToolName && stepNumber === 0
          ? {
              toolChoice: {
                type: 'tool' as const,
                toolName: quizzerDocQueryToolName,
              },
            }
          : {}),
        messages: [
          ...initialMessages,
          ...(docQueryToolName && stepNumber > 0
            ? withModelCitationIndices(responseMessages, steps)
            : responseMessages),
          languageReminder,
        ],
      }),
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
