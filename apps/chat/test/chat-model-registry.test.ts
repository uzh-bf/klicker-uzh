import { describe, expect, test, vi } from 'vitest'

describe('chat model registry defaults', () => {
  test('uses GPT-5.5 as the default primary model', async () => {
    vi.resetModules()
    vi.stubEnv('CHAT_MODEL_REGISTRY_JSON', undefined)
    vi.stubEnv('CHAT_PRIMARY_MODEL_ID', undefined)
    vi.stubEnv('CHAT_FALLBACK_MODEL_ID', undefined)

    const { getAutomaticModelId, getChatModelRegistry } = await import(
      '../src/lib/server/chatModelRegistry'
    )

    const registry = getChatModelRegistry()
    const gpt55 = registry.find((model) => model.id === 'gpt-5.5')
    const gpt54 = registry.find((model) => model.id === 'gpt-5.4')
    const gpt51 = registry.find((model) => model.id === 'gpt-5.1')

    expect(gpt55?.supportedReasoningEfforts).toEqual(
      expect.arrayContaining(['none', 'low', 'medium', 'high', 'xhigh'])
    )
    expect(gpt54?.supportedReasoningEfforts).toEqual(
      expect.arrayContaining(['none', 'low', 'medium', 'high', 'xhigh'])
    )
    expect(gpt51?.supportedReasoningEfforts).not.toContain('xhigh')
    expect(getAutomaticModelId({ current: 100 })).toBe('gpt-5.5')
  })
})
