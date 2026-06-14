// S5 live proof (needs the model). Run under Infisical:
//   infisical run --env=dev --path=/ -- node_modules/.bin/tsx src/check-summary-live.ts
//
// The offline check (check-summary.ts) proves branch-correct SELECTION with
// hand-written strings. This proves the GENERATIVE half end to end on the long
// linear thread (PROTO::long-linear, 40 turns):
//   1. summarize the head (turns up to an anchor) with the real model,
//   2. store it anchored at that message,
//   3. confirm the leaf selects it (deepest-on-path),
//   4. MEASURE the input-token delta — full history vs (summary + recent tail) —
//      using the provider's own tokenizer (usage.prompt_tokens), not an estimate.
//
// NOTE: this measures the SAVING when compression fires. WHEN to fire (the gate /
// threshold) is deliberately deferred to production telemetry per S0.5 — dev has
// no representative thread-length distribution.
import { pool } from './pool.js'
import { getActiveBranchPath, getThreadLeaves } from './engine/branch.js'
import { insertSummary, selectSummaryForLeaf } from './engine/summary.js'
import { summarizeMessages, promptTokensOf, type Turn } from './engine/summarize.js'

let failures = 0
function assert(cond: boolean, msg: string) {
  console.log(`${cond ? '✅' : '❌'} ${msg}`)
  if (!cond) failures++
}

function textOf(content: unknown): string {
  return Array.isArray(content)
    ? content.map((p) => (p && typeof p === 'object' && 'text' in p ? (p as { text: string }).text : '')).join(' ')
    : ''
}

const SYSTEM_PROMPT =
  'You are a helpful course tutor. Use the conversation context to answer the ' +
  'student precisely and concisely.'

async function main() {
  const { rows: tr } = await pool.query(
    `SELECT id FROM "ChatThread" WHERE title = 'PROTO::long-linear' LIMIT 1`
  )
  if (!tr[0]) throw new Error('fixture missing — run src/fixture.ts first')
  const threadId = tr[0].id as string

  // Clean prior summaries for a deterministic run.
  await pool.query(`DELETE FROM mastra_proto.message_summary WHERE thread_id = $1`, [threadId])

  const [leaf] = await getThreadLeaves(threadId)
  const path = await getActiveBranchPath(leaf) // root -> leaf
  assert(path.length >= 30, `long thread has a deep path (${path.length} messages)`)

  // Anchor after the first 30 turns; the last 10 stay as the verbatim recent tail.
  const TAIL = 10
  const head = path.slice(0, path.length - TAIL)
  const tail = path.slice(path.length - TAIL)
  const anchor = head[head.length - 1]

  const headTurns: Turn[] = head.map((m) => ({ role: m.role === 'assistant' ? 'assistant' : 'user', text: textOf(m.content) }))
  const summary = await summarizeMessages(headTurns)
  assert(summary.length > 0, 'model produced a non-empty summary of the head')
  console.log('\n--- generated summary ---\n' + summary + '\n-------------------------')

  const id = await insertSummary({ threadId, anchorMessageId: anchor.id, summary, coversCount: head.length })
  assert(!!id, 'summary stored, anchored at the head boundary')

  // Branch-correct selection still holds for a real summary.
  const picked = await selectSummaryForLeaf(leaf)
  assert(picked?.anchorMessageId === anchor.id, 'leaf selects the on-path summary (deepest anchor)')

  // ── Measured token delta ────────────────────────────────────────────────
  // Baseline: the full conversation as model context.
  const fullContext = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...path.map((m) => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: textOf(m.content) })),
  ]
  // Compressed: system + summary-as-context + only the recent tail verbatim.
  const compressedContext = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'system', content: `Summary of earlier conversation:\n${summary}` },
    ...tail.map((m) => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: textOf(m.content) })),
  ]

  const baseTokens = await promptTokensOf(fullContext)
  const compTokens = await promptTokensOf(compressedContext)
  const saved = baseTokens - compTokens
  const pct = Math.round((100 * saved) / baseTokens)
  console.log(`\nfull-history prompt tokens:  ${baseTokens}`)
  console.log(`compressed prompt tokens:    ${compTokens}  (summary + last ${TAIL} turns)`)
  console.log(`saved:                       ${saved} tokens (${pct}%)`)
  assert(compTokens < baseTokens, `compression reduces input tokens (${pct}% saved on this thread)`)

  console.log(failures === 0 ? '\nALL LIVE COMPRESSION CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`)
  await pool.end()
  process.exit(failures === 0 ? 0 : 1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
