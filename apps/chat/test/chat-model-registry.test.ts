import { describe, expect, test, vi } from 'vitest'

describe('chat model registry defaults', () => {
  test('uses Auto Mode as the default primary model', async () => {
    vi.resetModules()
    vi.stubEnv('CHAT_MODEL_REGISTRY_JSON', undefined)
    vi.stubEnv('CHAT_PRIMARY_MODEL_ID', undefined)
    vi.stubEnv('CHAT_FALLBACK_MODEL_ID', undefined)

    const {
      getAutomaticModelId,
      getChatModelRegistry,
      getParticipantFallbackModelId,
    } = await import('../src/lib/server/chatModelRegistry')

    const registry = getChatModelRegistry()
    expect(getAutomaticModelId()).toBe('auto')
    expect(
      registry.find((model) => model.id === getParticipantFallbackModelId())
    ).toMatchObject({ usageClass: 'BASE', fallback: true })
  })
})
