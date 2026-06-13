// Offline proof of the DB-backed skill source (no model needed).
// Run: DATABASE_URL='postgres://klicker-prod:klicker@localhost:5432/klicker-prod' \
//      node_modules/.bin/tsx src/check-skills.ts
//
// Proves the discovery + progressive-disclosure SHAPE the skill-search processor
// relies on: list skills cheaply (frontmatter only), then load one body on demand.
// The actual "agent selects + applies a skill" step is model-time.
import { pool } from './pool.js'
import { DbSkillSource, parseSkillFrontmatter } from './engine/skills.js'

let failures = 0
function assert(cond: boolean, msg: string) {
  console.log(`${cond ? '✅' : '❌'} ${msg}`)
  if (!cond) failures++
}

async function main() {
  const src = new DbSkillSource()

  const top = await src.readdir('/')
  const skillDirs = top.filter((e) => e.type === 'directory').map((e) => e.name).sort()
  assert(skillDirs.length === 2, `source lists 2 authored skills (${skillDirs.join(', ')})`)
  assert(skillDirs.includes('exam-coaching') && skillDirs.includes('concept-explainer'),
    'both authored skills are discoverable')

  // Progressive disclosure: read only frontmatter for the cheap catalog.
  const catalog: { name?: string; description?: string }[] = []
  for (const dir of skillDirs) {
    const md = await src.readFile(`/${dir}/SKILL.md`)
    catalog.push(parseSkillFrontmatter(md))
  }
  assert(catalog.every((c) => c.name && c.description),
    'every skill exposes name + description frontmatter (search index)')
  console.log('--- skill catalog (what the search processor sees) ---')
  for (const c of catalog) console.log(`• ${c.name}: ${c.description}`)
  console.log('-----------------------------------------------------')

  // Load one full body on demand (what happens after the agent picks a skill).
  const body = await src.readFile('/exam-coaching/SKILL.md')
  assert(body.includes('active recall'), 'full skill body loads on demand (exam-coaching)')

  // exists / stat sanity.
  assert(await src.exists('/concept-explainer/SKILL.md'), 'exists() resolves an authored file')
  assert(!(await src.exists('/no-such-skill/SKILL.md')), 'exists() is false for an unknown skill')
  const st = await src.stat('/exam-coaching/SKILL.md')
  assert(st.type === 'file' && st.size > 0, 'stat() reports a non-empty file')

  console.log(failures === 0 ? '\nALL SKILL-SOURCE CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`)
  await pool.end()
  process.exit(failures === 0 ? 0 : 1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
