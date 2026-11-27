import { createOpenAI } from '@ai-sdk/openai'
import {
  createOpenAIFetch,
  type EngineV2ChatRequest,
  type ResolvedGeneration,
} from '@klicker-uzh/chat-engine-contract'
import type { LanguageModel } from 'ai'

export type ProviderConfig = {
  deploymentBaseUrl?: string
  deploymentApiKey?: string
  providerAllowedOrigins?: ReadonlySet<string>
}

export function createProviderModel(
  generation: ResolvedGeneration | EngineV2ChatRequest['generation'],
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
    fetch: createOpenAIFetch(
      generation.credentialMode.mode === 'gateway' ? 'custom' : 'default'
    ),
  })
  const usesResponsesApi =
    'providerApi' in generation && generation.providerApi
      ? generation.providerApi === 'responses'
      : generation.reasoningEffort !== 'none'
  return usesResponsesApi
    ? provider.responses(generation.deploymentId)
    : provider.chat(generation.deploymentId)
}

export function providerOptionsForGeneration(
  generation: ResolvedGeneration | EngineV2ChatRequest['generation']
) {
  const usesResponsesApi =
    'providerApi' in generation && generation.providerApi
      ? generation.providerApi === 'responses'
      : generation.reasoningEffort !== 'none'
  return {
    openai: {
      ...(usesResponsesApi ? { store: generation.responseStorage } : {}),
      ...(generation.reasoningEffort !== 'none'
        ? {
            forceReasoning: true,
            reasoningEffort: generation.reasoningEffort,
            reasoningSummary: generation.reasoningSummary,
          }
        : {}),
    },
  }
}
