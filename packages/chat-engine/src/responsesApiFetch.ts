// Custom fetch that patches the Responses API request body to add
// `type: 'message'` and `status: 'completed'` on assistant items. The AI SDK
// omits these fields, but strict Responses API providers (e.g. Azure OpenAI)
// reject assistant items without them — and the breakage is silent, biting only
// on MULTI-turn tool-call continuations. Ported verbatim from apps/chat's chat
// route so the engine matches production exactly.
//
// Workaround for: https://github.com/vercel/ai/issues/12754
export const responsesApiFetch: typeof globalThis.fetch = async (
  input,
  init
) => {
  if (init?.body && typeof init.body === 'string') {
    try {
      const body = JSON.parse(init.body)
      if (Array.isArray(body.input)) {
        body.input = body.input.map((item: Record<string, unknown>) =>
          item.role === 'assistant'
            ? { ...item, type: 'message', status: 'completed' }
            : item
        )
        init = { ...init, body: JSON.stringify(body) }
      }
    } catch (error) {
      if (error instanceof SyntaxError) {
        // not JSON, pass through
      } else {
        console.error(
          '[responsesApiFetch] Unexpected error patching body:',
          error
        )
        throw error
      }
    }
  }
  return globalThis.fetch(input, init)
}
