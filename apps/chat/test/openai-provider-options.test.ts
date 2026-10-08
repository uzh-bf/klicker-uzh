import { createOpenAI } from '@ai-sdk/openai'
import { isStepCount, streamText, tool } from 'ai'
import { describe, expect, test, vi } from 'vitest'
import { z } from 'zod'
import { getOpenAIProviderOptions } from '../src/lib/server/openaiProviderOptions'

function openAIEventStream(chunks: unknown[]): string {
  return `${chunks
    .map((chunk) => `data: ${JSON.stringify(chunk)}\n\n`)
    .join('')}data: [DONE]\n\n`
}

const identity = {
  assistantMessageId: 'assistant-1',
  chatbotId: 'chatbot-1',
  threadId: 'thread-1',
}

describe('OpenAI provider routing options', () => {
  test('reuses one session id across the calls of a tool loop', async () => {
    const responses = [
      openAIEventStream([
        {
          id: 'chatcmpl-tool',
          choices: [
            {
              index: 0,
              delta: {
                role: 'assistant',
                tool_calls: [
                  {
                    index: 0,
                    id: 'call-1',
                    type: 'function',
                    function: {
                      name: 'doc_query',
                      arguments: JSON.stringify({ query: 'synthetic' }),
                    },
                  },
                ],
              },
              finish_reason: 'tool_calls',
            },
          ],
        },
      ]),
      openAIEventStream([
        {
          id: 'chatcmpl-answer',
          choices: [
            {
              index: 0,
              delta: { role: 'assistant', content: 'Answer' },
              finish_reason: 'stop',
            },
          ],
        },
      ]),
    ]
    const requestBodies: Record<string, unknown>[] = []
    const fetch = vi.fn(async (_input: unknown, init?: RequestInit) => {
      requestBodies.push(JSON.parse(String(init?.body)))
      return new Response(responses[requestBodies.length - 1], {
        status: 200,
        headers: { 'content-type': 'text/event-stream' },
      })
    })
    const provider = createOpenAI({
      apiKey: 'dummy-key',
      baseURL: 'https://example.test/v1',
      fetch,
    })

    const result = streamText({
      model: provider.chat('test-model'),
      prompt: 'Find the synthetic information.',
      providerOptions: {
        openai: await getOpenAIProviderOptions({
          ...identity,
          routingSource: 'default',
        }),
      },
      tools: {
        doc_query: tool({
          inputSchema: z.object({ query: z.string() }),
          execute: async () => ({ result: 'course information' }),
        }),
      },
      stopWhen: isStepCount(2),
    })

    await result.text

    expect(requestBodies).toHaveLength(2)
    expect(requestBodies[0]?.metadata).toMatchObject({
      session_id: expect.any(String),
    })
    expect(requestBodies[0]?.metadata).toEqual(requestBodies[1]?.metadata)
  })

  test('changes the session id for the next answer', async () => {
    const first = await getOpenAIProviderOptions({
      ...identity,
      routingSource: 'default',
    })
    const again = await getOpenAIProviderOptions({
      ...identity,
      routingSource: 'default',
    })
    const next = await getOpenAIProviderOptions({
      ...identity,
      assistantMessageId: 'assistant-2',
      routingSource: 'default',
    })

    expect(again.metadata.session_id).toBe(first.metadata.session_id)
    expect(next.metadata.session_id).not.toBe(first.metadata.session_id)
    expect(first.metadata.session_id).not.toContain(identity.threadId)
  })

  test('does not send gateway options to custom chatbot endpoints', async () => {
    const options = await getOpenAIProviderOptions({
      ...identity,
      routingSource: 'custom',
    })

    expect(options).toEqual({})
  })
})
