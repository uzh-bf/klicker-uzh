// S6 — two-level supervisor with a DB-driven roster.
// The supervisor exposes each roster specialist as an `ask_<key>` tool and
// delegates; specialists carry no further roster, so depth is held at two
// (the nested-streaming bug #15013 only bites at depth > 2).
import { Agent } from '@mastra/core/agent'
import { createOpenAI } from '@ai-sdk/openai'
import { env } from '../env.js'
import { pool } from '../pool.js'

const provider = createOpenAI({ baseURL: env.OPENAI_BASE_URL, apiKey: env.OPENAI_API_KEY })
// Chat Completions API (see agent.ts note on the Responses-API tool-call gotcha).
const model = () => provider.chat(env.PRIMARY_MODEL_ID)

export type SpecialistSpec = {
  key: string
  name: string
  description: string
  instructions: string
}

// Seed two specialists if the roster is empty (idempotent authoring).
export async function ensureRoster(): Promise<void> {
  const { rows } = await pool.query(`SELECT count(*)::int AS n FROM mastra_proto.subagent`)
  if (rows[0].n > 0) return
  const specs: SpecialistSpec[] = [
    {
      key: 'graphSpecialist',
      name: 'Graph Algorithms Specialist',
      description: 'Answers questions about graph algorithms: traversal, shortest paths, spanning trees.',
      instructions:
        'You are a graph-algorithms specialist. Answer ONLY graph-algorithm questions ' +
        '(BFS/DFS, Dijkstra, Bellman-Ford, MST). Be precise and concise.',
    },
    {
      key: 'sortingSpecialist',
      name: 'Sorting Algorithms Specialist',
      description: 'Answers questions about sorting algorithms and their complexity.',
      instructions:
        'You are a sorting-algorithms specialist. Answer ONLY sorting questions ' +
        '(quicksort, mergesort, heapsort, complexity). Be precise and concise.',
    },
  ]
  for (const s of specs) {
    await pool.query(
      `INSERT INTO mastra_proto.subagent (key, name, description, instructions)
       VALUES ($1, $2, $3, $4) ON CONFLICT (key) DO NOTHING`,
      [s.key, s.name, s.description, s.instructions]
    )
  }
}

export async function loadRoster(): Promise<SpecialistSpec[]> {
  const { rows } = await pool.query(
    `SELECT key, name, description, instructions FROM mastra_proto.subagent ORDER BY key`
  )
  return rows as SpecialistSpec[]
}

// Build the supervisor agent with the DB roster attached as delegatable agents.
export async function buildSupervisor(): Promise<{ supervisor: Agent; rosterKeys: string[] }> {
  await ensureRoster()
  const roster = await loadRoster()
  const agents: Record<string, Agent> = {}
  for (const s of roster) {
    agents[s.key] = new Agent({
      id: `sub-${s.key}`,
      name: s.name,
      description: s.description, // becomes the ask_<key> tool description
      instructions: s.instructions,
      model: model(),
      // no nested `agents` -> depth held at two
    })
  }
  const supervisor = new Agent({
    id: 'supervisor',
    name: 'Course Tutor Supervisor',
    instructions:
      'You are a tutoring supervisor. For a student question, delegate to exactly one ' +
      'specialist using the available ask_* tools when the question fits their area, then ' +
      'return their answer. If no specialist fits, answer briefly yourself.',
    model: model(),
    agents,
  })
  return { supervisor, rosterKeys: Object.keys(agents) }
}
