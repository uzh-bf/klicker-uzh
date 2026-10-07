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

  const registry = [
    {
      id: 'auto',
      deploymentId: 'router-a',
      name: 'Auto',
      maxOutputTokens: 512,
      cost: { input: 0, output: 0 },
    },
    {
      id: 'base-a',
      deploymentId: 'deployment-a',
      name: 'Base',
      usageClass: 'BASE',
      fallback: true,
      maxOutputTokens: 1024,
      cost: { input: 0.1, output: 0.2 },
    },
    {
      id: 'advanced-a',
      deploymentId: 'deployment-b',
      name: 'Advanced',
      maxOutputTokens: 2048,
      cost: { input: 1, output: 2 },
    },
  ]

  test('creates a new fixed bot on the configured default without modifying existing policies', async () => {
    vi.stubEnv('CHAT_MODEL_REGISTRY_JSON', JSON.stringify(registry))
    vi.stubEnv('CHAT_PRIMARY_MODEL_ID', 'auto')
    vi.stubEnv('CHAT_FALLBACK_MODEL_ID', 'base-a')
    vi.stubEnv('CHAT_NEW_CHATBOT_MODEL_ID', 'advanced-a')
    const { createChatbot, getChatModelRegistry } = await import(
      '../src/services/chatbots.js'
    )
    expect(getChatModelRegistry().map((model) => model.id)).toEqual(
      registry.map((model) => model.id)
    )
    const create = vi.fn(async ({ data }) => ({
      id: 'new-bot',
      ...data,
      allowedReasoningEffortsByModel: null,
    }))
    const prisma = {
      course: { findFirst: vi.fn(async () => ({ id: 'course-a' })) },
      chatbot: { create },
    }
    await createChatbot({ name: 'Synthetic', courseId: 'course-a' }, {
      prisma,
      user: { sub: 'owner-a' },
    } as unknown as Parameters<typeof createChatbot>[1])
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          modelSelection: false,
          allowedModelIds: ['advanced-a'],
        }),
      })
    )
  })

  test.each([
    'CHAT_PRIMARY_MODEL_ID',
    'CHAT_FALLBACK_MODEL_ID',
    'CHAT_NEW_CHATBOT_MODEL_ID',
  ])('rejects an unknown %s at startup', async (variable) => {
    vi.stubEnv('CHAT_MODEL_REGISTRY_JSON', JSON.stringify(registry))
    vi.stubEnv(variable, 'missing-model')
    const { getChatModelRegistry } = await import('../src/services/chatbots.js')
    expect(() => getChatModelRegistry()).toThrow()
  })
})
