import {
  type AdaptiveMeasurementVersion,
  AdaptiveRuntimeConfigurationError,
  resolveAdaptiveEstimator,
} from './estimator.js'
import type { AdaptivePosterior } from './posterior.js'
import type {
  AdaptiveRuntimeNode,
  AdaptiveRuntimeResponse,
  AdaptiveRuntimeSettings,
  AdaptiveRuntimeStopReason,
} from './runtime.js'
import {
  type AdaptiveV2ResponseCounts,
  computeAdaptiveV2Estimates,
  countAdaptiveV2Responses,
} from './runtimeV2Estimation.js'
import {
  buildPreparedAdaptiveV2Runtime,
  isPreparedAdaptiveV2Runtime,
} from './runtimeV2Preparation.js'
import type { AdaptiveScaleDefinition } from './scale.js'
import {
  type AdaptiveV2LeafSelectionState,
  type AdaptiveV2Mode,
  type AdaptiveV2PoolItem,
  type AdaptiveV2ResearchPolicy,
  type AdaptiveV2SelectionContext,
  selectAdaptiveV2Item,
} from './selectionV2.js'

export type AdaptiveV2RuntimeSettings = AdaptiveRuntimeSettings & {
  mode: AdaptiveV2Mode
  credibleMass: number
  classificationProbabilityThreshold: number
  minimumRootResponses: number
  researchPolicy: AdaptiveV2ResearchPolicy | null
}

export type AdaptiveV2ResultStatus =
  | 'CLASSIFIED'
  | 'BETWEEN_LEVELS'
  | 'INSUFFICIENT_EVIDENCE'
  | 'POOL_LIMITED'
  | 'RESEARCH_ONLY'

export type AdaptiveV2Estimate = {
  nodeKind: 'OVERALL' | 'COMPETENCE' | 'SUBCOMPETENCE'
  nodeId: number | null
  posterior: AdaptivePosterior
  responseCount: number
  administeredResponseCount: number
  classifiedLevelId: number | null
  classificationProbability: number | null
  resultStatus: AdaptiveV2ResultStatus
  leadingLevelIds: number[]
  evidenceSatisfied: boolean
  evidenceReachable: boolean
  calibratedCoverageSatisfied: boolean
  stopReason: AdaptiveRuntimeStopReason | null
}

export type AdaptiveV2Estimates = {
  overall: AdaptiveV2Estimate
  nodes: Map<number, AdaptiveV2Estimate>
}

export type PreparedAdaptiveV2Runtime = Readonly<{
  measurementVersion: 'IRT_V2_EAP_GRID_1'
  nodes: readonly AdaptiveRuntimeNode[]
  scale: AdaptiveScaleDefinition
  pool: readonly AdaptiveV2PoolItem[]
  settings: AdaptiveV2RuntimeSettings
  roots: readonly AdaptiveRuntimeNode[]
  nodesById: ReadonlyMap<number, AdaptiveRuntimeNode>
  poolById: ReadonlyMap<number, AdaptiveV2PoolItem>
  poolByLeaf: ReadonlyMap<number, readonly AdaptiveV2PoolItem[]>
  nodePathById: ReadonlyMap<number, readonly number[]>
  descendantLeafIdsByNode: ReadonlyMap<number, readonly number[]>
  effectiveLeafWeights: ReadonlyMap<number, number>
}>

export type AdaptiveV2Decision = {
  nextPoolItem: AdaptiveV2PoolItem | null
  stopReason: AdaptiveRuntimeStopReason | null
  resultStatus: AdaptiveV2ResultStatus | null
  selection: {
    role: AdaptiveV2PoolItem['role']
    conditionalAdministrationProbability: number
    collectionDesignVersion: string | null
    randomizationVersion: string
    randomDraw: number
    candidateSetHash: string
  } | null
  estimates: AdaptiveV2Estimates
}

export function prepareAdaptiveV2Runtime({
  nodes,
  scale,
  pool,
  settings,
  measurementVersion = 'IRT_V2_EAP_GRID_1',
}: {
  nodes: AdaptiveRuntimeNode[]
  scale: AdaptiveScaleDefinition
  pool: AdaptiveV2PoolItem[]
  settings: AdaptiveV2RuntimeSettings
  measurementVersion?: AdaptiveMeasurementVersion
}): PreparedAdaptiveV2Runtime {
  const estimator = resolveAdaptiveEstimator(measurementVersion)
  if (estimator.version !== 'IRT_V2_EAP_GRID_1') {
    throw configurationError(
      'The Bayesian adaptive runtime requires the IRT_V2_EAP_GRID_1 estimator.',
      'ADAPTIVE_ESTIMATOR_RUNTIME_MISMATCH'
    )
  }
  return buildPreparedAdaptiveV2Runtime({ nodes, scale, pool, settings })
}

export function advanceAdaptiveV2Runtime({
  attemptId,
  runtime,
  responses,
  selectionContext = {},
}: {
  attemptId: string
  runtime: PreparedAdaptiveV2Runtime
  responses: AdaptiveRuntimeResponse<AdaptiveV2PoolItem>[]
  selectionContext?: AdaptiveV2SelectionContext
}): AdaptiveV2Decision {
  assertPreparedV2Runtime(runtime)
  if (typeof attemptId !== 'string' || attemptId.trim().length === 0) {
    throw configurationError(
      'Adaptive attempt ID must not be empty.',
      'ADAPTIVE_ATTEMPT_ID_INVALID'
    )
  }
  assertSelectionContext(runtime, selectionContext)
  const canonicalResponses = canonicalizeResponses(runtime, responses)
  const counts = countAdaptiveV2Responses(canonicalResponses)
  const answeredIds = new Set(
    canonicalResponses.map(({ poolItemId }) => poolItemId)
  )
  const structurallyEligible = runtime.pool.filter((item) =>
    isStructurallyEligible({ item, runtime, answeredIds, counts })
  )
  const exposureEligible = structurallyEligible.filter((item) => {
    const eligible = selectionContext.isExposureEligible?.(item) ?? true
    if (typeof eligible !== 'boolean') {
      throw configurationError(
        'Exposure eligibility must be boolean.',
        'ADAPTIVE_EXPOSURE_STATE_INVALID'
      )
    }
    return eligible
  })

  const preliminary = computeAdaptiveV2Estimates({
    runtime,
    responses: canonicalResponses,
    eligibleScoringItems: exposureEligible.filter(
      ({ contributesToEstimate }) => contributesToEstimate
    ),
    counts,
    terminalReason: null,
  })

  let stopReason: AdaptiveRuntimeStopReason | null = null
  if (
    runtime.settings.mode === 'DIAGNOSTIC' &&
    runtime.roots.every(
      (root) => preliminary.nodes.get(root.id)?.resultStatus === 'CLASSIFIED'
    )
  ) {
    stopReason = 'ALL_ROOTS_CLASSIFIED'
  } else if (canonicalResponses.length >= runtime.settings.totalQuestionCap) {
    stopReason = 'TOTAL_QUESTION_CAP'
  }

  if (stopReason === null) {
    const selection = selectNextItem({
      attemptId,
      runtime,
      responses: canonicalResponses,
      counts,
      estimates: preliminary,
      eligibleItems: exposureEligible,
      selectionContext,
    })
    if (selection !== null) {
      return {
        nextPoolItem: selection.item,
        stopReason: null,
        resultStatus: null,
        selection: {
          role: selection.role,
          conditionalAdministrationProbability:
            selection.conditionalAdministrationProbability,
          collectionDesignVersion: selection.collectionDesignVersion,
          randomizationVersion: selection.randomizationVersion,
          randomDraw: selection.randomDraw,
          candidateSetHash: selection.candidateSetHash,
        },
        estimates: preliminary,
      }
    }
    stopReason = determineExhaustionReason({
      runtime,
      responses: canonicalResponses,
      structurallyEligible,
      exposureEligible,
    })
  }

  const terminalEstimates = computeAdaptiveV2Estimates({
    runtime,
    responses: canonicalResponses,
    eligibleScoringItems: exposureEligible.filter(
      ({ contributesToEstimate }) => contributesToEstimate
    ),
    counts,
    terminalReason: stopReason,
  })
  return {
    nextPoolItem: null,
    stopReason,
    resultStatus:
      runtime.settings.mode === 'RESEARCH'
        ? 'RESEARCH_ONLY'
        : terminalEstimates.overall.resultStatus,
    selection: null,
    estimates: terminalEstimates,
  }
}

function selectNextItem({
  attemptId,
  runtime,
  responses,
  counts,
  estimates,
  eligibleItems,
  selectionContext,
}: {
  attemptId: string
  runtime: PreparedAdaptiveV2Runtime
  responses: AdaptiveRuntimeResponse<AdaptiveV2PoolItem>[]
  counts: AdaptiveV2ResponseCounts
  estimates: AdaptiveV2Estimates
  eligibleItems: AdaptiveV2PoolItem[]
  selectionContext: AdaptiveV2SelectionContext
}) {
  const eligibleByLeaf = groupBy(eligibleItems, ({ leafNodeId }) => leafNodeId)
  const leaves: AdaptiveV2LeafSelectionState[] = []
  for (const [leafId, effectiveWeight] of runtime.effectiveLeafWeights) {
    const leafItems = eligibleByLeaf.get(leafId) ?? []
    if (leafItems.length === 0) continue
    const anchorResponsesByLevel = new Map(
      runtime.scale.levels.map((level) => [level.id, 0])
    )
    let fieldTestResponseCount = 0
    for (const response of responses) {
      if (response.poolItem.leafNodeId !== leafId) continue
      if (response.poolItem.role === 'FIELD_TEST') fieldTestResponseCount++
      if (response.poolItem.role === 'ANCHOR') {
        anchorResponsesByLevel.set(
          response.poolItem.levelId,
          (anchorResponsesByLevel.get(response.poolItem.levelId) ?? 0) + 1
        )
      }
    }
    if (
      runtime.settings.mode === 'RESEARCH' &&
      !hasSelectableResearchRole({
        items: leafItems,
        anchorResponsesByLevel,
        fieldTestResponseCount,
        policy: runtime.settings.researchPolicy!,
      })
    ) {
      continue
    }
    const path = runtime.nodePathById.get(leafId)!
    const rootId = path[0]!
    leaves.push({
      rootId,
      leafId,
      stableOrder: path.map((nodeId) => runtime.nodesById.get(nodeId)!.order),
      effectiveWeight,
      administeredResponseCount: counts.byLeaf.get(leafId) ?? 0,
      evidenceResponseCount: counts.evidenceByLeaf.get(leafId) ?? 0,
      rootEvidenceResponseCount: counts.evidenceByNode.get(rootId) ?? 0,
      posterior: estimates.nodes.get(leafId)!.posterior,
      eligibleItems: leafItems,
      anchorResponsesByLevel,
      fieldTestResponseCount,
    })
  }

  return selectAdaptiveV2Item({
    attemptId,
    responseOrder: responses.length + 1,
    mode: runtime.settings.mode,
    leaves,
    minQuestionsPerLeaf: runtime.settings.minQuestionsPerLeaf,
    totalQuestionCap: runtime.settings.totalQuestionCap,
    totalAdministeredResponses: responses.length,
    topInformationRatio: runtime.settings.topInformationRatio,
    researchPolicy: runtime.settings.researchPolicy,
    selectionContext: {
      ...selectionContext,
      isExposureEligible: undefined,
    },
  })
}

function assertPreparedV2Runtime(runtime: PreparedAdaptiveV2Runtime) {
  if (
    !isPreparedAdaptiveV2Runtime(runtime) ||
    runtime.measurementVersion !== 'IRT_V2_EAP_GRID_1'
  ) {
    throw configurationError(
      'The Bayesian adaptive runtime must be prepared by the IRT_V2_EAP_GRID_1 factory.',
      'ADAPTIVE_ESTIMATOR_RUNTIME_MISMATCH'
    )
  }
}

function assertSelectionContext(
  runtime: PreparedAdaptiveV2Runtime,
  context: AdaptiveV2SelectionContext
) {
  for (const [poolItemId, count] of context.servedCountByPoolItem ?? []) {
    if (
      !runtime.poolById.has(poolItemId) ||
      !Number.isInteger(count) ||
      count < 0
    ) {
      throw configurationError(
        'Adaptive pool exposure counts are invalid.',
        'ADAPTIVE_EXPOSURE_STATE_INVALID'
      )
    }
  }
  for (const poolItemId of context.priorAttemptPoolItemIds ?? []) {
    if (!runtime.poolById.has(poolItemId)) {
      throw configurationError(
        'Prior adaptive exposure identities are invalid.',
        'ADAPTIVE_EXPOSURE_STATE_INVALID'
      )
    }
  }
}

function canonicalizeResponses(
  runtime: PreparedAdaptiveV2Runtime,
  responses: AdaptiveRuntimeResponse<AdaptiveV2PoolItem>[]
) {
  const seenItems = new Set<number>()
  const canonicalResponses: AdaptiveRuntimeResponse<AdaptiveV2PoolItem>[] = []
  for (let index = 0; index < responses.length; index++) {
    const response = responses[index]!
    if (
      response.order !== index + 1 ||
      response.poolItemId !== response.poolItem.id ||
      typeof response.correct !== 'boolean' ||
      seenItems.has(response.poolItemId)
    ) {
      throw configurationError(
        'Adaptive responses are duplicated, out of order, or malformed.',
        'ADAPTIVE_RESPONSE_INVALID'
      )
    }
    const canonical = runtime.poolById.get(response.poolItemId)
    if (
      canonical === undefined ||
      !samePoolItem(canonical, response.poolItem)
    ) {
      throw configurationError(
        'Adaptive response pool identity does not match the prepared runtime.',
        'ADAPTIVE_RESPONSE_POOL_MISMATCH'
      )
    }
    const counts = countAdaptiveV2Responses(canonicalResponses)
    if (
      canonicalResponses.length >= runtime.settings.totalQuestionCap ||
      !isStructurallyEligible({
        item: canonical,
        runtime,
        answeredIds: seenItems,
        counts,
      })
    ) {
      throw configurationError(
        'Adaptive response history exceeds a configured question cap.',
        'ADAPTIVE_RESPONSE_CAP_EXCEEDED'
      )
    }
    assertResearchResponseOrder({
      runtime,
      responses: canonicalResponses,
      item: canonical,
    })
    seenItems.add(response.poolItemId)
    canonicalResponses.push({ ...response, poolItem: canonical })
  }
  return canonicalResponses
}

function assertResearchResponseOrder({
  runtime,
  responses,
  item,
}: {
  runtime: PreparedAdaptiveV2Runtime
  responses: AdaptiveRuntimeResponse<AdaptiveV2PoolItem>[]
  item: AdaptiveV2PoolItem
}) {
  if (runtime.settings.mode !== 'RESEARCH') return

  const policy = runtime.settings.researchPolicy!
  const anchorResponsesByLevel = new Map(
    runtime.scale.levels.map((level) => [level.id, 0])
  )
  for (const response of responses) {
    if (
      response.poolItem.leafNodeId === item.leafNodeId &&
      response.poolItem.role === 'ANCHOR'
    ) {
      anchorResponsesByLevel.set(
        response.poolItem.levelId,
        (anchorResponsesByLevel.get(response.poolItem.levelId) ?? 0) + 1
      )
    }
  }
  const requiredLevel = [...anchorResponsesByLevel]
    .filter(([, count]) => count < policy.anchorResponsesPerLeafLevel)
    .sort(
      ([leftLevel, leftCount], [rightLevel, rightCount]) =>
        leftCount - rightCount || leftLevel - rightLevel
    )[0]?.[0]
  if (
    requiredLevel !== undefined &&
    (item.role !== 'ANCHOR' || item.levelId !== requiredLevel)
  ) {
    throw configurationError(
      'Research response history violates mandatory anchor ordering.',
      'ADAPTIVE_RESEARCH_RESPONSE_ORDER_INVALID'
    )
  }
}

function isStructurallyEligible({
  item,
  runtime,
  answeredIds,
  counts,
}: {
  item: AdaptiveV2PoolItem
  runtime: PreparedAdaptiveV2Runtime
  answeredIds: ReadonlySet<number>
  counts: AdaptiveV2ResponseCounts
}) {
  if (answeredIds.has(item.id)) return false
  if (
    runtime.settings.perLeafQuestionCap !== null &&
    (counts.byLeaf.get(item.leafNodeId) ?? 0) >=
      runtime.settings.perLeafQuestionCap
  ) {
    return false
  }
  return item.nodePath.every((nodeId) => {
    const cap = runtime.nodesById.get(nodeId)!.questionCap
    return cap === null || (counts.byNode.get(nodeId) ?? 0) < cap
  })
}

function determineExhaustionReason({
  runtime,
  responses,
  structurallyEligible,
  exposureEligible,
}: {
  runtime: PreparedAdaptiveV2Runtime
  responses: AdaptiveRuntimeResponse<AdaptiveV2PoolItem>[]
  structurallyEligible: AdaptiveV2PoolItem[]
  exposureEligible: AdaptiveV2PoolItem[]
}): AdaptiveRuntimeStopReason {
  if (structurallyEligible.length > 0 && exposureEligible.length === 0) {
    return 'POOL_EXHAUSTED'
  }
  if (
    responses.every(({ poolItem }) => !poolItem.contributesToEstimate) &&
    exposureEligible.every((item) => !item.contributesToEstimate)
  ) {
    return 'INSUFFICIENT_DATA'
  }
  if (
    structurallyEligible.length === 0 &&
    responses.length < runtime.pool.length
  ) {
    return 'NODE_QUESTION_CAP'
  }
  return 'POOL_EXHAUSTED'
}

function hasSelectableResearchRole({
  items,
  anchorResponsesByLevel,
  fieldTestResponseCount,
  policy,
}: {
  items: AdaptiveV2PoolItem[]
  anchorResponsesByLevel: ReadonlyMap<number, number>
  fieldTestResponseCount: number
  policy: AdaptiveV2ResearchPolicy
}) {
  let hasAnchorDeficit = false
  for (const [levelId, count] of anchorResponsesByLevel) {
    if (count < policy.anchorResponsesPerLeafLevel) {
      hasAnchorDeficit = true
      if (
        items.some((item) => item.role === 'ANCHOR' && item.levelId === levelId)
      ) {
        return true
      }
    }
  }
  if (hasAnchorDeficit) return false
  if (
    fieldTestResponseCount < policy.fieldTestResponsesPerLeaf &&
    items.some((item) => item.role === 'FIELD_TEST')
  ) {
    return true
  }
  if (items.some((item) => item.role !== 'FIELD_TEST')) return true
  return false
}

function samePoolItem(left: AdaptiveV2PoolItem, right: AdaptiveV2PoolItem) {
  return (
    left.id === right.id &&
    left.leafNodeId === right.leafNodeId &&
    arraysEqual(left.nodePath, right.nodePath) &&
    left.levelId === right.levelId &&
    left.itemType === right.itemType &&
    left.choiceCount === right.choiceCount &&
    left.model === right.model &&
    left.calibrationId === right.calibrationId &&
    left.contributesToEstimate === right.contributesToEstimate &&
    left.role === right.role &&
    left.discrimination === right.discrimination &&
    left.difficulty === right.difficulty &&
    left.guessing === right.guessing
  )
}

function arraysEqual(left: readonly number[], right: readonly number[]) {
  return (
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  )
}

function appendToMap<K, V>(map: Map<K, V[]>, key: K, value: V) {
  const values = map.get(key) ?? []
  values.push(value)
  map.set(key, values)
}

function groupBy<K, V>(values: V[], key: (value: V) => K) {
  const grouped = new Map<K, V[]>()
  for (const value of values) appendToMap(grouped, key(value), value)
  return grouped
}

function configurationError(message: string, code: string) {
  return new AdaptiveRuntimeConfigurationError(message, code)
}
