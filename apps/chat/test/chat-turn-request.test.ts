import { createOpenAI } from '@ai-sdk/openai'
import { generateText, type ModelMessage, tool } from 'ai'
import { describe, expect, test } from 'vitest'
import { z } from 'zod'
import { buildChatTurnRequest } from '../src/lib/server/chatTurnRequest'
import { buildPromptCacheRequest } from '../src/lib/server/promptCacheIdentity'

type Body = {
  input: { role: string; content: unknown }[]
  tools?: unknown[]
  prompt_cache_key?: string
}

const STABLE_SECTIONS = ['Synthetic system prompt.', 'Synthetic summary.']

function responsesResponse() {
  return {
    id: 'response-turn-request',
    object: 'response',
    created_at: 1,
    status: 'completed',
    model: 'gpt-5.6-luna',
    output: [
      {
        type: 'message',
        role: 'assistant',
        id: 'message-turn-request',
        status: 'completed',
        content: [{ type: 'output_text', text: 'Reply.', annotations: [] }],
      },
    ],
    usage: {
      input_tokens: 1,
      output_tokens: 1,
      total_tokens: 2,
      input_tokens_details: { cached_tokens: 0 },
      output_tokens_details: { reasoning_tokens: 0 },
    },
  }
}

async function sendTurn(
  history: ModelMessage[],
  turnContext: string[],
  threadId: string
) {
  const bodies: Body[] = []
  const provider = createOpenAI({
    apiKey: 'dummy-key',
    baseURL: 'https://example.test/v1',
    fetch: async (_input, init) => {
      bodies.push(JSON.parse(String(init?.body)))
      return new Response(JSON.stringify(responsesResponse()), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    },
  })
  const cache = await buildPromptCacheRequest({
    deploymentId: 'gpt-5.6-luna',
    transport: 'responses',
    cacheScope: { chatbotId: 'chatbot-1', mode: 'tutor', threadId },
    tools: {
      practice: tool({
        inputSchema: z.object({ candidateId: z.string() }),
        execute: async () => ({ ok: true }),
      }),
    },
  })
  const request = buildChatTurnRequest({
    stableSections: STABLE_SECTIONS,
    turnContextSections: turnContext,
    history,
  })

  await generateText({
    model: provider.responses('gpt-5.6-luna'),
    instructions: request.instructions,
    messages: request.messages,
    allowSystemInMessages: true,
    tools: cache.tools,
    toolOrder: cache.toolOrder,
    providerOptions: { openai: { promptCacheKey: cache.promptCacheKey } },
    maxRetries: 0,
  })

  return bodies[0]
}

describe('chat turn request layout', () => {
  test('a later turn repeats the earlier request up to the previous answer', async () => {
    const user1: ModelMessage = { role: 'user', content: 'First question' }
    const assistant1: ModelMessage = { role: 'assistant', content: 'Reply 1' }
    const user2: ModelMessage = { role: 'user', content: 'Second question' }
    const user3: ModelMessage = { role: 'user', content: 'Third question' }

    const turn1 = await sendTurn(
      [user1],
      ['page A', 'candidates 1'],
      'thread-1'
    )
    const turn2 = await sendTurn(
      [user1, assistant1, user2],
      ['page B', 'candidates 2'],
      'thread-1'
    )
    const turn3 = await sendTurn(
      [
        user1,
        assistant1,
        user2,
        { role: 'assistant', content: 'Reply 2' },
        user3,
      ],
      [],
      'thread-1'
    )

    // Instructions are the first input item; per-turn context sits directly
    // before the new user message and is not replayed afterwards.
    const [instructions, context1] = turn1.input
    expect(instructions.role).toBe(context1.role)
    expect(JSON.stringify(instructions)).not.toContain('candidates')
    expect(turn1.input).toHaveLength(3)

    expect(turn2.tools).toEqual(turn1.tools)
    expect(turn2.prompt_cache_key).toBe(turn1.prompt_cache_key)
    expect(turn2.input[0]).toEqual(turn1.input[0])
    // Turn 2 = instructions, user 1, assistant 1, context 2, user 2.
    expect(turn2.input).toHaveLength(5)
    expect(JSON.stringify(turn2.input)).not.toContain('candidates 1')
    expect(JSON.stringify(turn2.input)).not.toContain('page A')

    // Turn 3 repeats turn 2 through assistant 1 (everything before turn 2's
    // context message), and an empty turn context adds no message.
    expect(turn3.input.slice(0, 3)).toEqual(turn2.input.slice(0, 3))
    expect(turn3.input).toHaveLength(6)
    expect(turn3.tools).toEqual(turn1.tools)
    expect(turn3.prompt_cache_key).toBe(turn1.prompt_cache_key)
  })

  test('uses a different cache key for another thread', async () => {
    const history: ModelMessage[] = [{ role: 'user', content: 'Question' }]
    const first = await sendTurn(history, [], 'thread-1')
    const other = await sendTurn(history, [], 'thread-2')

    expect(other.prompt_cache_key).not.toBe(first.prompt_cache_key)
  })
})
