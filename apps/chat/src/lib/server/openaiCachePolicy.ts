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

export { createOpenAIFetch } from '@klicker-uzh/chat-api/host/lib/server/openaiResponsesOptions'
