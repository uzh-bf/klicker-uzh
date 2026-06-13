// Thin data access over the existing Klicker Postgres (local dev copy).
// We OWN message persistence — Mastra never touches mastra_messages.
// Prototype-only tables (profile, embeddings, summaries) live in the
// `mastra_proto` schema; Klicker tables are read/written in `public`.
import pg from 'pg'
import { env } from './env.js'

export const pool = new pg.Pool({ connectionString: env.DATABASE_URL })

export type ChatbotConfig = {
  id: string
  name: string
  courseId: string | null
  systemPrompts: Record<string, { prompt: string; description?: string }> | null
  allowedModelIds: string[]
  modelSelection: boolean
  openaiApiKey: string | null
  openaiBaseUrl: string | null
}

export async function getChatbot(id: string): Promise<ChatbotConfig | null> {
  const { rows } = await pool.query(
    `SELECT id, name, "courseId", "systemPrompts", "allowedModelIds",
            "modelSelection", "openaiApiKey", "openaiBaseUrl"
     FROM "Chatbot" WHERE id = $1`,
    [id]
  )
  if (!rows[0]) return null
  const r = rows[0]
  return {
    id: r.id,
    name: r.name,
    courseId: r.courseId,
    systemPrompts: r.systemPrompts,
    allowedModelIds: r.allowedModelIds ?? [],
    modelSelection: r.modelSelection,
    openaiApiKey: r.openaiApiKey,
    openaiBaseUrl: r.openaiBaseUrl,
  }
}

export type StoredMessage = {
  id: string
  threadId: string
  parentId: string | null
  role: 'user' | 'assistant'
  content: unknown // PersistedAssistantContentPart[] | { type:'text', text }[]
  chatMode: string | null
  modelId: string | null
  createdAt: Date
}

// Loads the full thread ordered by creation. Branch-path selection (parentId
// walk) is layered on in the recall/compression slices; S0 uses linear order.
export async function getThreadMessages(threadId: string): Promise<StoredMessage[]> {
  const { rows } = await pool.query(
    `SELECT id, "threadId", "parentId", role, content, "chatMode", "modelId", "createdAt"
     FROM "ChatMessage" WHERE "threadId" = $1 ORDER BY "createdAt" ASC`,
    [threadId]
  )
  return rows as StoredMessage[]
}

export async function createThread(participantId: string, chatbotId: string): Promise<string> {
  const { rows } = await pool.query(
    `INSERT INTO "ChatThread" (id, "participantId", "chatbotId", "createdAt", "updatedAt")
     VALUES (gen_random_uuid(), $1, $2, now(), now()) RETURNING id`,
    [participantId, chatbotId]
  )
  return rows[0].id
}

export async function insertMessage(m: {
  threadId: string
  parentId: string | null
  role: 'user' | 'assistant'
  content: unknown
  chatMode?: string | null
  modelId?: string | null
  reasoningEffort?: string | null
  reasoningContent?: string | null
  creditsUsed?: number | null
}): Promise<string> {
  const { rows } = await pool.query(
    `INSERT INTO "ChatMessage"
       (id, "threadId", "parentId", role, content, "chatMode", "modelId",
        "reasoningEffort", "reasoningContent", "creditsUsed", "createdAt", "updatedAt")
     VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, now(), now())
     RETURNING id`,
    [
      m.threadId,
      m.parentId,
      m.role,
      JSON.stringify(m.content),
      m.chatMode ?? null,
      m.modelId ?? null,
      m.reasoningEffort ?? null,
      m.reasoningContent ?? null,
      m.creditsUsed ?? null,
    ]
  )
  return rows[0].id
}
