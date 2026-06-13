// Deterministic synthetic chat fixture for the prototype.
// The seeded Klicker copy has ZERO chat threads, so the branch-dependent slices
// (S4 recall, S5 compression) have nothing to run against. This generator writes
// synthetic branching threads to the local copy's public ChatThread/ChatMessage
// using only synthetic seeded participants (testuserN) and the existing chatbot.
//
// IMPORTANT: this is NOT a usage measurement. The real S0.5 question ("what share
// of REAL threads branch / get long?") can only be answered against production
// telemetry. These threads exist to exercise mechanism, not to estimate demand.
//
// Every thread title is prefixed `PROTO::` so the whole fixture can be purged
// with one DELETE. Run: `infisical run --env=dev --path=/ -- tsx src/fixture.ts`
import { pool } from './db.js'

const CHATBOT_ID = '11111111-1111-4111-8111-111111111111'

type Part = { type: 'text'; text: string }
const text = (t: string): Part[] => [{ type: 'text', text: t }]

async function participantId(username: string): Promise<string> {
  const { rows } = await pool.query(
    `SELECT id FROM "Participant" WHERE username = $1`,
    [username]
  )
  if (!rows[0]) throw new Error(`no participant ${username}`)
  return rows[0].id
}

async function newThread(title: string, participant: string): Promise<string> {
  const { rows } = await pool.query(
    `INSERT INTO "ChatThread" (id, title, "participantId", "chatbotId", "createdAt", "updatedAt")
     VALUES (gen_random_uuid(), $1, $2, $3, now(), now()) RETURNING id`,
    [`PROTO::${title}`, participant, CHATBOT_ID]
  )
  return rows[0].id
}

// Sequential timestamps so ORDER BY createdAt is stable within a thread.
let clock = 0
async function msg(
  threadId: string,
  parentId: string | null,
  role: 'user' | 'assistant',
  body: string,
  mode = 'tutor'
): Promise<string> {
  clock += 1
  const { rows } = await pool.query(
    `INSERT INTO "ChatMessage"
       (id, "threadId", "parentId", role, content, "chatMode", "modelId",
        "creditsUsed", "createdAt", "updatedAt")
     VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7,
             now() + ($8 || ' seconds')::interval, now())
     RETURNING id`,
    [
      threadId,
      parentId,
      role,
      JSON.stringify(text(body)),
      mode,
      role === 'assistant' ? 'openai/gpt-4.1' : null,
      role === 'assistant' ? 1 : null,
      String(clock),
    ]
  )
  return rows[0].id
}

async function purge() {
  await pool.query(
    `DELETE FROM "ChatMessage" WHERE "threadId" IN
       (SELECT id FROM "ChatThread" WHERE title LIKE 'PROTO::%')`
  )
  await pool.query(`DELETE FROM "ChatThread" WHERE title LIKE 'PROTO::%'`)
}

async function main() {
  await purge()
  const p1 = await participantId('testuser1')
  const p2 = await participantId('testuser2')

  // ── Thread A: the branch-aware recall centrepiece ────────────────────────
  // Ancestor facts (name=Dana, exam=algorithms) are shared. At m4 the thread
  // FORKS: the active branch pivots to graph algorithms; the abandoned branch
  // dives into quicksort. S4 recall on the active leaf must surface the
  // ancestors + active-branch facts and MUST exclude the quicksort branch.
  const A = await newThread('branched-recall', p1)
  const a1 = await msg(A, null, 'user', "Hi, my name is Dana and I'm studying for the algorithms exam next week.")
  const a2 = await msg(A, a1, 'assistant', "Hi Dana! Happy to help you prepare for the algorithms exam. What topic should we start with?")
  const a3 = await msg(A, a2, 'user', "Let's start with sorting algorithms.")
  const a4 = await msg(A, a3, 'assistant', "Great. Sorting covers comparison sorts like merge sort and quicksort, and non-comparison sorts like counting sort. Where would you like to go deeper?")
  // Active branch (X): pivot to graph algorithms
  const a5x = await msg(A, a4, 'user', "Actually, I changed my mind — let's focus on graph algorithms instead, especially Dijkstra.")
  const a6x = await msg(A, a5x, 'assistant', "Sure, Dana. Dijkstra's algorithm finds shortest paths from a source in a weighted graph with non-negative edges, using a priority queue. Want to walk through the relaxation step?")
  // Abandoned branch (Y): quicksort deep-dive — must NOT leak into X's recall
  const a5y = await msg(A, a4, 'user', "Tell me about quicksort's worst-case behaviour and how to avoid it.")
  const a6y = await msg(A, a5y, 'assistant', "Quicksort degrades to O(n^2) when pivots are poorly chosen, e.g. already-sorted input with a naive pivot. Randomised or median-of-three pivots avoid this.")

  // ── Thread B: a second branched thread (so branched_threads > 1) ─────────
  const B = await newThread('branched-prefs', p2)
  const b1 = await msg(B, null, 'user', "I'm a visual learner and I prefer short answers.")
  const b2 = await msg(B, b1, 'assistant', "Got it — I'll keep answers concise and lean on diagrams where useful.")
  const b3 = await msg(B, b2, 'user', "Explain hash tables.")
  const b4 = await msg(B, b3, 'assistant', "A hash table maps keys to buckets via a hash function; average O(1) lookup, with collisions handled by chaining or open addressing.")
  // fork: two alternative follow-ups
  await msg(B, b4, 'user', "Now explain collision resolution in detail.")
  await msg(B, b4, 'user', "Actually, explain load factor instead.")

  // ── Thread C: long linear thread for S5 compression (bucket 2/3) ─────────
  const C = await newThread('long-linear', p1)
  let parent: string | null = null
  const para =
    'This is a substantive tutoring turn that discusses a concept in enough ' +
    'detail to consume a realistic number of tokens, including a worked example, ' +
    'an edge case, and a short summary so the running context grows turn over turn. '
  for (let i = 0; i < 40; i++) {
    const role = i % 2 === 0 ? 'user' : 'assistant'
    const body =
      role === 'user'
        ? `Question ${i / 2 + 0.5 | 0}: can you explain topic number ${i} and how it connects to the previous one? ${para}`
        : `Answer ${(i + 1) / 2 | 0}: ${para}${para}`
    parent = await msg(C, parent, role, body)
  }

  // ── Threads D,E: short linear threads (bucket 1) for distribution spread ──
  for (const [name, p] of [['short-1', p1], ['short-2', p2]] as const) {
    const T = await newThread(name, p)
    const d1 = await msg(T, null, 'user', 'What is Big-O notation?')
    await msg(T, d1, 'assistant', 'Big-O describes the asymptotic upper bound on an algorithm\'s growth rate as input size increases.')
  }

  // Report what landed
  const { rows } = await pool.query(
    `SELECT t.title, COUNT(m.id) AS msgs
     FROM "ChatThread" t LEFT JOIN "ChatMessage" m ON m."threadId" = t.id
     WHERE t.title LIKE 'PROTO::%' GROUP BY t.title ORDER BY t.title`
  )
  console.table(rows)
  // Expose the key ids for the recall slice.
  console.log('Thread A active leaf (graph branch):', a6x)
  console.log('Thread A abandoned leaf (quicksort branch):', a6y)
  console.log('Thread A ids:', { a1, a2, a3, a4, a5x, a6x, a5y, a6y })
  await pool.end()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
