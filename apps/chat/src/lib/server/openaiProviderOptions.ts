import { createTraceId } from '@langfuse/tracing'
import { getTraceIdForMessage } from './langfuseTracing'

const PROMPT_CACHE_KEY_SEED = 'klicker:prompt-cache:v1:'

type OpenAIProviderOptionsInput = {
  assistantMessageId: string
  owningThreadId: string | null
}

/**
 * Build provider fields that are stable for one response and one thread.
 *
 * LiteLLM reads metadata.session_id for routing affinity, while the OpenAI
 * provider uses promptCacheKey for prefix-cache locality. Both values stay
 * pseudonymous so provider requests do not expose Klicker database ids.
 */
export async function getOpenAIProviderOptions({
  assistantMessageId,
  owningThreadId,
}: OpenAIProviderOptionsInput) {
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
