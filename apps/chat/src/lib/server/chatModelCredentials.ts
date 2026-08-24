import { createOpenAI } from '@ai-sdk/openai'
import type { Chatbot } from '@klicker-uzh/prisma/client'
import { safeDecrypt } from '@klicker-uzh/util'

import type { ChatModelConfig } from '@/src/lib/server/chatModelRegistry'
import { createOpenAIFetch } from '@/src/lib/server/openaiCachePolicy'

export type ModelRouting = {
  source: 'custom' | 'default'
  hasCustomKey: boolean
  baseUrl: string | undefined
}

type CustomModelCredential = {
  kind: 'custom'
  apiKey: string
  baseUrl: string
}

type DefaultModelCredential = {
  kind: 'default'
  baseUrl: string | undefined
}

export type ResolvedModelCredential =
  | CustomModelCredential
  | DefaultModelCredential

/**
 * Resolve the credential for one model request. A platform credential may only
 * leave through the platform endpoint; a chatbot-controlled endpoint is usable
 * only together with that chatbot's own key.
 */
export function resolveModelCredential(chatbot: {
  id: string
  openaiApiKey: string | null
  openaiBaseUrl: string | null
}): ResolvedModelCredential {
  const hasCustomBaseUrl =
    typeof chatbot.openaiBaseUrl === 'string' &&
    chatbot.openaiBaseUrl.length > 0

  if (
    typeof chatbot.openaiApiKey === 'string' &&
    chatbot.openaiApiKey.length > 0
  ) {
    try {
      const apiKey = safeDecrypt(chatbot.openaiApiKey)
      const baseUrl = hasCustomBaseUrl
        ? chatbot.openaiBaseUrl!
        : process.env.OPENAI_BASE_URL

      if (!baseUrl) {
        throw new Error('No base URL available for chatbot API key')
      }

      return { kind: 'custom', apiKey, baseUrl }
    } catch (error) {
      console.error('Failed to decrypt API key for chatbot:', {
        chatbotId: chatbot.id,
        error,
      })
      throw new Error(`Failed to decrypt API key for chatbot ${chatbot.id}`)
    }
  }

  if (hasCustomBaseUrl) {
    throw new Error(
      `Chatbot ${chatbot.id} has a custom base URL without its own API key`
    )
  }

  return { kind: 'default', baseUrl: process.env.OPENAI_BASE_URL }
}

function getOpenAIModel(
  provider: ReturnType<typeof createOpenAI>,
  modelConfig: ChatModelConfig
) {
  return modelConfig.usesResponsesApi
    ? provider.responses(modelConfig.deploymentId)
    : provider.chat(modelConfig.deploymentId)
}

export function getModel(
  chatbot: Chatbot,
  modelConfig: ChatModelConfig
): {
  model: ReturnType<ReturnType<typeof createOpenAI>['chat']>
  routing: ModelRouting
} {
  const credential = resolveModelCredential(chatbot)

  if (credential.kind === 'custom') {
    return {
      model: getOpenAIModel(
        createOpenAI({
          baseURL: credential.baseUrl,
          apiKey: credential.apiKey,
          fetch: createOpenAIFetch('custom'),
        }),
        modelConfig
      ),
      routing: {
        source: 'custom',
        hasCustomKey: true,
        baseUrl: credential.baseUrl,
      },
    }
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
    routing: {
      source: 'default',
      hasCustomKey: false,
      baseUrl: credential.baseUrl,
    },
  }
}
