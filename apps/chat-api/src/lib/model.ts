// Per-chatbot OpenAI provider resolution, mirroring apps/chat route getModel().
// Two consumers:
//   1. resolveProviderConfig() -> { apiKey, baseUrl } feeds the engine's
//      ChatbotConfig (the engine's providerFor builds the agent's model from the
//      decrypted key + base URL). We resolve key/url here exactly as the route
//      does so the agent talks to the same backend.
//   2. buildImageDescriptionModel() builds a standalone @ai-sdk/openai model for
//      the per-image generateText() description calls (the engine owns the agent
//      model but not a free-standing model handle), threading the engine's
//      responsesApiFetch shim so those calls also use the Responses API surface.
import { createOpenAI } from '@ai-sdk/openai'
import { responsesApiFetch } from '@klicker-uzh/chat-engine'
import { safeDecrypt } from '@klicker-uzh/util'

type ChatbotProviderFields = {
  id: string
  openaiApiKey: string | null
  openaiBaseUrl: string | null
}

export type ProviderConfig = {
  apiKey: string | undefined
  baseUrl: string | undefined
}

// Resolve the effective { apiKey, baseUrl } for a chatbot. A per-chatbot custom
// key is decrypted; a missing custom key/url falls back to the env defaults —
// the same precedence the route applies (custom config wins per field, env
// fills the gaps). Throws if a present custom key cannot be decrypted, matching
// the route (a misconfigured key must fail loudly, not silently use the env key).
export function resolveProviderConfig(
  chatbot: ChatbotProviderFields
): ProviderConfig {
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

    return { apiKey, baseUrl }
  }

  return {
    apiKey: process.env.OPENAI_API_KEY,
    baseUrl: process.env.OPENAI_BASE_URL,
  }
}

// Build a Responses-API model handle for image description generateText() calls,
// using the resolved provider config and the shared body-shape shim.
export function buildImageDescriptionModel(
  provider: ProviderConfig,
  deploymentId: string
) {
  return createOpenAI({
    baseURL: provider.baseUrl,
    apiKey: provider.apiKey || 'no-key',
    fetch: responsesApiFetch,
  })(deploymentId)
}
