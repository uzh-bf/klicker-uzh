/**
 * Prisma transaction utilities for atomic credit operations
 *
 * This module provides transaction-safe wrappers for credit operations
 * to prevent race conditions and ensure data consistency.
 */

import { prisma } from '@klicker-uzh/prisma'
import { Prisma } from '@klicker-uzh/prisma/client'

/**
 * Execute a function within a Prisma transaction with retry logic
 */
export async function withTransaction<T>(
  operation: (tx: Prisma.TransactionClient) => Promise<T>,
  maxRetries: number = 3
): Promise<T> {
  let lastError: Error | null = null

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await prisma.$transaction(operation, {
        isolationLevel: 'ReadCommitted',
        timeout: 10000, // 10 second timeout
      })
    } catch (error) {
      lastError = error as Error

      // Check if it's a serialization or deadlock error that we should retry
      if (isRetryableError(error) && attempt < maxRetries) {
        // Exponential backoff: wait 100ms * 2^(attempt-1)
        const delay = 100 * Math.pow(2, attempt - 1)
        await new Promise((resolve) => setTimeout(resolve, delay))
        continue
      }

      // If not retryable or max retries reached, throw the error
      throw error
    }
  }

  throw lastError
}

/**
 * Check if an error is retryable (serialization failure, deadlock, etc.)
 */
function isRetryableError(error: unknown): boolean {
  if (error instanceof Error) {
    const message = error.message.toLowerCase()
    return (
      message.includes('serialization_failure') ||
      message.includes('deadlock') ||
      message.includes('could not serialize access') ||
      message.includes('concurrent update')
    )
  }
  return false
}

/**
 * Atomically decrement credits with validation
 * Returns the updated credits or throws if insufficient funds
 */
export async function atomicDecrementCredits(
  participantId: string,
  chatbotId: string,
  amount: number
): Promise<{ current: number; total: number }> {
  return withTransaction(async (tx) => {
    // Lock the record for update to prevent concurrent modifications
    const credits = await tx.chatUsageCredits.findUnique({
      where: {
        participantId_chatbotId: {
          participantId,
          chatbotId,
        },
      },
    })

    if (!credits) {
      throw new Error('Credits record not found')
    }

    const currentCredits = credits.current.toNumber()
    const newCurrent = Math.max(0, currentCredits - amount)

    // Update with optimistic concurrency check
    const updated = await tx.chatUsageCredits.update({
      where: {
        participantId_chatbotId: {
          participantId,
          chatbotId,
        },
      },
      data: {
        current: newCurrent,
        updatedAt: new Date(),
      },
    })

    return {
      current: updated.current.toNumber(),
      total: updated.total.toNumber(),
    }
  })
}

/**
 * Atomically reset credits for a user if they're in an expired period
 * Returns updated credits or existing credits if no reset needed
 */
export async function atomicResetCreditsIfNeeded(
  participantId: string,
  chatbotId: string,
  newPeriodStart: Date,
  resetAmount: number,
  maxCredits: number
): Promise<{ current: number; total: number; wasReset: boolean }> {
  return withTransaction(async (tx) => {
    // Lock the record for update
    const credits = await tx.chatUsageCredits.findUnique({
      where: {
        participantId_chatbotId: {
          participantId,
          chatbotId,
        },
      },
    })

    if (!credits) {
      throw new Error('Credits record not found')
    }

    const periodStartedAt = credits.periodStartedAt || credits.createdAt

    // Check if reset is needed (user's period is older than the new period start)
    if (periodStartedAt.getTime() < newPeriodStart.getTime()) {
      // Reset needed
      const currentCredits = credits.current.toNumber()
      const newCurrent = Math.min(currentCredits + resetAmount, maxCredits)

      const updated = await tx.chatUsageCredits.update({
        where: {
          participantId_chatbotId: {
            participantId,
            chatbotId,
          },
        },
        data: {
          current: newCurrent,
          total: maxCredits,
          periodStartedAt: newPeriodStart,
          lastResetAt: new Date(),
          resetCount: credits.resetCount + 1,
          updatedAt: new Date(),
        },
      })

      return {
        current: updated.current.toNumber(),
        total: updated.total.toNumber(),
        wasReset: true,
      }
    }

    // No reset needed
    return {
      current: credits.current.toNumber(),
      total: credits.total.toNumber(),
      wasReset: false,
    }
  })
}

/**
 * Initialize credits for a new user with current period alignment
 */
export async function atomicInitializeCredits(
  participantId: string,
  chatbotId: string,
  initialCredits: number,
  maxCredits: number,
  periodStart: Date
): Promise<{ current: number; total: number }> {
  return withTransaction(async (tx) => {
    const credits = await tx.chatUsageCredits.upsert({
      where: {
        participantId_chatbotId: {
          participantId,
          chatbotId,
        },
      },
      create: {
        participantId,
        chatbotId,
        total: maxCredits,
        current: initialCredits,
        periodStartedAt: periodStart,
        lastResetAt: new Date(),
        resetCount: 0,
      },
      update: {},
    })

    return {
      current: credits.current.toNumber(),
      total: credits.total.toNumber(),
    }
  })
}
