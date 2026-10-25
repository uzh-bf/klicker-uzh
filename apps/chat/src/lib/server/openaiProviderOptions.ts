import { getTraceIdForMessage } from './langfuseTracing'

type OpenAIProviderOptionsInput = {
  assistantMessageId: string
  chatbotId: string
  threadId: string
  routingSource: 'custom' | 'default'
}

type DefaultOpenAIProviderOptions = {
  metadata: { session_id: string }
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
 * Build the gateway routing fields for one assistant answer.
 *
 * The default route sends LiteLLM's `metadata.session_id` so every tool-loop
 * call of one answer stays on the same routed model. The value is the
 * pseudonymous Langfuse trace id of the answer, so provider requests never
 * expose Klicker database ids. Custom chatbot endpoints do not receive
 * gateway-specific fields.
 */
export async function getOpenAIProviderOptions({
  assistantMessageId,
  chatbotId,
  threadId,
  routingSource,
}: OpenAIProviderOptionsInput) {
  if (routingSource !== 'default') return {}

  return {
    metadata: {
      session_id: await getTraceIdForMessage({
        assistantMessageId,
        chatbotId,
        threadId,
      }),
    },
  }
}
