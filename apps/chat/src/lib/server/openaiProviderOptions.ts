import { createTraceId } from '@langfuse/tracing'
import { getTraceIdForMessage } from './langfuseTracing'

const PROMPT_CACHE_KEY_SEED = 'klicker:prompt-cache:v1:'

type OpenAIProviderOptionsInput = {
  assistantMessageId: string
  owningThreadId: string | null
  routingSource: 'custom' | 'default'
}

type DefaultOpenAIProviderOptions = {
  metadata: { session_id: string }
  promptCacheKey?: string
}

export function getOpenAIProviderOptions(
  input: OpenAIProviderOptionsInput & { routingSource: 'default' }
): Promise<DefaultOpenAIProviderOptions>
export function getOpenAIProviderOptions(
  input: OpenAIProviderOptionsInput & { routingSource: 'custom' }
): Promise<Record<string, never>>
export function getOpenAIProviderOptions(
  input: OpenAIProviderOptionsInput
): Promise<DefaultOpenAIProviderOptions | Record<string, never>>

/**
 * Build provider fields that are stable for one response and one thread.
 *
 * The default route sends LiteLLM's metadata.session_id for routing affinity
 * and the OpenAI provider's promptCacheKey for prefix-cache locality. Both
 * values stay pseudonymous so provider requests do not expose Klicker
 * database ids. Custom chatbot endpoints do not receive these gateway fields.
 */
export async function getOpenAIProviderOptions({
  assistantMessageId,
  owningThreadId,
  routingSource,
}: OpenAIProviderOptionsInput) {
  if (routingSource !== 'default') return {}

  const sessionId = await getTraceIdForMessage(assistantMessageId)

  return {
    metadata: { session_id: sessionId },
    ...(owningThreadId
      ? {
          promptCacheKey: await createTraceId(
            `${PROMPT_CACHE_KEY_SEED}${owningThreadId}`
          ),
        }
      : {}),
  }
}
