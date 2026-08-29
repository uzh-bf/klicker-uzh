import type * as DB from '@klicker-uzh/prisma/client'
import type { FreeTextEvaluationAvailabilityReason } from '@klicker-uzh/types'
import {
  completeFreeTextAttemptExactFallbackInTransaction,
  markFreeTextAttemptUnavailable,
} from './freeTextEvaluationTransitions.js'
import { applyEvaluatedFreeTextAttemptInTransaction } from './freeTextPracticeResponseApplication.js'

export async function resolveFreeTextAttemptUnavailability(
  {
    attemptId,
    evaluationRevision,
    reason,
    retryable,
  }: {
    attemptId: string
    evaluationRevision: number
    reason: FreeTextEvaluationAvailabilityReason
    retryable: boolean
  },
  prisma: DB.PrismaClient
) {
  const exactMatchApplied = await prisma.$transaction(async (tx) => {
    const evaluationApplied =
      await completeFreeTextAttemptExactFallbackInTransaction(
        { attemptId, evaluationRevision, reason },
        tx
      )
    if (!evaluationApplied) return false

    const responseApplied = await applyEvaluatedFreeTextAttemptInTransaction(
      { attemptId, bumpStateVersion: false },
      tx
    )
    if (!responseApplied) {
      throw new Error(
        'Exact-match fallback could not apply its response atomically'
      )
    }
    return true
  })
  if (exactMatchApplied) return true

  return await markFreeTextAttemptUnavailable(
    { attemptId, evaluationRevision, reason, retryable },
    prisma
  )
}
