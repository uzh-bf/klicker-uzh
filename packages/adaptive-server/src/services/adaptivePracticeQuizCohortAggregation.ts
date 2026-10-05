import * as DB from '@klicker-uzh/prisma/client'
import {
  type AdaptiveItemDiagnostic,
  type AdaptivePilotMetrics,
  type AdaptivePracticeQuizDiagnosticsAccumulator,
  accumulateAdaptivePracticeQuizDiagnostics,
  createAdaptivePracticeQuizDiagnosticsAccumulator,
  finalizeAdaptiveItemDiagnostics,
  finalizeAdaptivePilotMetrics,
} from './adaptivePracticeQuizDiagnostics.js'
import { createAdaptiveV1LevelDetermination } from './adaptivePracticeQuizLevelDetermination.js'
import {
  type AdaptivePrivacySuppression,
  compactAdaptivePrivacySuppressions,
  hasAdaptivePrivacyWithholding,
  releaseAdaptiveBinaryMetric,
  releaseAdaptiveCategoricalMetric,
} from './adaptivePracticeQuizPrivacy.js'
import {
  type AdaptiveRuntimeLevel,
  type AdaptiveRuntimeNode,
  type AdaptiveRuntimeRoutingPoolItem,
  type AdaptiveRuntimeSettings,
  MIN_REPORTING_RESPONSES,
} from './adaptivePracticeQuizRuntime.js'

export type AdaptiveCohortLevelBucket = {
  levelLabel: string
  levelOrder: number
  count: number
  determinedCount?: number
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
  classifiedCount: number | null
  betweenLevelsCount: number | null
  insufficientEvidenceCount: number | null
  poolLimitedCount: number | null
  researchOnlyCount: number | null
  insufficientDataCount: number | null
  /**
   * Attempts without any response in this node (e.g. a subcompetence a
   * student was not served under subcompetence sampling). A subset of
   * insufficientDataCount; never counted as an ability estimate. Absent in
   * cohort snapshots written before this field existed.
   */
  notTestedCount?: number | null
  /**
   * Not-tested attempts whose engine excluded this subcompetence because no
   * eligible item lay within the student's level range (coverage status
   * OUT_OF_RANGE). A subset of notTestedCount; absent in older snapshots.
   */
  outOfRangeCount?: number | null
  buckets: AdaptiveCohortLevelBucket[]
}

export type AdaptiveCohortAttemptSummary = {
  suppressed: boolean
  suppressions: AdaptivePrivacySuppression[]
  classified: number | null
  betweenLevels: number | null
  insufficientEvidence: number | null
  poolLimited: number | null
  researchOnly: number | null
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
  publication: {
    id: string
    scaleVersionId: string
    measurementVersion: DB.AdaptiveMeasurementVersion
    retakePolicy: DB.AdaptiveAttemptSelectionPolicy
    cutScoreSnapshot: PrismaJson.PrismaAdaptiveCutScoreSnapshot
    hierarchicalWeightSnapshot: PrismaJson.PrismaAdaptiveHierarchicalWeightSnapshot
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
  resultStatus: DB.AdaptiveResultStatus | null
  measurementVersion: DB.AdaptiveMeasurementVersion
  elapsedSeconds: number | null
  estimates: Array<{
    nodeKind: DB.AdaptiveEstimateNodeKind
    nodeId: number | null
    theta: number | null
    standardError: number | null
    responseCount: number
    levelId: number | null
    resultStatus: DB.AdaptiveResultStatus | null
    stopReason?: DB.AdaptivePracticeQuizStopReason | null
    coverageStatus?: DB.AdaptiveLeafCoverageStatus | null
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
  classifications: Record<DB.AdaptiveResultStatus, number>
  definitions: DistributionDefinition[]
  distributions: Array<{
    insufficientDataCount: number
    notTestedCount: number
    outOfRangeCount: number
    levelCounts: Map<number, number>
    determinedCounts: Map<number, number>
    classifications: Record<DB.AdaptiveResultStatus, number>
  }>
  diagnostics: AdaptivePracticeQuizDiagnosticsAccumulator
}

export function createAdaptiveCohortAccumulator(
  runtime: AdaptiveCohortRuntime
): AdaptiveCohortAccumulator {
  const nodesById = new Map(runtime.tree.nodes.map((node) => [node.id, node]))
  const publishedNodesById = new Map(
    runtime.publication.hierarchicalWeightSnapshot.map((node) => [
      node.nodeId,
      node,
    ])
  )
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
        nodeName:
          publishedNodesById.get(node.id)?.name ?? nodesById.get(node.id)!.name,
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
    classifications: emptyClassificationCounts(),
    definitions,
    distributions: definitions.map(() => ({
      insufficientDataCount: 0,
      notTestedCount: 0,
      outOfRangeCount: 0,
      levelCounts: new Map(),
      determinedCounts: new Map(),
      classifications: emptyClassificationCounts(),
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
  incrementClassification(
    accumulator.classifications,
    resultClassification({ attempt, estimate: overall })
  )
  const diagnostics = accumulateAdaptivePracticeQuizDiagnostics({
    accumulator: accumulator.diagnostics,
    attempt,
    overall,
    responses,
  })
  if (diagnostics.insufficientData) {
    accumulator.insufficientData += 1
  }

  const determination = createAdaptiveV1LevelDetermination({
    runtime,
    answeredPoolItemIds: responses.map(({ poolItemId }) => poolItemId),
    coverageStatusByLeaf: new Map(
      attempt.estimates.flatMap((estimate) =>
        estimate.nodeKind === DB.AdaptiveEstimateNodeKind.SUBCOMPETENCE &&
        estimate.nodeId !== null
          ? [[estimate.nodeId, estimate.coverageStatus] as const]
          : []
      )
    ),
  })

  for (const [index, definition] of accumulator.definitions.entries()) {
    const estimate = estimates.get(
      estimateKey(definition.nodeKind, definition.nodeId)
    )
    const metric = accumulator.distributions[index]!
    const classification = resultClassification({ attempt, estimate })
    if (
      !estimate ||
      estimate.responseCount < MIN_REPORTING_RESPONSES ||
      estimate.theta === null ||
      estimate.standardError === null
    ) {
      metric.insufficientDataCount += 1
    }
    if (
      definition.nodeId !== null &&
      (!estimate || estimate.responseCount === 0)
    ) {
      metric.notTestedCount += 1
      if (
        estimate?.coverageStatus === DB.AdaptiveLeafCoverageStatus.OUT_OF_RANGE
      ) {
        metric.outOfRangeCount += 1
      }
    }
    // Each estimate uses its own interval and descendant-leaf coverage.
    const usable =
      estimate &&
      estimate.responseCount >= MIN_REPORTING_RESPONSES &&
      estimate.theta !== null &&
      Number.isFinite(estimate.theta) &&
      estimate.standardError !== null &&
      Number.isFinite(estimate.standardError) &&
      estimate.standardError >= 0 &&
      estimate.levelId !== null &&
      classification !== DB.AdaptiveResultStatus.RESEARCH_ONLY
    if (usable) {
      const levelId = runtimeLevelIdForStoredLevel(runtime, estimate.levelId!)
      if (runtime.algorithm.levels.some((level) => level.id === levelId)) {
        metric.levelCounts.set(
          levelId,
          (metric.levelCounts.get(levelId) ?? 0) + 1
        )
        const determined =
          attempt.measurementVersion === DB.AdaptiveMeasurementVersion.IRT_V1
            ? determination.isDetermined(definition.nodeId, {
                theta: estimate.theta!,
                standardError: estimate.standardError!,
                stopReason: estimate.stopReason,
              })
            : classification === DB.AdaptiveResultStatus.CLASSIFIED
        if (determined)
          metric.determinedCounts.set(
            levelId,
            (metric.determinedCounts.get(levelId) ?? 0) + 1
          )
      }
    }
    incrementClassification(metric.classifications, classification)
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
  const classificationRelease = releaseAdaptiveCategoricalMetric({
    field: 'RESULT_CLASSIFICATION',
    cells: Object.values(DB.AdaptiveResultStatus).map(
      (status) => accumulator.classifications[status]
    ),
    value: accumulator.classifications,
  })
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
  }
  const suppressions = compactAdaptivePrivacySuppressions([
    classificationRelease.suppression,
    ...Object.values(fields).map(({ suppression }) => suppression),
  ])
  const classifications = classificationRelease.value
  return {
    suppressed: hasAdaptivePrivacyWithholding(suppressions),
    suppressions,
    classified:
      classifications?.[DB.AdaptiveResultStatus.CLASSIFIED] ??
      fields.classified.value,
    betweenLevels:
      classifications?.[DB.AdaptiveResultStatus.BETWEEN_LEVELS] ?? null,
    insufficientEvidence:
      classifications?.[DB.AdaptiveResultStatus.INSUFFICIENT_EVIDENCE] ?? null,
    poolLimited:
      classifications?.[DB.AdaptiveResultStatus.POOL_LIMITED] ?? null,
    researchOnly:
      classifications?.[DB.AdaptiveResultStatus.RESEARCH_ONLY] ?? null,
    capped: fields.capped.value,
    poolExhausted: fields.poolExhausted.value,
    stoppedInsufficientData: fields.stoppedInsufficientData.value,
    insufficientData: fields.insufficientData.value,
    nearBoundary: null,
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
      determinedCount: metric.determinedCounts.get(level.id) ?? 0,
    }))
    const release = releaseAdaptiveCategoricalMetric({
      field: 'DISTRIBUTION',
      cells: [
        ...buckets.map(({ count }) => count),
        metric.classifications[DB.AdaptiveResultStatus.BETWEEN_LEVELS],
        metric.classifications[DB.AdaptiveResultStatus.INSUFFICIENT_EVIDENCE],
        metric.classifications[DB.AdaptiveResultStatus.POOL_LIMITED],
        metric.classifications[DB.AdaptiveResultStatus.RESEARCH_ONLY],
      ],
      value: {
        classifiedCount:
          metric.classifications[DB.AdaptiveResultStatus.CLASSIFIED],
        betweenLevelsCount:
          metric.classifications[DB.AdaptiveResultStatus.BETWEEN_LEVELS],
        insufficientEvidenceCount:
          metric.classifications[DB.AdaptiveResultStatus.INSUFFICIENT_EVIDENCE],
        poolLimitedCount:
          metric.classifications[DB.AdaptiveResultStatus.POOL_LIMITED],
        researchOnlyCount:
          metric.classifications[DB.AdaptiveResultStatus.RESEARCH_ONLY],
        insufficientDataCount: metric.insufficientDataCount,
        buckets,
      },
    })
    const insufficientDataRelease = releaseAdaptiveBinaryMetric({
      field: 'INSUFFICIENT_DATA',
      total: accumulator.total,
      positive: metric.insufficientDataCount,
      value: metric.insufficientDataCount,
    })
    const suppressions = compactAdaptivePrivacySuppressions([
      release.suppression,
      insufficientDataRelease.suppression,
    ])
    const withheld = hasAdaptivePrivacyWithholding(suppressions)
    return {
      ...definition,
      suppressed: withheld,
      suppressions,
      classifiedCount: withheld
        ? null
        : (release.value?.classifiedCount ?? null),
      betweenLevelsCount: withheld
        ? null
        : (release.value?.betweenLevelsCount ?? null),
      insufficientEvidenceCount: withheld
        ? null
        : (release.value?.insufficientEvidenceCount ?? null),
      poolLimitedCount: withheld
        ? null
        : (release.value?.poolLimitedCount ?? null),
      researchOnlyCount: withheld
        ? null
        : (release.value?.researchOnlyCount ?? null),
      insufficientDataCount: withheld ? null : insufficientDataRelease.value,
      // Not-tested attempts are a subset of the insufficient-data partition
      // and follow its release decision.
      notTestedCount:
        withheld || insufficientDataRelease.value === null
          ? null
          : metric.notTestedCount,
      outOfRangeCount:
        withheld || insufficientDataRelease.value === null
          ? null
          : metric.outOfRangeCount,
      buckets: withheld ? [] : (release.value?.buckets ?? []),
    }
  })
}

function emptyClassificationCounts(): Record<DB.AdaptiveResultStatus, number> {
  return {
    [DB.AdaptiveResultStatus.CLASSIFIED]: 0,
    [DB.AdaptiveResultStatus.BETWEEN_LEVELS]: 0,
    [DB.AdaptiveResultStatus.INSUFFICIENT_EVIDENCE]: 0,
    [DB.AdaptiveResultStatus.POOL_LIMITED]: 0,
    [DB.AdaptiveResultStatus.RESEARCH_ONLY]: 0,
  }
}

function incrementClassification(
  counts: Record<DB.AdaptiveResultStatus, number>,
  classification: DB.AdaptiveResultStatus
) {
  counts[classification] += 1
}

function resultClassification({
  attempt,
  estimate,
}: {
  attempt: AdaptiveCohortAttemptRecord
  estimate: AdaptiveCohortAttemptRecord['estimates'][number] | undefined
}) {
  if (estimate?.resultStatus) return estimate.resultStatus
  if (attempt.resultStatus) return attempt.resultStatus
  if (
    attempt.measurementVersion ===
    DB.AdaptiveMeasurementVersion.IRT_V2_EAP_GRID_1
  ) {
    return DB.AdaptiveResultStatus.INSUFFICIENT_EVIDENCE
  }
  if (
    estimate &&
    estimate.responseCount >= MIN_REPORTING_RESPONSES &&
    estimate.levelId !== null &&
    (attempt.stopReason === DB.AdaptivePracticeQuizStopReason.CLASSIFIED ||
      attempt.stopReason ===
        DB.AdaptivePracticeQuizStopReason.ALL_ROOTS_CLASSIFIED)
  ) {
    return DB.AdaptiveResultStatus.CLASSIFIED
  }
  return attempt.stopReason === DB.AdaptivePracticeQuizStopReason.POOL_EXHAUSTED
    ? DB.AdaptiveResultStatus.POOL_LIMITED
    : DB.AdaptiveResultStatus.INSUFFICIENT_EVIDENCE
}

function runtimeLevelIdForStoredLevel(
  runtime: AdaptiveCohortRuntime,
  storedLevelId: number
) {
  if (
    runtime.publication.measurementVersion ===
    DB.AdaptiveMeasurementVersion.IRT_V1
  ) {
    return storedLevelId
  }
  return (
    runtime.publication.cutScoreSnapshot.find(
      ({ sourceLevelId }) => sourceLevelId === storedLevelId
    )?.scaleLevelId ?? storedLevelId
  )
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
