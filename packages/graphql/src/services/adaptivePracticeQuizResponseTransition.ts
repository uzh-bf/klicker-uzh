import * as DB from '@klicker-uzh/prisma/client'
import {
  adaptiveV2AttemptUpdateData,
  adaptiveV2ResponseAuditData,
  type AdvancedAdaptiveRuntime,
} from './adaptivePracticeQuizCommandSupport.js'
import {
  buildAdaptiveRuntimeEstimateWrite,
  buildAdaptiveV2RuntimeEstimateWrite,
  markClassifiedAdaptiveRootEstimates,
} from './adaptivePracticeQuizEstimatePersistence.js'
import type { PersistAdaptivePracticeQuizEstimatesInput } from './adaptivePracticeQuizRepository.js'
import {
  computeAdaptiveEstimates,
  type AdaptiveRuntimeResponse,
  type AdaptiveRuntimeRoutingPoolItem,
} from './adaptivePracticeQuizRuntime.js'
import type { AdaptiveAttemptRuntimeRecord } from './adaptivePracticeQuizRuntimeData.js'
import { tryComputeAdaptiveIrtV2ShadowEvent } from './adaptivePracticeQuizShadow.js'

type LegacyAdaptiveResponseEstimateData = Pick<
  DB.Prisma.AdaptivePracticeQuizResponseUncheckedCreateInput,
  'overallThetaBefore' | 'overallThetaAfter' | 'overallStandardErrorAfter'
>

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
      shadowEvent: ReturnType<typeof tryComputeAdaptiveIrtV2ShadowEvent>
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
    const estimates = terminalStopReason
      ? computeAdaptiveEstimates({
          nodes: runtime.algorithm.nodes,
          levels: runtime.algorithm.levels,
          responses,
          settings: runtime.algorithm.settings,
          terminalStopReason,
        })
      : decision.estimates

    if (terminalStopReason) {
      markClassifiedAdaptiveRootEstimates(runtime, responses, estimates)
    }

    const estimateNodeIds = terminalStopReason
      ? [...estimates.nodes.keys()]
      : servedPoolItem.nodePath
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

    return {
      measurementVersion: advancedRuntime.measurementVersion,
      responseEstimateData: {
        overallThetaBefore: overallBefore?.theta ?? null,
        overallThetaAfter: estimates.overall.theta,
        overallStandardErrorAfter: estimates.overall.standardError,
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
        ? tryComputeAdaptiveIrtV2ShadowEvent({
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
