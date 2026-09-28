import * as DB from '@klicker-uzh/prisma/client'
import type { PrismaTransactionClient } from '@klicker-uzh/util'
import {
  buildAdaptiveRuntimeEstimateWrite,
  buildAdaptiveV2RuntimeEstimateWrite,
  sourceLevelIdForScaleLevel,
  toBandProbabilityRecord,
} from './adaptivePracticeQuizEstimatePersistence.js'
import { advanceLoadedAdaptiveRuntime } from './adaptivePracticeQuizEstimatorVersions.js'
import { persistAdaptivePracticeQuizEstimates } from './adaptivePracticeQuizRepository.js'
import type {
  AdaptiveAttemptRuntimeRecord,
  LoadedAdaptiveRuntime,
} from './adaptivePracticeQuizRuntimeData.js'
import { toRuntimeResponses } from './adaptivePracticeQuizRuntimeData.js'

export function getAdaptiveAttemptDeadline(
  runtime: Pick<LoadedAdaptiveRuntime, 'publication'>,
  attempt: Pick<AdaptiveAttemptRuntimeRecord, 'startedAt'>
): Date | null {
  const timeLimitSeconds = runtime.publication.timeLimitSeconds
  return timeLimitSeconds === null
    ? null
    : new Date(attempt.startedAt.getTime() + timeLimitSeconds * 1_000)
}

export function isAdaptiveAttemptExpired(
  runtime: Pick<LoadedAdaptiveRuntime, 'publication'>,
  attempt: Pick<AdaptiveAttemptRuntimeRecord, 'startedAt'>,
  now = new Date()
): boolean {
  const deadline = getAdaptiveAttemptDeadline(runtime, attempt)
  return deadline !== null && now.getTime() >= deadline.getTime()
}

export function adaptiveAttemptTimeLimitCompletionData(
  runtime: Pick<LoadedAdaptiveRuntime, 'publication'>,
  attempt: Pick<AdaptiveAttemptRuntimeRecord, 'startedAt'>
): DB.Prisma.AdaptivePracticeQuizAttemptUncheckedUpdateInput {
  const deadline = getAdaptiveAttemptDeadline(runtime, attempt)
  if (deadline === null) {
    throw new Error('An unlimited adaptive attempt cannot expire.')
  }
  return {
    status: DB.AdaptivePracticeQuizAttemptStatus.COMPLETED,
    stopReason: DB.AdaptivePracticeQuizStopReason.TIME_LIMIT,
    nextPoolItemId: null,
    nextAdministrationProbability: null,
    nextCollectionDesignVersion: null,
    nextRandomizationVersion: null,
    nextRandomDraw: null,
    nextCandidateSetHash: null,
    nextItemRole: null,
    elapsedSeconds: runtime.publication.timeLimitSeconds,
    completedAt: deadline,
  }
}

/**
 * Seal the current evidence before completing an expired attempt. Results must
 * remain readable even when the first served item was never answered.
 */
export async function completeAdaptiveAttemptForTimeLimit({
  prisma,
  runtime,
  attempt,
}: {
  prisma: PrismaTransactionClient
  runtime: LoadedAdaptiveRuntime
  attempt: AdaptiveAttemptRuntimeRecord
}) {
  const completion = adaptiveAttemptTimeLimitCompletionData(runtime, attempt)
  const responses = toRuntimeResponses(attempt.responses, runtime.publication)

  const decision = await advanceLoadedAdaptiveRuntime({
    attemptId: attempt.id,
    runtime: runtime.estimator,
    responses,
    terminalStopReason: 'INSUFFICIENT_DATA',
  })

  if (decision.measurementVersion === 'IRT_V1') {
    const estimates = decision.decision.estimates
    await persistAdaptivePracticeQuizEstimates(
      buildAdaptiveRuntimeEstimateWrite({
        attempt,
        estimates,
        nodeIds: [...estimates.nodes.keys()],
      }),
      prisma
    )
    await prisma.adaptivePracticeQuizAttempt.update({
      where: { id: attempt.id },
      data: {
        ...completion,
        currentTheta: estimates.overall.theta ?? attempt.currentTheta,
        currentStandardError: estimates.overall.standardError,
        finalTheta: estimates.overall.theta,
        finalStandardError: estimates.overall.standardError,
        finalLevelId: estimates.overall.levelId,
      },
    })
    return
  }

  if (decision.measurementVersion !== 'IRT_V2_EAP_GRID_1') {
    throw new Error(
      'Adaptive estimator version changed while sealing time limit.'
    )
  }
  const overall = decision.decision.estimates.overall
  await persistAdaptivePracticeQuizEstimates(
    buildAdaptiveV2RuntimeEstimateWrite({
      attempt,
      runtime,
      estimates: decision.decision.estimates,
    }),
    prisma
  )
  await prisma.adaptivePracticeQuizAttempt.update({
    where: { id: attempt.id },
    data: {
      ...completion,
      currentTheta: overall.posterior.mean,
      currentStandardError: overall.posterior.standardDeviation,
      credibleLower: overall.posterior.credibleLower,
      credibleUpper: overall.posterior.credibleUpper,
      bandProbabilities: toBandProbabilityRecord(
        overall.posterior.bandProbabilities
      ),
      resultStatus: DB.AdaptiveResultStatus[decision.decision.resultStatus!],
      finalTheta: overall.posterior.mean,
      finalStandardError: overall.posterior.standardDeviation,
      finalScaleLevelId: overall.classifiedLevelId,
      finalLevelId: sourceLevelIdForScaleLevel(
        runtime,
        overall.classifiedLevelId
      ),
      finalBandProbability: overall.classificationProbability,
    },
  })
}
