import { createOpenAI } from '@ai-sdk/openai'
import { streamText, tool } from 'ai'
import { describe, expect, test, vi } from 'vitest'
import { z } from 'zod'

function openAIEventStream(chunks: unknown[]): string {
  const separator = '\n\n'

  return `${chunks
    .map((chunk) => `data: ${JSON.stringify(chunk)}${separator}`)
    .join('')}data: [DONE]${separator}`
}

describe('OpenAI-compatible streamed tool calls', () => {
  test('completes a tool call whose first provider index is sparse', async () => {
    const toolInput = JSON.stringify({ query: 'vorkurs' })
    const responseBody = openAIEventStream([
      {
        id: 'chatcmpl-test',
        choices: [
          {
            index: 0,
            delta: { role: 'assistant' },
            finish_reason: null,
          },
        ],
      },
      {
        id: 'chatcmpl-test',
        choices: [
          {
            index: 0,
            delta: {
              tool_calls: [
                {
                  index: 1,
                  id: 'call-vorkurs',
                  type: 'function',
                  function: {
                    name: 'doc_query',
                    arguments: toolInput.slice(0, 8),
                  },
                },
              ],
            },
            finish_reason: null,
          },
        ],
      },
      {
        id: 'chatcmpl-test',
        choices: [
          {
            index: 0,
            delta: {
              tool_calls: [
                {
                  index: 1,
                  function: { arguments: toolInput.slice(8) },
                },
              ],
            },
            finish_reason: null,
          },
        ],
      },
      {
        id: 'chatcmpl-test',
        choices: [
          {
            index: 0,
            delta: {},
            finish_reason: 'tool_calls',
          },
        ],
      },
      {
        id: 'chatcmpl-test',
        choices: [],
        usage: {
          prompt_tokens: 1,
          completion_tokens: 2,
          total_tokens: 3,
        },
      },
    ])
    const fetch = vi.fn(
      async () =>
        new Response(responseBody, {
          status: 200,
          headers: { 'content-type': 'text/event-stream' },
        })
    )
    const provider = createOpenAI({
      apiKey: 'test-key',
      baseURL: 'https://example.test/v1',
      fetch,
    })

    const result = streamText({
      model: provider.chat('test-model'),
      prompt: 'Find the Vorkurs information.',
      tools: {
        doc_query: tool({
          inputSchema: z.object({ query: z.string() }),
        }),
      },
    })
    const parts = []

    for await (const part of result.stream) {
      parts.push(part)
    }

    const toolCalls = parts.filter((part) => part.type === 'tool-call')
    const finishes = parts.filter((part) => part.type === 'finish')

    expect(fetch).toHaveBeenCalledOnce()
    expect(toolCalls).toHaveLength(1)
    expect(toolCalls[0]).toMatchObject({
      toolCallId: 'call-vorkurs',
      toolName: 'doc_query',
      input: { query: 'vorkurs' },
    })
    expect(finishes).toHaveLength(1)
    expect(finishes[0]).toMatchObject({
      finishReason: 'tool-calls',
    })
  })
})
