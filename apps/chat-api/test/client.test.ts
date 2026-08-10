import { describe, expect, test, vi } from 'vitest'
import {
  CHAT_ENGINE_CONTRACT_VERSION,
  conformanceRequest,
} from '@klicker-uzh/chat-engine-contract'
import {
  createEngineClient,
  EngineReadinessProbe,
} from '../src/engine/client.js'

describe('engine client and readiness', () => {
  test('keeps generation degraded until an incompatible or unavailable manifest recovers', async () => {
    let attempts = 0
    const engine = {
      manifest: vi.fn(async () => {
        attempts += 1
        if (attempts === 1) throw new Error('connection refused')
        return {
          contractVersion: CHAT_ENGINE_CONTRACT_VERSION,
          engineId: 'default',
          features: {
            text: true,
            reasoning: true,
            images: true,
            tools: true,
            cancellation: true,
          } as const,
        }
      }),
      chat: vi.fn(),
    }
    const probe = new EngineReadinessProbe(engine, 0)

    expect((await probe.get()).ok).toBe(false)
    expect((await probe.get()).ok).toBe(true)
    expect(attempts).toBe(2)
  })

  test('forwards service and provider credentials only as headers', async () => {
    let captured: RequestInit | undefined
    const client = createEngineClient({
      baseUrl: 'http://engine.local',
      serviceToken: 'service-secret',
      fetch: vi.fn(async (_input, init) => {
        captured = init
        return new Response('data: [DONE]\n\n', {
          headers: { 'content-type': 'text/event-stream' },
        })
      }),
    })
    await client.chat(conformanceRequest, {
      providerAuthorization: 'Bearer provider-secret',
      signal: new AbortController().signal,
    })

    const headers = new Headers(captured?.headers)
    expect(headers.get('authorization')).toBe('Bearer service-secret')
    expect(headers.get('provider-authorization')).toBe('Bearer provider-secret')
    expect(String(captured?.body)).not.toContain('provider-secret')
  })
})
