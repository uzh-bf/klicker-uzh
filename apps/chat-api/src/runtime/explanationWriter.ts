import { createOpenAI } from '@ai-sdk/openai'
import {
  createOpenAIFetch,
  providerOriginIsAllowed,
} from '@klicker-uzh/chat-engine-contract'
import { safeDecrypt } from '@klicker-uzh/util'
import { getOpenAIResponsesStore } from '../host/lib/server/openaiResponsesOptions.js'
import {
  type ExplanationWriter,
  explanationWriterReasoningEffort,
} from '../host/services/explainerService.js'
import type { ChatModelConfig } from '../policy/modelRegistry.js'
import type { ChatbotRecord } from './defaultDependencies.js'

/**
 * The writer is a second model call inside the explanation tool, so it needs
 * its own provider client: the deployment endpoint, or the chatbot's own one
 * when the turn runs there. Missing credentials leave the tool reporting the
 * service as unavailable instead of failing the turn.
 */
export function createExplanationWriter({
  chatbot,
  customRouting,
  writerConfig,
  providerAllowedOrigins,
}: {
  chatbot: Pick<ChatbotRecord, 'openaiApiKey' | 'openaiBaseUrl'>
  customRouting: boolean
  writerConfig: ChatModelConfig
  providerAllowedOrigins: ReadonlySet<string>
}): ExplanationWriter {
  const baseUrl = customRouting
    ? (chatbot.openaiBaseUrl ?? process.env.OPENAI_BASE_URL)
    : process.env.OPENAI_BASE_URL
  if (!baseUrl)
    throw new Error('The explanation writer endpoint is not configured.')
  if (
    customRouting &&
    !providerOriginIsAllowed(baseUrl, providerAllowedOrigins)
  )
    throw new Error('The explanation writer endpoint is not allowed.')
  const apiKey = chatbot.openaiApiKey
    ? safeDecrypt(chatbot.openaiApiKey)
    : process.env.OPENAI_API_KEY
  if (!apiKey)
    throw new Error('The explanation writer credential is not configured.')

  const effort = explanationWriterReasoningEffort(writerConfig)
  const provider = createOpenAI({
    baseURL: baseUrl,
    apiKey,
    fetch: createOpenAIFetch(customRouting ? 'custom' : 'default'),
  })
  return {
    modelId: writerConfig.id,
    model: writerConfig.usesResponsesApi
      ? provider.responses(writerConfig.deploymentId)
      : provider.chat(writerConfig.deploymentId),
    providerOptions: {
      openai: {
        ...(writerConfig.usesResponsesApi
          ? { store: getOpenAIResponsesStore() }
          : {}),
        // Deployment ids defeat the SDK's model-id based reasoning detection.
        ...(effort ? { forceReasoning: true, reasoningEffort: effort } : {}),
      },
    },
  }
}
