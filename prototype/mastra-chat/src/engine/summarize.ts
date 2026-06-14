// S5 (model-time) — the generative half of DIY compression.
// Branch-correct SELECTION lives in summary.ts (pure graph logic). This module is
// the part that needs the model: turn a run of on-path turns into a compact
// summary, and measure the actual prompt-token cost of a message array using the
// provider's own tokenizer (usage.prompt_tokens) so the savings claim is measured,
// not estimated. Direct OpenAI-compatible calls mirror embeddings.ts.
import { env } from '../env.js'

export type Turn = { role: 'user' | 'assistant'; text: string }

const MODEL = env.PRIMARY_MODEL_ID

const SUMMARIZER_SYSTEM =
  'You compress a tutoring conversation into a dense factual summary for use as ' +
  'context in later turns. Preserve: the student’s stated facts/preferences, the ' +
  'topics covered and conclusions reached, and any open threads. Drop pleasantries ' +
  'and restated questions. Write 6–10 terse bullet points, no preamble.'

function chatBody(messages: { role: string; content: string }[], maxTokens: number) {
  return JSON.stringify({ model: MODEL, messages, max_tokens: maxTokens, temperature: 0 })
}

async function postChat(messages: { role: string; content: string }[], maxTokens: number) {
  const res = await fetch(`${env.OPENAI_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: { authorization: `Bearer ${env.OPENAI_API_KEY}`, 'content-type': 'application/json' },
    body: chatBody(messages, maxTokens),
  })
  if (!res.ok) throw new Error(`chat/completions ${res.status}: ${await res.text()}`)
  return (await res.json()) as {
    choices: { message: { content: string } }[]
    usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number }
  }
}

// Generate a real summary of a run of turns.
export async function summarizeMessages(turns: Turn[]): Promise<string> {
  const transcript = turns.map((t) => `${t.role.toUpperCase()}: ${t.text}`).join('\n\n')
  const json = await postChat(
    [
      { role: 'system', content: SUMMARIZER_SYSTEM },
      { role: 'user', content: `Summarize this conversation so far:\n\n${transcript}` },
    ],
    400
  )
  return json.choices[0].message.content.trim()
}

// Measured prompt-token count for a candidate context, from the provider's own
// tokenizer. We send the array with a tiny output cap and read usage.prompt_tokens
// — the input cost the model would actually pay for that context. (prompt_tokens
// is independent of the output cap; 16 is this provider's minimum max_output_tokens.)
export async function promptTokensOf(messages: { role: string; content: string }[]): Promise<number> {
  const json = await postChat(messages, 16)
  return json.usage.prompt_tokens
}
