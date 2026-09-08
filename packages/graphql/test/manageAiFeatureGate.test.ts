import { describe, expect, test, vi } from 'vitest'
import type { ContextWithUser } from '../src/lib/context.js'
import {
  assertManageAiEnabled,
  isManageAiEnabled,
  manageAiFeatureFlagAttributes,
} from '../src/lib/manageAiFeatureGate.js'
import {
  getManageChatModelRegistry,
  updateChatbotModelSettings,
} from '../src/services/chatbots.js'

type UserLookupArgs = {
  select: {
    aiFeaturesEnabled?: boolean
    betaEnabled?: boolean
  }
  where: { id: string }
}

function createContext(
  aiFeaturesEnabled: boolean | null,
  featureFlagEnabled: boolean | Error = false,
  betaEnabled = true
) {
  const betaPreferenceFindUnique = vi.fn().mockResolvedValue({ betaEnabled })
  const accountFindUnique = vi
    .fn()
    .mockResolvedValue(
      aiFeaturesEnabled === null ? null : { aiFeaturesEnabled }
    )
  const findUnique = vi.fn().mockImplementation((args: UserLookupArgs) => {
    if (args.select.betaEnabled) return betaPreferenceFindUnique(args)
    return accountFindUnique(args)
  })
  const chatbotFindFirst = vi.fn()
  const ctx = {
    featureFlags: {
      isEnabled: vi.fn(() => {
        if (featureFlagEnabled instanceof Error) throw featureFlagEnabled
        return featureFlagEnabled
      }),
    },
    prisma: {
      chatbot: { findFirst: chatbotFindFirst },
      user: { findUnique },
    },
    user: {
      catalystIndividual: false,
      catalystInstitutional: true,
      role: 'USER',
      scope: 'FULL_ACCESS',
      sub: 'lecturer-1',
    },
  } as unknown as ContextWithUser

  return {
    accountFindUnique,
    betaPreferenceFindUnique,
    chatbotFindFirst,
    ctx,
  }
}

describe('Manage AI feature gate', () => {
  test('opens only when the flag and account entitlement both hold', async () => {
    const { ctx, accountFindUnique } = createContext(true, true)

    await expect(isManageAiEnabled(ctx)).resolves.toBe(true)
    expect(accountFindUnique).toHaveBeenCalledWith({
      select: { aiFeaturesEnabled: true },
      where: { id: 'lecturer-1' },
    })
    expect(ctx.featureFlags?.isEnabled).toHaveBeenCalledWith('ai-beta', {
      actorType: 'user',
      catalyst: true,
      id: 'lecturer-1',
      role: 'USER',
      betaEnabled: true,
    })
  })

  test('does not read the account when the flag is closed', async () => {
    const { ctx, accountFindUnique, betaPreferenceFindUnique } =
      createContext(true)

    await expect(isManageAiEnabled(ctx)).resolves.toBe(false)
    expect(betaPreferenceFindUnique).toHaveBeenCalledTimes(1)
    expect(accountFindUnique).not.toHaveBeenCalled()
  })

  test.each([
    ['a missing evaluator', undefined],
    ['an evaluation failure', new Error('SDK unavailable')],
  ])('fails closed for %s', async (_, evaluatorFailure) => {
    const { ctx, accountFindUnique } = createContext(
      true,
      evaluatorFailure instanceof Error ? evaluatorFailure : false
    )
    if (evaluatorFailure === undefined) ctx.featureFlags = undefined
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)

    await expect(isManageAiEnabled(ctx)).resolves.toBe(false)
    expect(accountFindUnique).not.toHaveBeenCalled()

    warn.mockRestore()
  })

  test('trusted beta preference defeats an enabled evaluator', async () => {
    const { ctx, accountFindUnique } = createContext(true, true, false)

    await expect(isManageAiEnabled(ctx)).resolves.toBe(false)
    expect(ctx.featureFlags?.isEnabled).not.toHaveBeenCalled()
    expect(accountFindUnique).not.toHaveBeenCalled()
  })

  test.each([
    false,
    null,
  ])('stays closed without a live account entitlement (%s)', async (aiFeaturesEnabled) => {
    const { ctx, accountFindUnique } = createContext(aiFeaturesEnabled, true)

    await expect(assertManageAiEnabled(ctx)).rejects.toMatchObject({
      extensions: { code: 'AI_BETA_ACCESS_REQUIRED' },
    })
    expect(accountFindUnique).toHaveBeenCalledTimes(1)
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

  test('denies chatbot authoring before reading chatbot data', async () => {
    const {
      ctx,
      betaPreferenceFindUnique,
      accountFindUnique,
      chatbotFindFirst,
    } = createContext(true)

    await expect(
      updateChatbotModelSettings(
        {
          allowedModelIds: [],
          chatbotId: 'chatbot-1',
          modelSelection: true,
        },
        ctx
      )
    ).rejects.toMatchObject({
      message: 'Forbidden',
      extensions: { code: 'FORBIDDEN' },
    })
    expect(betaPreferenceFindUnique).toHaveBeenCalledTimes(1)
    expect(accountFindUnique).not.toHaveBeenCalled()
    expect(chatbotFindFirst).not.toHaveBeenCalled()
  })

  test('allows chatbot model access without Manage AI approval', async () => {
    const { ctx, accountFindUnique } = createContext(false, true)

    await expect(getManageChatModelRegistry(ctx)).resolves.toEqual(
      expect.any(Array)
    )
    expect(accountFindUnique).not.toHaveBeenCalled()
  })
})
