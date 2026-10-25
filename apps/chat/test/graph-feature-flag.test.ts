import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  owner: vi.fn(),
  initialize: vi.fn(),
  enabled: vi.fn(),
}))
vi.mock('@klicker-uzh/prisma', () => ({
  prisma: { user: { findUnique: mocks.owner } },
}))
vi.mock('@klicker-uzh/feature-flags/node', () => ({
  NodeFeatureFlagClient: class {
    initialize = mocks.initialize
    isEnabled = mocks.enabled
  },
}))

import { isChatbotGraphRetrievalEnabled } from '../src/lib/server/featureFlags'

describe('graph retrieval rollout', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mocks.owner.mockResolvedValue({
      role: 'USER',
      catalystInstitutional: false,
      catalystIndividual: true,
      betaEnabled: true,
    })
    mocks.initialize.mockResolvedValue(undefined)
    mocks.enabled.mockReturnValue(true)
  })

  it('evaluates current owner attributes and rechecks changes', async () => {
    expect(await isChatbotGraphRetrievalEnabled('owner')).toBe(true)
    expect(mocks.enabled).toHaveBeenLastCalledWith('chatbot-graphrag', {
      id: 'owner',
      actorType: 'user',
      role: 'USER',
      catalyst: true,
      betaEnabled: true,
    })
    mocks.owner.mockResolvedValue({
      role: 'ADMIN',
      catalystInstitutional: false,
      catalystIndividual: false,
      betaEnabled: false,
    })
    mocks.enabled.mockReturnValue(false)
    expect(await isChatbotGraphRetrievalEnabled('owner')).toBe(false)
    expect(mocks.enabled).toHaveBeenLastCalledWith('chatbot-graphrag', {
      id: 'owner',
      actorType: 'user',
      role: 'ADMIN',
      catalyst: false,
      betaEnabled: false,
    })
  })

  it('denies a missing owner without evaluating the flag', async () => {
    mocks.owner.mockResolvedValue(null)
    expect(await isChatbotGraphRetrievalEnabled('missing')).toBe(false)
    expect(mocks.enabled).not.toHaveBeenCalled()
  })

  it('denies unavailable configuration and database reads', async () => {
    mocks.initialize.mockRejectedValue(new Error('unavailable'))
    expect(await isChatbotGraphRetrievalEnabled('owner')).toBe(false)
    mocks.owner.mockRejectedValue(new Error('unavailable'))
    expect(await isChatbotGraphRetrievalEnabled('owner')).toBe(false)
  })
})
