// Idempotent DDL for the prototype-only tables. They live in an isolated
// `mastra_proto` schema so they never collide with Prisma-managed `public`
// tables (the plan's data-isolation rule). Klicker tables are read from public;
// these three are the DIY-feature stores.
// Run: DATABASE_URL='postgres://klicker-prod:klicker@localhost:5432/klicker-prod' \
//      node_modules/.bin/tsx src/proto-schema.ts
import { pool } from './pool.js'

async function main() {
  await pool.query(`CREATE SCHEMA IF NOT EXISTS mastra_proto`)

  // S3 — student profile. Branch-AGNOSTIC by design: keyed by participant+chatbot
  // only, with no thread/branch reference, so a fact learned on any branch of any
  // thread is available everywhere. Opposite of recall/compression, which are
  // branch-SPECIFIC. The jsonb holds typed facts the update-profile tool writes.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS mastra_proto.student_profile (
      participant_id uuid NOT NULL,
      chatbot_id     uuid NOT NULL,
      profile        jsonb NOT NULL DEFAULT '{}'::jsonb,
      updated_at     timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (participant_id, chatbot_id)
    )`)

  // S5 — conversation compression. A summary covers the thread UP TO an anchor
  // message (inclusive). Branch-correctness: a summary is reusable by a leaf only
  // if its anchor lies on that leaf's root->leaf path; the deepest such anchor
  // wins. Anchoring to a message id (not a thread) is what makes this work across
  // forks — a summary built on an abandoned branch is simply never on-path.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS mastra_proto.message_summary (
      id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      thread_id         uuid NOT NULL,
      anchor_message_id uuid NOT NULL,
      covers_count      int  NOT NULL DEFAULT 0,
      summary           text NOT NULL,
      created_at        timestamptz NOT NULL DEFAULT now()
    )`)
  await pool.query(`
    CREATE INDEX IF NOT EXISTS message_summary_anchor_idx
      ON mastra_proto.message_summary (anchor_message_id)`)

  // S4 — semantic recall. pgvector is NOT installed on this dev image, so we store
  // embeddings as float8[] and rank in app code. Branch-restricted recall scores
  // only the active-path candidates (a small set), so no ANN index is needed —
  // a finding in its own right. Production cross-thread recall would want pgvector.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS mastra_proto.message_embedding (
      message_id uuid PRIMARY KEY,
      thread_id  uuid NOT NULL,
      dims       int  NOT NULL,
      embedding  float8[] NOT NULL,
      model      text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    )`)
  await pool.query(`
    CREATE INDEX IF NOT EXISTS message_embedding_thread_idx
      ON mastra_proto.message_embedding (thread_id)`)

  const { rows } = await pool.query(
    `SELECT table_name FROM information_schema.tables
     WHERE table_schema = 'mastra_proto' ORDER BY table_name`
  )
  console.log('mastra_proto tables:', rows.map((r) => r.table_name).join(', '))
  await pool.end()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
