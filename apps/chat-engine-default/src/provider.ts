import { createOpenAI } from '@ai-sdk/openai'
import type { ResolvedGeneration } from '@klicker-uzh/chat-engine-contract'
import type { LanguageModel } from 'ai'

export type ProviderConfig = {
  deploymentBaseUrl?: string
  deploymentApiKey?: string
  providerAllowedOrigins?: ReadonlySet<string>
}

/**
 * The current chat route needs this small Responses API compatibility patch for
 * strict OpenAI-compatible providers. Keeping it in the engine makes the
 * provider behavior identical while removing provider details from chat-api.
 */
export const responsesApiFetch: typeof globalThis.fetch = async (
  input,
  init
) => {
  if (init?.body && typeof init.body === 'string') {
    try {
      const body = JSON.parse(init.body) as { input?: unknown }
      if (Array.isArray(body.input)) {
        body.input = body.input.map((item: Record<string, unknown>) =>
          item.role === 'assistant'
            ? { ...item, type: 'message', status: 'completed' }
            : item
        )
        init = { ...init, body: JSON.stringify(body) }
      }
    } catch (error) {
      if (!(error instanceof SyntaxError)) throw error
    }
  }
  return globalThis.fetch(input, init)
}

export function createProviderModel(
  generation: ResolvedGeneration,
  providerApiKey: string,
  config: ProviderConfig
): LanguageModel {
  const baseUrl =
    generation.credentialMode.mode === 'gateway'
      ? generation.credentialMode.gatewayOrigin
      : config.deploymentBaseUrl
  if (!baseUrl) {
    throw new Error('Deployment provider base URL is not configured.')
  }

  const provider = createOpenAI({
    baseURL: baseUrl,
    apiKey: providerApiKey,
    fetch: responsesApiFetch,
  })
  const usesResponsesApi = generation.reasoningEffort !== 'none'
  return usesResponsesApi
    ? provider.responses(generation.deploymentId)
    : provider.chat(generation.deploymentId)
}

export function providerOptionsForGeneration(generation: ResolvedGeneration) {
  const usesResponsesApi = generation.reasoningEffort !== 'none'
  return {
    openai: {
      ...(usesResponsesApi ? { store: generation.responseStorage } : {}),
      ...(usesResponsesApi
        ? {
            reasoningEffort: generation.reasoningEffort,
            reasoningSummary: generation.reasoningSummary,
          }
        : {}),
    },
  }
}
