import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import type { ContextWithUser } from '../src/lib/context.js'

function createContext(aiFeaturesEnabled: boolean | null) {
  const findUnique = vi
    .fn()
    .mockResolvedValue(
      aiFeaturesEnabled === null ? null : { aiFeaturesEnabled }
    )
  const ctx = {
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

async function loadGate(forcedOn?: string) {
  vi.resetModules()
  vi.stubEnv('GROWTHBOOK_API_HOST', '')
  vi.stubEnv('GROWTHBOOK_CLIENT_KEY', '')
  vi.stubEnv('GROWTHBOOK_ENV', 'development')
  vi.stubEnv('FEATURE_FLAGS_FORCED_ON', forcedOn ?? '')
  return import('../src/lib/manageAiFeatureGate.js')
}

async function loadChatbots(forcedOn?: string) {
  vi.resetModules()
  vi.stubEnv('GROWTHBOOK_API_HOST', '')
  vi.stubEnv('GROWTHBOOK_CLIENT_KEY', '')
  vi.stubEnv('GROWTHBOOK_ENV', 'development')
  vi.stubEnv('FEATURE_FLAGS_FORCED_ON', forcedOn ?? '')
  return import('../src/services/chatbots.js')
}

describe('Manage AI feature gate', () => {
  beforeEach(() => {
    vi.unstubAllEnvs()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  test('opens only when the flag and account entitlement both hold', async () => {
    const { ctx } = createContext(true)
    const { isManageAiEnabled } = await loadGate('ai-beta')

    await expect(isManageAiEnabled(ctx)).resolves.toBe(true)
  })

  test('does not read the account when the flag is closed', async () => {
    const { ctx, findUnique } = createContext(true)
    const { isManageAiEnabled } = await loadGate()

    await expect(isManageAiEnabled(ctx)).resolves.toBe(false)
    expect(findUnique).not.toHaveBeenCalled()
  })

  test.each([
    false,
    null,
  ])('stays closed without a live account entitlement (%s)', async (aiFeaturesEnabled) => {
    const { ctx } = createContext(aiFeaturesEnabled)
    const { assertManageAiEnabled } = await loadGate('ai-beta')

    await expect(assertManageAiEnabled(ctx)).rejects.toMatchObject({
      extensions: { code: 'AI_BETA_ACCESS_REQUIRED' },
    })
  })

  test('uses the same catalyst attribute as the browser gate', async () => {
    const { ctx } = createContext(true)
    const { manageAiFeatureFlagAttributes } = await loadGate('ai-beta')

    expect(manageAiFeatureFlagAttributes(ctx.user)).toMatchObject({
      actorType: 'user',
      catalyst: true,
      id: 'lecturer-1',
      role: 'USER',
    })
  })

  test('keeps the Manage chatbot model registry behind the gate', async () => {
    const { ctx, findUnique } = createContext(true)
    const { getManageChatModelRegistry } = await loadChatbots()

    await expect(getManageChatModelRegistry(ctx)).rejects.toMatchObject({
      extensions: { code: 'AI_BETA_ACCESS_REQUIRED' },
    })
    expect(findUnique).not.toHaveBeenCalled()
  })
})
