import { getWeather, RAGSearch } from '@/app/tools'
import { anthropic } from '@ai-sdk/anthropic'
import { openai } from '@ai-sdk/openai'
import {
  convertToModelMessages,
  stepCountIs,
  streamText,
  UIMessage,
  type LanguageModel,
} from 'ai'

export const maxDuration = 30

const BACKEND_URL = process.env.BACKEND_URL

export async function POST(req: Request) {
  const {
    messages,
    threadId,
    selectedModel,
    systemPrompt,
  }: {
    messages: Array<{ id: string; role: string; content: string }>
    threadId: string | null
    selectedModel: string
    systemPrompt: string
  } = await req.json()

  let currentThreadId = threadId

  // create a new thread if none exists
  if (!currentThreadId && messages.length > 0) {
    try {
      const response = await fetch(`/api/threads`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: null }),
      })
      const newThread = await response.json()
      currentThreadId = newThread.id
    } catch (error) {
      console.error('Failed to create thread:', error)
    }
  }

  // save user message to backend
  if (currentThreadId && messages.length > 0) {
    const lastMessage = messages[messages.length - 1]
    if (lastMessage.role === 'user') {
      try {
        await fetch(`${BACKEND_URL}/api/threads/${currentThreadId}/messages`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            role: lastMessage.role,
            content: [{ type: 'text', text: lastMessage.content }],
          }),
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
      // save assistant response to backend
      if (currentThreadId && result.text) {
        try {
          await fetch(
            `${BACKEND_URL}/api/threads/${currentThreadId}/messages`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                role: 'assistant',
                content: [{ type: 'text', text: result.text }],
              }),
            }
          )
        } catch (error) {
          console.error('Failed to save assistant message:', error)
        }
      }
    },
  })
  return result.toUIMessageStreamResponse()
}
