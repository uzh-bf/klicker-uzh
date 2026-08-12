import { createOpenAI } from '@ai-sdk/openai'
import { generateText } from 'ai'
import { describe, expect, test } from 'vitest'
import { createOpenAIFetch } from '../src/lib/server/openaiCachePolicy'

type JsonObject = Record<string, unknown>

function chatResponse() {
  return {
    id: 'chatcmpl-cache-policy',
    object: 'chat.completion',
    created: 1,
    model: 'test-model',
    choices: [
      {
        index: 0,
        message: { role: 'assistant', content: 'Synthetic answer.' },
        finish_reason: 'stop',
      },
    ],
    usage: {
      prompt_tokens: 1,
      completion_tokens: 2,
      total_tokens: 3,
    },
  }
}

function responsesResponse() {
  return {
    id: 'response-cache-policy',
    object: 'response',
    created_at: 1,
    status: 'completed',
    model: 'test-model',
    output: [
      {
        type: 'message',
        role: 'assistant',
        id: 'message-cache-policy',
        status: 'completed',
        content: [
          { type: 'output_text', text: 'Synthetic answer.', annotations: [] },
        ],
      },
    ],
    usage: {
      input_tokens: 1,
      output_tokens: 2,
      total_tokens: 3,
      input_tokens_details: { cached_tokens: 0 },
      output_tokens_details: { reasoning_tokens: 0 },
    },
  }
}

function captureFetch(responseBody: unknown, captures: JsonObject[]) {
  return async (_input: RequestInfo | URL, init?: RequestInit) => {
    captures.push(JSON.parse(String(init?.body)) as JsonObject)
    return new Response(JSON.stringify(responseBody), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })
  }
}

describe('OpenAI exact-response cache policy', () => {
  test('adds the bypass to default Chat Completions requests', async () => {
    const captures: JsonObject[] = []
    const provider = createOpenAI({
      apiKey: 'test-key',
      baseURL: 'https://example.test/v1',
      fetch: createOpenAIFetch(
        'default',
        captureFetch(chatResponse(), captures)
      ),
    })

    const result = await generateText({
      model: provider.chat('test-model'),
      prompt: 'Synthetic prompt.',
      maxRetries: 0,
    })

    expect(result.text).toBe('Synthetic answer.')
    expect(captures).toHaveLength(1)
    expect(captures[0]?.cache).toEqual({
      'no-cache': true,
      'no-store': true,
    })
  })

  test('adds the bypass and preserves Responses assistant normalization', async () => {
    const captures: JsonObject[] = []
    const provider = createOpenAI({
      apiKey: 'test-key',
      baseURL: 'https://example.test/v1',
      fetch: createOpenAIFetch(
        'default',
        captureFetch(responsesResponse(), captures)
      ),
    })

    const result = await generateText({
      model: provider.responses('test-model'),
      messages: [{ role: 'assistant', content: 'Previous answer.' }],
      maxRetries: 0,
    })

    expect(result.text).toBe('Synthetic answer.')
    expect(captures).toHaveLength(1)
    expect(captures[0]?.cache).toEqual({
      'no-cache': true,
      'no-store': true,
    })
    expect(captures[0]?.input).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          role: 'assistant',
          type: 'message',
          status: 'completed',
        }),
      ])
    )
  })

  test('preserves custom Responses fields without adding gateway cache policy', async () => {
    const captures: JsonObject[] = []
    const provider = createOpenAI({
      apiKey: 'test-key',
      baseURL: 'https://custom.example/v1',
      fetch: createOpenAIFetch(
        'custom',
        captureFetch(responsesResponse(), captures)
      ),
    })

    await generateText({
      model: provider.responses('gpt-5.6-luna'),
      prompt: 'Synthetic prompt.',
      providerOptions: {
        openai: {
          store: true,
          reasoningEffort: 'high',
        },
      },
      maxRetries: 0,
    })

    expect(captures).toHaveLength(1)
    expect(captures[0]).not.toHaveProperty('cache')
    expect(captures[0]?.store).toBe(true)
    expect(captures[0]?.reasoning).toMatchObject({ effort: 'high' })
  })

  test('adds the bypass to image-shaped default requests without a prompt cache key', async () => {
    const captures: JsonObject[] = []
    const provider = createOpenAI({
      apiKey: 'test-key',
      baseURL: 'https://example.test/v1',
      fetch: createOpenAIFetch(
        'default',
        captureFetch(chatResponse(), captures)
      ),
    })

    await generateText({
      model: provider.chat('test-model'),
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image', image: 'data:image/png;base64,c3ludGhldGlj' },
            { type: 'text', text: 'Describe this synthetic image.' },
          ],
        },
      ],
      maxRetries: 0,
    })

    expect(captures).toHaveLength(1)
    expect(captures[0]?.cache).toEqual({
      'no-cache': true,
      'no-store': true,
    })
    expect(captures[0]).not.toHaveProperty('prompt_cache_key')
  })

  test('passes non-JSON bodies through without changing custom requests', async () => {
    const body = 'synthetic-body'
    let receivedInit: RequestInit | undefined
    const fetch = createOpenAIFetch('custom', async (_input, init) => {
      receivedInit = init
      return new Response('ok')
    })

    await fetch('https://custom.example/v1', { method: 'POST', body })

    expect(receivedInit).toEqual({ method: 'POST', body })
  })
})
