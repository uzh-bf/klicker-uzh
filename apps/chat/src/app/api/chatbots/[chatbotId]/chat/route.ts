import { getChatbotOr404, getParticipantId } from '@/src/lib/server/apiGuards'
import {
  getAutomaticModelId,
  getChatModelRegistry,
} from '@/src/lib/server/chatModelRegistry'
import {
  getAggregatedMCPTools,
  type MCPServerWithConfig,
} from '@/src/services/mcpClients'
import { createAzure } from '@ai-sdk/azure'
import { prisma } from '@klicker-uzh/prisma'
import { Chatbot } from '@klicker-uzh/prisma/client'
import { safeDecrypt } from '@klicker-uzh/util'
import {
  convertToModelMessages,
  LanguageModel,
  stepCountIs,
  streamText,
  UIMessage,
} from 'ai'
import { NextRequest, NextResponse } from 'next/server'
import { DEFAULT_PROMPT } from 'src/lib/config/prompts'
import {
  GPT_5_1_MODEL_ID,
  REASONING_EFFORT_OPTIONS,
  type ReasoningEffort,
  supportsReasoningEffort,
} from 'src/lib/config/reasoning'
import { CreditsService } from 'src/services/credits'
import { DisclaimersService } from 'src/services/disclaimers'
import { ThreadService } from 'src/services/threads'
import { z } from 'zod'

export const maxDuration = 60

function getAzureModel(
  chatbot: Chatbot,
  deploymentId: string,
  apiVersion: string
): LanguageModel {
  // Use per-chatbot Azure configuration if available, otherwise fallback to environment
  const apiKey = chatbot?.azureOpenAIKey
    ? safeDecrypt(chatbot.azureOpenAIKey)
    : process.env.AZURE_API_KEY

  const resourceName = chatbot?.azureOpenAIEndpoint
    ? new URL(chatbot.azureOpenAIEndpoint).hostname.split('.')[0]
    : process.env.AZURE_RESOURCE_NAME || 'klicker-ai'

  const responsesApiVersion =
    process.env.AZURE_RESPONSES_API_VERSION || apiVersion || 'preview'

  const azure = createAzure({
    resourceName,
    apiKey,
    useDeploymentBasedUrls: false,
    apiVersion: responsesApiVersion,
  })

  return azure.responses(deploymentId)
}

const normalizeReasoningContent = (
  value: string | null | undefined
): string | null =>
  typeof value === 'string' && value.trim().length > 0 ? value : null

type PersistedAssistantContentPart =
  | { type: 'text'; text: string }
  | { type: 'reasoning'; text: string }
  | {
      type: 'tool-call'
      toolCallId: string
      toolName: string
      args?: unknown
      result?: unknown
    }

const mapAssistantStepContent = (
  steps: Array<{ content?: unknown[] }> | undefined
): PersistedAssistantContentPart[] => {
  const content: PersistedAssistantContentPart[] = []
  const toolCallIndexById = new Map<string, number>()

  for (const step of steps ?? []) {
    if (!Array.isArray(step.content)) continue

    for (const rawPart of step.content) {
      if (!rawPart || typeof rawPart !== 'object') continue

      const part = rawPart as {
        type?: unknown
        text?: unknown
        toolCallId?: unknown
        toolName?: unknown
        input?: unknown
        output?: unknown
      }

      if (part.type === 'text' && typeof part.text === 'string') {
        content.push({ type: 'text', text: part.text })
        continue
      }

      if (part.type === 'reasoning' && typeof part.text === 'string') {
        content.push({ type: 'reasoning', text: part.text })
        continue
      }

      if (
        part.type === 'tool-call' &&
        typeof part.toolCallId === 'string' &&
        typeof part.toolName === 'string'
      ) {
        const nextToolCall = {
          type: 'tool-call' as const,
          toolCallId: part.toolCallId,
          toolName: part.toolName,
          args: part.input,
        }
        content.push(nextToolCall)
        toolCallIndexById.set(nextToolCall.toolCallId, content.length - 1)
        continue
      }

      if (part.type === 'tool-result' && typeof part.toolCallId === 'string') {
        const toolCallIndex = toolCallIndexById.get(part.toolCallId)
        if (toolCallIndex !== undefined) {
          const existingToolCall = content[toolCallIndex]
          if (existingToolCall?.type === 'tool-call') {
            existingToolCall.result = part.output
          }
          continue
        }

        if (typeof part.toolName !== 'string') {
          continue
        }

        const toolCallWithResult = {
          type: 'tool-call' as const,
          toolCallId: part.toolCallId,
          toolName: part.toolName,
          args: {},
          result: part.output,
        }
        content.push(toolCallWithResult)
        toolCallIndexById.set(part.toolCallId, content.length - 1)
      }
    }
  }

  return content
}

/**
 * Main chat endpoint that processes AI conversations with streaming responses.
 * Handles thread creation, message persistence, and AI model interactions with tools.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ chatbotId: string }> }
) {
  const { chatbotId } = await params
  const participantResult = await getParticipantId(req)
  if ('response' in participantResult) {
    return participantResult.response
  }
  const { participantId } = participantResult

  const chatbotResult = await getChatbotOr404(chatbotId, { courseId: true })
  if ('response' in chatbotResult) {
    return chatbotResult.response
  }
  const { courseId } = chatbotResult.chatbot

  // check participation
  try {
    const participation = await prisma.participation.findUnique({
      where: {
        courseId_participantId: {
          courseId,
          participantId,
        },
      },
    })

    if (!participation) {
      return NextResponse.json(
        { error: 'No valid participation found for this chatbot' },
        { status: 403 }
      )
    }
  } catch (error) {
    console.error('Error checking participation:', error)
    return NextResponse.json(
      { error: 'Error checking participation' },
      { status: 500 }
    )
  }

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
    console.error('Error checking disclaimer status:', error)
    return NextResponse.json(
      { error: 'Error checking disclaimer status' },
      { status: 500 }
    )
  }

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
    reasoningEffort: z
      .enum(REASONING_EFFORT_OPTIONS)
      .optional()
      .default('none'),
    parentId: z.string().min(1).nullable().optional(),
    assistantMessageId: z.string().min(1),
  })
  let parsed
  try {
    parsed = bodySchema.parse(await req.json())
  } catch (e) {
    console.error('Invalid request body:', e)
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }
  const {
    messages,
    threadId,
    selectedMode,
    reasoningEffort: requestedReasoningEffort,
    parentId,
    assistantMessageId,
  } = parsed

  let selectedModel = parsed.selectedModel

  let currentThreadId = threadId
  let userMessageId: string | null = null

  // fetch chatbot with MCP configurations and system prompt
  let systemPrompt = ''
  let mcpServersWithConfigs: MCPServerWithConfig[] = []
  let chatbot = null

  try {
    chatbot = await prisma.chatbot.findUnique({
      where: { id: chatbotId },
      include: {
        mcpConfigurations: {
          where: {
            chatMode: selectedMode,
            isEnabled: true,
          },
          include: {
            mcpServer: true,
          },
          orderBy: { priority: 'asc' },
        },
      },
    })

    if (chatbot) {
      // Extract system prompt
      const systemPrompts = chatbot.systemPrompts as Record<
        string,
        Record<string, string>
      >
      if (systemPrompts && systemPrompts[selectedMode]) {
        systemPrompt =
          systemPrompts[selectedMode].prompt ||
          DEFAULT_PROMPT[selectedMode]?.prompt ||
          ''
      } else {
        systemPrompt = DEFAULT_PROMPT[selectedMode]?.prompt || ''
      }

      // Prepare MCP server configurations
      mcpServersWithConfigs =
        chatbot.mcpConfigurations
          ?.filter((config) => config.mcpServer?.isActive === true)
          ?.map((config) => ({
            server: {
              id: config.mcpServer.id,
              name: config.mcpServer.name,
              url: config.mcpServer.url,
              authType: config.mcpServer.authType,
              authSecret: config.mcpServer.authSecret ?? '',
              parameters: config.mcpServer.parameters,
            },
            config: {
              allowedTools: config.allowedTools as string[] | undefined,
              parameters: config.parameters,
              priority: config.priority,
            },
          })) || []
    }
  } catch (error) {
    console.error('Failed to fetch chatbot configuration:', error)
  }

  // create a new thread if none exists
  if (!currentThreadId && messages.length > 0) {
    try {
      const newThread = await ThreadService.createThread(
        participantId,
        chatbotId,
        null
      )
      currentThreadId = newThread.id
    } catch (error) {
      console.error('Failed to create thread:', error)
    }
  }

  const lastMessage = messages.length > 0 ? messages[messages.length - 1] : null
  if (lastMessage?.role === 'user') {
    userMessageId = lastMessage.id
  }

  // track partial content for cancelled streams
  let partialContent = ''
  let partialReasoningContent = ''
  let assistantReasoningContent: string | null = null

  // convert to UIMessage format
  const uiMessages: UIMessage[] = messages.map((msg) => ({
    id: msg.id,
    role: msg.role as 'user' | 'assistant',
    content: msg.content,
    parts: [{ type: 'text' as const, text: msg.content }],
  }))

  // Load MCP tools from database configurations or fallback to legacy
  const mcpTools = await getAggregatedMCPTools(mcpServersWithConfigs, chatbotId)

  if (!chatbot) {
    return NextResponse.json({ error: 'Chatbot not found' }, { status: 404 })
  }

  const modelRegistry = getChatModelRegistry()

  // Override model selection if modelSelection is disabled
  let userCredits: { current: number; total: number } | null = null
  if (!chatbot.modelSelection) {
    // Get current user credits to determine automatic model selection
    userCredits = await CreditsService.getUserCredits(participantId, chatbotId)
    selectedModel = getAutomaticModelId(userCredits)
  }

  let selectedModelConfig = modelRegistry.find((m) => m.id === selectedModel)
  if (!selectedModelConfig) {
    return NextResponse.json(
      { error: `Unknown model: ${selectedModel}` },
      { status: 400 }
    )
  }

  const maxOutputTokens =
    selectedModelConfig.id === GPT_5_1_MODEL_ID ? 2048 : undefined

  // Enforce fallback-only usage when the user has no credits left.
  // This prevents bypassing credit gating by manually calling the API.
  if (chatbot.modelSelection && !selectedModelConfig.fallback) {
    userCredits =
      userCredits ??
      (await CreditsService.getUserCredits(participantId, chatbotId))
    if (userCredits.current <= 0) {
      selectedModel = getAutomaticModelId(userCredits)
      selectedModelConfig = modelRegistry.find((m) => m.id === selectedModel)
      if (!selectedModelConfig) {
        return NextResponse.json(
          { error: `Unknown model: ${selectedModel}` },
          { status: 400 }
        )
      }
    }
  }

  const appliedReasoningEffort: ReasoningEffort | null =
    supportsReasoningEffort(selectedModelConfig.id)
      ? requestedReasoningEffort
      : null

  const providerReasoningEffort =
    appliedReasoningEffort && appliedReasoningEffort !== 'none'
      ? appliedReasoningEffort
      : undefined

  const owningThread = currentThreadId
    ? await prisma.chatThread.findFirst({
        where: {
          id: currentThreadId,
          participantId,
          chatbotId,
        },
        select: { id: true },
      })
    : null

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
        }
      }

      // update thread's timestamp
      await prisma.chatThread.update({
        where: { id: currentThreadId },
        data: { updatedAt: new Date() },
      })
    } catch (error) {
      console.error('Failed to save user message:', error)
    }
  } else if (currentThreadId && !owningThread && userMessageId) {
    console.warn('Skipping user message save: thread ownership mismatch', {
      messageId: userMessageId,
      threadId: currentThreadId,
    })
  }

  const result = streamText({
    model: getAzureModel(
      chatbot,
      selectedModelConfig.deploymentId,
      selectedModelConfig.apiVersion
    ),
    maxOutputTokens,
    providerOptions: providerReasoningEffort
      ? {
          openai: {
            reasoningEffort: providerReasoningEffort,
          },
        }
      : undefined,
    messages: convertToModelMessages(uiMessages),
    tools: mcpTools,
    toolChoice: 'auto',
    stopWhen: stepCountIs(5),
    system: systemPrompt,

    abortSignal: req.signal,

    onChunk: ({ chunk }) => {
      if (chunk.type === 'text-delta' && chunk.text) {
        partialContent += chunk.text
      }
      if (chunk.type === 'reasoning-delta' && chunk.text) {
        partialReasoningContent += chunk.text
      }
    },

    onFinish: async (result) => {
      const creditsUsed = result.totalUsage
        ? calcCost(
            selectedModelConfig.cost,
            result.totalUsage.inputTokens || 0,
            result.totalUsage.outputTokens || 0
          )
        : null
      const finishedReasoningContent =
        normalizeReasoningContent(
          result.reasoningText ||
            result.steps
              .map((step) => step.reasoningText || '')
              .filter((value) => value.length > 0)
              .join('')
        ) ?? normalizeReasoningContent(partialReasoningContent)
      assistantReasoningContent = finishedReasoningContent

      // save assistant response to database
      if (
        currentThreadId &&
        owningThread &&
        result.steps &&
        result.steps.length > 0
      ) {
        try {
          const content = mapAssistantStepContent(result.steps)
          // save assistant message to db
          const metadata = {
            chatMode: selectedMode,
            modelId: selectedModelConfig.id,
            reasoningEffort: appliedReasoningEffort,
            reasoningContent: finishedReasoningContent,
            creditsUsed,
          }
          const updated = await prisma.chatMessage.updateMany({
            where: { id: assistantMessageId, threadId: currentThreadId },
            data: {
              content,
              ...metadata,
            },
          })

          if (updated.count === 0) {
            const existingMessage = await prisma.chatMessage.findUnique({
              where: { id: assistantMessageId },
              select: { id: true },
            })

            if (existingMessage) {
              console.warn(
                'Skipping assistant message update: message exists outside current thread',
                {
                  messageId: assistantMessageId,
                  threadId: currentThreadId,
                }
              )
            } else {
              await prisma.chatMessage.create({
                data: {
                  id: assistantMessageId,
                  threadId: currentThreadId,
                  parentId: userMessageId,
                  role: 'assistant',
                  content: content,
                  ...metadata,
                },
              })
            }
          }

          // update thread's timestamp
          await prisma.chatThread.update({
            where: { id: currentThreadId },
            data: { updatedAt: new Date() },
          })
        } catch (error) {
          console.error('Failed to save assistant message:', error)
        }
      } else if (currentThreadId && !owningThread) {
        console.warn(
          'Skipping assistant message save: thread ownership mismatch',
          {
            messageId: assistantMessageId,
            threadId: currentThreadId,
          }
        )
      }

      // deduct credits
      if (creditsUsed !== null) {
        try {
          await CreditsService.decrementCredits(
            participantId,
            chatbotId,
            creditsUsed
          )
        } catch (error) {
          console.error('Failed to deduct credits:', error)
        }
      }
    },

    onAbort: async (steps) => {
      let creditsUsed: number | null = null
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
          creditsUsed = totalCost
        }

        if (creditsUsed !== null && creditsUsed > 0) {
          try {
            await CreditsService.decrementCredits(
              participantId,
              chatbotId,
              creditsUsed
            )
          } catch (error) {
            console.error('Failed to deduct credits:', error)
          }
        }
      }

      const abortedReasoningContent =
        normalizeReasoningContent(
          Array.isArray(steps?.steps)
            ? steps.steps
                .map((step) => step.reasoningText || '')
                .filter((value) => value.length > 0)
                .join('')
            : ''
        ) ?? normalizeReasoningContent(partialReasoningContent)
      assistantReasoningContent = abortedReasoningContent

      // save partial message
      if (
        currentThreadId &&
        owningThread &&
        (partialContent.trim() || abortedReasoningContent)
      ) {
        try {
          const partialAssistantContent: PersistedAssistantContentPart[] = []
          if (partialContent.trim()) {
            partialAssistantContent.push({ type: 'text', text: partialContent })
          }
          if (abortedReasoningContent) {
            partialAssistantContent.push({
              type: 'reasoning',
              text: abortedReasoningContent,
            })
          }

          const metadata = {
            chatMode: selectedMode,
            modelId: selectedModelConfig.id,
            reasoningEffort: appliedReasoningEffort,
            reasoningContent: abortedReasoningContent,
            creditsUsed,
          }
          const updated = await prisma.chatMessage.updateMany({
            where: { id: assistantMessageId, threadId: currentThreadId },
            data: {
              content: partialAssistantContent,
              ...metadata,
            },
          })

          if (updated.count === 0) {
            const existingMessage = await prisma.chatMessage.findUnique({
              where: { id: assistantMessageId },
              select: { id: true },
            })

            if (existingMessage) {
              console.warn(
                'Skipping assistant message update: message exists outside current thread',
                {
                  messageId: assistantMessageId,
                  threadId: currentThreadId,
                }
              )
            } else {
              await prisma.chatMessage.create({
                data: {
                  id: assistantMessageId,
                  threadId: currentThreadId,
                  parentId: userMessageId,
                  role: 'assistant',
                  content: partialAssistantContent,
                  ...metadata,
                },
              })
            }
          }

          // update thread's timestamp
          await prisma.chatThread.update({
            where: { id: currentThreadId },
            data: { updatedAt: new Date() },
          })
        } catch (error) {
          console.error('Failed to save partial message:', error)
        }
      } else if (
        currentThreadId &&
        !owningThread &&
        (partialContent.trim() || abortedReasoningContent)
      ) {
        console.warn(
          'Skipping assistant message save: thread ownership mismatch',
          {
            messageId: assistantMessageId,
            threadId: currentThreadId,
          }
        )
      }
    },

    onError: async (error) => {
      // handle error
      console.error('Error during streaming response:', error)
    },
  })
  return result.toUIMessageStreamResponse({
    sendReasoning: true,
    messageMetadata: ({ part }) => {
      if (part.type !== 'finish') {
        return undefined
      }

      const creditsUsed = part.totalUsage
        ? calcCost(
            selectedModelConfig.cost,
            part.totalUsage.inputTokens || 0,
            part.totalUsage.outputTokens || 0
          )
        : null

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
