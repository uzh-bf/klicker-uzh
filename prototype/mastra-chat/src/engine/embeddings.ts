// S4 (model-time) — embedding generation + cosine ranking over the
// BRANCH-RESTRICTED candidate set. Branch-correctness comes for free from
// getRecallCandidates (only the active root->leaf path); this layer adds
// relevance ranking. pgvector is absent in dev, so embeddings are stored as
// float8[] and ranked in app code — fine because the candidate set is small.
import { pool } from '../pool.js'
import { getRecallCandidates } from './branch.js'
import { env } from '../env.js'

const EMBED_MODEL = process.env.EMBEDDING_MODEL_ID ?? 'text-embedding-3-small'

// Direct call to the OpenAI-compatible embeddings endpoint (OpenRouter/Azure).
export async function embedText(text: string): Promise<number[]> {
  const res = await fetch(`${env.OPENAI_BASE_URL}/embeddings`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${env.OPENAI_API_KEY}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ model: EMBED_MODEL, input: text }),
  })
  if (!res.ok) throw new Error(`embeddings ${res.status}: ${await res.text()}`)
  const json = (await res.json()) as { data: { embedding: number[] }[] }
  return json.data[0].embedding
}

function textOf(content: unknown): string {
  return Array.isArray(content)
    ? content.map((p) => (p && typeof p === 'object' && 'text' in p ? (p as { text: string }).text : '')).join(' ')
    : ''
}

// Embed-on-write (inline for the prototype): store a message's embedding if absent.
export async function ensureEmbedding(messageId: string, threadId: string, text: string): Promise<void> {
  const { rows } = await pool.query(
    `SELECT 1 FROM mastra_proto.message_embedding WHERE message_id = $1`,
    [messageId]
  )
  if (rows.length) return
  const vec = await embedText(text)
  await pool.query(
    `INSERT INTO mastra_proto.message_embedding (message_id, thread_id, dims, embedding, model)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (message_id) DO NOTHING`,
    [messageId, threadId, vec.length, vec, EMBED_MODEL]
  )
}

export function cosine(a: number[], b: number[]): number {
  let dot = 0
  let na = 0
  let nb = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    na += a[i] * a[i]
    nb += b[i] * b[i]
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb) || 1)
}

export type RankedRecall = {
  messageId: string
  role: string
  text: string
  score: number
}

// Branch-correct semantic recall: rank the active-branch candidates by similarity
// to the query. Off-branch messages are absent from the candidate set entirely.
export async function rankRecall(
  leafId: string,
  queryText: string,
  topK = 3
): Promise<RankedRecall[]> {
  const candidates = await getRecallCandidates(leafId)
  // Embed-on-read (also populates the store) for the prototype.
  for (const c of candidates) {
    const { rows } = await pool.query(
      `SELECT embedding FROM mastra_proto.message_embedding WHERE message_id = $1`,
      [c.id]
    )
    if (!rows.length) await ensureEmbedding(c.id, await threadOf(c.id), textOf(c.content))
  }
  const queryVec = await embedText(queryText)
  const scored: RankedRecall[] = []
  for (const c of candidates) {
    const { rows } = await pool.query(
      `SELECT embedding FROM mastra_proto.message_embedding WHERE message_id = $1`,
      [c.id]
    )
    if (!rows.length) continue
    const vec = (rows[0].embedding as string[] | number[]).map(Number)
    scored.push({ messageId: c.id, role: c.role, text: textOf(c.content), score: cosine(queryVec, vec) })
  }
  return scored.sort((a, b) => b.score - a.score).slice(0, topK)
}

async function threadOf(messageId: string): Promise<string> {
  const { rows } = await pool.query(`SELECT "threadId" FROM "ChatMessage" WHERE id = $1`, [messageId])
  return rows[0]?.threadId
}
