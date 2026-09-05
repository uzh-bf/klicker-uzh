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

  // The flag is checked first so a lecturer outside the beta costs no query.
  test('does not read the account when the flag is off', async () => {
    const isEnabled = await loadGate()

    await expect(isEnabled(lecturer)).resolves.toBe(false)
    expect(mocks.findUniqueUser).not.toHaveBeenCalled()
  })
})
