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
// Returns the vector plus the provider-reported input-token count, so callers
// can attribute the (background, non-chat) embedding cost. `tokens` falls back
// to 0 if a provider omits usage — the cost then prints as 0 rather than wrong.
export async function embedText(text: string): Promise<{ embedding: number[]; tokens: number }> {
  const res = await fetch(`${env.OPENAI_BASE_URL}/embeddings`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${env.OPENAI_API_KEY}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ model: EMBED_MODEL, input: text }),
  })
  if (!res.ok) throw new Error(`embeddings ${res.status}: ${await res.text()}`)
  const json = (await res.json()) as {
    data: { embedding: number[] }[]
    usage?: { prompt_tokens?: number; total_tokens?: number }
  }
  if (json.usage?.prompt_tokens == null) {
    console.warn(`[cost] embeddings response omitted usage; embedding cost will under-report: ${EMBED_MODEL}`)
  }
  return { embedding: json.data[0].embedding, tokens: json.usage?.prompt_tokens ?? 0 }
}

function textOf(content: unknown): string {
  return Array.isArray(content)
    ? content.map((p) => (p && typeof p === 'object' && 'text' in p ? (p as { text: string }).text : '')).join(' ')
    : ''
}

// Embed-on-write (inline for the prototype): store a message's embedding if absent.
// Returns the embedding tokens consumed (0 when already cached, so callers can
// sum the real background cost across a ranking pass).
export async function ensureEmbedding(messageId: string, threadId: string, text: string): Promise<number> {
  const { rows } = await pool.query(
    `SELECT 1 FROM mastra_proto.message_embedding WHERE message_id = $1`,
    [messageId]
  )
  if (rows.length) return 0
  const { embedding, tokens } = await embedText(text)
  await pool.query(
    `INSERT INTO mastra_proto.message_embedding (message_id, thread_id, dims, embedding, model)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (message_id) DO NOTHING`,
    [messageId, threadId, embedding.length, embedding, EMBED_MODEL]
  )
  return tokens
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

// A ranking pass plus the background embedding cost it incurred. `embedTokens`
// is the input tokens this invocation actually spent: candidates already cached
// contribute 0 (embeddings are billed once, on write — re-counting them every
// recall would over-report), plus the query embed. So on a warm cache it is just
// the query; the check script clears the cache first to surface the full cold
// "build recall from scratch" figure. Pairs with embedModel for costForTokens.
export type RecallResult = {
  results: RankedRecall[]
  embedTokens: number
  embedModel: string
}

// Branch-correct semantic recall: rank the active-branch candidates by similarity
// to the query. Off-branch messages are absent from the candidate set entirely.
export async function rankRecall(leafId: string, queryText: string, topK = 3): Promise<RecallResult> {
  const candidates = await getRecallCandidates(leafId)
  let embedTokens = 0
  // Embed-on-read (also populates the store) for the prototype.
  for (const c of candidates) {
    const { rows } = await pool.query(
      `SELECT embedding FROM mastra_proto.message_embedding WHERE message_id = $1`,
      [c.id]
    )
    if (!rows.length) embedTokens += await ensureEmbedding(c.id, await threadOf(c.id), textOf(c.content))
  }
  const { embedding: queryVec, tokens: queryTokens } = await embedText(queryText)
  embedTokens += queryTokens
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
  return {
    results: scored.sort((a, b) => b.score - a.score).slice(0, topK),
    embedTokens,
    embedModel: EMBED_MODEL,
  }
}

async function threadOf(messageId: string): Promise<string> {
  const { rows } = await pool.query(`SELECT "threadId" FROM "ChatMessage" WHERE id = $1`, [messageId])
  return rows[0]?.threadId
}
