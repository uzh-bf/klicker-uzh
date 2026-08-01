import {
  classificationIntervalWithinLevelBand,
  type AdaptiveV2Estimate,
  type AdaptiveV2Estimates,
} from '@klicker-uzh/adaptive-learning'
import * as DB from '@klicker-uzh/prisma/client'
import { adaptivePracticeQuizError } from './adaptivePracticeQuizErrors.js'
import type { PersistAdaptivePracticeQuizEstimatesInput } from './adaptivePracticeQuizRepository.js'
import {
  MIN_REPORTING_RESPONSES,
  computeAdaptiveEstimates,
  type AdaptiveRuntimeNode,
  type AdaptiveRuntimeResponse,
} from './adaptivePracticeQuizRuntime.js'
import type {
  AdaptiveAttemptRuntimeRecord,
  LoadedAdaptiveRuntime,
} from './adaptivePracticeQuizRuntimeData.js'

export function getEffectivelyEnabledRuntimeNodes(
  nodes: AdaptiveRuntimeNode[]
) {
  const enabled = new Set<number>()
  for (const node of nodes.slice().sort((a, b) => a.depth - b.depth)) {
    if (
      node.enabled &&
      (node.parentId === null || enabled.has(node.parentId))
    ) {
      enabled.add(node.id)
    }
  }
  return nodes.filter((node) => enabled.has(node.id))
}

export function markClassifiedAdaptiveRootEstimates(
  runtime: LoadedAdaptiveRuntime,
  responses: AdaptiveRuntimeResponse[],
  estimates: ReturnType<typeof computeAdaptiveEstimates>
) {
  const leafCounts = new Map<number, number>()
  for (const response of responses) {
    leafCounts.set(
      response.poolItem.leafNodeId,
      (leafCounts.get(response.poolItem.leafNodeId) ?? 0) + 1
    )
  }
  const roots = getEffectivelyEnabledRuntimeNodes(
    runtime.algorithm.nodes
  ).filter(
    (node) =>
      node.parentId === null && node.kind === DB.AdaptiveNodeKind.COMPETENCE
  )
  for (const root of roots) {
    const estimate = estimates.nodes.get(root.id)
    if (
      !estimate ||
      estimate.theta === null ||
      estimate.standardError === null ||
      estimate.responseCount < MIN_REPORTING_RESPONSES
    ) {
      continue
    }
    const leafIds = [
      ...new Set(
        runtime.pool
          .filter((item) => item.nodePath[0] === root.id)
          .map(({ leafNodeId }) => leafNodeId)
      ),
    ]
    const breadthSatisfied = leafIds.every(
      (leafId) =>
        (leafCounts.get(leafId) ?? 0) >=
        runtime.algorithm.settings.minQuestionsPerLeaf
    )
    if (
      breadthSatisfied &&
      classificationIntervalWithinLevelBand({
        theta: estimate.theta,
        standardError: estimate.standardError,
        levels: runtime.algorithm.levels,
        range: runtime.algorithm.settings.thetaRange,
        mappingRule: runtime.algorithm.settings.levelMappingRule,
        z: runtime.algorithm.settings.classificationZ,
      })
    ) {
      estimates.nodes.set(root.id, {
        ...estimate,
        stopReason: DB.AdaptivePracticeQuizStopReason.CLASSIFIED,
      })
    }
  }
}

export function buildAdaptiveRuntimeEstimateWrite({
  attempt,
  estimates,
  nodeIds,
}: {
  attempt: AdaptiveAttemptRuntimeRecord
  estimates: ReturnType<typeof computeAdaptiveEstimates>
  nodeIds: readonly number[]
}): PersistAdaptivePracticeQuizEstimatesInput {
  const overall = estimates.overall
  return {
    attemptId: attempt.id,
    configId: attempt.configId,
    competenceTreeId: attempt.competenceTreeId,
    overall: {
      nodeKind: DB.AdaptiveEstimateNodeKind.OVERALL,
      nodeId: null,
      theta: overall.theta,
      standardError: overall.standardError,
      responseCount: overall.responseCount,
      levelId: overall.levelId,
      stopReason: overall.stopReason,
    },
    nodes: [...new Set(nodeIds)].flatMap((nodeId) => {
      const estimate = estimates.nodes.get(nodeId)
      if (!estimate) return []
      if (
        estimate.nodeKind === DB.AdaptiveEstimateNodeKind.OVERALL ||
        estimate.nodeId === null
      ) {
        throw new Error('Adaptive node estimate identity is invalid.')
      }
      return [
        {
          nodeKind: estimate.nodeKind,
          nodeId: estimate.nodeId,
          theta: estimate.theta,
          standardError: estimate.standardError,
          responseCount: estimate.responseCount,
          levelId: estimate.levelId,
          stopReason: estimate.stopReason,
        },
      ]
    }),
  }
}

export function buildAdaptiveV2RuntimeEstimateWrite({
  attempt,
  runtime,
  estimates,
}: {
  attempt: AdaptiveAttemptRuntimeRecord
  runtime: LoadedAdaptiveRuntime
  estimates: AdaptiveV2Estimates
}): PersistAdaptivePracticeQuizEstimatesInput {
  if (
    runtime.estimator.measurementVersion !==
    DB.AdaptiveMeasurementVersion.IRT_V2_EAP_GRID_1
  ) {
    throw adaptivePracticeQuizError(
      'Bayesian estimates cannot be stored for a legacy attempt.',
      'ADAPTIVE_ESTIMATOR_RUNTIME_MISMATCH'
    )
  }
  assertFiniteV2Estimate(estimates.overall)
  for (const estimate of estimates.nodes.values()) {
    assertFiniteV2Estimate(estimate)
  }
  const toWrite = (estimate: AdaptiveV2Estimate) => ({
    nodeKind: estimate.nodeKind,
    nodeId: estimate.nodeId,
    theta: estimate.posterior.mean,
    standardError: estimate.posterior.standardDeviation,
    responseCount: estimate.responseCount,
    levelId: sourceLevelIdForScaleLevel(runtime, estimate.classifiedLevelId),
    stopReason: estimate.stopReason,
    resultStatus: estimate.resultStatus,
    classificationProbability: estimate.classificationProbability,
    credibleLower: estimate.posterior.credibleLower,
    credibleUpper: estimate.posterior.credibleUpper,
    bandProbabilities: toBandProbabilityRecord(
      estimate.posterior.bandProbabilities
    ),
  })
  const overall = toWrite(estimates.overall)
  return {
    attemptId: attempt.id,
    configId: attempt.configId,
    competenceTreeId: attempt.competenceTreeId,
    overall: {
      ...overall,
      nodeKind: DB.AdaptiveEstimateNodeKind.OVERALL,
      nodeId: null,
    },
    nodes: [...estimates.nodes.values()].map((estimate) => {
      const entry = toWrite(estimate)
      if (entry.nodeId === null || entry.nodeKind === 'OVERALL') {
        throw adaptivePracticeQuizError(
          'Bayesian node estimate identity is invalid.',
          'ADAPTIVE_ATTEMPT_DATA_INVALID'
        )
      }
      return {
        ...entry,
        nodeKind: entry.nodeKind,
        nodeId: entry.nodeId,
      }
    }),
  }
}

export function toBandProbabilityRecord(
  values: Array<{ levelId: number; probability: number }>
): Record<string, number> {
  return Object.fromEntries(
    values.map(({ levelId, probability }) => [String(levelId), probability])
  )
}

export function sourceLevelIdForScaleLevel(
  runtime: LoadedAdaptiveRuntime,
  scaleLevelId: number | null
) {
  if (scaleLevelId === null) return null
  return (
    runtime.publication.cutScoreSnapshot.find(
      ({ scaleLevelId: candidate }) => candidate === scaleLevelId
    )?.sourceLevelId ?? null
  )
}

function assertFiniteV2Estimate(estimate: AdaptiveV2Estimate) {
  const posterior = estimate.posterior
  if (
    !Number.isFinite(posterior.mean) ||
    !Number.isFinite(posterior.standardDeviation) ||
    !Number.isFinite(posterior.credibleLower) ||
    !Number.isFinite(posterior.credibleUpper) ||
    posterior.bandProbabilities.some(
      ({ probability }) => !Number.isFinite(probability) || probability < 0
    )
  ) {
    throw adaptivePracticeQuizError(
      'The Bayesian posterior is not finite.',
      'ADAPTIVE_POSTERIOR_INVALID'
    )
  }
}
