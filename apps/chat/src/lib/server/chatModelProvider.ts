import { createOpenAI } from '@ai-sdk/openai'
import type { Chatbot } from '@klicker-uzh/prisma/client'
import { safeDecrypt } from '@klicker-uzh/util'
import { createOpenAIFetch } from '@/src/lib/server/openaiCachePolicy'
import type { ChatModelConfig } from './chatModelRegistry'

export type ChatModelRouting = {
  source: 'custom' | 'default'
}

function getOpenAIModel(
  provider: ReturnType<typeof createOpenAI>,
  modelConfig: ChatModelConfig
) {
  return modelConfig.usesResponsesApi
    ? provider.responses(modelConfig.deploymentId)
    : provider.chat(modelConfig.deploymentId)
}

export function getChatModel(chatbot: Chatbot, modelConfig: ChatModelConfig) {
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

    const routing: ChatModelRouting = {
      source: 'custom',
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

  const routing: ChatModelRouting = {
    source: 'default',
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
