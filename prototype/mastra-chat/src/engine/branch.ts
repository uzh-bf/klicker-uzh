// S4/S5 core — branch-aware traversal of our message tree.
// This is the thesis the whole prototype exists to prove: because we own the
// message store and it is a parentId tree, recall and compression can be made
// *branch-correct* — they see only the messages on the active root→leaf path and
// provably exclude messages that live on abandoned forks. Mastra's managed
// memory is thread-linear and cannot express this.
//
// Pure SQL/graph logic, no model required — so it is validatable offline.
import { pool } from '../pool.js'

export type PathMessage = {
  id: string
  parentId: string | null
  role: string
  content: unknown
  createdAt: Date
  depth: number // 0 = the leaf, increasing toward the root
}

// Walk parentId from a leaf up to the root. Returns messages ordered root→leaf
// (the active branch). Any message on a sibling/abandoned fork is, by definition
// of the parent walk, never included.
export async function getActiveBranchPath(leafId: string): Promise<PathMessage[]> {
  const { rows } = await pool.query(
    `WITH RECURSIVE path AS (
       SELECT id, "parentId", role, content, "createdAt", 0 AS depth
       FROM "ChatMessage" WHERE id = $1
       UNION ALL
       SELECT m.id, m."parentId", m.role, m.content, m."createdAt", p.depth + 1
       FROM "ChatMessage" m JOIN path p ON m.id = p."parentId"
     )
     SELECT id, "parentId" AS "parentId", role, content, "createdAt" AS "createdAt", depth
     FROM path
     ORDER BY depth DESC`, // root first, leaf last
    [leafId]
  )
  return rows as PathMessage[]
}

// Recall candidates = the prior messages on the active branch (everything on the
// root→leaf path except the leaf turn itself). This set is what a semantic-recall
// ranker scores; restricting candidates to it is what makes recall branch-correct.
export async function getRecallCandidates(leafId: string): Promise<PathMessage[]> {
  const path = await getActiveBranchPath(leafId)
  return path.filter((m) => m.id !== leafId)
}

// For S5 compression: the set of message ids on the active path, used to pick the
// deepest summary anchor that lies on THIS branch (a summary anchored on a fork
// must not be reused by a leaf that branched away before it).
export async function getActivePathIds(leafId: string): Promise<string[]> {
  const path = await getActiveBranchPath(leafId)
  return path.map((m) => m.id)
}

// Helper: the leaf messages of a thread (messages that are nobody's parent).
export async function getThreadLeaves(threadId: string): Promise<string[]> {
  const { rows } = await pool.query(
    `SELECT m.id FROM "ChatMessage" m
     WHERE m."threadId" = $1
       AND NOT EXISTS (SELECT 1 FROM "ChatMessage" c WHERE c."parentId" = m.id)
     ORDER BY m."createdAt" ASC`,
    [threadId]
  )
  return rows.map((r) => r.id as string)
}
