// S5 — branch-correct conversation compression.
// A summary covers a thread up to an anchor message. The selector returns the
// summary whose anchor is the DEEPEST message on the requesting leaf's active
// path — guaranteeing a summary built on an abandoned fork is never reused by a
// leaf that branched away before that anchor. Selection is pure graph logic.
import { pool } from '../pool.js'
import { getActiveBranchPath } from './branch.js'

export async function insertSummary(s: {
  threadId: string
  anchorMessageId: string
  summary: string
  coversCount?: number
}): Promise<string> {
  const { rows } = await pool.query(
    `INSERT INTO mastra_proto.message_summary
       (thread_id, anchor_message_id, summary, covers_count)
     VALUES ($1, $2, $3, $4) RETURNING id`,
    [s.threadId, s.anchorMessageId, s.summary, s.coversCount ?? 0]
  )
  return rows[0].id
}

export type SelectedSummary = {
  id: string
  anchorMessageId: string
  summary: string
  anchorDepth: number // 0 = leaf; smaller = deeper/closer to the leaf
}

// Pick the on-path summary with the deepest anchor (smallest depth). Off-path
// summaries (anchored on an abandoned fork) are excluded because their anchor id
// is absent from the leaf's path.
export async function selectSummaryForLeaf(leafId: string): Promise<SelectedSummary | null> {
  const path = await getActiveBranchPath(leafId)
  const depthById = new Map(path.map((m) => [m.id, m.depth]))

  const threadId = await threadOf(leafId)
  if (!threadId) return null

  const { rows } = await pool.query(
    `SELECT id, anchor_message_id, summary
     FROM mastra_proto.message_summary WHERE thread_id = $1`,
    [threadId]
  )

  let best: SelectedSummary | null = null
  for (const r of rows) {
    const depth = depthById.get(r.anchor_message_id)
    if (depth === undefined) continue // anchor not on this branch -> skip
    if (best === null || depth < best.anchorDepth) {
      best = {
        id: r.id,
        anchorMessageId: r.anchor_message_id,
        summary: r.summary,
        anchorDepth: depth,
      }
    }
  }
  return best
}

async function threadOf(messageId: string): Promise<string | null> {
  const { rows } = await pool.query(
    `SELECT "threadId" FROM "ChatMessage" WHERE id = $1`,
    [messageId]
  )
  return rows[0]?.threadId ?? null
}
