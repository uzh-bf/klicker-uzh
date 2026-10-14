type RoutingSource = 'custom' | 'default'

type JsonObject = Record<string, unknown>

const EXACT_RESPONSE_CACHE_BYPASS = {
  'no-cache': true,
  'no-store': true,
} as const

/** Enforces the opt-in evaluator boundary before provider construction. */
export function assertEvaluationRouting(
  chatbot: { openaiApiKey?: string | null; openaiBaseUrl?: string | null },
  env: Record<string, string | undefined> = process.env
) {
  const origin = env.KLICKER_EVAL_GUARD_ORIGIN
  if (!origin) return

  let url: URL
  try {
    url = new URL(origin)
  } catch {
    throw new Error('evaluation_guard_origin_invalid')
  }
  if (
    !['http:', 'https:'].includes(url.protocol) ||
    !(
      url.hostname === '127.0.0.1' ||
      url.hostname === '[::1]' ||
      url.hostname === 'localhost' ||
      url.hostname.endsWith('.localhost')
    ) ||
    url.origin !== origin
  ) {
    throw new Error('evaluation_guard_origin_invalid')
  }
  if (env.OPENAI_BASE_URL !== `${origin}/v1`) {
    throw new Error('evaluation_guard_endpoint_mismatch')
  }
  if (chatbot.openaiApiKey || chatbot.openaiBaseUrl) {
    throw new Error('evaluation_guard_chatbot_override')
  }
}

function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function parseJsonObject(body: string): JsonObject | undefined {
  try {
    const value = JSON.parse(body)
    return isJsonObject(value) ? value : undefined
  } catch (error) {
    if (error instanceof SyntaxError) return undefined
    throw error
  }
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

    const body = parseJsonObject(init.body)
    if (!body) {
      // Non-JSON request bodies pass through unchanged.
      return fetchImpl(input, init)
    }

    patchResponsesInput(body)

    if (routingSource === 'default') {
      body.cache = {
        ...(isJsonObject(body.cache) ? body.cache : {}),
        ...EXACT_RESPONSE_CACHE_BYPASS,
      }
    }

    return fetchImpl(input, { ...init, body: JSON.stringify(body) })
  }
}
