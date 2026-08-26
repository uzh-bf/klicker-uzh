import { afterEach, describe, expect, test, vi } from 'vitest'
import {
  createPersonalCardGenerationEvaluator,
  type PersonalCardGenerationTarget,
} from '../src/lib/server/personalElements/featureFlag'

const target: PersonalCardGenerationTarget = {
  participantId: 'participant-1',
  chatbotId: '00000000-0000-0000-0000-000000000001',
}

function client({
  enabled = true,
  initialized = true,
  healthy = true,
}: {
  enabled?: boolean
  initialized?: boolean
  healthy?: boolean
} = {}) {
  return {
    initialize: vi.fn().mockResolvedValue(initialized),
    getStatus: vi.fn().mockReturnValue({ healthy }),
    isEnabled: vi.fn().mockReturnValue(enabled),
  }
}

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('personal card generation capability', () => {
  test('targets the participant and chatbot through the shared evaluator', async () => {
    const flags = client()
    const evaluate = createPersonalCardGenerationEvaluator({ client: flags })

    await expect(evaluate(target)).resolves.toBe(true)
    expect(flags.initialize).toHaveBeenCalledOnce()
    expect(flags.isEnabled).toHaveBeenCalledWith(
      'personal-card-generation',
      expect.objectContaining({
        id: target.participantId,
        actorType: 'participant',
        role: 'PARTICIPANT',
        chatbotId: target.chatbotId,
      })
    )
  })

  test.each([
    ['missing configuration', { initialized: false, healthy: false }],
    ['unhealthy client', { initialized: true, healthy: false }],
    ['disabled flag', { initialized: true, healthy: true, enabled: false }],
  ])('fails closed for %s', async (_, status) => {
    const flags = client(status)
    const evaluate = createPersonalCardGenerationEvaluator({ client: flags })

    await expect(evaluate(target)).resolves.toBe(false)
    if (!status.initialized || !status.healthy) {
      expect(flags.isEnabled).not.toHaveBeenCalled()
    }
  })

  test('fails closed when the evaluator client throws', async () => {
    const flags = client()
    flags.initialize.mockRejectedValueOnce(new Error('provider unavailable'))
    const evaluate = createPersonalCardGenerationEvaluator({ client: flags })

    await expect(evaluate(target)).resolves.toBe(false)
    expect(flags.isEnabled).not.toHaveBeenCalled()
  })

  test('allows only the development override', async () => {
    const developmentFlags = client({ enabled: false })
    const developmentEvaluate = createPersonalCardGenerationEvaluator({
      client: developmentFlags,
      nodeEnvironment: 'development',
      developmentOverride: 'true',
    })
    await expect(developmentEvaluate(target)).resolves.toBe(true)
    expect(developmentFlags.initialize).not.toHaveBeenCalled()

    const productionFlags = client({ enabled: false })
    const productionEvaluate = createPersonalCardGenerationEvaluator({
      client: productionFlags,
      nodeEnvironment: 'production',
      developmentOverride: 'true',
    })
    await expect(productionEvaluate(target)).resolves.toBe(false)
    expect(productionFlags.initialize).toHaveBeenCalledOnce()
  })
})
