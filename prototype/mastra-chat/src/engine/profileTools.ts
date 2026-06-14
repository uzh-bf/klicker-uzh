// S3 (model-time) — the agent-callable side of the student profile.
// `update_profile` lets the model persist durable facts; `profileContext`
// renders the stored facts for injection into the system prompt so the agent
// "remembers" the student across threads (branch-agnostic).
import { createTool } from '@mastra/core/tools'
import { z } from 'zod'
import { getProfile, updateProfileFacts, renderProfileForContext } from './profile.js'

export function buildProfileTool(participantId: string, chatbotId: string) {
  return createTool({
    id: 'update_profile',
    description:
      'Persist a durable fact about THIS student (e.g. preferred name, learning goal, ' +
      'learning style, answer-length preference). Call this whenever the student shares a ' +
      'stable preference or fact about themselves so it is remembered in future conversations.',
    inputSchema: z.object({
      facts: z
        .record(z.string(), z.any())
        .describe('Key-value facts to remember, e.g. {"preferredName":"Dana","learningStyle":"visual"}'),
    }),
    execute: async (input: { facts: Record<string, unknown> }) => {
      const profile = await updateProfileFacts(participantId, chatbotId, input.facts)
      return { ok: true, profile }
    },
  })
}

// Render stored facts for system-prompt injection (empty string when none).
export async function profileContext(participantId: string, chatbotId: string): Promise<string> {
  const facts = await getProfile(participantId, chatbotId)
  if (Object.keys(facts).length === 0) return ''
  return `\n\nWhat you remember about this student:\n${renderProfileForContext(facts)}`
}
