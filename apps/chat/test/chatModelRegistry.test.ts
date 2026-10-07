import { resolveChatModelPolicy } from '@klicker-uzh/util'
import { afterEach, describe, expect, test, vi } from 'vitest'

afterEach(() => {
  vi.unstubAllEnvs()
  vi.resetModules()
})

describe('chat model registry provider protocol', () => {
  const customRegistry = [
    {
      id: 'auto',
      deploymentId: 'router-a',
      name: 'Auto',
      maxOutputTokens: 512,
      cost: { input: 0, output: 0 },
    },
    {
      id: 'base-a',
      deploymentId: 'base-deployment',
      name: 'Base',
      usageClass: 'BASE',
      fallback: true,
      supportsReasoning: true,
      supportedReasoningEfforts: ['low', 'high'],
      maxOutputTokens: 1024,
      cost: { input: 0.1, output: 0.2 },
    },
    {
      id: 'advanced-a',
      deploymentId: 'advanced-deployment',
      name: 'Advanced',
      maxOutputTokens: 2048,
      cost: { input: 1, output: 2 },
    },
  ]

  test('uses configured defaults without built-in vendor IDs and preserves fixed allow-lists', async () => {
    vi.stubEnv('CHAT_MODEL_REGISTRY_JSON', JSON.stringify(customRegistry))
    vi.stubEnv('CHAT_PRIMARY_MODEL_ID', 'advanced-a')
    vi.stubEnv('CHAT_FALLBACK_MODEL_ID', 'base-a')
    vi.stubEnv('CHAT_NEW_CHATBOT_MODEL_ID', 'auto')
    const {
      getChatModelRegistry,
      getAutomaticModelId,
      getParticipantFallbackModelId,
      getModelsForChatbot,
      getAllowedReasoningEffortsForModel,
    } = await import('../src/lib/server/chatModelRegistry')
    const registry = getChatModelRegistry()
    expect(getAutomaticModelId()).toBe('advanced-a')
    expect(getParticipantFallbackModelId()).toBe('base-a')
    expect(getAutomaticModelId(['auto'])).toBe('auto')
    expect(
      getModelsForChatbot({ allowedModelIds: ['retired'] }).map(
        (model) => model.id
      )
    ).toEqual(['base-a'])
    expect(
      getAllowedReasoningEffortsForModel(
        registry.find((model) => model.id === 'base-a')!,
        { 'base-a': ['retired-effort'] }
      )
    ).toEqual([])
  })

  test('requires an explicit fallback for ambiguous catalogs and ignores registry order', async () => {
    const { parseChatModelRegistry } = await import(
      '../src/lib/server/chatModelRegistry'
    )
    const registry = parseChatModelRegistry([
      ...customRegistry,
      { ...customRegistry[1], id: 'base-b' },
    ])
    expect(() => resolveChatModelPolicy(registry)).toThrow()
    expect(
      resolveChatModelPolicy(registry, { fallbackModelId: 'base-b' })
        .fallbackModelId
    ).toBe('base-b')
    expect(
      resolveChatModelPolicy([...registry].reverse(), {
        fallbackModelId: 'base-b',
      }).fallbackModelId
    ).toBe('base-b')
  })

  test.each([
    'CHAT_PRIMARY_MODEL_ID',
    'CHAT_FALLBACK_MODEL_ID',
    'CHAT_NEW_CHATBOT_MODEL_ID',
  ])('rejects an unknown %s at startup', async (variable) => {
    vi.stubEnv('CHAT_MODEL_REGISTRY_JSON', JSON.stringify(customRegistry))
    vi.stubEnv(variable, 'missing')
    const { getChatModelRegistry } = await import(
      '../src/lib/server/chatModelRegistry'
    )
    expect(() => getChatModelRegistry()).toThrow()
  })
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
          id: 'gpt-6-luna',
          deploymentId: 'gpt-6-luna',
          name: 'GPT-6 Luna',
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
    expect(byId.get('gpt-6-luna')).toMatchObject({
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
          id: 'auto',
          deploymentId: 'auto-router',
          name: 'Auto',
          maxOutputTokens: 4096,
          cost: { input: 1, output: 1 },
        },
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
          id: 'gpt-6-luna',
          deploymentId: 'gpt-6-luna',
          name: 'GPT-6 Luna',
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
    ).toEqual(['gpt-6-luna'])
    expect(getAutomaticModelId(['gpt-4.1-mini'])).toBe('gpt-6-luna')
  })

  test('rejects an ADVANCED configured participant fallback', async () => {
    vi.stubEnv('CHAT_FALLBACK_MODEL_ID', 'advanced-fallback')
    vi.stubEnv(
      'CHAT_MODEL_REGISTRY_JSON',
      JSON.stringify([
        {
          id: 'auto',
          deploymentId: 'auto-router',
          name: 'Auto',
          maxOutputTokens: 4096,
          cost: { input: 1, output: 1 },
        },
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
          id: 'gpt-6-luna',
          deploymentId: 'gpt-6-luna',
          name: 'GPT-6 Luna',
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

    expect(() => getParticipantFallbackModelId()).toThrow()
    vi.stubEnv('CHAT_FALLBACK_MODEL_ID', 'gpt-6-luna')
    expect(getParticipantFallbackModelId()).toBe('gpt-6-luna')
  })

  test('rejects a registry whose fallback Luna is not BASE', async () => {
    const { parseChatModelRegistry } = await import(
      '../src/lib/server/chatModelRegistry'
    )

    expect(() =>
      parseChatModelRegistry([
        {
          id: 'gpt-6-luna',
          deploymentId: 'gpt-6-luna',
          name: 'GPT-6 Luna',
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
    ).toThrow(/BASE.*fallback/)

    expect(() =>
      parseChatModelRegistry([
        {
          id: 'gpt-6-luna',
          deploymentId: 'gpt-6-luna',
          name: 'GPT-6 Luna',
          usageClass: 'BASE',
          maxOutputTokens: 4096,
          cost: { input: 0.2, output: 1.2 },
        },
      ])
    ).toThrow(/fallback/)
  })

  test('fails closed when supplied registry JSON is invalid', async () => {
    vi.stubEnv('CHAT_MODEL_REGISTRY_JSON', '{')

    const { getChatModelRegistry } = await import(
      '../src/lib/server/chatModelRegistry'
    )

    expect(() => getChatModelRegistry()).toThrow()
  })
})
