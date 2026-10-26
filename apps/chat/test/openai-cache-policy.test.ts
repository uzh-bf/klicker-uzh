import { createOpenAI } from '@ai-sdk/openai'
import { generateText } from 'ai'
import { describe, expect, test, vi } from 'vitest'
import {
  assertEvaluationRouting,
  createOpenAIFetch,
} from '../src/lib/server/openaiCachePolicy'

type JsonObject = Record<string, unknown>

describe('evaluation provider boundary', () => {
  const origin = 'http://127.0.0.1:1418'
  const env = {
    KLICKER_EVAL_GUARD_ORIGIN: origin,
    OPENAI_BASE_URL: `${origin}/v1`,
  }

  test('permits only the bound default provider when evaluation is enabled', () => {
    expect(() => assertEvaluationRouting({}, env)).not.toThrow()
    const ipv6Origin = 'http://[::1]:1418'
    expect(() =>
      assertEvaluationRouting(
        {},
        {
          KLICKER_EVAL_GUARD_ORIGIN: ipv6Origin,
          OPENAI_BASE_URL: `${ipv6Origin}/v1`,
        }
      )
    ).not.toThrow()
    for (const override of [
      { openaiApiKey: 'synthetic-override' },
      { openaiBaseUrl: 'http://localhost:4000/v1' },
    ]) {
      expect(() => assertEvaluationRouting(override, env)).toThrow(
        'evaluation_guard_chatbot_override'
      )
    }
    for (const base of [undefined, origin, 'https://example.test/v1']) {
      expect(() =>
        assertEvaluationRouting({}, { ...env, OPENAI_BASE_URL: base })
      ).toThrow('evaluation_guard_endpoint_mismatch')
    }
  })

  test('rejects nonlocal or ambiguous guard origins', () => {
    for (const invalid of [
      'https://example.test',
      `${origin}/`,
      `${origin}?query=1`,
      'http://user:password@localhost:1418',
      'invalid',
    ]) {
      expect(() =>
        assertEvaluationRouting(
          {},
          { ...env, KLICKER_EVAL_GUARD_ORIGIN: invalid }
        )
      ).toThrow('evaluation_guard_origin_invalid')
    }
  })

  test('preserves ordinary custom provider routing without the opt-in', () => {
    expect(() =>
      assertEvaluationRouting(
        {
          openaiApiKey: 'synthetic-key',
          openaiBaseUrl: 'https://example.test',
        },
        {}
      )
    ).not.toThrow()
  })
})

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
      prompt_tokens: 1536,
      completion_tokens: 2,
      total_tokens: 1538,
      prompt_tokens_details: {
        cached_tokens: 1024,
        cache_write_tokens: 256,
      },
      completion_tokens_details: { reasoning_tokens: 0 },
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
      input_tokens: 1536,
      output_tokens: 2,
      total_tokens: 1538,
      input_tokens_details: {
        cached_tokens: 1024,
        cache_write_tokens: 256,
      },
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
  test('preserves bounded reasoning settings for a prefixed evaluation deployment', async () => {
    const captures: JsonObject[] = []
    const provider = createOpenAI({
      apiKey: 'synthetic-key',
      baseURL: 'http://localhost:1418/v1',
      fetch: createOpenAIFetch(
        'default',
        captureFetch(responsesResponse(), captures)
      ),
    })
    await generateText({
      model: provider.responses('openai/gpt-6-luna'),
      prompt: 'Synthetic routing check.',
      maxRetries: 0,
      maxOutputTokens: 4096,
      providerOptions: {
        openai: { forceReasoning: true, reasoningEffort: 'low' },
      },
    })
    expect(captures[0]?.model).toBe('openai/gpt-6-luna')
    expect(captures[0]?.max_output_tokens).toBe(4096)
    expect(captures[0]?.reasoning).toMatchObject({ effort: 'low' })
  })

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
    expect(result.usage.inputTokenDetails).toEqual({
      noCacheTokens: 256,
      cacheReadTokens: 1024,
      cacheWriteTokens: 256,
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
    expect(result.usage.inputTokenDetails).toEqual({
      noCacheTokens: 256,
      cacheReadTokens: 1024,
      cacheWriteTokens: 256,
    })
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
      model: provider.responses('gpt-6-luna'),
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

  test('propagates a synchronous fetch SyntaxError without retrying', async () => {
    const fetchError = new SyntaxError('synthetic fetch failure')
    const fetchImpl = vi.fn(() => {
      throw fetchError
    }) as unknown as typeof globalThis.fetch
    const fetch = createOpenAIFetch('default', fetchImpl)

    await expect(
      fetch('https://example.test/v1', {
        method: 'POST',
        body: JSON.stringify({ messages: [] }),
      })
    ).rejects.toBe(fetchError)

    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })
})
