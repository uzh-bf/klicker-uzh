import { getModelCost, type ModelID } from '@/src/lib/config/models'
import { getMCPTools } from '@/src/services/mcpClients'
import { anthropic } from '@ai-sdk/anthropic'
import { openai } from '@ai-sdk/openai'
import { prisma } from '@klicker-uzh/prisma'
import {
  convertToModelMessages,
  LanguageModel,
  stepCountIs,
  streamText,
  UIMessage,
} from 'ai'
import { JWTPayload, jwtVerify } from 'jose'
import { NextRequest, NextResponse } from 'next/server'
import { DEFAULT_PROMPT } from '../../../../../lib/config/prompts'
import { CreditsService } from '../../../../../services/credits'
import { ThreadService } from '../../../../../services/threads'

export const maxDuration = 30

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
  try {
    const jwtPayload = await jwtVerify(
      participantToken,
      new TextEncoder().encode(process.env.APP_SECRET || '')
    )
    participantData = jwtPayload.payload
  } catch (error) {
    console.error('Unexpected JWT verification failure in API route:', error)
    return NextResponse.json(
      { error: 'Invalid authentication token' },
      { status: 401 }
    )
  }

  const {
    messages,
    threadId,
    selectedModel,
    selectedMode,
    parentId,
    assistantMessageId,
  }: {
    messages: Array<{ id: string; role: string; content: string }>
    threadId: string | null
    selectedModel: ModelID
    selectedMode: string
    parentId?: string | null
    assistantMessageId: string
  } = await req.json()

  let currentThreadId = threadId
  let userMessageId: string | null = null

  // fetch system prompt for the selected chat mode from the database
  let systemPrompt = ''
  if (selectedMode) {
    try {
      const chatbot = await prisma.chatbot.findUnique({
        where: { id: chatbotId },
      })
      if (chatbot) {
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
      }
    } catch (error) {
      console.error('Failed to fetch system prompt:', error)
    }
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
        await prisma.chatMessage.create({
          data: {
            id: lastMessage.id,
            threadId: currentThreadId,
            parentId: parentId || null,
            role: lastMessage.role,
            content: [{ type: 'text', text: lastMessage.content }],
          },
        })

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

  function getModel(modelId: ModelID): LanguageModel {
    switch (modelId) {
      case 'gpt-4.1':
        return openai('gpt-4.1')
      case 'claude-sonnet-4-0':
        return anthropic('claude-sonnet-4-0')
      default:
        console.warn(`Unknown model: ${modelId}, defaulting to OpenAI GPT-4.1`)
        return openai('gpt-4.1')
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

  const mcpTools = await getMCPTools(chatbotId)

  const result = streamText({
    model: getModel(selectedModel),
    messages: convertToModelMessages(uiMessages),
    tools: {
      ...mcpTools,
    },
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
          await prisma.chatMessage.create({
            data: {
              id: assistantMessageId,
              threadId: currentThreadId,
              parentId: userMessageId,
              role: 'assistant',
              content: content,
            },
          })

          // update thread's timestamp
          await prisma.chatThread.update({
            where: { id: currentThreadId },
            data: { updatedAt: new Date() },
          })
        } catch (error) {
          console.error('Failed to save assistant message:', error)
        }
      }

      if (result.totalUsage) {
        try {
          const costBase = getModelCost(selectedModel)

          const totalCost =
            (costBase.input * (result.totalUsage.inputTokens || 0) +
              costBase.output * (result.totalUsage.outputTokens || 0)) /
            1000000

          const costTotal = totalCost

          if (participantData.sub) {
            await CreditsService.decrementCredits(
              participantData.sub as string,
              chatbotId,
              costTotal
            )
          }
        } catch (error) {
          console.error('Failed to deduct credits:', error)
        }
      }
    },

    onAbort: async () => {
      // save partial message
      if (currentThreadId && partialContent.trim()) {
        try {
          await prisma.chatMessage.create({
            data: {
              id: assistantMessageId,
              threadId: currentThreadId,
              parentId: userMessageId,
              role: 'assistant',
              content: [{ type: 'text', text: partialContent }],
            },
          })

          // update thread's timestamp
          await prisma.chatThread.update({
            where: { id: currentThreadId },
            data: { updatedAt: new Date() },
          })
        } catch (error) {
          console.error('Failed to save partial message:', error)
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
