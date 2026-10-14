import { createOpenAI } from '@ai-sdk/openai'
import type { Chatbot } from '@klicker-uzh/prisma/client'
import { safeDecrypt } from '@klicker-uzh/util'
import { createOpenAIFetch } from '@/src/lib/server/openaiCachePolicy'
import { getRouteLogger } from '@/src/lib/server/requestLogging'
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
  const source: ChatModelRouting['source'] = hasCustomConfig
    ? 'custom'
    : 'default'
  let apiKey = process.env.OPENAI_API_KEY

  if (hasCustomKey) {
    try {
      apiKey = safeDecrypt(chatbot.openaiApiKey!)
    } catch (error) {
      getRouteLogger().error(
        { event: 'chat.provider.key_decryption.failed' },
        'Failed to decrypt API key for chatbot'
      )
      throw new Error(`Failed to decrypt API key for chatbot ${chatbot.id}`)
    }
  }

  return {
    model: getOpenAIModel(
      createOpenAI({
        baseURL: hasCustomBaseUrl
          ? chatbot.openaiBaseUrl!
          : process.env.OPENAI_BASE_URL,
        apiKey: apiKey || 'no-key',
        fetch: createOpenAIFetch(source),
      }),
      modelConfig
    ),
    routing: { source },
  }
}
