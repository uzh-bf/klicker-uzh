import { beforeEach, describe, expect, test, vi } from 'vitest'
import type { AuthenticatedManageUser } from '@/src/lib/server/manageAuth'

const mocks = vi.hoisted(() => ({ findUniqueUser: vi.fn() }))

vi.mock('@klicker-uzh/prisma', () => ({
  prisma: { user: { findUnique: mocks.findUniqueUser } },
}))

const lecturer: AuthenticatedManageUser = {
  catalyst: true,
  role: 'USER',
  scope: 'FULL_ACCESS',
  sub: 'lecturer-1',
}

// The helper keeps one GrowthBook client per process, so each case needs a
// fresh module instance to pick up its own environment.
async function loadCapability({
  apiHost,
  clientKey,
  forcedOn,
}: {
  apiHost?: string
  clientKey?: string
  forcedOn?: string
} = {}) {
  vi.resetModules()
  vi.stubEnv('GROWTHBOOK_ENV', 'development')
  vi.stubEnv('GROWTHBOOK_API_HOST', apiHost ?? '')
  vi.stubEnv('GROWTHBOOK_CLIENT_KEY', clientKey ?? '')
  vi.stubEnv('FEATURE_FLAGS_FORCED_ON', forcedOn ?? '')
  const { getManageAssistantCapability } = await import(
    '@/src/lib/server/featureFlags'
  )
  return getManageAssistantCapability
}

describe('getManageAssistantCapability', () => {
  beforeEach(() => {
    vi.unstubAllEnvs()
    mocks.findUniqueUser.mockReset()
  })

  test('opens for a Catalyst lecturer in the beta without the AI approval', async () => {
    mocks.findUniqueUser.mockResolvedValue({ betaEnabled: true })
    const getCapability = await loadCapability({ forcedOn: 'ai-beta' })

    await expect(getCapability(lecturer)).resolves.toBe('enabled')
  })

  test('does not open without a rollout decision', async () => {
    mocks.findUniqueUser.mockResolvedValue({ betaEnabled: true })
    const getCapability = await loadCapability()

    await expect(getCapability(lecturer)).resolves.not.toBe('enabled')
  })

  test('stays closed for a non-Catalyst session without reading the account', async () => {
    const getCapability = await loadCapability({ forcedOn: 'ai-beta' })

    await expect(getCapability({ ...lecturer, catalyst: false })).resolves.toBe(
      'disabled'
    )
    expect(mocks.findUniqueUser).not.toHaveBeenCalled()
  })

  test.each([
    false,
    null,
  ])('denies an opted-out or unknown preference (%s) despite forced rollout', async (betaEnabled) => {
    mocks.findUniqueUser.mockResolvedValue({ betaEnabled })
    const getCapability = await loadCapability({ forcedOn: 'ai-beta' })

    await expect(getCapability(lecturer)).resolves.toBe('disabled')
  })

  test('stays closed when the account no longer exists', async () => {
    mocks.findUniqueUser.mockResolvedValue(null)
    const getCapability = await loadCapability({ forcedOn: 'ai-beta' })

    await expect(getCapability(lecturer)).resolves.toBe('disabled')
  })

  test('reports a temporary state when GrowthBook has no usable payload', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('unavailable', { status: 503 }))
    )
    mocks.findUniqueUser.mockResolvedValue({ betaEnabled: true })
    const getCapability = await loadCapability({
      apiHost: 'https://growthbook.test',
      clientKey: 'sdk-test',
    })

    await expect(getCapability(lecturer)).resolves.toBe(
      'temporarilyUnavailable'
    )
    vi.unstubAllGlobals()
  })
})
