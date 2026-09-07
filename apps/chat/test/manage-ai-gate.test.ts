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
async function loadGate(forcedOn?: string) {
  vi.resetModules()
  vi.stubEnv('GROWTHBOOK_ENV', 'development')
  vi.stubEnv('FEATURE_FLAGS_FORCED_ON', forcedOn ?? '')
  const { isManageAiEnabled } = await import('@/src/lib/server/featureFlags')
  return isManageAiEnabled
}

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
  const { getManageAiCapability } = await import(
    '@/src/lib/server/featureFlags'
  )
  return getManageAiCapability
}

describe('isManageAiEnabled', () => {
  beforeEach(() => {
    vi.unstubAllEnvs()
    mocks.findUniqueUser.mockReset()
  })

  test('opens only when the flag and the account entitlement both hold', async () => {
    mocks.findUniqueUser.mockResolvedValue({ aiFeaturesEnabled: true })
    const isEnabled = await loadGate('ai-beta')

    await expect(isEnabled(lecturer)).resolves.toBe(true)
  })

  test('stays closed for an entitled account outside the beta', async () => {
    mocks.findUniqueUser.mockResolvedValue({ aiFeaturesEnabled: true })
    const isEnabled = await loadGate()

    await expect(isEnabled(lecturer)).resolves.toBe(false)
  })

  // The expensive half of the gate: an account inside the beta that has not
  // supplied a cost center must not be able to spend model budget.
  test('stays closed inside the beta without the account entitlement', async () => {
    mocks.findUniqueUser.mockResolvedValue({ aiFeaturesEnabled: false })
    const isEnabled = await loadGate('ai-beta')

    await expect(isEnabled(lecturer)).resolves.toBe(false)
  })

  test('stays closed when the account no longer exists', async () => {
    mocks.findUniqueUser.mockResolvedValue(null)
    const isEnabled = await loadGate('ai-beta')

    await expect(isEnabled(lecturer)).resolves.toBe(false)
  })

  test('reads the live account entitlement before evaluating GrowthBook', async () => {
    const isEnabled = await loadGate()

    await expect(isEnabled(lecturer)).resolves.toBe(false)
    expect(mocks.findUniqueUser).toHaveBeenCalledTimes(1)
  })

  test('reports a temporary state when an entitled account has no usable payload', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('unavailable', { status: 503 }))
    )
    mocks.findUniqueUser.mockResolvedValue({ aiFeaturesEnabled: true })
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
