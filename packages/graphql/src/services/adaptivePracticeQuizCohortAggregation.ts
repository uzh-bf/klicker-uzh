import * as DB from '@klicker-uzh/prisma/client'
import {
  accumulateAdaptivePracticeQuizDiagnostics,
  createAdaptivePracticeQuizDiagnosticsAccumulator,
  finalizeAdaptiveItemDiagnostics,
  finalizeAdaptivePilotMetrics,
  type AdaptiveItemDiagnostic,
  type AdaptivePilotMetrics,
  type AdaptivePracticeQuizDiagnosticsAccumulator,
} from './adaptivePracticeQuizDiagnostics.js'
import {
  compactAdaptivePrivacySuppressions,
  hasAdaptivePrivacyWithholding,
  releaseAdaptiveBinaryMetric,
  releaseAdaptiveCategoricalMetric,
  type AdaptivePrivacySuppression,
} from './adaptivePracticeQuizPrivacy.js'
import {
  MIN_REPORTING_RESPONSES,
  type AdaptiveRuntimeLevel,
  type AdaptiveRuntimeNode,
  type AdaptiveRuntimeRoutingPoolItem,
  type AdaptiveRuntimeSettings,
} from './adaptivePracticeQuizRuntime.js'

export type AdaptiveCohortLevelBucket = {
  levelLabel: string
  levelOrder: number
  count: number
}

export type AdaptiveCohortNodeDistribution = {
  nodeId: number | null
  parentNodeId: number | null
  nodeName: string
  nodeKind: DB.AdaptiveEstimateNodeKind
  depth: number
  order: number
  suppressed: boolean
  suppressions: AdaptivePrivacySuppression[]
  insufficientDataCount: number | null
  buckets: AdaptiveCohortLevelBucket[]
}

export type AdaptiveCohortAttemptSummary = {
  suppressed: boolean
  suppressions: AdaptivePrivacySuppression[]
  classified: number | null
  capped: number | null
  poolExhausted: number | null
  stoppedInsufficientData: number | null
  insufficientData: number | null
  nearBoundary: number | null
}

export type AdaptiveCohortResults = {
  practiceQuizId: string
  cohortSize: number | null
  suppressed: boolean
  attemptSummary: AdaptiveCohortAttemptSummary
  pilotMetrics: AdaptivePilotMetrics
  itemDiagnostics: AdaptiveItemDiagnostic[]
  distributions: AdaptiveCohortNodeDistribution[]
}

export type AdaptiveCohortRuntime = {
  quiz: { id: string }
  config: {
    id: string
    attemptSelectionPolicy: DB.AdaptiveAttemptSelectionPolicy
  }
  tree: {
    nodes: Array<{
      id: number
      parentId: number | null
      name: string
      depth: number
      order: number
    }>
  }
  pool: AdaptiveRuntimeRoutingPoolItem[]
  algorithm: {
    nodes: AdaptiveRuntimeNode[]
    levels: AdaptiveRuntimeLevel[]
    settings: AdaptiveRuntimeSettings
  }
}

export type AdaptiveCohortAttemptRecord = {
  stopReason: DB.AdaptivePracticeQuizStopReason | null
  elapsedSeconds: number | null
  estimates: Array<{
    nodeKind: DB.AdaptiveEstimateNodeKind
    nodeId: number | null
    theta: number | null
    standardError: number | null
    responseCount: number
    levelId: number | null
  }>
}

export type AdaptiveCohortResponseRecord = {
  correct: boolean
  poolItemId: number | null
}

type DistributionDefinition = {
  nodeId: number | null
  parentNodeId: number | null
  nodeName: string
  nodeKind: DB.AdaptiveEstimateNodeKind
  depth: number
  order: number
}

export type AdaptiveCohortAccumulator = {
  total: number
  classified: number
  capped: number
  poolExhausted: number
  stoppedInsufficientData: number
  insufficientData: number
  definitions: DistributionDefinition[]
  distributions: Array<{
    insufficientDataCount: number
    levelCounts: Map<number, number>
  }>
  diagnostics: AdaptivePracticeQuizDiagnosticsAccumulator
}

export function createAdaptiveCohortAccumulator(
  runtime: AdaptiveCohortRuntime
): AdaptiveCohortAccumulator {
  const nodesById = new Map(runtime.tree.nodes.map((node) => [node.id, node]))
  const definitions: DistributionDefinition[] = [
    {
      nodeId: null,
      parentNodeId: null,
      nodeName: 'Overall',
      nodeKind: DB.AdaptiveEstimateNodeKind.OVERALL,
      depth: 0,
      order: 0,
    },
    ...getEffectivelyEnabledRuntimeNodes(runtime.algorithm.nodes).map(
      (node) => ({
        nodeId: node.id,
        parentNodeId: node.parentId,
        nodeName: nodesById.get(node.id)!.name,
        nodeKind:
          node.kind === DB.AdaptiveNodeKind.COMPETENCE
            ? DB.AdaptiveEstimateNodeKind.COMPETENCE
            : DB.AdaptiveEstimateNodeKind.SUBCOMPETENCE,
        depth: nodesById.get(node.id)!.depth,
        order: nodesById.get(node.id)!.order,
      })
    ),
  ]
  return {
    total: 0,
    classified: 0,
    capped: 0,
    poolExhausted: 0,
    stoppedInsufficientData: 0,
    insufficientData: 0,
    definitions,
    distributions: definitions.map(() => ({
      insufficientDataCount: 0,
      levelCounts: new Map(),
    })),
    diagnostics: createAdaptivePracticeQuizDiagnosticsAccumulator(runtime.pool),
  }
}

export function accumulateAdaptiveCohortAttempt(
  runtime: AdaptiveCohortRuntime,
  accumulator: AdaptiveCohortAccumulator,
  attempt: AdaptiveCohortAttemptRecord,
  responses: AdaptiveCohortResponseRecord[]
) {
  accumulator.total += 1
  incrementStopReason(accumulator, attempt.stopReason)

  const estimates = new Map(
    attempt.estimates.map((estimate) => [
      estimateKey(estimate.nodeKind, estimate.nodeId),
      estimate,
    ])
  )
  const overall = estimates.get(
    estimateKey(DB.AdaptiveEstimateNodeKind.OVERALL, null)
  )
  const diagnostics = accumulateAdaptivePracticeQuizDiagnostics({
    runtime,
    accumulator: accumulator.diagnostics,
    attempt,
    overall,
    responses,
  })
  if (diagnostics.insufficientData) {
    accumulator.insufficientData += 1
  }

  for (const [index, definition] of accumulator.definitions.entries()) {
    const estimate = estimates.get(
      estimateKey(definition.nodeKind, definition.nodeId)
    )
    const metric = accumulator.distributions[index]!
    if (
      !estimate ||
      estimate.responseCount < MIN_REPORTING_RESPONSES ||
      estimate.levelId === null
    ) {
      metric.insufficientDataCount += 1
      continue
    }
    metric.levelCounts.set(
      estimate.levelId,
      (metric.levelCounts.get(estimate.levelId) ?? 0) + 1
    )
  }
}

export function finalizeAdaptiveCohort(
  runtime: AdaptiveCohortRuntime,
  accumulator: AdaptiveCohortAccumulator
): AdaptiveCohortResults {
  const attemptSummary = finalizeAttemptSummary(accumulator)
  const pilotMetrics = finalizeAdaptivePilotMetrics({
    practiceQuizId: runtime.quiz.id,
    cohortSize: accumulator.total,
    accumulator: accumulator.diagnostics,
    attemptSummary,
  })
  const itemDiagnostics = finalizeAdaptiveItemDiagnostics(
    accumulator.total,
    accumulator.diagnostics
  )
  const distributions = finalizeDistributions(runtime, accumulator)
  return {
    practiceQuizId: runtime.quiz.id,
    cohortSize: accumulator.total === 0 ? null : accumulator.total,
    suppressed:
      attemptSummary.suppressed ||
      pilotMetrics.suppressed ||
      itemDiagnostics.some(({ suppressed }) => suppressed) ||
      distributions.some(({ suppressed }) => suppressed),
    attemptSummary,
    pilotMetrics,
    itemDiagnostics,
    distributions,
  }
}

function finalizeAttemptSummary(
  accumulator: AdaptiveCohortAccumulator
): AdaptiveCohortAttemptSummary {
  const fields = {
    classified: releaseAdaptiveBinaryMetric({
      field: 'CLASSIFIED',
      total: accumulator.total,
      positive: accumulator.classified,
      value: accumulator.classified,
    }),
    capped: releaseAdaptiveBinaryMetric({
      field: 'CAPPED',
      total: accumulator.total,
      positive: accumulator.capped,
      value: accumulator.capped,
    }),
    poolExhausted: releaseAdaptiveBinaryMetric({
      field: 'POOL_EXHAUSTED',
      total: accumulator.total,
      positive: accumulator.poolExhausted,
      value: accumulator.poolExhausted,
    }),
    stoppedInsufficientData: releaseAdaptiveBinaryMetric({
      field: 'STOPPED_INSUFFICIENT_DATA',
      total: accumulator.total,
      positive: accumulator.stoppedInsufficientData,
      value: accumulator.stoppedInsufficientData,
    }),
    insufficientData: releaseAdaptiveBinaryMetric({
      field: 'INSUFFICIENT_DATA',
      total: accumulator.total,
      positive: accumulator.insufficientData,
      value: accumulator.insufficientData,
    }),
    nearBoundary: releaseAdaptiveBinaryMetric({
      field: 'NEAR_BOUNDARY',
      total: accumulator.total,
      positive: accumulator.diagnostics.nearBoundary,
      value: accumulator.diagnostics.nearBoundary,
    }),
  }
  const suppressions = compactAdaptivePrivacySuppressions(
    Object.values(fields).map(({ suppression }) => suppression)
  )
  return {
    suppressed: hasAdaptivePrivacyWithholding(suppressions),
    suppressions,
    classified: fields.classified.value,
    capped: fields.capped.value,
    poolExhausted: fields.poolExhausted.value,
    stoppedInsufficientData: fields.stoppedInsufficientData.value,
    insufficientData: fields.insufficientData.value,
    nearBoundary: fields.nearBoundary.value,
  }
}

function finalizeDistributions(
  runtime: AdaptiveCohortRuntime,
  accumulator: AdaptiveCohortAccumulator
): AdaptiveCohortNodeDistribution[] {
  return accumulator.definitions.map((definition, index) => {
    const metric = accumulator.distributions[index]!
    const buckets = runtime.algorithm.levels.map((level) => ({
      levelLabel: level.label,
      levelOrder: level.order,
      count: metric.levelCounts.get(level.id) ?? 0,
    }))
    const release = releaseAdaptiveCategoricalMetric({
      field: 'DISTRIBUTION',
      cells: [
        ...buckets.map(({ count }) => count),
        metric.insufficientDataCount,
      ],
      value: {
        insufficientDataCount: metric.insufficientDataCount,
        buckets,
      },
    })
    const suppressions = compactAdaptivePrivacySuppressions([
      release.suppression,
    ])
    return {
      ...definition,
      suppressed: hasAdaptivePrivacyWithholding(suppressions),
      suppressions,
      insufficientDataCount: release.value?.insufficientDataCount ?? null,
      buckets: release.value?.buckets ?? [],
    }
  })
}

function incrementStopReason(
  accumulator: AdaptiveCohortAccumulator,
  stopReason: DB.AdaptivePracticeQuizStopReason | null
) {
  switch (stopReason) {
    case DB.AdaptivePracticeQuizStopReason.CLASSIFIED:
    case DB.AdaptivePracticeQuizStopReason.ALL_ROOTS_CLASSIFIED:
      accumulator.classified += 1
      break
    case DB.AdaptivePracticeQuizStopReason.TOTAL_QUESTION_CAP:
    case DB.AdaptivePracticeQuizStopReason.NODE_QUESTION_CAP:
      accumulator.capped += 1
      break
    case DB.AdaptivePracticeQuizStopReason.POOL_EXHAUSTED:
      accumulator.poolExhausted += 1
      break
    case DB.AdaptivePracticeQuizStopReason.INSUFFICIENT_DATA:
      accumulator.stoppedInsufficientData += 1
      break
  }
}

function getEffectivelyEnabledRuntimeNodes(nodes: AdaptiveRuntimeNode[]) {
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

function estimateKey(kind: DB.AdaptiveEstimateNodeKind, nodeId: number | null) {
  return `${kind}:${nodeId ?? 'overall'}`
}
