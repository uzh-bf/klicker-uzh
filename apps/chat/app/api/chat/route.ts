import { getWeather, RAGSearch } from '@/app/tools'
import { anthropic } from '@ai-sdk/anthropic'
import { openai } from '@ai-sdk/openai'
import { PrismaClient } from '@klicker-uzh/prisma'
import {
  convertToModelMessages,
  stepCountIs,
  streamText,
  UIMessage,
  type LanguageModel,
} from 'ai'

export const maxDuration = 30

const prisma = new PrismaClient()

export async function POST(req: Request) {
  const {
    messages,
    threadId,
    selectedModel,
    systemPrompt,
    parentId,
    assistantMessageId,
  }: {
    messages: Array<{ id: string; role: string; content: string }>
    threadId: string | null
    selectedModel: string
    systemPrompt: string
    parentId?: string | null
    assistantMessageId: string
  } = await req.json()

  let currentThreadId = threadId
  let userMessageId: string | null = null

  // create a new thread if none exists
  if (!currentThreadId && messages.length > 0) {
    try {
      const newThread = await prisma.chatThread.create({
        data: {
          title: null,
        },
      })
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

  function getModel(modelName: string): LanguageModel {
    switch (modelName) {
      case 'openai':
        return openai('gpt-4.1')
      case 'anthropic':
        return anthropic('claude-sonnet-4-0')
      default:
        console.warn(
          `Unknown model: ${modelName}, defaulting to OpenAI GPT-4.1`
        )
        return openai('gpt-4.1')
    }
  }

  // convert to UIMessage format
  const uiMessages: UIMessage[] = messages.map((msg) => ({
    id: msg.id,
    role: msg.role as 'user' | 'assistant',
    content: msg.content,
    parts: [{ type: 'text' as const, text: msg.content }],
  }))

  const result = streamText({
    model: getModel(selectedModel),
    messages: convertToModelMessages(uiMessages),
    tools: {
      getWeather,
      RAGSearch,
    },
    toolChoice: 'auto',
    stopWhen: stepCountIs(5),
    system:
      systemPrompt ||
      'You are a helpful assistant. After using any tool, always provide a helpful summary or explanation of the results.',

    onFinish: async (result) => {
      // save assistant response to database
      if (currentThreadId && result.text) {
        try {
          await prisma.chatMessage.create({
            data: {
              id: assistantMessageId,
              threadId: currentThreadId,
              parentId: userMessageId,
              role: 'assistant',
              content: [{ type: 'text', text: result.text }],
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
    },
  })
  return result.toUIMessageStreamResponse()
}
