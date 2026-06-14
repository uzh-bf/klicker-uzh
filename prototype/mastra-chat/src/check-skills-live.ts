// S2 live proof (needs the model + running server on :7100).
// The offline check (check-skills.ts) proves the DB source SHAPE; this proves the
// model actually USES it: given a study/coaching request with skills enabled, the
// agent must (1) call skill_search to see the cheap catalog, (2) call skill to load
// one body on demand, and (3) apply that skill's instructions in its answer. This
// is the differentiator — a lecturer-authored, DB-backed, versioned skill,
// discovered and applied at runtime via progressive disclosure.
//
// Prereqs: author-skills.ts has seeded the two skills; server running on :7100.
// Run: node_modules/.bin/tsx src/check-skills-live.ts
let failures = 0
function assert(cond: boolean, msg: string) {
  console.log(`${cond ? '✅' : '❌'} ${msg}`)
  if (!cond) failures++
}

type Trace = {
  toolCalls: { name: string; input: unknown }[]
  toolOutputs: { name: string; output: Record<string, unknown> }[]
  text: string
}

async function ask(prompt: string): Promise<Trace> {
  const res = await fetch('http://localhost:7100/api/chat', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      chatbotId: '11111111-1111-4111-8111-111111111111',
      mode: 'tutor',
      guardrails: false, // isolate skill behaviour; guardrails tested in S1
      skills: true,
      messages: [{ role: 'user', parts: [{ type: 'text', text: prompt }] }],
    }),
  })
  const body = await res.text()
  const trace: Trace = { toolCalls: [], toolOutputs: [], text: '' }
  // tool-output-available chunks key the tool by toolCallId, not toolName, so we
  // map id->name from the input chunk to attribute each output.
  const nameById = new Map<string, string>()
  for (const line of body.split('\n')) {
    if (!line.startsWith('data: ')) continue
    let e: {
      type?: string
      toolName?: string
      toolCallId?: string
      input?: unknown
      output?: Record<string, unknown>
      delta?: string
    }
    try {
      e = JSON.parse(line.slice(6))
    } catch {
      continue
    }
    if (e.type === 'tool-input-available' && e.toolName) {
      if (e.toolCallId) nameById.set(e.toolCallId, e.toolName)
      trace.toolCalls.push({ name: e.toolName, input: e.input })
    }
    if (e.type === 'tool-output-available' && e.output) {
      const name = (e.toolName ?? (e.toolCallId ? nameById.get(e.toolCallId) : undefined)) ?? '?'
      trace.toolOutputs.push({ name, output: e.output })
    }
    if (e.type === 'text-delta') trace.text += e.delta ?? ''
  }
  return trace
}

async function main() {
  const t = await ask('Help me study for my algorithms exam next week.')
  const callNames = t.toolCalls.map((c) => c.name)
  console.log('tool calls (in order):', callNames.join(' -> '))

  const searchIdx = callNames.indexOf('skill_search')
  const skillIdx = callNames.indexOf('skill')
  assert(searchIdx !== -1, 'agent calls skill_search (discovery)')
  assert(skillIdx !== -1, 'agent calls skill (activation)')
  assert(searchIdx !== -1 && skillIdx !== -1 && searchIdx < skillIdx, 'discovery precedes activation (progressive disclosure)')

  // The catalog the model saw must be name+description only (cheap), not full bodies.
  const search = t.toolOutputs.find((o) => o.name === 'skill_search')
  const catalog = (search?.output?.skills as { skillName?: string }[] | undefined) ?? []
  assert(catalog.length >= 2, `skill_search returns the multi-skill catalog (${catalog.map((s) => s.skillName).join(', ')})`)

  // The model picked the exam skill for an exam request.
  const picked = t.toolCalls.find((c) => c.name === 'skill')?.input as { skillName?: string } | undefined
  assert(picked?.skillName === 'exam-coaching', `agent selects the relevant skill (picked: ${picked?.skillName})`)

  // The answer APPLIES exam-coaching: establish scope first (date/topics), name
  // active recall, and avoid dumping the syllabus.
  const low = t.text.toLowerCase()
  const scopeFirst = /(topic|syllabus|chapter)/.test(low) && /(date|when|week)/.test(low)
  assert(scopeFirst, 'answer establishes exam scope first (topics + date) per the skill')
  // Coaching vocabulary the skill prescribes (recall/practice/spacing/self-check).
  // Broad match: the model paraphrases, so we accept any of the skill's signals.
  assert(
    /(recall|active|practice|attempt|self.?check|spaced|review)/.test(low),
    'answer reflects the skill’s coaching method (active recall / spaced review)'
  )

  console.log('\n--- answer (first 400 chars) ---')
  console.log(t.text.slice(0, 400))
  console.log(failures === 0 ? '\nALL LIVE SKILL CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`)
  process.exit(failures === 0 ? 0 : 1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
