import { beforeEach, describe, expect, test, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  claim: vi.fn(),
  complete: vi.fn(),
  abort: vi.fn(),
}))

vi.mock('../src/lib/server/personalElements/graphqlClient', () => ({
  claimCardGenerationLease: mocks.claim,
  completeCardGenerationLease: mocks.complete,
  abortCardGenerationLease: mocks.abort,
}))

import {
  abortGenerationLease,
  claimGenerationLease,
  completeGenerationLease,
} from '../src/lib/server/personalElements/lease'

describe('personal-element generation lease adapter', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.claim.mockResolvedValue({ id: 'lease-1' })
    mocks.complete.mockResolvedValue(true)
    mocks.abort.mockResolvedValue(true)
  })

  test('binds the accepted plan to the assistant attempt token', async () => {
    const lease = await claimGenerationLease({
      participantId: 'participant-1',
      planMessageId: '00000000-0000-0000-0000-000000000001',
      planToolCallId: 'plan-tool-1',
      attemptToken: 'assistant-attempt-1',
    })

    expect(lease).toEqual({
      id: 'lease-1',
      attemptToken: 'assistant-attempt-1',
    })
    expect(mocks.claim).toHaveBeenCalledWith(
      {
        planMessageId: '00000000-0000-0000-0000-000000000001',
        planToolCallId: 'plan-tool-1',
        attemptToken: 'assistant-attempt-1',
      },
      'participant-1'
    )
  })

  test('uses the same participant and attempt token for settlement', async () => {
    const lease = { id: 'lease-1', attemptToken: 'assistant-attempt-1' }

    await expect(
      completeGenerationLease({
        participantId: 'participant-1',
        lease,
      })
    ).resolves.toBe(true)
    await expect(
      abortGenerationLease({
        participantId: 'participant-1',
        lease,
      })
    ).resolves.toBe(true)

    expect(mocks.complete).toHaveBeenCalledWith(
      'lease-1',
      'assistant-attempt-1',
      'participant-1'
    )
    expect(mocks.abort).toHaveBeenCalledWith(
      'lease-1',
      'assistant-attempt-1',
      'participant-1'
    )
  })
})
