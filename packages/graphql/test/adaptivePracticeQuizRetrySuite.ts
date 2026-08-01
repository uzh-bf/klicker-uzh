import type { ContextWithUser } from '../src/lib/context.js'
import { withSerializableRetry } from '../src/services/adaptivePracticeQuizzes.js'

export function registerAdaptivePracticeQuizRetryTests() {
  it('recovers from a transient transaction conflict', async () => {
    const transaction = vi
      .fn()
      .mockRejectedValueOnce(
        Object.assign(new Error('Prisma transaction conflict'), {
          code: 'P2034',
        })
      )
      .mockResolvedValueOnce('updated')
    const ctx = {
      prisma: { $transaction: transaction },
    } as unknown as ContextWithUser

    await expect(
      withSerializableRetry(ctx, async () => 'ignored')
    ).resolves.toBe('updated')
    expect(transaction).toHaveBeenCalledTimes(2)
  })

  it('retries start-only uniqueness conflicts but passes them through otherwise', async () => {
    const uniqueConflict = Object.assign(new Error('Unique conflict'), {
      code: 'P2002',
    })
    const retryingTransaction = vi
      .fn()
      .mockRejectedValueOnce(uniqueConflict)
      .mockResolvedValueOnce('existing-attempt')
    const retryingCtx = {
      prisma: { $transaction: retryingTransaction },
    } as unknown as ContextWithUser

    await expect(
      withSerializableRetry(retryingCtx, async () => 'ignored', {
        retryOnUniqueConstraint: true,
      })
    ).resolves.toBe('existing-attempt')
    expect(retryingTransaction).toHaveBeenCalledTimes(2)

    const nonRetryingTransaction = vi.fn().mockRejectedValue(uniqueConflict)
    const nonRetryingCtx = {
      prisma: { $transaction: nonRetryingTransaction },
    } as unknown as ContextWithUser
    await expect(
      withSerializableRetry(nonRetryingCtx, async () => 'ignored')
    ).rejects.toBe(uniqueConflict)
    expect(nonRetryingTransaction).toHaveBeenCalledTimes(1)
  })

  it('passes non-transaction failures through without retrying', async () => {
    const failure = Object.assign(new Error('Validation failed'), {
      code: 'P2003',
    })
    const transaction = vi.fn().mockRejectedValue(failure)
    const ctx = {
      prisma: { $transaction: transaction },
    } as unknown as ContextWithUser

    await expect(
      withSerializableRetry(ctx, async () => 'ignored')
    ).rejects.toBe(failure)
    expect(transaction).toHaveBeenCalledTimes(1)
  })
}
