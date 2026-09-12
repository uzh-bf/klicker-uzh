import { afterEach, describe, expect, test, vi } from 'vitest'

afterEach(() => {
  vi.unstubAllEnvs()
  vi.resetModules()
})

describe('GraphQL chat model registry startup validation', () => {
  test('fails closed when supplied registry JSON is invalid', async () => {
    vi.stubEnv('CHAT_MODEL_REGISTRY_JSON', '{')

    const { getChatModelRegistry } = await import('../src/services/chatbots.js')

    expect(() => getChatModelRegistry()).toThrow()
  })
})
