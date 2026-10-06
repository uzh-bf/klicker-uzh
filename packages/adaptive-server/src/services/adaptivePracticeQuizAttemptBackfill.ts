import type { ContextWithUser } from '@klicker-uzh/graphql/adaptive-context-types'
import * as DB from '@klicker-uzh/prisma/client'
import { replayAdaptiveAttempt } from './adaptivePracticeQuizAttemptReplay.js'
import { adaptivePracticeQuizError } from './adaptivePracticeQuizErrors.js'
import { advanceLoadedAdaptiveRuntime } from './adaptivePracticeQuizEstimatorVersions.js'
import { loadAdaptiveRuntime } from './adaptivePracticeQuizRuntimeData.js'
import { isAdaptiveTestingInfoEnabled } from './adaptivePracticeQuizTestingInfo.js'

export type AdaptiveAttemptEstimateBackfill = {
  /** Attempts that still lacked stored competence estimates. */
  attemptsMissing: number
  attemptsUpdated: number
  answersUpdated: number
  /** Updated attempts the current engine would have routed differently. */
  attemptsReplayDiffering: number
  /** Attempts the engine could not replay (left unchanged). */
  attemptsFailed: number
}

// Stored only when usable; the response check constraint rejects a
// non-positive standard error.
function storable(estimate: {
  theta: number | null
  standardError: number | null
}) {
  const theta =
    typeof estimate.theta === 'number' && Number.isFinite(estimate.theta)
      ? estimate.theta
      : null
  const standardError =
    theta !== null &&
    typeof estimate.standardError === 'number' &&
    Number.isFinite(estimate.standardError) &&
    estimate.standardError > 0
      ? estimate.standardError
      : null
  return { theta, standardError }
}

/**
 * One-time backfill of the per-answer competence estimates for completed
 * IRT_V1 attempts of the current publication that predate their storage
 * (testing environments only; the GraphQL field checks ADMIN permission on
 * the quiz). Each attempt with a missing value is replayed through the
 * engine, one decide per answer prefix, and its missing answers are updated
 * in one transaction. Answers the live runtime stored are never overwritten.
 */
export async function backfillAdaptivePracticeQuizAttemptEstimates(
  { practiceQuizId }: { practiceQuizId: string },
  ctx: ContextWithUser,
  showSolutions: string | undefined = process.env.ADAPTIVE_QUIZ_SHOW_SOLUTIONS
): Promise<AdaptiveAttemptEstimateBackfill> {
  if (!isAdaptiveTestingInfoEnabled(showSolutions)) {
    throw adaptivePracticeQuizError(
      'Attempt diagnostics are only available in testing environments.',
      'ADAPTIVE_DIAGNOSTICS_DISABLED'
    )
  }
  const runtime = await loadAdaptiveRuntime(ctx.prisma, practiceQuizId, {
    includeAlgorithmData: true,
  })
  const estimator = runtime.estimator
  const result: AdaptiveAttemptEstimateBackfill = {
    attemptsMissing: 0,
    attemptsUpdated: 0,
    answersUpdated: 0,
    attemptsReplayDiffering: 0,
    attemptsFailed: 0,
  }
  if (estimator.measurementVersion !== 'IRT_V1') return result

  const attempts = await ctx.prisma.adaptivePracticeQuizAttempt.findMany({
    where: {
      practiceQuizId,
      publicationId: runtime.publication.id,
      status: DB.AdaptivePracticeQuizAttemptStatus.COMPLETED,
      measurementVersion: DB.AdaptiveMeasurementVersion.IRT_V1,
      responses: { some: { competenceThetaAfter: null } },
    },
    select: {
      id: true,
      responses: {
        select: {
          id: true,
          order: true,
          poolItemId: true,
          correct: true,
          competenceThetaAfter: true,
        },
        orderBy: { order: 'asc' },
      },
    },
    orderBy: { startedAt: 'asc' },
  })
  result.attemptsMissing = attempts.length

  // Sequential: each replay already makes one engine call per answer.
  for (const attempt of attempts) {
    const responses = attempt.responses.flatMap((response) => {
      const poolItem =
        response.poolItemId === null
          ? undefined
          : runtime.poolById.get(response.poolItemId)
      return poolItem
        ? [
            {
              id: response.id,
              order: response.order,
              poolItemId: poolItem.id,
              correct: response.correct,
              poolItem,
            },
          ]
        : []
    })
    try {
      const replay = await replayAdaptiveAttempt({
        responses,
        decide: async (prefix) => {
          const loaded = await advanceLoadedAdaptiveRuntime({
            attemptId: attempt.id,
            runtime: estimator,
            responses: prefix,
          })
          if (loaded.measurementVersion !== 'IRT_V1') {
            throw new Error('Estimator mismatch')
          }
          return {
            nextPoolItemId: loaded.decision.nextPoolItem?.id ?? null,
            nodes: loaded.decision.estimates.nodes,
          }
        },
      })
      // Answers the live runtime already stored stay as they are.
      const missingIdByOrder = new Map(
        attempt.responses
          .filter(({ competenceThetaAfter }) => competenceThetaAfter === null)
          .map(({ order, id }) => [order, id])
      )
      const updates = replay.answers.filter(({ order }) =>
        missingIdByOrder.has(order)
      )
      await ctx.prisma.$transaction(
        updates.map((answer) => {
          const before = storable(answer.competenceBefore)
          const after = storable(answer.competenceAfter)
          return ctx.prisma.adaptivePracticeQuizResponse.update({
            where: { id: missingIdByOrder.get(answer.order)! },
            data: {
              competenceThetaBefore: before.theta,
              competenceStandardErrorBefore: before.standardError,
              competenceThetaAfter: after.theta,
              competenceStandardErrorAfter: after.standardError,
            },
          })
        })
      )
      result.attemptsUpdated += 1
      result.answersUpdated += updates.length
      if (!replay.exact) result.attemptsReplayDiffering += 1
    } catch {
      result.attemptsFailed += 1
    }
  }
  return result
}
