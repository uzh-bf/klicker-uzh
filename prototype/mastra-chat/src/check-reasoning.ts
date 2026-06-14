// A2 reasoning-streaming validation (needs a reasoning-capable model). Run under
// Infisical:
//   infisical run --env=dev --path=/ -- node_modules/.bin/tsx src/check-reasoning.ts
//
// The step-1 transport check confirmed OpenRouter surfaces reasoning over Chat
// Completions (under a `reasoning` delta field) for the configured model. This
// asserts the Mastra -> AI-SDK-v6 bridge turns that transport into reasoning
// chunks at both layers our server depends on:
//   1. the RAW Mastra stream  — >=1 reasoning-start + non-empty reasoning-delta,
//   2. after toAISdkStream({ sendReasoning: true }) — the same, as v6 UI parts
//      (the exact shape the frontend's useChatResponse reads).
// Mastra streams are single-consumer, so we use TWO independent agent.stream()
// calls (raw, then converted) rather than double-reading one stream.
import { toAISdkStream } from '@mastra/ai-sdk'
import { buildAgent } from './engine/agent.js'
import { getChatbot } from './db.js'
import { pool } from './pool.js'
import { env } from './env.js'

const CHATBOT_ID = '11111111-1111-4111-8111-111111111111'
const PROMPT = [
  {
    role: 'user',
    parts: [
      {
        type: 'text',
        text:
          'Think step by step, showing your reasoning: a farmer has 17 sheep and ' +
          'all but 9 run away. How many remain? Then state the number.',
      },
    ],
  },
]
// Reasoning models run on the OpenRouter provider (see engine/agent.ts), whose
// reasoning toggle is providerOptions.openrouter.reasoning. Low effort keeps the
// trace short (and cheap) — we only need it to exist.
const REASONING = { openrouter: { reasoning: { effort: 'low' } } }

let failures = 0
function assert(cond: boolean, msg: string) {
  console.log(`${cond ? '✅' : '❌'} ${msg}`)
  if (!cond) failures++
}

// Minimal structural views of the two chunk shapes we inspect (avoids depending
// on the exact discriminated-union exports across Mastra/AI-SDK versions).
type RawChunk = { type: string; payload?: { text?: string } }
type UiChunk = { type: string; delta?: string }

// Drain a stream, counting reasoning-start chunks and concatenating
// reasoning-delta text. `textOf` adapts the two chunk shapes (raw payload.text vs
// converted UI delta) so the raw and converted legs share one counter.
async function countReasoning<T extends RawChunk | UiChunk>(
  stream: ReadableStream<T>,
  textOf: (c: T) => string
): Promise<{ starts: number; text: string }> {
  let starts = 0
  let text = ''
  const reader = stream.getReader()
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    if (value.type === 'reasoning-start') starts++
    else if (value.type === 'reasoning-delta') text += textOf(value)
  }
  return { starts, text }
}

async function newStream() {
  const chatbot = await getChatbot(CHATBOT_ID)
  if (!chatbot) throw new Error('fixture chatbot missing — run src/fixture.ts first')
  return buildAgent(chatbot, 'tutor', env.REASONING_MODEL_ID).stream(PROMPT as never, {
    providerOptions: REASONING,
  })
}

async function main() {
  console.log(`reasoning model: ${env.REASONING_MODEL_ID}`)

  // ── 1. RAW Mastra stream ────────────────────────────────────────────────
  const raw = await countReasoning(
    (await newStream()).fullStream as ReadableStream<RawChunk>,
    (c) => c.payload?.text ?? ''
  )
  assert(raw.starts >= 1, `raw Mastra stream emits >=1 reasoning-start (got ${raw.starts})`)
  assert(raw.text.trim().length > 0, `raw Mastra stream emits non-empty reasoning-delta (${raw.text.length} chars)`)
  console.log(`\n--- raw reasoning (first 200 chars) ---\n${raw.text.slice(0, 200)}\n---`)

  // ── 2. CONVERTED AI SDK v6 stream (sendReasoning: true) ──────────────────
  const ui = toAISdkStream(await newStream(), { from: 'agent', version: 'v6', sendReasoning: true })
  const conv = await countReasoning(ui as unknown as ReadableStream<UiChunk>, (c) => c.delta ?? '')
  assert(conv.starts >= 1, `converted v6 stream emits >=1 reasoning-start (got ${conv.starts})`)
  assert(conv.text.trim().length > 0, `converted v6 stream emits non-empty reasoning-delta (${conv.text.length} chars)`)

  console.log(failures === 0 ? '\nALL REASONING CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`)
  await pool.end()
  process.exit(failures === 0 ? 0 : 1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
