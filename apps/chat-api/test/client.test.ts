import { describe, expect, test, vi } from 'vitest'
import {
  conformanceManifest,
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
        return { ...conformanceManifest, engineId: 'default' }
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
      traceContext: {
        traceparent: '00-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa-bbbbbbbbbbbbbbbb-01',
        tracestate: 'vendor=value',
      },
      signal: new AbortController().signal,
    })

    const headers = new Headers(captured?.headers)
    expect(headers.get('authorization')).toBe('Bearer service-secret')
    expect(headers.get('provider-authorization')).toBe('Bearer provider-secret')
    expect(headers.get('traceparent')).toBe(
      '00-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa-bbbbbbbbbbbbbbbb-01'
    )
    expect(headers.get('tracestate')).toBe('vendor=value')
    expect(String(captured?.body)).not.toContain('provider-secret')
    expect(String(captured?.body)).not.toContain('traceparent')
  })

  test('degrades readiness when the manifest does not respond before the timeout', async () => {
    let aborted = false
    const client = createEngineClient({
      baseUrl: 'http://engine.local',
      fetch: vi.fn(
        async (_input, init) =>
          new Promise<Response>((_, reject) => {
            init?.signal?.addEventListener('abort', () => {
              aborted = true
              reject(new Error('aborted'))
            })
          })
      ),
    })
    const probe = new EngineReadinessProbe(client, 0, 5)

    await expect(probe.get()).resolves.toMatchObject({
      ok: false,
      reason: 'Engine manifest check timed out.',
    })
    expect(aborted).toBe(true)
  })
})

test('concurrent readiness callers await the same first manifest probe', async () => {
  let resolveManifest!: (value: typeof conformanceManifest) => void
  const manifest = vi.fn(
    () =>
      new Promise<typeof conformanceManifest>((resolve) => {
        resolveManifest = resolve
      })
  )
  vi.stubEnv('CHAT_ENGINE_ID', conformanceManifest.engineId)
  const probe = new EngineReadinessProbe(
    { manifest, chat: vi.fn() },
    15000,
    5000
  )
  vi.unstubAllEnvs()
  const first = probe.get()
  const second = probe.get()
  resolveManifest(conformanceManifest)
  const states = await Promise.all([first, second])
  expect(states.map((state) => state.ok)).toEqual([true, true])
  expect(manifest).toHaveBeenCalledTimes(1)
})
