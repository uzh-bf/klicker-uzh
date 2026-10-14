import { createOpenAI } from '@ai-sdk/openai'
import { isStepCount, streamText, tool } from 'ai'
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

  test('streams a tool result and continued answer through the UI protocol', async () => {
    const requests: Record<string, unknown>[] = []
    const execute = vi.fn(async (_input: { query: string }) => ({
      marker: 'SYNTHETIC_KB_RESULT',
    }))
    const fetch = vi.fn(
      async (_input: RequestInfo | URL, init?: RequestInit) => {
        requests.push(JSON.parse(String(init?.body)))
        const delta =
          requests.length === 1
            ? {
                role: 'assistant',
                tool_calls: [
                  {
                    index: 1,
                    id: 'call-synthetic',
                    type: 'function',
                    function: {
                      name: 'doc_query',
                      arguments: JSON.stringify({ query: 'synthetic' }),
                    },
                  },
                ],
              }
            : { role: 'assistant', content: 'Synthetic grounded answer.' }

        return new Response(
          openAIEventStream([
            {
              id: `chatcmpl-synthetic-${requests.length}`,
              choices: [{ index: 0, delta, finish_reason: null }],
            },
            {
              id: `chatcmpl-synthetic-${requests.length}`,
              choices: [
                {
                  index: 0,
                  delta: {},
                  finish_reason: requests.length === 1 ? 'tool_calls' : 'stop',
                },
              ],
            },
          ]),
          {
            headers: { 'content-type': 'text/event-stream' },
          }
        )
      }
    )
    const provider = createOpenAI({
      apiKey: 'test-key',
      baseURL: 'https://example.test/v1',
      fetch,
    })
    const result = streamText({
      model: provider.chat('test-model'),
      prompt: 'Use the synthetic knowledge tool.',
      tools: {
        doc_query: tool({
          inputSchema: z.object({ query: z.string() }),
          execute,
        }),
      },
      stopWhen: isStepCount(2),
      maxRetries: 0,
    })
    const response = result.toUIMessageStreamResponse()
    const body = await response.text()
    const events = body
      .split('\n')
      .filter((line) => line.startsWith('data: ') && line !== 'data: [DONE]')
      .map((line) => JSON.parse(line.slice(6)))

    expect(fetch).toHaveBeenCalledTimes(2)
    expect(execute).toHaveBeenCalledOnce()
    expect(execute.mock.calls[0]?.[0]).toEqual({ query: 'synthetic' })
    expect(requests[1]?.messages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          role: 'tool',
          tool_call_id: 'call-synthetic',
          content: JSON.stringify({ marker: 'SYNTHETIC_KB_RESULT' }),
        }),
      ])
    )
    expect(events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'tool-input-available',
          toolCallId: 'call-synthetic',
          toolName: 'doc_query',
          input: { query: 'synthetic' },
        }),
        expect.objectContaining({
          type: 'tool-output-available',
          toolCallId: 'call-synthetic',
          output: { marker: 'SYNTHETIC_KB_RESULT' },
        }),
        expect.objectContaining({
          type: 'text-delta',
          delta: 'Synthetic grounded answer.',
        }),
      ])
    )
    expect(events.filter((event) => event.type === 'finish')).toHaveLength(1)
    expect(events.some((event) => event.type === 'error')).toBe(false)
    expect(body).toContain('data: [DONE]')
  })
})
