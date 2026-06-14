// A2 reasoning-streaming validation against the STANDARD OpenAI / Azure AI Foundry
// Responses API (no OpenRouter). Run under Infisical, remapping the provider env to
// Azure for dev (the dev OPENAI_BASE_URL is still OpenRouter):
//   infisical run --env=dev --path=/ -- sh -c \
//     'OPENAI_BASE_URL=https://klicker-ai.openai.azure.com/openai/v1/ \
//      OPENAI_API_KEY=$AZURE_API_KEY node_modules/.bin/tsx src/check-reasoning.ts'
//
// Reasoning summaries are surfaced via the Responses API (providerOptions.openai.
// reasoningSummary:'detailed', set in responsesProviderOptions) — NOT Chat
// Completions, which hides reasoning as opaque reasoning_tokens.
//
// PROVIDER QUIRK (measured, not a pipeline bug): on Azure gpt-5.1 the reasoning
// SUMMARY is bursty and NON-STATIONARY — a response streams either a full summary
// (~75-85 deltas) or NONE, and the non-empty rate drifts over the minute or two a
// batch of calls takes (seen swinging 0/6 → 3/6 across back-to-back windows).
// Bisecting raw @ai-sdk/openai streamText vs Mastra's raw fullStream vs the
// converted v6 stream showed all three rise and fall TOGETHER as that window
// drifts — the conversion never drops text the provider emitted in the same window;
// the empties are the provider's. (A converted-batch-then-raw-batch comparison is
// therefore invalid: it confounds the pipeline with the time drift between batches.)
//
// The reasoning ITEM is deterministic — reasoning-start always fires — so we gate on
// that, and treat summary TEXT as positive-proof-or-warn:
//   Leg 1 (REASONING model, env.REASONING_MODEL_ID = gpt-5.1):
//     • CHANNEL (hard gate, deterministic): every converted v6 run emits >=1
//       reasoning-start — the frontend-facing stream carries the reasoning channel.
//     • TEXT (positive proof): the first converted run with non-empty reasoning-delta
//       definitively proves the pipeline carries summary text end-to-end → pass. If
//       the whole window is bursty-empty, we WARN (not fail): the channel is already
//       proven, and an all-empty window can't be pinned on the pipeline without
//       interleaved A/B sampling the provider's drift makes impractical here.
//   Leg 2 (NON-reasoning model, gpt-4.1-mini — the designated test model): a normal
//     text stream with ZERO reasoning parts (correct: gpt-4.1-mini cannot reason),
//     confirming store:true is accepted and no spurious reasoning is injected.
// Mastra streams are single-consumer, so each attempt uses its own agent.stream().
import { toAISdkStream } from '@mastra/ai-sdk'
import { buildAgent, responsesProviderOptions } from './engine/agent.js'
import { getChatbot, type ChatbotConfig } from './db.js'
import { pool } from './pool.js'
import { env } from './env.js'

const CHATBOT_ID = '11111111-1111-4111-8111-111111111111'
const REASONING_EFFORT = 'medium'
// Converted trials to catch one non-empty summary. Sized to clear an observed
// bursty-empty window (~6 in a row); a positive ends the loop early.
const MAX_TRIALS = 8
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

let failures = 0
function assert(cond: boolean, msg: string) {
  console.log(`${cond ? '✅' : '❌'} ${msg}`)
  if (!cond) failures++
}

// Minimal structural view of a converted v6 UI part (avoids depending on the exact
// discriminated-union exports across Mastra/AI-SDK versions). Reasoning and text
// payloads both arrive under `delta`.
type UiChunk = { type: string; delta?: string }

type Counts = { reasoningStarts: number; reasoningText: string; textChars: number }

// Drain a converted v6 UI stream, counting reasoning-start chunks, concatenating
// reasoning-delta text, and tallying text-delta length.
async function drain(stream: ReadableStream<UiChunk>): Promise<Counts> {
  let reasoningStarts = 0
  let reasoningText = ''
  let textChars = 0
  const reader = stream.getReader()
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    if (value.type === 'reasoning-start') reasoningStarts++
    else if (value.type === 'reasoning-delta') reasoningText += value.delta ?? ''
    else if (value.type === 'text-delta') textChars += (value.delta ?? '').length
  }
  return { reasoningStarts, reasoningText, textChars }
}

// One agent run, drained as the converted v6 UI stream — the EXACT frontend-facing
// shape the server emits (via toAISdkStream sendReasoning:true), with the real
// Responses-API providerOptions (store:true; reasoning options only when engaged).
// Both legs use this so the non-reasoning baseline is checked on the same path.
async function convertedCounts(
  chatbot: ChatbotConfig,
  modelId: string,
  effort: string | undefined
): Promise<Counts> {
  const stream = buildAgent(chatbot, 'tutor', modelId).stream(PROMPT as never, {
    providerOptions: responsesProviderOptions(modelId, effort).options,
  })
  const ui = toAISdkStream(await stream, { from: 'agent', version: 'v6', sendReasoning: true })
  return drain(ui as unknown as ReadableStream<UiChunk>)
}

async function main() {
  const chatbot = await getChatbot(CHATBOT_ID)
  if (!chatbot) throw new Error('fixture chatbot missing — run src/fixture.ts first')

  // ── Leg 1: REASONING model ────────────────────────────────────────────────
  console.log(`reasoning model: ${env.REASONING_MODEL_ID} (effort: ${REASONING_EFFORT})`)
  let allStarted = true // CHANNEL: reasoning-start must fire on every converted run
  let summary = '' // first non-empty summary observed → definitive text proof
  for (let trial = 1; trial <= MAX_TRIALS; trial++) {
    const r = await convertedCounts(chatbot, env.REASONING_MODEL_ID, REASONING_EFFORT)
    if (r.reasoningStarts < 1) allStarted = false
    console.log(`  converted trial ${trial}: reasoning-start=${r.reasoningStarts}, reasoning-chars=${r.reasoningText.length}`)
    if (r.reasoningText.trim().length > 0) {
      summary = r.reasoningText
      break // one non-empty converted run definitively proves text carriage
    }
  }

  assert(allStarted, 'every converted v6 run emits >=1 reasoning-start — pipeline carries the reasoning channel')
  if (summary) {
    console.log('✅ converted v6 stream carries non-empty reasoning-delta text end-to-end')
    console.log(`\n--- reasoning summary (first 200 chars) ---\n${summary.slice(0, 200)}\n---`)
  } else {
    console.log(
      `⚠️  no summary text across ${MAX_TRIALS} trials — bursty-empty provider window ` +
        `(Azure gpt-5.1 summaries are non-stationary; see header). Reasoning channel ` +
        `proven by reasoning-start above; not treated as a pipeline fault.`
    )
  }

  // ── Leg 2: NON-reasoning baseline (gpt-4.1-mini) — text, no reasoning parts ──
  // Drained through the SAME converted v6 path the frontend sees, so "zero reasoning
  // parts" is asserted on exactly what the UI receives — the conversion can't smuggle
  // in spurious reasoning for a non-reasoning model.
  console.log(`\nbaseline model: ${env.FALLBACK_MODEL_ID} (no effort)`)
  const base = await convertedCounts(chatbot, env.FALLBACK_MODEL_ID, undefined)
  assert(base.textChars > 0, `baseline emits a non-empty text stream (${base.textChars} chars) — store:true accepted`)
  assert(base.reasoningStarts === 0, `baseline emits ZERO reasoning parts (got ${base.reasoningStarts}) — correct for a non-reasoning model`)

  console.log(failures === 0 ? '\nALL REASONING CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`)
  await pool.end()
  process.exit(failures === 0 ? 0 : 1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
