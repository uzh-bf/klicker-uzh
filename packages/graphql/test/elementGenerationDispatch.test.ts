import * as DB from '@klicker-uzh/prisma/client'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  claimElementGenerationSpend,
  getElementGenerationSpendDispatchState,
  releaseStaleClaimedElementGenerationSpend,
  settleElementGenerationSpend,
} from '../src/services/elementGenerationAccounting.js'
import { dispatchCostAccountedElementGeneration } from '../src/services/elementGenerationDispatch.js'
import { questionGenerationServiceError } from '../src/services/questionGenerationErrors.js'

vi.mock('../src/services/elementGenerationAccounting.js', () => ({
  ELEMENT_GENERATION_DISPATCH_CLAIM_GRACE_MS: 15 * 60 * 1000,
  claimElementGenerationSpend: vi.fn(async () => true),
  getElementGenerationSpendDispatchState: vi.fn(),
  releaseStaleClaimedElementGenerationSpend: vi.fn(async () => true),
  settleElementGenerationSpend: vi.fn(async () => true),
}))

const dispatchAttemptId = '123e4567-e89b-42d3-a456-426614174000'
const now = new Date('2026-08-26T12:00:00.000Z')

describe('cost-accounted element-generation dispatch', () => {
  beforeEach(() => vi.clearAllMocks())

  it.each([
    'question',
    'initial flashcard',
    'flashcard retry',
  ])('does not redispatch an accepted-but-not-yet-visible %s attempt', async () => {
    vi.mocked(getElementGenerationSpendDispatchState).mockResolvedValue({
      costStatus: DB.KBGraphCostStatus.RESERVED,
      dispatchClaimedAt: new Date(now.getTime() - 60_000),
    })
    const dispatch = vi.fn()

    await expect(
      dispatchCostAccountedElementGeneration({
        prisma: {} as never,
        dispatchAttemptId,
        recover: vi.fn(async () => null),
        dispatch,
        now,
      })
    ).rejects.toMatchObject({
      code: 'WORKFLOW_DISPATCH_UNCERTAIN',
      retryable: true,
    })
    expect(dispatch).not.toHaveBeenCalled()
    expect(releaseStaleClaimedElementGenerationSpend).not.toHaveBeenCalled()
  })

  it('releases a stale claimed attempt only after a definitive empty recovery', async () => {
    vi.mocked(getElementGenerationSpendDispatchState).mockResolvedValue({
      costStatus: DB.KBGraphCostStatus.RESERVED,
      dispatchClaimedAt: new Date(now.getTime() - 16 * 60 * 1000),
    })
    const dispatch = vi.fn()
    const prisma = {} as never

    await expect(
      dispatchCostAccountedElementGeneration({
        prisma,
        dispatchAttemptId,
        recover: vi.fn(async () => null),
        dispatch,
        now,
      })
    ).rejects.toMatchObject({
      code: 'WORKFLOW_DISPATCH_UNCERTAIN',
      retryable: false,
    })
    expect(dispatch).not.toHaveBeenCalled()
    expect(releaseStaleClaimedElementGenerationSpend).toHaveBeenCalledWith(
      prisma,
      dispatchAttemptId,
      now
    )
  })

  it('claims only after preflight and recovers an uncertain accepted dispatch', async () => {
    vi.mocked(getElementGenerationSpendDispatchState).mockResolvedValue({
      costStatus: DB.KBGraphCostStatus.RESERVED,
      dispatchClaimedAt: null,
    })
    const recover = vi
      .fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ runId: 'run-1', status: 'RUNNING' })
    const dispatch = vi.fn(
      async (beforeProviderDispatch: () => Promise<void>) => {
        await beforeProviderDispatch()
        throw questionGenerationServiceError(
          'WORKFLOW_DISPATCH_UNCERTAIN',
          'provider response was lost',
          true
        )
      }
    )

    await expect(
      dispatchCostAccountedElementGeneration({
        prisma: {} as never,
        dispatchAttemptId,
        recover,
        dispatch,
        now,
      })
    ).resolves.toEqual({ eventId: null, recoveredRunId: 'run-1' })
    expect(
      vi.mocked(claimElementGenerationSpend).mock.invocationCallOrder[0]!
    ).toBeLessThan(
      vi.mocked(settleElementGenerationSpend).mock.invocationCallOrder[0]!
    )
    expect(settleElementGenerationSpend).toHaveBeenCalledOnce()
  })

  it('does not call the provider when the spend claim is unavailable', async () => {
    vi.mocked(getElementGenerationSpendDispatchState).mockResolvedValue({
      costStatus: DB.KBGraphCostStatus.RESERVED,
      dispatchClaimedAt: null,
    })
    vi.mocked(claimElementGenerationSpend).mockRejectedValueOnce(
      new Error('database unavailable')
    )
    const providerPush = vi.fn()
    const dispatch = vi.fn(
      async (beforeProviderDispatch: () => Promise<void>) => {
        await beforeProviderDispatch()
        return providerPush()
      }
    )

    await expect(
      dispatchCostAccountedElementGeneration({
        prisma: {} as never,
        dispatchAttemptId,
        recover: vi.fn(async () => null),
        dispatch,
        now,
      })
    ).rejects.toMatchObject({
      code: 'WORKFLOW_STATUS_UNAVAILABLE',
      retryable: true,
    })
    expect(providerPush).not.toHaveBeenCalled()
  })

  it('allows exactly one provider push when two callers race for one dispatch claim', async () => {
    vi.mocked(getElementGenerationSpendDispatchState).mockResolvedValue({
      costStatus: DB.KBGraphCostStatus.RESERVED,
      dispatchClaimedAt: null,
    })
    let claimWinnerAvailable = true
    vi.mocked(claimElementGenerationSpend).mockImplementation(async () => {
      if (!claimWinnerAvailable) return false
      claimWinnerAvailable = false
      return true
    })
    const providerPush = vi.fn(async () => ({ eventId: 'event-1' }))
    const dispatch = vi.fn(
      async (beforeProviderDispatch: () => Promise<void>) => {
        await beforeProviderDispatch()
        return providerPush()
      }
    )
    const createAttempt = () =>
      dispatchCostAccountedElementGeneration({
        prisma: {} as never,
        dispatchAttemptId,
        recover: vi.fn(async () => null),
        dispatch,
        now,
      })

    const results = await Promise.allSettled([createAttempt(), createAttempt()])

    expect(
      results.filter((result) => result.status === 'fulfilled')
    ).toHaveLength(1)
    expect(
      results.filter((result) => result.status === 'rejected')
    ).toHaveLength(1)
    expect(providerPush).toHaveBeenCalledOnce()
    expect(settleElementGenerationSpend).toHaveBeenCalledOnce()
  })
})
