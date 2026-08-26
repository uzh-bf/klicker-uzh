import * as DB from '@klicker-uzh/prisma/client'
import {
  ELEMENT_GENERATION_DISPATCH_CLAIM_GRACE_MS,
  claimElementGenerationSpend,
  getElementGenerationSpendDispatchState,
  releaseStaleClaimedElementGenerationSpend,
  settleElementGenerationSpend,
} from './elementGenerationAccounting.js'
import {
  QuestionGenerationServiceError,
  questionGenerationServiceError,
} from './questionGenerationErrors.js'
import type { QuestionGenerationRunStatus } from './questionGenerationRuntime.js'

type RecoveredRun = {
  runId: string
  status: QuestionGenerationRunStatus
}

async function accountingOperation<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation()
  } catch (error) {
    if (error instanceof QuestionGenerationServiceError) throw error
    throw questionGenerationServiceError(
      'WORKFLOW_STATUS_UNAVAILABLE',
      'Element-generation accounting state is temporarily unavailable',
      true
    )
  }
}

export async function dispatchCostAccountedElementGeneration({
  prisma,
  dispatchAttemptId,
  recover,
  dispatch,
  now = new Date(),
}: {
  prisma: DB.PrismaClient
  dispatchAttemptId: string
  recover: () => Promise<RecoveredRun | null>
  dispatch: (
    beforeProviderDispatch: () => Promise<void>
  ) => Promise<{ eventId: string }>
  now?: Date
}): Promise<{ eventId: string | null; recoveredRunId: string | null }> {
  let recovered = await recover()
  if (!recovered) {
    const spend = await accountingOperation(() =>
      getElementGenerationSpendDispatchState(prisma, dispatchAttemptId)
    )
    if (spend.costStatus === DB.KBGraphCostStatus.RELEASED) {
      throw questionGenerationServiceError(
        'WORKFLOW_DISPATCH_UNCERTAIN',
        'Element-generation dispatch was not found and its quota hold was released'
      )
    }
    if (spend.costStatus === DB.KBGraphCostStatus.SETTLED) {
      throw questionGenerationServiceError(
        'WORKFLOW_STATUS_UNAVAILABLE',
        'Element-generation dispatch was settled but could not be recovered',
        true
      )
    }
    if (spend.dispatchClaimedAt !== null) {
      if (
        now.getTime() - spend.dispatchClaimedAt.getTime() <
        ELEMENT_GENERATION_DISPATCH_CLAIM_GRACE_MS
      ) {
        throw questionGenerationServiceError(
          'WORKFLOW_DISPATCH_UNCERTAIN',
          'Element-generation dispatch is still awaiting provider correlation',
          true
        )
      }
      const released = await accountingOperation(() =>
        releaseStaleClaimedElementGenerationSpend(
          prisma,
          dispatchAttemptId,
          now
        )
      )
      if (!released) {
        throw questionGenerationServiceError(
          'WORKFLOW_STATUS_UNAVAILABLE',
          'Element-generation dispatch state changed during recovery',
          true
        )
      }
      throw questionGenerationServiceError(
        'WORKFLOW_DISPATCH_UNCERTAIN',
        'Element-generation dispatch was not found after the recovery window'
      )
    }

    let eventId: string | null = null
    try {
      eventId = (
        await dispatch(async () => {
          const claimed = await accountingOperation(() =>
            claimElementGenerationSpend(prisma, dispatchAttemptId, now)
          )
          if (!claimed) {
            throw questionGenerationServiceError(
              'WORKFLOW_DISPATCH_UNCERTAIN',
              'Element-generation dispatch was claimed by another request',
              true
            )
          }
        })
      ).eventId
    } catch (error) {
      if (
        !(error instanceof QuestionGenerationServiceError) ||
        error.code !== 'WORKFLOW_DISPATCH_UNCERTAIN'
      ) {
        throw error
      }
      recovered = await recover()
      if (!recovered) throw error
    }
    await accountingOperation(() =>
      settleElementGenerationSpend(prisma, dispatchAttemptId, now)
    )
    return { eventId, recoveredRunId: recovered?.runId ?? null }
  }

  await accountingOperation(() =>
    claimElementGenerationSpend(prisma, dispatchAttemptId, now)
  )
  await accountingOperation(() =>
    settleElementGenerationSpend(prisma, dispatchAttemptId, now)
  )
  return { eventId: null, recoveredRunId: recovered.runId }
}
