// Offline proof of the student-profile DIY feature (no model needed).
// Run: DATABASE_URL='postgres://klicker-prod:klicker@localhost:5432/klicker-prod' \
//      node_modules/.bin/tsx src/check-profile.ts
//
// Asserts: facts written "from different threads/branches" all persist and are
// visible together (branch/thread-agnostic); the transparency render is correct;
// the deletion hook erases the row.
import { pool } from './pool.js'
import {
  getProfile,
  updateProfileFacts,
  renderProfileForContext,
  deleteProfile,
} from './engine/profile.js'

const CHATBOT_ID = '11111111-1111-4111-8111-111111111111'

let failures = 0
function assert(cond: boolean, msg: string) {
  console.log(`${cond ? '✅' : '❌'} ${msg}`)
  if (!cond) failures++
}

async function main() {
  const { rows } = await pool.query(`SELECT id FROM "Participant" WHERE username = 'testuser1'`)
  const participantId = rows[0].id as string

  // Clean slate.
  await deleteProfile(participantId, CHATBOT_ID)

  // Fact learned "in thread 1 / branch A".
  await updateProfileFacts(participantId, CHATBOT_ID, { preferredName: 'Dana', goal: 'pass the algorithms exam' })
  // Fact learned later "in a different thread / branch" — must coexist, not replace.
  await updateProfileFacts(participantId, CHATBOT_ID, { learningStyle: 'visual', preferredLength: 'short' })

  const profile = await getProfile(participantId, CHATBOT_ID)
  assert(profile.preferredName === 'Dana', 'fact from first thread persists')
  assert(profile.learningStyle === 'visual', 'fact from a second thread coexists (branch/thread-agnostic)')
  assert(Object.keys(profile).length === 4, 'all four facts merged, none lost')

  // Update an existing key — last write wins on that key only.
  await updateProfileFacts(participantId, CHATBOT_ID, { preferredLength: 'medium' })
  const updated = await getProfile(participantId, CHATBOT_ID)
  assert(updated.preferredLength === 'medium', 'per-key update overwrites that key')
  assert(updated.preferredName === 'Dana', 'per-key update leaves other facts intact')

  // Transparency render.
  const rendered = renderProfileForContext(updated)
  assert(rendered.includes('preferredName: Dana'), 'transparency view shows stored facts')
  console.log('--- student-facing profile view ---\n' + rendered + '\n-----------------------------------')

  // Deletion hook.
  const deleted = await deleteProfile(participantId, CHATBOT_ID)
  assert(deleted, 'deletion hook removes the profile row')
  const after = await getProfile(participantId, CHATBOT_ID)
  assert(Object.keys(after).length === 0, 'profile is empty after deletion (erasure works)')

  console.log(failures === 0 ? '\nALL PROFILE CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`)
  await pool.end()
  process.exit(failures === 0 ? 0 : 1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
