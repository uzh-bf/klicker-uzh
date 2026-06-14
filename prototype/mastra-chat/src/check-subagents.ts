// S6 proof (needs the model). Run under Infisical:
//   infisical run --env=dev --path=/ -- node_modules/.bin/tsx src/check-subagents.ts
//
// A graph question must route to graphSpecialist (ask_graphSpecialist tool call),
// a sorting question to sortingSpecialist. Confirms two-level delegation and that
// the delegation surfaces in the stream (progress the UI can render).
import { pool } from './pool.js'
import { buildSupervisor } from './engine/subagents.js'

let failures = 0
function assert(cond: boolean, msg: string) {
  console.log(`${cond ? '✅' : '❌'} ${msg}`)
  if (!cond) failures++
}

async function askAndTrace(question: string): Promise<{ tools: string[]; text: string }> {
  const { supervisor } = await buildSupervisor()
  const stream = await supervisor.stream([{ role: 'user', content: question }] as never)
  const tools: string[] = []
  let text = ''
  // Iterate the full chunk stream to observe delegation tool-calls + final text.
  for await (const chunk of stream.fullStream as AsyncIterable<{ type: string; payload?: unknown }>) {
    const c = chunk as { type: string; payload?: { toolName?: string }; toolName?: string; text?: string; delta?: string }
    if (c.type === 'tool-call' && (c.payload?.toolName || c.toolName)) {
      tools.push((c.payload?.toolName || c.toolName) as string)
    }
    if (c.type === 'text-delta') text += c.delta ?? c.text ?? ''
  }
  return { tools, text }
}

async function main() {
  console.log('=== graph question ===')
  const g = await askAndTrace('What is the time complexity of Dijkstra with a binary heap, and why?')
  console.log('delegated tools:', g.tools)
  console.log('answer:', g.text.slice(0, 200))
  assert(g.tools.some((t) => t.includes('graphSpecialist')), 'graph question delegates to graphSpecialist')

  console.log('\n=== sorting question ===')
  const s = await askAndTrace('Why is mergesort stable but quicksort is not?')
  console.log('delegated tools:', s.tools)
  console.log('answer:', s.text.slice(0, 200))
  assert(s.tools.some((t) => t.includes('sortingSpecialist')), 'sorting question delegates to sortingSpecialist')

  console.log(failures === 0 ? '\nALL SUB-AGENT CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`)
  await pool.end()
  process.exit(failures === 0 ? 0 : 1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
