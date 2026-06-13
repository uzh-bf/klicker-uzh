// Author two example Workspace Skills into the DB-backed source (lecturer side).
// Run: DATABASE_URL='postgres://klicker-prod:klicker@localhost:5432/klicker-prod' \
//      node_modules/.bin/tsx src/author-skills.ts
import { pool } from './pool.js'
import { upsertSkillFile } from './engine/skills.js'

const EXAM_COACHING = `---
name: Exam Coaching
description: Structured exam preparation — turn a vague "help me study" into a concrete plan with retrieval practice and spaced checkpoints.
---

# Exam Coaching

When a student asks for exam help:
1. Establish the exam scope (topics, date, weighting) before giving content.
2. Prefer active recall: ask the student to attempt before you explain.
3. End each topic with a one-question self-check and a spaced-review suggestion.
4. Never dump the full syllabus; coach one topic at a time.
`

const CONCEPT_EXPLAINER = `---
name: Concept Explainer
description: Explain a single concept from first principles with one analogy and one worked example, then check understanding.
---

# Concept Explainer

When a student asks "what is X":
1. Give a one-sentence intuition first, then the precise definition.
2. Provide exactly one analogy and one minimal worked example.
3. Close with a single check-for-understanding question.
4. Keep it short unless the student asks to go deeper.
`

async function main() {
  await upsertSkillFile('exam-coaching', '/exam-coaching/SKILL.md', EXAM_COACHING)
  await upsertSkillFile('concept-explainer', '/concept-explainer/SKILL.md', CONCEPT_EXPLAINER)
  const { rows } = await pool.query(
    `SELECT skill_name, path, version FROM mastra_proto.skill_file ORDER BY path`
  )
  console.table(rows)
  await pool.end()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
