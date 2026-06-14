// S7 — eval runner over the course-question dataset.
// Runs each case through the live agent (HTTP endpoint) and scores expect/avoid
// keyword markers to produce a prompt-quality signal. This is the lightweight
// keyword scorer the dataset encodes; Mastra-native scorers (createScorer) could
// layer richer LLM-graded metrics on the same cases later.
//
// Prereqs: server running on :7100. Run: node_modules/.bin/tsx src/check-evals.ts
import { readFileSync } from 'node:fs'

type Case = {
  id: string
  mode: string
  prompt: string
  expectKeywords: string[]
  avoidKeywords: string[]
  rubric: string
}

const dataset = JSON.parse(readFileSync(new URL('../evals/course-questions.json', import.meta.url), 'utf8')) as {
  cases: Case[]
}

async function ask(prompt: string, mode: string): Promise<string> {
  const res = await fetch('http://localhost:7100/api/chat', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      chatbotId: '11111111-1111-4111-8111-111111111111',
      mode,
      guardrails: false, // score the model's own behaviour; guardrails tested in S1
      messages: [{ role: 'user', parts: [{ type: 'text', text: prompt }] }],
    }),
  })
  const text = await res.text()
  let out = ''
  for (const line of text.split('\n')) {
    if (!line.startsWith('data: ')) continue
    try {
      const e = JSON.parse(line.slice(6))
      if (e.type === 'text-delta') out += e.delta ?? ''
    } catch {
      /* ignore non-JSON keepalive lines */
    }
  }
  return out
}

async function main() {
  const results: { id: string; pass: boolean; expectHit: number; expectTot: number; avoidHit: number }[] = []
  for (const c of dataset.cases) {
    const answer = (await ask(c.prompt, c.mode)).toLowerCase()
    const expectHit = c.expectKeywords.filter((k) => answer.includes(k.toLowerCase())).length
    const avoidHit = c.avoidKeywords.filter((k) => answer.includes(k.toLowerCase())).length
    // Pass = at least half the expected markers present AND no red-flag markers.
    const pass = expectHit >= Math.ceil(c.expectKeywords.length / 2) && avoidHit === 0
    results.push({ id: c.id, pass, expectHit, expectTot: c.expectKeywords.length, avoidHit })
    console.log(`${pass ? '✅' : '❌'} ${c.id.padEnd(26)} expect ${expectHit}/${c.expectKeywords.length}  avoid ${avoidHit}`)
  }
  const passed = results.filter((r) => r.pass).length
  console.log(`\nPrompt-quality signal: ${passed}/${results.length} cases passed (${Math.round((100 * passed) / results.length)}%)`)
  process.exit(0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
