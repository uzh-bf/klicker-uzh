import { describe, expect, test, vi } from 'vitest'
import type { ContextWithUser } from '../src/lib/context.js'
import {
  assertManageAiEnabled,
  getManageAiCapability,
  isManageAiEnabled,
  manageAiFeatureFlagAttributes,
} from '../src/lib/manageAiFeatureGate.js'
import { getManageChatModelRegistry } from '../src/services/chatbots.js'

function createContext(
  aiFeaturesEnabled: boolean | null,
  featureFlagDecision:
    | 'enabled'
    | 'disabled'
    | 'temporarilyUnavailable'
    | Error = 'disabled'
) {
  const findUnique = vi
    .fn()
    .mockResolvedValue(
      aiFeaturesEnabled === null ? null : { aiFeaturesEnabled }
    )
  const ctx = {
    featureFlags: {
      isEnabled: vi.fn(),
      getAiBetaDecision: vi.fn(() => {
        if (featureFlagDecision instanceof Error) throw featureFlagDecision
        return featureFlagDecision
      }),
    },
    prisma: { user: { findUnique } },
    user: {
      catalystIndividual: false,
      catalystInstitutional: true,
      role: 'USER',
      scope: 'FULL_ACCESS',
      sub: 'lecturer-1',
    },
  } as unknown as ContextWithUser

  return { ctx, findUnique }
}

describe('Manage AI feature gate', () => {
  test('opens only when the flag and account entitlement both hold', async () => {
    const { ctx } = createContext(true, 'enabled')

    await expect(isManageAiEnabled(ctx)).resolves.toBe(true)
  })

  test('returns the explicit enabled capability when both gates hold', async () => {
    const { ctx } = createContext(true, 'enabled')

    await expect(getManageAiCapability(ctx)).resolves.toBe('enabled')
  })

  test('returns disabled before evaluating GrowthBook without account entitlement', async () => {
    const { ctx, findUnique } = createContext(false, 'enabled')

    await expect(getManageAiCapability(ctx)).resolves.toBe('disabled')
    expect(findUnique).toHaveBeenCalledTimes(1)
    expect(ctx.featureFlags?.getAiBetaDecision).not.toHaveBeenCalled()
  })

  test.each([
    ['a missing evaluator', undefined],
    ['an evaluation failure', new Error('SDK unavailable')],
  ])('reports temporary unavailability for %s', async (_, evaluatorFailure) => {
    const { ctx, findUnique } = createContext(
      true,
      evaluatorFailure instanceof Error ? evaluatorFailure : 'disabled'
    )
    if (evaluatorFailure === undefined) ctx.featureFlags = undefined
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)

    await expect(getManageAiCapability(ctx)).resolves.toBe(
      'temporarilyUnavailable'
    )
    expect(findUnique).toHaveBeenCalledTimes(1)

    warn.mockRestore()
  })

  test.each([
    false,
    null,
  ])('stays closed without a live account entitlement (%s)', async (aiFeaturesEnabled) => {
    const { ctx } = createContext(aiFeaturesEnabled, 'enabled')

    await expect(assertManageAiEnabled(ctx)).rejects.toMatchObject({
      extensions: { code: 'AI_BETA_ACCESS_REQUIRED' },
    })
  })

  test('uses a separate error code for a temporary GrowthBook outage', async () => {
    const { ctx } = createContext(true, 'temporarilyUnavailable')

    await expect(assertManageAiEnabled(ctx)).rejects.toMatchObject({
      extensions: { code: 'AI_FEATURE_TEMPORARILY_UNAVAILABLE' },
    })
  })

  test('uses the same catalyst attribute as the browser gate', async () => {
    const { ctx } = createContext(true)

    expect(manageAiFeatureFlagAttributes(ctx.user)).toMatchObject({
      actorType: 'user',
      catalyst: true,
      id: 'lecturer-1',
      role: 'USER',
    })
  })

  test('keeps the Manage chatbot model registry behind the gate', async () => {
    const { ctx, findUnique } = createContext(true, 'disabled')

    await expect(getManageChatModelRegistry(ctx)).rejects.toMatchObject({
      extensions: { code: 'AI_BETA_ACCESS_REQUIRED' },
    })
    expect(findUnique).toHaveBeenCalledTimes(1)
  })
})
