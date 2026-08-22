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

  test('keeps every allow-listed model visible regardless of participant balance', async () => {
    vi.stubEnv('CHAT_PRIMARY_MODEL_ID', 'advanced-primary')
    vi.stubEnv(
      'CHAT_MODEL_REGISTRY_JSON',
      JSON.stringify([
        {
          id: 'advanced-primary',
          deploymentId: 'advanced-primary',
          name: 'Advanced Primary',
          usageClass: 'ADVANCED',
          cost: { input: 1, output: 1 },
        },
        {
          id: 'advanced-fallback',
          deploymentId: 'advanced-fallback',
          name: 'Advanced Fallback',
          fallback: true,
          usageClass: 'ADVANCED',
          cost: { input: 1, output: 1 },
        },
        {
          id: 'base-fallback',
          deploymentId: 'base-fallback',
          name: 'Base Fallback',
          fallback: true,
          usageClass: 'BASE',
          cost: { input: 1, output: 1 },
        },
      ])
    )

    const { getAutomaticModelId, getModelsForChatbot } = await import(
      '../src/lib/server/chatModelRegistry'
    )

    expect(
      getModelsForChatbot({
        allowedModelIds: ['advanced-primary', 'advanced-fallback'],
      }).map((model) => model.id)
    ).toEqual(['advanced-primary', 'advanced-fallback'])
    expect(getAutomaticModelId(['advanced-primary', 'advanced-fallback'])).toBe(
      'advanced-primary'
    )
  })

  test('selects participant fallback only within the primary class and allow-list', async () => {
    vi.stubEnv('CHAT_FALLBACK_MODEL_ID', 'advanced-fallback')
    vi.stubEnv(
      'CHAT_MODEL_REGISTRY_JSON',
      JSON.stringify([
        {
          id: 'advanced-primary',
          deploymentId: 'advanced-primary',
          name: 'Advanced Primary',
          usageClass: 'ADVANCED',
          cost: { input: 1, output: 1 },
        },
        {
          id: 'advanced-fallback',
          deploymentId: 'advanced-fallback',
          name: 'Advanced Fallback',
          fallback: true,
          usageClass: 'ADVANCED',
          cost: { input: 1, output: 1 },
        },
        {
          id: 'base-fallback',
          deploymentId: 'base-fallback',
          name: 'Base Fallback',
          fallback: true,
          usageClass: 'BASE',
          cost: { input: 1, output: 1 },
        },
      ])
    )

    const { getParticipantFallbackModelId } = await import(
      '../src/lib/server/chatModelRegistry'
    )

    expect(
      getParticipantFallbackModelId('ADVANCED', [
        'advanced-primary',
        'advanced-fallback',
        'base-fallback',
      ])
    ).toBe('advanced-fallback')
    expect(
      getParticipantFallbackModelId('ADVANCED', [
        'advanced-primary',
        'base-fallback',
      ])
    ).toBeNull()
    vi.stubEnv('CHAT_FALLBACK_MODEL_ID', 'base-fallback')
    expect(getParticipantFallbackModelId('BASE', ['base-fallback'])).toBe(
      'base-fallback'
    )
  })
})
