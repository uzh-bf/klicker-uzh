import { afterEach, describe, expect, test, vi } from 'vitest'

afterEach(() => {
  vi.unstubAllEnvs()
  vi.resetModules()
})

describe('chat model registry provider protocol', () => {
  test('preserves the legacy reasoning-based Responses default while allowing Auto to opt in', async () => {
    vi.stubEnv(
      'CHAT_MODEL_REGISTRY_JSON',
      JSON.stringify([
        {
          id: 'auto',
          deploymentId: 'auto-router',
          name: 'Auto',
          supportsReasoning: false,
          usesResponsesApi: true,
          cost: { input: 1, output: 1 },
        },
        {
          id: 'reasoning',
          deploymentId: 'reasoning',
          name: 'Reasoning',
          supportsReasoning: true,
          supportedReasoningEfforts: ['medium'],
          cost: { input: 1, output: 1 },
        },
        {
          id: 'fallback',
          deploymentId: 'fallback',
          name: 'Fallback',
          fallback: true,
          cost: { input: 1, output: 1 },
        },
      ])
    )

    const { getChatModelRegistry } = await import(
      '../src/lib/server/chatModelRegistry'
    )
    const byId = new Map(
      getChatModelRegistry().map((model) => [model.id, model])
    )

    expect(byId.get('auto')).toMatchObject({
      supportsReasoning: false,
      usesResponsesApi: true,
      supportedReasoningEfforts: [],
    })
    expect(byId.get('reasoning')).toMatchObject({
      supportsReasoning: true,
      usesResponsesApi: true,
      supportedReasoningEfforts: ['medium'],
    })
    expect(byId.get('fallback')).toMatchObject({
      supportsReasoning: false,
      usesResponsesApi: false,
      supportedReasoningEfforts: [],
    })
  })
})
