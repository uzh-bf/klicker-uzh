type RoutingSource = 'custom' | 'default'

type JsonObject = Record<string, unknown>

const EXACT_RESPONSE_CACHE_BYPASS = {
  'no-cache': true,
  'no-store': true,
} as const

function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function patchResponsesInput(body: JsonObject) {
  if (!Array.isArray(body.input)) return

  body.input = body.input.map((item: unknown) =>
    isJsonObject(item) && item.role === 'assistant'
      ? { ...item, type: 'message', status: 'completed' }
      : item
  )
}

/**
 * Creates the fetch boundary for an OpenAI-compatible chatbot provider.
 *
 * The default provider must not reuse personalized requests from LiteLLM's
 * exact-response cache. Custom chatbot endpoints keep their existing request
 * shape, while Responses requests still receive the compatibility fields that
 * strict providers require.
 */
export function createOpenAIFetch(
  routingSource: RoutingSource,
  fetchImpl: typeof globalThis.fetch = globalThis.fetch
): typeof globalThis.fetch {
  return async (input, init) => {
    if (!init?.body || typeof init.body !== 'string') {
      return fetchImpl(input, init)
    }

    try {
      const body = JSON.parse(init.body)
      if (!isJsonObject(body)) return fetchImpl(input, init)

      patchResponsesInput(body)

      if (routingSource === 'default') {
        body.cache = {
          ...(isJsonObject(body.cache) ? body.cache : {}),
          ...EXACT_RESPONSE_CACHE_BYPASS,
        }
      }

      return fetchImpl(input, { ...init, body: JSON.stringify(body) })
    } catch (error) {
      if (!(error instanceof SyntaxError)) throw error
      // Non-JSON request bodies pass through unchanged.
    }

    return fetchImpl(input, init)
  }
}
