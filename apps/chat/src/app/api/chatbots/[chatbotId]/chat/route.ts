import {
  getModelCost,
  getModelLink,
  MODEL_IDS,
  type ModelID,
} from '@/src/lib/config/models'
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
import { JWTPayload, jwtVerify } from 'jose'
import { NextRequest, NextResponse } from 'next/server'
import { DEFAULT_PROMPT } from 'src/lib/config/prompts'
import { CreditsService } from 'src/services/credits'
import { DisclaimersService } from 'src/services/disclaimers'
import { ThreadService } from 'src/services/threads'
import { z } from 'zod'

export const maxDuration = 30

function getAzureModel(chatbot: Chatbot, modelId: ModelID): LanguageModel {
  const apiVersion = getModelLink(modelId).split('?api-version=')[1]

  // Use per-chatbot Azure configuration if available, otherwise fallback to environment
  const apiKey = chatbot?.azureOpenAIKey
    ? safeDecrypt(chatbot.azureOpenAIKey)
    : process.env.AZURE_API_KEY

  const resourceName = chatbot?.azureOpenAIEndpoint
    ? new URL(chatbot.azureOpenAIEndpoint).hostname.split('.')[0]
    : process.env.AZURE_RESOURCE_NAME || 'klicker-ai'

  const azure = createAzure({
    resourceName,
    apiKey,
    useDeploymentBasedUrls: true,
    apiVersion: apiVersion || 'preview',
  })

  return azure(modelId)
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
  const participantToken = req.cookies.get('participant_token')?.value

  if (!participantToken) {
    return NextResponse.json(
      { error: 'No authentication token found' },
      { status: 401 }
    )
  }

  let participantData: JWTPayload
  let participantId: string | null = null
  try {
    const jwtPayload = await jwtVerify(
      participantToken,
      new TextEncoder().encode(process.env.APP_SECRET || '')
    )
    participantData = jwtPayload.payload
    participantId =
      typeof participantData.sub === 'string' && participantData.sub
        ? participantData.sub
        : null
    if (!participantId) {
      return NextResponse.json(
        { error: 'Invalid authentication token' },
        { status: 401 }
      )
    }
  } catch (error) {
    console.error('Unexpected JWT verification failure in API route:', error)
    return NextResponse.json(
      { error: 'Invalid authentication token' },
      { status: 401 }
    )
  }

  // check participation
  try {
    const participation = await prisma.participation.findUnique({
      where: {
        courseId_participantId: {
          courseId:
            (
              await prisma.chatbot.findUnique({
                where: { id: chatbotId },
                select: { courseId: true },
              })
            )?.courseId ?? '',
          participantId: participantId,
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
    selectedModel: z.enum(MODEL_IDS),
    selectedMode: z
      .string()
      .optional()
      .transform((val) => val?.toLowerCase())
      .default('tutor'),
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
  const { messages, threadId, selectedMode, parentId, assistantMessageId } =
    parsed

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
        participantData.sub as string,
        chatbotId,
        null
      )
      currentThreadId = newThread.id
    } catch (error) {
      console.error('Failed to create thread:', error)
    }
  }

  // save user message to database
  if (currentThreadId && messages.length > 0) {
    const lastMessage = messages[messages.length - 1]
    if (lastMessage.role === 'user') {
      userMessageId = lastMessage.id

      try {
        // check if message already exists (e.g. in case of retries)
        const existingMessage = await prisma.chatMessage.findUnique({
          where: { id: userMessageId },
        })
        if (!existingMessage) {
          await prisma.chatMessage.create({
            data: {
              id: lastMessage.id,
              threadId: currentThreadId,
              parentId: parentId || null,
              role: lastMessage.role,
              content: [{ type: 'text', text: lastMessage.content }],
            },
          })
        }

        // update thread's timestamp
        await prisma.chatThread.update({
          where: { id: currentThreadId },
          data: { updatedAt: new Date() },
        })
      } catch (error) {
        console.error('Failed to save user message:', error)
      }
    }
  }

  // track partial content for cancelled streams
  let partialContent = ''

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
  // Override model selection if modelSelection is disabled
  if (!chatbot.modelSelection) {
    // Get current user credits to determine automatic model selection
    const userCredits = await CreditsService.getUserCredits(
      participantId,
      chatbotId
    )
    selectedModel = CreditsService.getAutomaticModel(userCredits) as any
  }

  const result = streamText({
    model: getAzureModel(chatbot, selectedModel),
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
    },

    onFinish: async (result) => {
      // save assistant response to database
      if (currentThreadId && result.steps && result.steps.length > 0) {
        try {
          const content = []

          for (const step of result.steps) {
            if (step.content && Array.isArray(step.content)) {
              if (
                step.content.length === 1 &&
                step.content[0].type === 'text'
              ) {
                // Case 1: single text content
                content.push({ type: 'text', text: step.content[0].text })
              } else if (step.content.length === 2) {
                // Case 2: tool call with tool-call and tool-result
                const toolCall = step.content.find(
                  (item) => item.type === 'tool-call'
                )
                const toolResult = step.content.find(
                  (item) => item.type === 'tool-result'
                )

                if (toolCall && toolResult) {
                  content.push({
                    type: 'tool-call',
                    toolCallId: toolCall.toolCallId,
                    toolName: toolCall.toolName,
                    args: toolCall.input,
                    result: toolResult.output,
                  })
                }
              }
            }
          }
          // save assistant message to db
          const existingMessage = await prisma.chatMessage.findUnique({
            where: { id: assistantMessageId },
          })
          if (!existingMessage) {
            await prisma.chatMessage.create({
              data: {
                id: assistantMessageId,
                threadId: currentThreadId,
                parentId: userMessageId,
                role: 'assistant',
                content: content,
              },
            })
          }

          // update thread's timestamp
          await prisma.chatThread.update({
            where: { id: currentThreadId },
            data: { updatedAt: new Date() },
          })
        } catch (error) {
          console.error('Failed to save assistant message:', error)
        }
      }

      // deduct credits
      if (result.totalUsage) {
        try {
          const costBase = getModelCost(selectedModel)

          const totalCost = calcCost(
            costBase,
            result.totalUsage.inputTokens || 0,
            result.totalUsage.outputTokens || 0
          )

          if (participantData.sub) {
            await CreditsService.decrementCredits(
              participantData.sub as string,
              chatbotId,
              totalCost
            )
          }
        } catch (error) {
          console.error('Failed to deduct credits:', error)
        }
      }
    },

    onAbort: async (steps) => {
      // save partial message
      if (currentThreadId && partialContent.trim()) {
        try {
          const existingMessage = await prisma.chatMessage.findUnique({
            where: { id: assistantMessageId },
          })
          if (!existingMessage) {
            await prisma.chatMessage.create({
              data: {
                id: assistantMessageId,
                threadId: currentThreadId,
                parentId: userMessageId,
                role: 'assistant',
                content: [{ type: 'text', text: partialContent }],
              },
            })
          }

          // update thread's timestamp
          await prisma.chatThread.update({
            where: { id: currentThreadId },
            data: { updatedAt: new Date() },
          })
        } catch (error) {
          console.error('Failed to save partial message:', error)
        }
      }

      if (steps) {
        let totalCost = 0
        const costBase = getModelCost(selectedModel)
        if (steps && Array.isArray(steps.steps)) {
          for (const step of steps.steps) {
            if (step.usage) {
              totalCost += calcCost(
                costBase,
                step.usage.inputTokens || 0,
                step.usage.outputTokens || 0
              )
            }
          }
          if (participantData.sub && totalCost > 0) {
            try {
              await CreditsService.decrementCredits(
                participantData.sub as string,
                chatbotId,
                totalCost
              )
            } catch (error) {
              console.error('Failed to deduct credits:', error)
            }
          }
        }
      }
    },

    onError: async (error) => {
      // handle error
      console.error('Error during streaming response:', error)
    },
  })
  return result.toUIMessageStreamResponse()
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
