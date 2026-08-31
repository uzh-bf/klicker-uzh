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
          maxOutputTokens: 4096,
          cost: { input: 1, output: 1 },
        },
        {
          id: 'reasoning',
          deploymentId: 'reasoning',
          name: 'Reasoning',
          supportsReasoning: true,
          supportedReasoningEfforts: ['medium'],
          maxOutputTokens: 4096,
          cost: { input: 1, output: 1 },
        },
        {
          id: 'gpt-5.6-luna',
          deploymentId: 'gpt-5.6-luna',
          name: 'GPT-5.6 Luna',
          fallback: true,
          usageClass: 'BASE',
          maxOutputTokens: 4096,
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
    expect(byId.get('gpt-5.6-luna')).toMatchObject({
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
          maxOutputTokens: 4096,
          cost: { input: 1, output: 1 },
        },
        {
          id: 'advanced-fallback',
          deploymentId: 'advanced-fallback',
          name: 'Advanced Fallback',
          fallback: true,
          usageClass: 'ADVANCED',
          maxOutputTokens: 4096,
          cost: { input: 1, output: 1 },
        },
        {
          id: 'gpt-5.6-luna',
          deploymentId: 'gpt-5.6-luna',
          name: 'GPT-5.6 Luna',
          fallback: true,
          usageClass: 'BASE',
          maxOutputTokens: 4096,
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

  test('uses Luna when an allow-list contains only retired models', async () => {
    const { getAutomaticModelId, getModelsForChatbot } = await import(
      '../src/lib/server/chatModelRegistry'
    )

    expect(
      getModelsForChatbot({ allowedModelIds: ['gpt-4.1-mini'] }).map(
        (model) => model.id
      )
    ).toEqual(['gpt-5.6-luna'])
    expect(getAutomaticModelId(['gpt-4.1-mini'])).toBe('gpt-5.6-luna')
  })

  test('always selects Luna as the participant fallback', async () => {
    vi.stubEnv('CHAT_FALLBACK_MODEL_ID', 'advanced-fallback')
    vi.stubEnv(
      'CHAT_MODEL_REGISTRY_JSON',
      JSON.stringify([
        {
          id: 'advanced-primary',
          deploymentId: 'advanced-primary',
          name: 'Advanced Primary',
          usageClass: 'ADVANCED',
          maxOutputTokens: 4096,
          cost: { input: 1, output: 1 },
        },
        {
          id: 'advanced-fallback',
          deploymentId: 'advanced-fallback',
          name: 'Advanced Fallback',
          fallback: true,
          usageClass: 'ADVANCED',
          maxOutputTokens: 4096,
          cost: { input: 1, output: 1 },
        },
        {
          id: 'gpt-5.6-luna',
          deploymentId: 'gpt-5.6-luna',
          name: 'GPT-5.6 Luna',
          fallback: true,
          usageClass: 'BASE',
          maxOutputTokens: 4096,
          cost: { input: 1, output: 1 },
        },
      ])
    )

    const { getParticipantFallbackModelId } = await import(
      '../src/lib/server/chatModelRegistry'
    )

    expect(getParticipantFallbackModelId()).toBe('gpt-5.6-luna')
    vi.stubEnv('CHAT_FALLBACK_MODEL_ID', 'gpt-5.6-luna')
    expect(getParticipantFallbackModelId()).toBe('gpt-5.6-luna')
  })

  test('rejects a registry whose sole BASE model is not fallback Luna', async () => {
    const { parseChatModelRegistry } = await import(
      '../src/lib/server/chatModelRegistry'
    )

    expect(() =>
      parseChatModelRegistry([
        {
          id: 'gpt-5.6-luna',
          deploymentId: 'gpt-5.6-luna',
          name: 'GPT-5.6 Luna',
          fallback: true,
          usageClass: 'ADVANCED',
          maxOutputTokens: 4096,
          cost: { input: 0.2, output: 1.2 },
        },
        {
          id: 'other-base',
          deploymentId: 'other-base',
          name: 'Other Base',
          usageClass: 'BASE',
          maxOutputTokens: 4096,
          cost: { input: 1, output: 1 },
        },
      ])
    ).toThrow(/gpt-5\.6-luna.*only BASE/)

    expect(() =>
      parseChatModelRegistry([
        {
          id: 'gpt-5.6-luna',
          deploymentId: 'gpt-5.6-luna',
          name: 'GPT-5.6 Luna',
          usageClass: 'BASE',
          maxOutputTokens: 4096,
          cost: { input: 0.2, output: 1.2 },
        },
      ])
    ).toThrow(/participant-credit fallback/)
  })

  test('fails closed when supplied registry JSON is invalid', async () => {
    vi.stubEnv('CHAT_MODEL_REGISTRY_JSON', '{')

    const { getChatModelRegistry } = await import(
      '../src/lib/server/chatModelRegistry'
    )

    expect(() => getChatModelRegistry()).toThrow()
  })
})
