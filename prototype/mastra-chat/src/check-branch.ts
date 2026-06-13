// Offline proof of branch-correct recall (no model needed).
// Run: DATABASE_URL='postgres://klicker-prod:klicker@localhost:5432/klicker-prod' \
//      node_modules/.bin/tsx src/check-branch.ts
//
// Uses the synthetic fixture (Thread A: a forked thread where the active branch
// pivots to graph algorithms and the abandoned branch dives into quicksort).
// Asserts that recall on the active leaf includes the shared ancestors and the
// active-branch turns, and EXCLUDES every message on the abandoned fork.
import { pool } from './pool.js'
import { getActiveBranchPath, getRecallCandidates, getThreadLeaves } from './engine/branch.js'

function textOf(content: unknown): string {
  if (Array.isArray(content)) {
    return content
      .map((p) => (p && typeof p === 'object' && 'text' in p ? (p as { text: string }).text : ''))
      .join(' ')
  }
  return ''
}

let failures = 0
function assert(cond: boolean, msg: string) {
  console.log(`${cond ? '✅' : '❌'} ${msg}`)
  if (!cond) failures++
}

async function main() {
  // Locate Thread A and its two leaves.
  const { rows: threadRows } = await pool.query(
    `SELECT id FROM "ChatThread" WHERE title = 'PROTO::branched-recall' LIMIT 1`
  )
  if (!threadRows[0]) throw new Error('fixture missing — run src/fixture.ts first')
  const threadId = threadRows[0].id as string

  const leaves = await getThreadLeaves(threadId)
  console.log(`Thread A has ${leaves.length} leaves`)
  assert(leaves.length === 2, 'thread A has exactly two leaves (it forked)')

  // Identify which leaf is the active (graph) branch vs the abandoned (quicksort).
  let activeLeaf = ''
  let abandonedLeaf = ''
  for (const leaf of leaves) {
    const path = await getActiveBranchPath(leaf)
    const joined = path.map((m) => textOf(m.content)).join(' ').toLowerCase()
    if (joined.includes('dijkstra') || joined.includes('graph algorithms')) activeLeaf = leaf
    if (joined.includes('quicksort')) abandonedLeaf = leaf
  }
  console.log(`active (graph) leaf:    ${activeLeaf}`)
  console.log(`abandoned (qsort) leaf: ${abandonedLeaf}`)
  assert(!!activeLeaf && !!abandonedLeaf && activeLeaf !== abandonedLeaf, 'two distinct branches identified')

  // Recall on the ACTIVE leaf.
  const candidates = await getRecallCandidates(activeLeaf)
  const candidateText = candidates.map((m) => textOf(m.content)).join(' \n ').toLowerCase()

  // Must include the shared ancestor facts and the active-branch content.
  assert(candidateText.includes('dana'), 'recall includes ancestor fact (name = Dana)')
  assert(candidateText.includes('algorithms exam'), 'recall includes ancestor fact (algorithms exam)')
  assert(candidateText.includes('graph algorithms') || candidateText.includes('dijkstra'),
    'recall includes active-branch content (graph/Dijkstra)')

  // The decisive assertion: fork-SPECIFIC content of the abandoned branch must be
  // excluded. Note the subtlety: the word "quicksort" also appears in the SHARED
  // ancestor a4 ("comparison sorts like merge sort and quicksort"), which is a
  // common parent of BOTH branches and is therefore correctly visible. Branch
  // isolation excludes the fork's *own* turns (the worst-case deep dive), not the
  // shared prefix. We assert on markers that live only on the abandoned fork.
  assert(!candidateText.includes('worst-case behaviour'),
    'recall EXCLUDES abandoned-fork turn (no quicksort worst-case deep dive)')
  assert(!candidateText.includes('median-of-three'),
    'recall EXCLUDES abandoned-fork turn (no median-of-three pivot content)')
  assert(!candidateText.includes('o(n^2)'),
    'recall EXCLUDES abandoned-fork turn (no O(n^2) degradation content)')

  // And confirm the shared prefix IS visible (a4 mentions quicksort generically):
  assert(candidateText.includes('quicksort'),
    'recall INCLUDES shared-prefix mention (quicksort named in common ancestor a4)')

  // Symmetry check: recall on the abandoned leaf must in turn exclude the graph branch.
  const abandonedCandidates = await getRecallCandidates(abandonedLeaf)
  const abandonedText = abandonedCandidates.map((m) => textOf(m.content)).join(' ').toLowerCase()
  assert(abandonedText.includes('quicksort'), 'abandoned-branch recall includes its own content')
  assert(!abandonedText.includes('dijkstra'),
    'abandoned-branch recall EXCLUDES the graph branch (fork isolation is symmetric)')

  console.log(failures === 0 ? '\nALL BRANCH-CORRECTNESS CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`)
  await pool.end()
  process.exit(failures === 0 ? 0 : 1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
