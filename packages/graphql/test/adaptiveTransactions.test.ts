import * as DB from '@klicker-uzh/prisma/client'
import { withAdaptiveOperationalTransaction } from '../src/services/adaptiveTransactions.js'

describe('adaptive operational transactions', () => {
  it('retries a transient deadlock and returns the successful result', async () => {
    const transaction = vi
      .fn()
      .mockRejectedValueOnce(deadlockError())
      .mockResolvedValueOnce('updated')
    const prisma = {
      $transaction: transaction,
    } as unknown as DB.PrismaClient

    await expect(
      withAdaptiveOperationalTransaction(prisma, async () => 'ignored', {
        errorCode: 'ADAPTIVE_OPERATION_CONFLICT',
        errorMessage: 'Adaptive operation was busy.',
      })
    ).resolves.toBe('updated')
    expect(transaction).toHaveBeenCalledTimes(2)
  })

  it('normalizes deadlock exhaustion and transaction timeout', async () => {
    for (const { error, expectedCalls } of [
      { error: deadlockError(), expectedCalls: 3 },
      {
        error: Object.assign(new Error('Transaction expired'), {
          code: 'P2028',
        }),
        expectedCalls: 1,
      },
    ]) {
      const transaction = vi.fn().mockRejectedValue(error)
      const prisma = {
        $transaction: transaction,
      } as unknown as DB.PrismaClient

      await expect(
        withAdaptiveOperationalTransaction(prisma, async () => undefined, {
          errorCode: 'ADAPTIVE_OPERATION_CONFLICT',
          errorMessage: 'Adaptive operation was busy.',
        })
      ).rejects.toMatchObject({
        message: 'Adaptive operation was busy.',
        extensions: { code: 'ADAPTIVE_OPERATION_CONFLICT' },
      })
      expect(transaction).toHaveBeenCalledTimes(expectedCalls)
    }
  })

  it('passes non-transaction errors through unchanged', async () => {
    const failure = Object.assign(new Error('Foreign key violation'), {
      code: 'P2003',
    })
    const transaction = vi.fn().mockRejectedValue(failure)
    const prisma = {
      $transaction: transaction,
    } as unknown as DB.PrismaClient

    await expect(
      withAdaptiveOperationalTransaction(prisma, async () => undefined, {
        errorCode: 'ADAPTIVE_OPERATION_CONFLICT',
        errorMessage: 'Adaptive operation was busy.',
      })
    ).rejects.toBe(failure)
    expect(transaction).toHaveBeenCalledTimes(1)
  })
})

function deadlockError() {
  return Object.assign(new Error('PostgreSQL deadlock'), {
    code: 'P2010',
    meta: {
      driverAdapterError: {
        cause: {
          kind: 'TransactionWriteConflict',
          originalCode: '40P01',
        },
      },
    },
  })
}
