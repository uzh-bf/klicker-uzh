import { afterEach, describe, expect, test, vi } from 'vitest'

afterEach(() => {
  vi.unstubAllEnvs()
  vi.resetModules()
})

describe('chat startup validation', () => {
  test('validates the model registry before telemetry can be disabled', async () => {
    vi.stubEnv('NEXT_RUNTIME', 'nodejs')
    vi.stubEnv('CHAT_ENABLE_AI_TELEMETRY', 'false')
    vi.stubEnv('CHAT_MODEL_REGISTRY_JSON', '{')

    const { register } = await import('../src/instrumentation')

    await expect(register()).rejects.toThrow()
  })
})
