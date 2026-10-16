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

  test('continues startup when Langfuse initialization fails open', async () => {
    const getChatModelRegistry = vi.fn(() => [])
    const registerLangfuseTelemetry = vi.fn(async () => false)
    vi.stubEnv('NEXT_RUNTIME', 'nodejs')
    vi.doMock('../src/lib/server/chatModelRegistry', () => ({
      getChatModelRegistry,
    }))
    vi.doMock('../src/lib/server/langfuseTracing', () => ({
      registerLangfuseTelemetry,
    }))

    const { register } = await import('../src/instrumentation')

    await expect(register()).resolves.toBeUndefined()
    expect(getChatModelRegistry).toHaveBeenCalledOnce()
    expect(registerLangfuseTelemetry).toHaveBeenCalledOnce()
  })
})
