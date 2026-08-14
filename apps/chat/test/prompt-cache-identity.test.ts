import { createOpenAI } from '@ai-sdk/openai'
import { generateText, type ToolSet, tool } from 'ai'
import { describe, expect, test } from 'vitest'
import { z } from 'zod'
import { buildPromptCacheRequest } from '../src/lib/server/promptCacheIdentity'

type StablePrefixChange = {
  deploymentId?: string
  instructions?: string
  transport?: 'chat' | 'responses'
}

function createTools(order: 'first' | 'second' = 'first'): ToolSet {
  const first = tool({
    description: 'Search the synthetic corpus.',
    inputSchema: z.object({
      query: z.string().describe('Search query'),
      limit: z.number().int().optional(),
    }),
    strict: true,
    execute: async () => ({ ok: true }),
  })
  const second = tool({
    description: 'Read one synthetic result.',
    inputSchema: z.object({ resultId: z.string() }),
    execute: async () => ({ ok: true }),
  })

  return order === 'first'
    ? { search: first, read: second }
    : { read: second, search: first }
}

function chatResponse() {
  return {
    id: 'chatcmpl-prompt-cache-identity',
    object: 'chat.completion',
    created: 1,
    model: 'gpt-4.1',
    choices: [
      {
        index: 0,
        message: { role: 'assistant', content: 'Synthetic answer.' },
        finish_reason: 'stop',
      },
    ],
    usage: {
      prompt_tokens: 1536,
      completion_tokens: 1,
      total_tokens: 1537,
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
    id: 'response-prompt-cache-identity',
    object: 'response',
    created_at: 1,
    status: 'completed',
    model: 'gpt-5.6-luna',
    output: [
      {
        type: 'message',
        role: 'assistant',
        id: 'message-prompt-cache-identity',
        status: 'completed',
        content: [
          { type: 'output_text', text: 'Synthetic answer.', annotations: [] },
        ],
      },
    ],
    usage: {
      input_tokens: 1536,
      output_tokens: 1,
      total_tokens: 1537,
      input_tokens_details: {
        cached_tokens: 1024,
        cache_write_tokens: 256,
      },
      output_tokens_details: { reasoning_tokens: 0 },
    },
  }
}

function captureFetch(
  responseBody: unknown,
  captures: Record<string, unknown>[]
) {
  return async (_input: RequestInfo | URL, init?: RequestInit) => {
    captures.push(JSON.parse(String(init?.body)) as Record<string, unknown>)
    return new Response(JSON.stringify(responseBody), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })
  }
}

describe('prompt cache identity', () => {
  test('is stable across tool insertion order and returns one provider order', async () => {
    const first = await buildPromptCacheRequest({
      deploymentId: 'gpt-5.6-luna',
      transport: 'responses',
      instructions: 'Synthetic instructions.',
      tools: createTools('first'),
    })
    const second = await buildPromptCacheRequest({
      deploymentId: 'gpt-5.6-luna',
      transport: 'responses',
      instructions: 'Synthetic instructions.',
      tools: createTools('second'),
    })

    expect(first.promptCacheKey).toBe(second.promptCacheKey)
    expect(first.promptCacheKey).toHaveLength(64)
    expect(first.toolOrder).toEqual(['read', 'search'])
    expect(second.toolOrder).toEqual(first.toolOrder)
  })

  test.each<[string, StablePrefixChange]>([
    ['instructions', { instructions: 'Changed instructions.' }],
    ['deployment', { deploymentId: 'auto-router' }],
    ['transport', { transport: 'chat' as const }],
  ])('changes the key when the stable prefix %s changes', async (_, change) => {
    const base = await buildPromptCacheRequest({
      deploymentId: 'gpt-5.6-luna',
      transport: 'responses',
      instructions: 'Synthetic instructions.',
      tools: createTools(),
    })
    const changed = await buildPromptCacheRequest({
      deploymentId: change.deploymentId ?? 'gpt-5.6-luna',
      transport: change.transport ?? 'responses',
      instructions: change.instructions ?? 'Synthetic instructions.',
      tools: createTools(),
    })

    expect(changed.promptCacheKey).not.toBe(base.promptCacheKey)
  })

  test('changes the key for provider-visible tool changes but not runtime functions', async () => {
    const baseTools = createTools()
    const base = await buildPromptCacheRequest({
      deploymentId: 'gpt-5.6-luna',
      transport: 'responses',
      instructions: 'Synthetic instructions.',
      tools: baseTools,
    })
    const changed = await buildPromptCacheRequest({
      deploymentId: 'gpt-5.6-luna',
      transport: 'responses',
      instructions: 'Synthetic instructions.',
      tools: {
        ...createTools(),
        search: tool<{ query: string }, { ok: boolean }, Record<never, never>>({
          description: 'Changed search description.',
          inputSchema: z.object({ query: z.string() }),
          execute: async (_input) => ({ ok: true }),
        }),
      },
    })

    expect(changed.promptCacheKey).not.toBe(base.promptCacheKey)
    expect(changed.tools.search.execute).not.toBeUndefined()
    expect(base.tools.search.execute).toBe(baseTools.search.execute)
  })

  test('changes the key for provider-visible tool options', async () => {
    const base = await buildPromptCacheRequest({
      deploymentId: 'gpt-5.6-luna',
      transport: 'responses',
      instructions: 'Synthetic instructions.',
      tools: {
        search: tool<{ query: string }, { ok: boolean }, Record<never, never>>({
          description: 'Search the synthetic corpus.',
          inputSchema: z.object({ query: z.string() }),
          strict: true,
          inputExamples: [{ input: { query: 'base' } }],
          providerOptions: { openai: { strictJsonSchema: true } },
          execute: async () => ({ ok: true }),
        }),
      },
    })
    const changed = await buildPromptCacheRequest({
      deploymentId: 'gpt-5.6-luna',
      transport: 'responses',
      instructions: 'Synthetic instructions.',
      tools: {
        search: tool<{ query: string }, { ok: boolean }, Record<never, never>>({
          description: 'Search the synthetic corpus.',
          inputSchema: z.object({ query: z.string() }),
          strict: false,
          inputExamples: [{ input: { query: 'changed' } }],
          providerOptions: { openai: { strictJsonSchema: false } },
          execute: async () => ({ ok: true }),
        }),
      },
    })

    expect(changed.promptCacheKey).not.toBe(base.promptCacheKey)
  })

  test('ignores runtime-only changes while retaining the executable tool', async () => {
    const firstTools = createTools()
    const secondTools = createTools()
    secondTools.search.execute = async () => ({ ok: true })

    const first = await buildPromptCacheRequest({
      deploymentId: 'gpt-5.6-luna',
      transport: 'responses',
      instructions: 'Synthetic instructions.',
      tools: firstTools,
    })
    const second = await buildPromptCacheRequest({
      deploymentId: 'gpt-5.6-luna',
      transport: 'responses',
      instructions: 'Synthetic instructions.',
      tools: secondTools,
    })

    expect(second.promptCacheKey).toBe(first.promptCacheKey)
    expect(second.tools.search.execute).toBe(secondTools.search.execute)
  })

  test.each([
    ['userId', 'synthetic-user'],
    ['participantId', 'synthetic-participant'],
    ['chatbotId', 'synthetic-chatbot'],
    ['threadId', 'synthetic-thread'],
    ['assistantMessageId', 'synthetic-assistant'],
    ['messageId', 'synthetic-message'],
    ['requestId', 'synthetic-request'],
    ['toolCallId', 'synthetic-tool-call'],
    ['mcpServerId', 'synthetic-mcp-server'],
  ])('does not accept %s as a stable identity input', async (field, value) => {
    const base = await buildPromptCacheRequest({
      deploymentId: 'gpt-5.6-luna',
      transport: 'responses',
      instructions: 'Synthetic instructions.',
      tools: createTools(),
    })
    const inputWithRequestIdentifier = {
      deploymentId: 'gpt-5.6-luna',
      transport: 'responses' as const,
      instructions: 'Synthetic instructions.',
      tools: createTools(),
      [field]: value,
    }

    const withRequestIdentifiers = await buildPromptCacheRequest(
      inputWithRequestIdentifier
    )

    expect(withRequestIdentifiers.promptCacheKey).toBe(base.promptCacheKey)
  })

  test('serializes the same canonical tool projection on Chat and Responses', async () => {
    const chatCaptures: Record<string, unknown>[] = []
    const chatRequest = await buildPromptCacheRequest({
      deploymentId: 'gpt-4.1',
      transport: 'chat',
      instructions: 'Synthetic instructions.',
      tools: createTools(),
    })
    const chatProvider = createOpenAI({
      apiKey: 'test-key',
      baseURL: 'https://example.test/v1',
      fetch: captureFetch(chatResponse(), chatCaptures),
    })

    const chatResult = await generateText({
      model: chatProvider.chat('gpt-4.1'),
      prompt: 'Synthetic prompt.',
      instructions: 'Synthetic instructions.',
      tools: chatRequest.tools,
      toolOrder: chatRequest.toolOrder,
      providerOptions: {
        openai: { promptCacheKey: chatRequest.promptCacheKey },
      },
      maxRetries: 0,
    })

    const chatBody = chatCaptures[0]
    const chatTools = chatBody?.tools as Record<string, unknown>[]
    expect(chatBody?.prompt_cache_key).toBe(chatRequest.promptCacheKey)
    expect(chatBody?.prompt_cache_options).toBeUndefined()
    expect(
      chatTools.map((entry) => (entry.function as Record<string, unknown>).name)
    ).toEqual(['read', 'search'])
    const searchChatTool = chatTools.find(
      (entry) => (entry.function as Record<string, unknown>)?.name === 'search'
    )
    const chatParameters = ((
      searchChatTool?.function as Record<string, unknown>
    )?.parameters ?? {}) as Record<string, unknown>
    const chatParameterKeys = Object.keys(chatParameters)
    expect(chatParameterKeys).toEqual(
      [...chatParameterKeys].sort((left, right) =>
        left.localeCompare(right, 'en-US')
      )
    )
    expect(chatParameters).toMatchObject({
      type: 'object',
      properties: expect.any(Object),
    })
    expect(chatResult.usage.inputTokenDetails).toEqual({
      noCacheTokens: 256,
      cacheReadTokens: 1024,
      cacheWriteTokens: 256,
    })

    const responsesCaptures: Record<string, unknown>[] = []
    const responsesRequest = await buildPromptCacheRequest({
      deploymentId: 'gpt-5.6-luna',
      transport: 'responses',
      instructions: 'Synthetic instructions.',
      tools: createTools(),
    })
    const responsesProvider = createOpenAI({
      apiKey: 'test-key',
      baseURL: 'https://example.test/v1',
      fetch: captureFetch(responsesResponse(), responsesCaptures),
    })

    const responseResult = await generateText({
      model: responsesProvider.responses('gpt-5.6-luna'),
      prompt: 'Synthetic prompt.',
      instructions: 'Synthetic instructions.',
      tools: responsesRequest.tools,
      toolOrder: responsesRequest.toolOrder,
      providerOptions: {
        openai: { promptCacheKey: responsesRequest.promptCacheKey },
      },
      maxRetries: 0,
    })

    const responsesBody = responsesCaptures[0]
    const responseTools = responsesBody?.tools as Record<string, unknown>[]
    expect(responsesBody?.prompt_cache_key).toBe(
      responsesRequest.promptCacheKey
    )
    expect(responsesBody?.prompt_cache_options).toBeUndefined()
    expect(responseTools.map((entry) => entry.name)).toEqual(['read', 'search'])
    const searchResponseTool = responseTools.find(
      (entry) => entry.name === 'search'
    )
    const responseParameters = (searchResponseTool?.parameters ?? {}) as Record<
      string,
      unknown
    >
    const responseParameterKeys = Object.keys(responseParameters)
    expect(responseParameterKeys).toEqual(
      [...responseParameterKeys].sort((left, right) =>
        left.localeCompare(right, 'en-US')
      )
    )
    expect(responseParameters).toEqual(chatParameters)

    expect(responseResult.usage.inputTokenDetails).toEqual({
      noCacheTokens: 256,
      cacheReadTokens: 1024,
      cacheWriteTokens: 256,
    })
  })
})
