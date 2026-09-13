import { describe, expect, test, vi } from 'vitest'

describe('chat model registry defaults', () => {
  test('uses Auto Mode as the default primary model', async () => {
    vi.resetModules()
    vi.stubEnv('CHAT_MODEL_REGISTRY_JSON', undefined)
    vi.stubEnv('CHAT_PRIMARY_MODEL_ID', undefined)
    vi.stubEnv('CHAT_FALLBACK_MODEL_ID', undefined)

    const { getAutomaticModelId, getChatModelRegistry } = await import(
      '../src/lib/server/chatModelRegistry'
    )

    const registry = getChatModelRegistry()
    const gpt54 = registry.find((model) => model.id === 'gpt-5.4')
    const gpt51 = registry.find((model) => model.id === 'gpt-5.1')

    // Retired from the built-in registry: the model must no longer be
    // selectable, while the remaining frontier entries keep their efforts.
    expect(registry.map((model) => model.id)).not.toContain('gpt-5.5')
    expect(gpt54?.supportedReasoningEfforts).toEqual(
      expect.arrayContaining(['none', 'low', 'medium', 'high', 'xhigh'])
    )
    expect(gpt51?.supportedReasoningEfforts).not.toContain('xhigh')
    // 'auto' maps to the LiteLLM complexity router deployment, which is the
    // registry's first non-fallback entry and therefore the default primary.
    expect(getAutomaticModelId()).toBe('auto')
  })
})
