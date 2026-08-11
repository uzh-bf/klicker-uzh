import { createOpenAI } from '@ai-sdk/openai'
import { generateText, isStepCount, streamText, tool } from 'ai'
import { describe, expect, test, vi } from 'vitest'
import { z } from 'zod'
import { getOpenAIProviderOptions } from '../src/lib/server/openaiProviderOptions'

function openAIEventStream(chunks: unknown[]): string {
  return `${chunks
    .map((chunk) => `data: ${JSON.stringify(chunk)}\n\n`)
    .join('')}data: [DONE]\n\n`
}

describe('OpenAI provider routing and cache options', () => {
  test('reuses one routing and cache key across a tool loop', async () => {
    const toolInput = JSON.stringify({ query: 'vorkurs' })
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
                    id: 'call-vorkurs',
                    type: 'function',
                    function: {
                      name: 'doc_query',
                      arguments: toolInput,
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
      apiKey: 'test-key',
      baseURL: 'https://example.test/v1',
      fetch,
    })

    const result = streamText({
      model: provider.chat('test-model'),
      prompt: 'Find the Vorkurs information.',
      providerOptions: {
        openai: await getOpenAIProviderOptions({
          assistantMessageId: 'assistant-1',
          owningThreadId: 'thread-1',
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

    expect(fetch).toHaveBeenCalledTimes(2)
    expect(requestBodies).toHaveLength(2)
    expect(requestBodies[0]?.metadata).toEqual(requestBodies[1]?.metadata)
    expect(requestBodies[0]?.prompt_cache_key).toBe(
      requestBodies[1]?.prompt_cache_key
    )
    expect(requestBodies[0]?.metadata).toMatchObject({
      session_id: expect.any(String),
    })
    expect(requestBodies[0]?.prompt_cache_key).toEqual(expect.any(String))
  })

  test('changes the session key per response and keeps the thread cache key stable', async () => {
    const first = await getOpenAIProviderOptions({
      assistantMessageId: 'assistant-1',
      owningThreadId: 'thread-1',
    })
    const second = await getOpenAIProviderOptions({
      assistantMessageId: 'assistant-2',
      owningThreadId: 'thread-1',
    })

    expect(first.metadata.session_id).not.toBe(second.metadata.session_id)
    expect(first.promptCacheKey).toBe(second.promptCacheKey)
  })

  test('serializes the same options through the Responses API transport', async () => {
    const requestBodies: Record<string, unknown>[] = []
    const fetch = vi.fn(async (_input: unknown, init?: RequestInit) => {
      requestBodies.push(JSON.parse(String(init?.body)))
      return new Response(
        JSON.stringify({
          id: 'response-1',
          created_at: 1,
          model: 'gpt-5.6-sol',
          output: [
            {
              type: 'message',
              role: 'assistant',
              id: 'message-1',
              content: [
                { type: 'output_text', text: 'Answer', annotations: [] },
              ],
              execution: 'server',
              call_id: null,
              status: 'completed',
              arguments: null,
            },
          ],
          usage: {
            input_tokens: 1,
            output_tokens: 1,
            input_tokens_details: { cached_tokens: 0 },
            output_tokens_details: { reasoning_tokens: 0 },
          },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      )
    })
    const provider = createOpenAI({
      apiKey: 'test-key',
      baseURL: 'https://example.test/v1',
      fetch,
    })
    const options = await getOpenAIProviderOptions({
      assistantMessageId: 'assistant-1',
      owningThreadId: 'thread-1',
    })

    const result = await generateText({
      model: provider.responses('gpt-5.6-sol'),
      prompt: 'Answer briefly.',
      providerOptions: { openai: options },
    })

    expect(result.text).toBe('Answer')
    expect(requestBodies).toHaveLength(1)
    expect(requestBodies[0]?.metadata).toEqual(options.metadata)
    expect(requestBodies[0]?.prompt_cache_key).toBe(options.promptCacheKey)
  })

  test('omits the cache key when thread ownership is unavailable', async () => {
    const options = await getOpenAIProviderOptions({
      assistantMessageId: 'assistant-1',
      owningThreadId: null,
    })

    expect(options.metadata.session_id).toEqual(expect.any(String))
    expect(options).not.toHaveProperty('promptCacheKey')
  })
})
