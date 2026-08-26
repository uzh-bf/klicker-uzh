import { describe, expect, test, vi } from 'vitest'
import type { ContextWithUser } from '../src/lib/context.js'
import {
  assertManageAiEnabled,
  isManageAiEnabled,
  manageAiFeatureFlagAttributes,
} from '../src/lib/manageAiFeatureGate.js'
import { getManageChatModelRegistry } from '../src/services/chatbots.js'

function createContext(
  aiFeaturesEnabled: boolean | null,
  featureFlagEnabled: boolean | Error = false
) {
  const findUnique = vi
    .fn()
    .mockResolvedValue(
      aiFeaturesEnabled === null ? null : { aiFeaturesEnabled }
    )
  const ctx = {
    featureFlags: {
      isEnabled: vi.fn(() => {
        if (featureFlagEnabled instanceof Error) throw featureFlagEnabled
        return featureFlagEnabled
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
    const { ctx } = createContext(true, true)

    await expect(isManageAiEnabled(ctx)).resolves.toBe(true)
  })

  test('does not read the account when the flag is closed', async () => {
    const { ctx, findUnique } = createContext(true)

    await expect(isManageAiEnabled(ctx)).resolves.toBe(false)
    expect(findUnique).not.toHaveBeenCalled()
  })

  test.each([
    ['a missing evaluator', undefined],
    ['an evaluation failure', new Error('SDK unavailable')],
  ])('fails closed for %s', async (_, evaluatorFailure) => {
    const { ctx, findUnique } = createContext(
      true,
      evaluatorFailure instanceof Error ? evaluatorFailure : false
    )
    if (evaluatorFailure === undefined) ctx.featureFlags = undefined
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)

    await expect(isManageAiEnabled(ctx)).resolves.toBe(false)
    expect(findUnique).not.toHaveBeenCalled()

    warn.mockRestore()
  })

  test.each([
    false,
    null,
  ])('stays closed without a live account entitlement (%s)', async (aiFeaturesEnabled) => {
    const { ctx } = createContext(aiFeaturesEnabled, true)

    await expect(assertManageAiEnabled(ctx)).rejects.toMatchObject({
      extensions: { code: 'AI_BETA_ACCESS_REQUIRED' },
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
    const { ctx, findUnique } = createContext(true)

    await expect(getManageChatModelRegistry(ctx)).rejects.toMatchObject({
      extensions: { code: 'AI_BETA_ACCESS_REQUIRED' },
    })
    expect(findUnique).not.toHaveBeenCalled()
  })
})
