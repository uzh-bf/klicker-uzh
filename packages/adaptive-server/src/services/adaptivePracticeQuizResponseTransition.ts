import * as DB from '@klicker-uzh/prisma/client'
import {
  type AdvancedAdaptiveRuntime,
  adaptiveV2AttemptUpdateData,
  adaptiveV2ResponseAuditData,
} from './adaptivePracticeQuizCommandSupport.js'
import {
  buildAdaptiveRuntimeEstimateWrite,
  buildAdaptiveV2RuntimeEstimateWrite,
  getEffectivelyEnabledRuntimeNodes,
} from './adaptivePracticeQuizEstimatePersistence.js'
import type { PersistAdaptivePracticeQuizEstimatesInput } from './adaptivePracticeQuizRepository.js'
import {
  type AdaptiveRuntimeResponse,
  type AdaptiveRuntimeRoutingPoolItem,
  getMappedRuntimeNodeIds,
} from './adaptivePracticeQuizRuntime.js'
import type { AdaptiveAttemptRuntimeRecord } from './adaptivePracticeQuizRuntimeData.js'
import { tryComputeAdaptiveIrtV2ShadowEvent } from './adaptivePracticeQuizShadow.js'

type LegacyAdaptiveResponseEstimateData = Pick<
  DB.Prisma.AdaptivePracticeQuizResponseUncheckedCreateInput,
  | 'overallThetaBefore'
  | 'overallThetaAfter'
  | 'overallStandardErrorAfter'
  | 'competenceThetaBefore'
  | 'competenceStandardErrorBefore'
  | 'competenceThetaAfter'
  | 'competenceStandardErrorAfter'
>

// Stored only when usable; the response check constraint rejects a
// non-positive standard error.
function storableCompetenceEstimate(
  estimate: { theta: number | null; standardError: number | null } | undefined
) {
  const theta =
    typeof estimate?.theta === 'number' && Number.isFinite(estimate.theta)
      ? estimate.theta
      : null
  const standardError =
    theta !== null &&
    typeof estimate?.standardError === 'number' &&
    Number.isFinite(estimate.standardError) &&
    estimate.standardError > 0
      ? estimate.standardError
      : null
  return { theta, standardError }
}

type BayesianAdaptiveResponseEstimateData = LegacyAdaptiveResponseEstimateData &
  ReturnType<typeof adaptiveV2ResponseAuditData>

type AdaptivePracticeQuizResponseTransitionBase = {
  estimateWrite: PersistAdaptivePracticeQuizEstimatesInput
  attemptUpdate: DB.Prisma.AdaptivePracticeQuizAttemptUncheckedUpdateInput
  answeredExposurePoolItemId: number | null
  nextExposurePoolItemId: number | null
}

export type AdaptivePracticeQuizResponseTransition =
  | (AdaptivePracticeQuizResponseTransitionBase & {
      measurementVersion: 'IRT_V1'
      responseEstimateData: LegacyAdaptiveResponseEstimateData
      shadowEvent:
        | (() => ReturnType<typeof tryComputeAdaptiveIrtV2ShadowEvent>)
        | null
    })
  | (AdaptivePracticeQuizResponseTransitionBase & {
      measurementVersion: 'IRT_V2_EAP_GRID_1'
      responseEstimateData: BayesianAdaptiveResponseEstimateData
      shadowEvent: null
    })

export function planAdaptivePracticeQuizResponseTransition({
  attempt,
  servedPoolItem,
  responses,
  advancedRuntime,
  totalElapsedSeconds,
  completedAt,
}: {
  attempt: AdaptiveAttemptRuntimeRecord
  servedPoolItem: AdaptiveRuntimeRoutingPoolItem
  responses: AdaptiveRuntimeResponse[]
  advancedRuntime: AdvancedAdaptiveRuntime
  totalElapsedSeconds: number | null
  completedAt: Date
}): AdaptivePracticeQuizResponseTransition {
  const runtime = advancedRuntime.runtime
  const overallBefore =
    attempt.currentStandardError === null
      ? null
      : {
          theta: attempt.currentTheta,
          standardError: attempt.currentStandardError,
        }

  if (advancedRuntime.measurementVersion === 'IRT_V1') {
    const decision = advancedRuntime.decision
    const terminalStopReason = decision.nextPoolItem
      ? null
      : (decision.stopReason ??
        DB.AdaptivePracticeQuizStopReason.INSUFFICIENT_DATA)
    const estimates = decision.estimates

    // A multi-leaf answer also updates the nodes on its additional paths.
    const estimateNodeIds = terminalStopReason
      ? [...estimates.nodes.keys()]
      : getMappedRuntimeNodeIds(
          servedPoolItem,
          runtime.algorithm.nodes,
          new Set(
            getEffectivelyEnabledRuntimeNodes(runtime.algorithm.nodes).map(
              ({ id }) => id
            )
          )
        )
    const attemptUpdate: DB.Prisma.AdaptivePracticeQuizAttemptUncheckedUpdateInput =
      terminalStopReason
        ? {
            status: DB.AdaptivePracticeQuizAttemptStatus.COMPLETED,
            stopReason: terminalStopReason,
            nextPoolItemId: null,
            currentTheta: estimates.overall.theta ?? attempt.currentTheta,
            currentStandardError: estimates.overall.standardError,
            finalTheta: estimates.overall.theta,
            finalStandardError: estimates.overall.standardError,
            finalLevelId: estimates.overall.levelId,
            elapsedSeconds: totalElapsedSeconds,
            completedAt,
          }
        : {
            nextPoolItemId: decision.nextPoolItem!.id,
            currentTheta: estimates.overall.theta ?? attempt.currentTheta,
            currentStandardError: estimates.overall.standardError,
            elapsedSeconds: totalElapsedSeconds,
          }

    // Estimate of the answered item's competence (root) before and after
    // this answer, for the lecturer attempt diagnostics.
    const rootId = servedPoolItem.nodePath[0]
    const competenceBefore = storableCompetenceEstimate(
      attempt.estimates.find(
        (estimate) =>
          estimate.nodeKind !== DB.AdaptiveEstimateNodeKind.OVERALL &&
          estimate.nodeId === rootId
      )
    )
    const competenceAfter = storableCompetenceEstimate(
      typeof rootId === 'number' ? estimates.nodes.get(rootId) : undefined
    )

    return {
      measurementVersion: advancedRuntime.measurementVersion,
      responseEstimateData: {
        overallThetaBefore: overallBefore?.theta ?? null,
        overallThetaAfter: estimates.overall.theta,
        overallStandardErrorAfter: estimates.overall.standardError,
        competenceThetaBefore: competenceBefore.theta,
        competenceStandardErrorBefore: competenceBefore.standardError,
        competenceThetaAfter: competenceAfter.theta,
        competenceStandardErrorAfter: competenceAfter.standardError,
      },
      estimateWrite: buildAdaptiveRuntimeEstimateWrite({
        attempt,
        estimates,
        nodeIds: estimateNodeIds,
      }),
      attemptUpdate,
      answeredExposurePoolItemId: null,
      nextExposurePoolItemId: null,
      shadowEvent: terminalStopReason
        ? () =>
            tryComputeAdaptiveIrtV2ShadowEvent({
              runtime,
              responses,
              terminalReason: terminalStopReason,
              v1LevelId: estimates.overall.levelId,
            })
        : null,
    }
  }

  const decision = advancedRuntime.decision
  const terminalStopReason = decision.nextPoolItem
    ? null
    : (decision.stopReason ??
      DB.AdaptivePracticeQuizStopReason.INSUFFICIENT_DATA)
  const posterior = decision.estimates.overall.posterior

  return {
    measurementVersion: advancedRuntime.measurementVersion,
    responseEstimateData: {
      overallThetaBefore: overallBefore?.theta ?? null,
      overallThetaAfter: posterior.mean,
      overallStandardErrorAfter: posterior.standardDeviation,
      ...adaptiveV2ResponseAuditData(attempt, advancedRuntime),
    },
    estimateWrite: buildAdaptiveV2RuntimeEstimateWrite({
      attempt,
      runtime,
      estimates: decision.estimates,
    }),
    attemptUpdate: adaptiveV2AttemptUpdateData({
      runtime,
      loadedDecision: advancedRuntime,
      terminalStopReason,
      totalElapsedSeconds,
      completedAt,
    }),
    answeredExposurePoolItemId: servedPoolItem.id,
    nextExposurePoolItemId: decision.nextPoolItem?.id ?? null,
    shadowEvent: null,
  }
}
