/**
 * Prisma transaction utilities for atomic credit operations
 *
 * This module provides transaction-safe wrappers for credit operations
 * to prevent race conditions and ensure data consistency.
 */

import { prisma } from '@klicker-uzh/prisma'
import { CreditResetPeriod, Prisma } from '@klicker-uzh/prisma/client'
import {
  getCurrentPeriodStart,
  getEffectiveCreditPeriodBaseline,
  isPeriodExpired,
} from './creditPeriods'

export interface ChatbotCreditPolicy {
  creditInitialCredits: number
  creditResetPeriod: CreditResetPeriod
  creditResetAmount: number
  creditMaxCredits: number
  creditResetPeriodChangedAt: Date | null
}

interface DecimalLike {
  toNumber(): number
}

export interface ChatUsageCreditsSnapshot {
  current: DecimalLike
  total: DecimalLike
  periodStartedAt: Date | null
  createdAt: Date
  resetCount: number
}

/**
 * Lock a chatbot before reading its credit policy. Approval takes the same
 * row lock in FOR UPDATE mode, so the policy and participant credit row stay
 * ordered around an activation.
 */
export async function loadChatbotCreditPolicyForWriter(
  tx: Prisma.TransactionClient,
  chatbotId: string
): Promise<ChatbotCreditPolicy | null> {
  await tx.$queryRaw(
    Prisma.sql`
      SELECT 1
      FROM "public"."Chatbot"
      WHERE "id" = CAST(${chatbotId} AS UUID)
      FOR SHARE
    `
  )

  return loadChatbotCreditPolicy(tx, chatbotId)
}

/**
 * Acquire the participant credit row lock after the chatbot policy lock.
 */
export async function lockChatUsageCreditsForUpdate(
  tx: Prisma.TransactionClient,
  participantId: string,
  chatbotId: string
): Promise<void> {
  await tx.$queryRaw(
    Prisma.sql`
      SELECT 1
      FROM "public"."ChatUsageCredits"
      WHERE "participantId" = CAST(${participantId} AS UUID)
        AND "chatbotId" = CAST(${chatbotId} AS UUID)
      FOR UPDATE
    `
  )
}

export async function findChatUsageCreditsForUpdate(
  tx: Prisma.TransactionClient,
  participantId: string,
  chatbotId: string
): Promise<ChatUsageCreditsSnapshot | null> {
  await lockChatUsageCreditsForUpdate(tx, participantId, chatbotId)

  return tx.chatUsageCredits.findUnique({
    where: {
      participantId_chatbotId: {
        participantId,
        chatbotId,
      },
    },
  })
}

/**
 * Apply one normal reset using the policy already read under the chatbot
 * lock. Existing balances and totals are retained until this point.
 */
export async function resetCreditsIfNeededInTransaction(
  tx: Prisma.TransactionClient,
  participantId: string,
  chatbotId: string,
  chatbot: ChatbotCreditPolicy | null,
  credits: ChatUsageCreditsSnapshot
): Promise<{ current: number; total: number; wasReset: boolean }> {
  const existing = {
    current: credits.current.toNumber(),
    total: credits.total.toNumber(),
  }

  if (!chatbot || chatbot.creditResetPeriod === CreditResetPeriod.NONE) {
    return { ...existing, wasReset: false }
  }

  const periodStartedAt = getEffectiveCreditPeriodBaseline(
    credits.periodStartedAt,
    credits.createdAt,
    chatbot.creditResetPeriodChangedAt
  )
  if (!isPeriodExpired(periodStartedAt, chatbot.creditResetPeriod)) {
    return { ...existing, wasReset: false }
  }

  const currentPeriodStart = getCurrentPeriodStart(chatbot.creditResetPeriod)
  const updated = await tx.chatUsageCredits.update({
    where: {
      participantId_chatbotId: {
        participantId,
        chatbotId,
      },
    },
    data: {
      current: Math.min(
        existing.current + chatbot.creditResetAmount,
        chatbot.creditMaxCredits
      ),
      total: chatbot.creditMaxCredits,
      periodStartedAt: currentPeriodStart,
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
 * Returns the updated credits, clamping the remaining balance at zero
 */
export async function atomicDecrementCredits(
  participantId: string,
  chatbotId: string,
  amount: number
): Promise<{ current: number; total: number }> {
  return withTransaction((tx) =>
    decrementCreditsWithPolicyInTransaction(
      tx,
      participantId,
      chatbotId,
      amount
    )
  )
}

/**
 * Ensure the participant credit row is initialized and reset, then debit it
 * using an existing transaction. The chatbot policy lock is held until the
 * caller commits.
 */
export async function decrementCreditsWithPolicyInTransaction(
  tx: Prisma.TransactionClient,
  participantId: string,
  chatbotId: string,
  amount: number
): Promise<{ current: number; total: number }> {
  const chatbot = await loadChatbotCreditPolicyForWriter(tx, chatbotId)
  const policy = chatbot ?? {
    creditInitialCredits: 1,
    creditResetPeriod: CreditResetPeriod.WEEKLY,
    creditResetAmount: 1,
    creditMaxCredits: 1,
    creditResetPeriodChangedAt: null,
  }

  let credits = await findChatUsageCreditsForUpdate(
    tx,
    participantId,
    chatbotId
  )

  if (!credits) {
    await initializeCreditsInTransaction(
      tx,
      participantId,
      chatbotId,
      policy.creditInitialCredits,
      policy.creditMaxCredits,
      getCurrentPeriodStart(policy.creditResetPeriod)
    )
    credits = await findChatUsageCreditsForUpdate(tx, participantId, chatbotId)
  }

  if (!credits) {
    throw new Error('Credits record not found')
  }

  await resetCreditsIfNeededInTransaction(
    tx,
    participantId,
    chatbotId,
    chatbot,
    credits
  )

  return executeAtomicDecrementCreditsInTransaction(
    tx,
    participantId,
    chatbotId,
    amount
  )
}

/**
 * Atomically decrement credits using an existing transaction.
 *
 * The database expression prevents concurrent decrements from overwriting
 * each other while keeping the balance at zero when the requested amount is
 * larger than the remaining balance.
 */
export async function atomicDecrementCreditsInTransaction(
  tx: Prisma.TransactionClient,
  participantId: string,
  chatbotId: string,
  amount: number
): Promise<{ current: number; total: number }> {
  await loadChatbotCreditPolicyForWriter(tx, chatbotId)
  await lockChatUsageCreditsForUpdate(tx, participantId, chatbotId)

  return executeAtomicDecrementCreditsInTransaction(
    tx,
    participantId,
    chatbotId,
    amount
  )
}

async function executeAtomicDecrementCreditsInTransaction(
  tx: Prisma.TransactionClient,
  participantId: string,
  chatbotId: string,
  amount: number
): Promise<{ current: number; total: number }> {
  const updatedCount = await tx.$executeRaw(
    Prisma.sql`
      UPDATE "public"."ChatUsageCredits"
      SET "current" = GREATEST(
            "current" - CAST(${amount} AS DECIMAL(18, 6)),
            0
          ),
          "updatedAt" = CURRENT_TIMESTAMP
      WHERE "participantId" = CAST(${participantId} AS UUID)
        AND "chatbotId" = CAST(${chatbotId} AS UUID)
    `
  )

  if (updatedCount !== 1) {
    throw new Error('Credits record not found')
  }

  const updated = await tx.chatUsageCredits.findUnique({
    where: {
      participantId_chatbotId: {
        participantId,
        chatbotId,
      },
    },
  })

  if (!updated) {
    throw new Error('Credits record not found')
  }

  return {
    current: updated.current.toNumber(),
    total: updated.total.toNumber(),
  }
}

/**
 * Atomically reset credits for a user if they're in an expired period
 * Returns updated credits or existing credits if no reset needed
 */
export async function atomicResetCreditsIfNeeded(
  participantId: string,
  chatbotId: string
): Promise<{ current: number; total: number; wasReset: boolean }> {
  return withTransaction(async (tx) => {
    const chatbot = await loadChatbotCreditPolicyForWriter(tx, chatbotId)
    const credits = await findChatUsageCreditsForUpdate(
      tx,
      participantId,
      chatbotId
    )

    if (!credits) {
      throw new Error('Credits record not found')
    }

    return resetCreditsIfNeededInTransaction(
      tx,
      participantId,
      chatbotId,
      chatbot,
      credits
    )
  })
}

/**
 * Initialize credits for a new user with current period alignment
 */
export async function atomicInitializeCredits(
  participantId: string,
  chatbotId: string,
  initialCredits?: number,
  maxCredits?: number,
  periodStart?: Date
): Promise<{ current: number; total: number }> {
  return withTransaction(async (tx) => {
    const chatbot = await loadChatbotCreditPolicyForWriter(tx, chatbotId)
    const policy = chatbot ?? {
      creditInitialCredits: initialCredits ?? 1,
      creditResetPeriod: CreditResetPeriod.WEEKLY,
      creditResetAmount: 1,
      creditMaxCredits: maxCredits ?? 1,
      creditResetPeriodChangedAt: null,
    }

    const credits = await initializeCreditsInTransaction(
      tx,
      participantId,
      chatbotId,
      policy.creditInitialCredits,
      policy.creditMaxCredits,
      chatbot
        ? getCurrentPeriodStart(policy.creditResetPeriod)
        : (periodStart ?? getCurrentPeriodStart(policy.creditResetPeriod))
    )

    return {
      current: credits.current.toNumber(),
      total: credits.total.toNumber(),
    }
  })
}

export async function atomicGetUserCredits(
  participantId: string,
  chatbotId: string
): Promise<{ current: number; total: number }> {
  return withTransaction((tx) =>
    getUserCreditsInTransaction(tx, participantId, chatbotId)
  )
}

export async function atomicPreviewUserCredits(
  participantId: string,
  chatbotId: string
): Promise<{ current: number; total: number }> {
  return withConsistentReadTransaction(async (tx) => {
    const chatbot = await loadChatbotCreditPolicy(tx, chatbotId)
    const credits = await tx.chatUsageCredits.findUnique({
      where: {
        participantId_chatbotId: {
          participantId,
          chatbotId,
        },
      },
    })

    if (!credits) {
      return {
        current: chatbot?.creditInitialCredits ?? 1,
        total: chatbot?.creditMaxCredits ?? 1,
      }
    }

    if (!chatbot || chatbot.creditResetPeriod === CreditResetPeriod.NONE) {
      return {
        current: credits.current.toNumber(),
        total: credits.total.toNumber(),
      }
    }

    const periodStartedAt = getEffectiveCreditPeriodBaseline(
      credits.periodStartedAt,
      credits.createdAt,
      chatbot.creditResetPeriodChangedAt
    )
    if (!isPeriodExpired(periodStartedAt, chatbot.creditResetPeriod)) {
      return {
        current: credits.current.toNumber(),
        total: credits.total.toNumber(),
      }
    }

    return {
      current: Math.min(
        credits.current.toNumber() + chatbot.creditResetAmount,
        chatbot.creditMaxCredits
      ),
      total: chatbot.creditMaxCredits,
    }
  })
}

export async function withConsistentReadTransaction<T>(
  operation: (tx: Prisma.TransactionClient) => Promise<T>
): Promise<T> {
  return prisma.$transaction(operation, {
    isolationLevel: 'RepeatableRead',
    timeout: 10000,
  })
}

async function loadChatbotCreditPolicy(
  tx: Prisma.TransactionClient,
  chatbotId: string
): Promise<ChatbotCreditPolicy | null> {
  return tx.chatbot.findUnique({
    where: { id: chatbotId },
    select: {
      creditInitialCredits: true,
      creditResetPeriod: true,
      creditResetAmount: true,
      creditMaxCredits: true,
      creditResetPeriodChangedAt: true,
    },
  })
}

export async function getUserCreditsInTransaction(
  tx: Prisma.TransactionClient,
  participantId: string,
  chatbotId: string
): Promise<{ current: number; total: number }> {
  const chatbot = await loadChatbotCreditPolicyForWriter(tx, chatbotId)
  const credits = await findChatUsageCreditsForUpdate(
    tx,
    participantId,
    chatbotId
  )

  if (!credits) {
    const policy = chatbot ?? {
      creditInitialCredits: 1,
      creditResetPeriod: CreditResetPeriod.WEEKLY,
      creditResetAmount: 1,
      creditMaxCredits: 1,
      creditResetPeriodChangedAt: null,
    }
    const initialized = await initializeCreditsInTransaction(
      tx,
      participantId,
      chatbotId,
      policy.creditInitialCredits,
      policy.creditMaxCredits,
      getCurrentPeriodStart(policy.creditResetPeriod)
    )
    return {
      current: initialized.current.toNumber(),
      total: initialized.total.toNumber(),
    }
  }

  const reset = await resetCreditsIfNeededInTransaction(
    tx,
    participantId,
    chatbotId,
    chatbot,
    credits
  )

  return {
    current: reset.current,
    total: reset.total,
  }
}

async function initializeCreditsInTransaction(
  tx: Prisma.TransactionClient,
  participantId: string,
  chatbotId: string,
  initialCredits: number,
  maxCredits: number,
  periodStart: Date
) {
  // Keep existing balances, totals, and reset history untouched. PostgreSQL's
  // native ON CONFLICT upsert makes concurrent initialization idempotent.
  return tx.chatUsageCredits.upsert({
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
    update: { participantId },
  })
}
