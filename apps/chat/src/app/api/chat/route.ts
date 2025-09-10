import { anthropic } from '@ai-sdk/anthropic'
import { openai } from '@ai-sdk/openai'
import { prisma } from '@klicker-uzh/prisma'
import {
  convertToModelMessages,
  stepCountIs,
  streamText,
  UIMessage,
  type LanguageModel,
} from 'ai'
import { JWTPayload, jwtVerify } from 'jose'
import { NextRequest, NextResponse } from 'next/server'
import { getSystemPrompt, type ChatbotMode } from '../../../lib/config/prompts'
import { getContext7Tools } from '../../services/mcpClients'
import { ThreadService } from '../../services/threads'
import { RAGSearch } from '../../services/tools'

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
    chatMode,
    parentId,
    assistantMessageId,
  }: {
    messages: Array<{ id: string; role: string; content: string }>
    threadId: string | null
    selectedModel: string
    chatMode?: ChatbotMode
    parentId?: string | null
    assistantMessageId: string
  } = await req.json()

  let currentThreadId = threadId
  let userMessageId: string | null = null

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

  // track partial content for cancelled streams
  let partialContent = ''

  // convert to UIMessage format
  const uiMessages: UIMessage[] = messages.map((msg) => ({
    id: msg.id,
    role: msg.role as 'user' | 'assistant',
    content: msg.content,
    parts: [{ type: 'text' as const, text: msg.content }],
  }))

  const context7Tools = await getContext7Tools()

  const result = streamText({
    model: getModel(selectedModel),
    messages: convertToModelMessages(uiMessages),
    tools: {
      RAGSearch,
      ...context7Tools,
    },
    toolChoice: 'auto',
    stopWhen: stepCountIs(5),
    system: getSystemPrompt(chatMode),

    abortSignal: req.signal,

    onChunk: ({ chunk }) => {
      if (chunk.type === 'text-delta' && chunk.text) {
        partialContent += chunk.text
      }
    },

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
      console.error('ERRORRRR:', error)
    },
  })
  return result.toUIMessageStreamResponse()
}
