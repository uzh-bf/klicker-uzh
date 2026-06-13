// Offline proof of branch-correct compression (no model needed).
// Run: DATABASE_URL='postgres://klicker-prod:klicker@localhost:5432/klicker-prod' \
//      node_modules/.bin/tsx src/check-summary.ts
//
// Inserts two summaries on Thread A: one anchored on the SHARED ancestor (a3,
// the "sorting algorithms" turn) and one anchored on the ABANDONED fork (a5y,
// the quicksort worst-case turn). Asserts:
//   - the active (graph) leaf selects the shared-anchor summary, never the fork one
//   - the abandoned (quicksort) leaf selects the deeper fork-anchor summary
// proving deepest-on-path selection and fork isolation.
import { pool } from './pool.js'
import { getActiveBranchPath, getThreadLeaves } from './engine/branch.js'
import { insertSummary, selectSummaryForLeaf } from './engine/summary.js'

function textOf(content: unknown): string {
  return Array.isArray(content)
    ? content.map((p) => (p && typeof p === 'object' && 'text' in p ? (p as { text: string }).text : '')).join(' ')
    : ''
}

let failures = 0
function assert(cond: boolean, msg: string) {
  console.log(`${cond ? '✅' : '❌'} ${msg}`)
  if (!cond) failures++
}

async function findMessageId(threadId: string, needle: string): Promise<string> {
  const { rows } = await pool.query(
    `SELECT id, content FROM "ChatMessage" WHERE "threadId" = $1`,
    [threadId]
  )
  const hit = rows.find((r) => textOf(r.content).toLowerCase().includes(needle.toLowerCase()))
  if (!hit) throw new Error(`no message containing "${needle}"`)
  return hit.id
}

async function main() {
  const { rows: tr } = await pool.query(
    `SELECT id FROM "ChatThread" WHERE title = 'PROTO::branched-recall' LIMIT 1`
  )
  if (!tr[0]) throw new Error('fixture missing — run src/fixture.ts first')
  const threadId = tr[0].id as string

  // Clean prior summaries for a deterministic run.
  await pool.query(`DELETE FROM mastra_proto.message_summary WHERE thread_id = $1`, [threadId])

  const a3 = await findMessageId(threadId, "Let's start with sorting") // shared ancestor
  const a5y = await findMessageId(threadId, "worst-case behaviour") // abandoned fork turn

  await insertSummary({ threadId, anchorMessageId: a3, summary: 'SUMMARY@shared(a3): Dana, algorithms exam, started on sorting.', coversCount: 3 })
  await insertSummary({ threadId, anchorMessageId: a5y, summary: 'SUMMARY@fork(a5y): deep dive into quicksort worst case.', coversCount: 6 })

  const leaves = await getThreadLeaves(threadId)
  let activeLeaf = ''
  let abandonedLeaf = ''
  for (const leaf of leaves) {
    const joined = (await getActiveBranchPath(leaf)).map((m) => textOf(m.content)).join(' ').toLowerCase()
    if (joined.includes('dijkstra')) activeLeaf = leaf
    if (joined.includes('median-of-three')) abandonedLeaf = leaf
  }

  // Active (graph) leaf: a5y is OFF its path, so only the shared a3 summary applies.
  const activePick = await selectSummaryForLeaf(activeLeaf)
  assert(activePick?.anchorMessageId === a3,
    'active leaf selects the shared-ancestor summary (a3), not the fork summary')
  assert(!(activePick?.summary ?? '').includes('@fork'),
    'active leaf NEVER receives the abandoned-fork summary')

  // Abandoned (quicksort) leaf: a5y IS on its path and is deeper than a3, so it wins.
  const abandonedPick = await selectSummaryForLeaf(abandonedLeaf)
  assert(abandonedPick?.anchorMessageId === a5y,
    'abandoned leaf selects the deeper fork-anchor summary (a5y) — deepest-on-path wins')

  console.log(failures === 0 ? '\nALL COMPRESSION BRANCH-CORRECTNESS CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`)
  await pool.end()
  process.exit(failures === 0 ? 0 : 1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
