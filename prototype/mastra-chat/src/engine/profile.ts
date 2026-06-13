// S3 — student profile (DIY). Persistent per-student facts, keyed only by
// participant + chatbot, so they are BRANCH- and THREAD-AGNOSTIC: a fact learned
// on any branch of any thread is visible everywhere (the deliberate opposite of
// recall/compression). Includes a transparency render (student-facing) and a
// deletion hook (the privacy story, exercised not deferred).
import { pool } from '../pool.js'

export type ProfileFacts = Record<string, unknown>

export async function getProfile(
  participantId: string,
  chatbotId: string
): Promise<ProfileFacts> {
  const { rows } = await pool.query(
    `SELECT profile FROM mastra_proto.student_profile
     WHERE participant_id = $1 AND chatbot_id = $2`,
    [participantId, chatbotId]
  )
  return (rows[0]?.profile as ProfileFacts) ?? {}
}

// Shallow-merge new facts into the stored profile (upsert). The update-profile
// tool the agent calls delegates here; callers pass already-extracted facts.
export async function updateProfileFacts(
  participantId: string,
  chatbotId: string,
  facts: ProfileFacts
): Promise<ProfileFacts> {
  const { rows } = await pool.query(
    `INSERT INTO mastra_proto.student_profile (participant_id, chatbot_id, profile, updated_at)
     VALUES ($1, $2, $3::jsonb, now())
     ON CONFLICT (participant_id, chatbot_id) DO UPDATE
       SET profile = mastra_proto.student_profile.profile || EXCLUDED.profile,
           updated_at = now()
     RETURNING profile`,
    [participantId, chatbotId, JSON.stringify(facts)]
  )
  return rows[0].profile as ProfileFacts
}

// Transparency: a flat, human-readable view a student can inspect ("here is what
// the tutor remembers about you").
export function renderProfileForContext(facts: ProfileFacts): string {
  const entries = Object.entries(facts)
  if (entries.length === 0) return '(no stored facts yet)'
  return entries.map(([k, v]) => `- ${k}: ${typeof v === 'string' ? v : JSON.stringify(v)}`).join('\n')
}

// Deletion hook (GDPR-style erasure). Returns true if a row was removed.
export async function deleteProfile(
  participantId: string,
  chatbotId: string
): Promise<boolean> {
  const res = await pool.query(
    `DELETE FROM mastra_proto.student_profile
     WHERE participant_id = $1 AND chatbot_id = $2`,
    [participantId, chatbotId]
  )
  return (res.rowCount ?? 0) > 0
}
