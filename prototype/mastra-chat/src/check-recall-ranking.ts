// S4 ranking proof (needs the model for embeddings).
// Run under Infisical:
//   infisical run --env=dev --path=/ -- node_modules/.bin/tsx src/check-recall-ranking.ts
//
// On Thread A's active (graph) leaf, a graph-shortest-path query must rank the
// Dijkstra turn top, and NO quicksort-fork message may appear in the ranked set
// (branch-correctness carried from getRecallCandidates).
import { pool } from './pool.js'
import { getActiveBranchPath, getThreadLeaves } from './engine/branch.js'
import { rankRecall } from './engine/embeddings.js'

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

async function main() {
  const { rows: tr } = await pool.query(
    `SELECT id FROM "ChatThread" WHERE title = 'PROTO::branched-recall' LIMIT 1`
  )
  const threadId = tr[0].id as string
  const leaves = await getThreadLeaves(threadId)
  let activeLeaf = ''
  for (const leaf of leaves) {
    const joined = (await getActiveBranchPath(leaf)).map((m) => textOf(m.content)).join(' ').toLowerCase()
    if (joined.includes('dijkstra')) activeLeaf = leaf
  }

  const ranked = await rankRecall(activeLeaf, 'finding the shortest path in a weighted graph from a source', 3)
  console.log('--- ranked recall (active/graph branch) ---')
  for (const r of ranked) console.log(`${r.score.toFixed(3)}  [${r.role}] ${r.text.slice(0, 70)}`)
  console.log('-------------------------------------------')

  const joined = ranked.map((r) => r.text.toLowerCase()).join(' ')
  assert(ranked.length > 0, 'recall returned ranked candidates')
  assert(joined.includes('dijkstra') || joined.includes('graph'),
    'top-ranked recall is the relevant graph/Dijkstra content')
  assert(!joined.includes('worst-case behaviour') && !joined.includes('median-of-three'),
    'NO abandoned-fork (quicksort) content appears in the ranked set — branch-correct')

  console.log(failures === 0 ? '\nALL RANKING CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`)
  await pool.end()
  process.exit(failures === 0 ? 0 : 1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
