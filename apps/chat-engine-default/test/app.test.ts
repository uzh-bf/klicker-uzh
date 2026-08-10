import { MockLanguageModelV3 } from 'ai/test'
import { describe, expect, test } from 'vitest'
import {
  conformanceRequest,
  parseEngineStreamPart,
} from '@klicker-uzh/chat-engine-contract'
import { createDefaultEngineApp } from '../src/index.js'

function mockStream() {
  return new ReadableStream({
    start(controller) {
      controller.enqueue({ type: 'stream-start', warnings: [] })
      controller.enqueue({ type: 'text-start', id: 'text-1' })
      controller.enqueue({
        type: 'text-delta',
        id: 'text-1',
        delta: 'A bond is debt.',
      })
      controller.enqueue({ type: 'text-end', id: 'text-1' })
      controller.enqueue({
        type: 'finish',
        finishReason: { unified: 'stop', raw: 'stop' },
        usage: {
          inputTokens: {
            total: 12,
            noCache: 12,
            cacheRead: undefined,
            cacheWrite: undefined,
          },
          outputTokens: { total: 8, text: 8, reasoning: undefined },
        },
      })
      controller.close()
    },
  })
}

async function readParts(response: Response) {
  const body = await response.text()
  return body
    .split('\n')
    .filter((line) => line.startsWith('data: ') && line !== 'data: [DONE]')
    .map((line) =>
      parseEngineStreamPart(JSON.parse(line.slice('data: '.length)))
    )
}

describe('default chat engine', () => {
  test('serves a manifest and streams the normalized contract', async () => {
    const model = new MockLanguageModelV3({
      doStream: { stream: mockStream() },
    })
    const app = createDefaultEngineApp({
      serviceToken: 'service-secret',
      modelFactory: () => model,
    })

    const manifestResponse = await app.request('/v1/manifest')
    expect(manifestResponse.status).toBe(200)
    expect((await manifestResponse.json()).contractVersion).toBe('v1')

    const response = await app.request('/v1/chat', {
      method: 'POST',
      headers: {
        authorization: 'Bearer service-secret',
        'content-type': 'application/json',
      },
      body: JSON.stringify(conformanceRequest),
    })
    expect(response.status).toBe(200)

    const parts = await readParts(response)
    const finish = parts.find((part) => part.type === 'finish')
    expect(parts.some((part) => part.type === 'text-delta')).toBe(true)
    expect(
      finish?.type === 'finish' ? finish.messageMetadata.usage : null
    ).toMatchObject({
      inputTokens: 12,
      outputTokens: 8,
      totalTokens: 20,
    })
    expect(model.doStreamCalls).toHaveLength(1)
  })

  test('rejects missing service, provider, and MCP credentials before streaming', async () => {
    const requestModeRequest = {
      ...conformanceRequest,
      generation: {
        ...conformanceRequest.generation,
        credentialMode: {
          mode: 'request' as const,
          providerBaseUrl: 'https://openrouter.ai/api/v1',
        },
      },
      tools: [
        {
          name: 'doc_query',
          description: 'Search course documents.',
          inputSchema: { type: 'object', properties: {} },
        },
      ],
    }
    const model = new MockLanguageModelV3({
      doStream: { stream: mockStream() },
    })
    const app = createDefaultEngineApp({
      serviceToken: 'service-secret',
      modelFactory: () => model,
    })

    const missingService = await app.request('/v1/chat', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(conformanceRequest),
    })
    expect(missingService.status).toBe(401)

    const missingProvider = await app.request('/v1/chat', {
      method: 'POST',
      headers: {
        authorization: 'Bearer service-secret',
        'content-type': 'application/json',
      },
      body: JSON.stringify(requestModeRequest),
    })
    expect(missingProvider.status).toBe(400)

    const missingMcpToken = await app.request('/v1/chat', {
      method: 'POST',
      headers: {
        authorization: 'Bearer service-secret',
        'content-type': 'application/json',
        'provider-authorization': 'Bearer provider-secret',
      },
      body: JSON.stringify(requestModeRequest),
    })
    expect(missingMcpToken.status).toBe(400)
    expect(model.doStreamCalls).toHaveLength(0)
  })
})
