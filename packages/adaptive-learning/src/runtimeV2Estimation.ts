import { classifyPosterior } from './classification.js'
import { combineWeightedPosteriors } from './composite.js'
import { type AdaptivePosterior, estimateEapPosterior } from './posterior.js'
import {
  type AdaptiveRuntimeNode,
  type AdaptiveRuntimeResponse,
  type AdaptiveRuntimeStopReason,
  MIN_ADAPTIVE_REPORTING_RESPONSES,
} from './runtime.js'
import type {
  AdaptiveV2Estimate,
  AdaptiveV2Estimates,
  PreparedAdaptiveV2Runtime,
} from './runtimeV2.js'
import type { AdaptiveV2PoolItem } from './selectionV2.js'

export type AdaptiveV2ResponseCounts = {
  byNode: Map<number, number>
  byLeaf: Map<number, number>
  evidenceByNode: Map<number, number>
  evidenceByLeaf: Map<number, number>
  totalAdministered: number
}

export function countAdaptiveV2Responses(
  responses: AdaptiveRuntimeResponse<AdaptiveV2PoolItem>[]
): AdaptiveV2ResponseCounts {
  const byNode = new Map<number, number>()
  const byLeaf = new Map<number, number>()
  const evidenceByNode = new Map<number, number>()
  const evidenceByLeaf = new Map<number, number>()
  for (const response of responses) {
    increment(byLeaf, response.poolItem.leafNodeId)
    for (const nodeId of response.poolItem.nodePath) increment(byNode, nodeId)
    if (response.poolItem.contributesToEstimate) {
      increment(evidenceByLeaf, response.poolItem.leafNodeId)
      for (const nodeId of response.poolItem.nodePath) {
        increment(evidenceByNode, nodeId)
      }
    }
  }
  return {
    byNode,
    byLeaf,
    evidenceByNode,
    evidenceByLeaf,
    totalAdministered: responses.length,
  }
}

export function computeAdaptiveV2Estimates({
  runtime,
  responses,
  eligibleScoringItems,
  counts,
  terminalReason,
}: {
  runtime: PreparedAdaptiveV2Runtime
  responses: AdaptiveRuntimeResponse<AdaptiveV2PoolItem>[]
  eligibleScoringItems: AdaptiveV2PoolItem[]
  counts: AdaptiveV2ResponseCounts
  terminalReason: AdaptiveRuntimeStopReason | null
}): AdaptiveV2Estimates {
  const evidenceByNode = new Map<
    number,
    AdaptiveRuntimeResponse<AdaptiveV2PoolItem>[]
  >()
  for (const response of responses) {
    if (!response.poolItem.contributesToEstimate) continue
    for (const nodeId of response.poolItem.nodePath) {
      appendToMap(evidenceByNode, nodeId, response)
    }
  }

  const nodeEstimates = new Map<number, AdaptiveV2Estimate>()
  for (const node of runtime.nodes) {
    const evidence = evidenceByNode.get(node.id) ?? []
    const posterior = estimateEapPosterior({
      responses: evidence.map(toScoredResponse),
      scale: runtime.scale,
      credibleMass: runtime.settings.credibleMass,
    })
    const evidenceState = computeEvidenceState({
      node,
      runtime,
      counts,
      eligibleScoringItems,
    })
    nodeEstimates.set(
      node.id,
      buildEstimate({
        nodeKind: node.kind === 'COMPETENCE' ? 'COMPETENCE' : 'SUBCOMPETENCE',
        nodeId: node.id,
        posterior,
        responseCount: evidence.length,
        administeredResponseCount: counts.byNode.get(node.id) ?? 0,
        evidenceState,
        runtime,
        terminalReason,
      })
    )
  }

  const overallPosterior = combineWeightedPosteriors({
    entries: runtime.roots.map((root) => ({
      key: String(root.id),
      posterior: nodeEstimates.get(root.id)!.posterior,
      weight: root.weight!,
    })),
    scale: runtime.scale,
    credibleMass: runtime.settings.credibleMass,
  })
  const rootEstimates = runtime.roots.map((root) => nodeEstimates.get(root.id)!)
  const allRootsClassified = rootEstimates.every(
    ({ resultStatus }) => resultStatus === 'CLASSIFIED'
  )
  const overallEvidenceState = {
    satisfied: rootEstimates.every(
      ({ evidenceSatisfied }) => evidenceSatisfied
    ),
    reachable: rootEstimates.every(
      ({ evidenceReachable }) => evidenceReachable
    ),
    calibratedCoverageSatisfied: rootEstimates.every(
      ({ calibratedCoverageSatisfied }) => calibratedCoverageSatisfied
    ),
  }
  const overall = buildEstimate({
    nodeKind: 'OVERALL',
    nodeId: null,
    posterior: overallPosterior,
    responseCount: responses.filter(
      ({ poolItem }) => poolItem.contributesToEstimate
    ).length,
    administeredResponseCount: responses.length,
    evidenceState: overallEvidenceState,
    classificationGateSatisfied: allRootsClassified,
    runtime,
    terminalReason,
  })

  return { overall, nodes: nodeEstimates }
}

function buildEstimate({
  nodeKind,
  nodeId,
  posterior,
  responseCount,
  administeredResponseCount,
  evidenceState,
  classificationGateSatisfied = true,
  runtime,
  terminalReason,
}: {
  nodeKind: AdaptiveV2Estimate['nodeKind']
  nodeId: number | null
  posterior: AdaptivePosterior
  responseCount: number
  administeredResponseCount: number
  evidenceState: EvidenceState
  classificationGateSatisfied?: boolean
  runtime: PreparedAdaptiveV2Runtime
  terminalReason: AdaptiveRuntimeStopReason | null
}): AdaptiveV2Estimate {
  if (runtime.settings.mode === 'RESEARCH') {
    return {
      nodeKind,
      nodeId,
      posterior,
      responseCount,
      administeredResponseCount,
      classifiedLevelId: null,
      classificationProbability: null,
      resultStatus: 'RESEARCH_ONLY',
      leadingLevelIds: [],
      evidenceSatisfied: evidenceState.satisfied,
      evidenceReachable: evidenceState.reachable,
      calibratedCoverageSatisfied: evidenceState.calibratedCoverageSatisfied,
      stopReason: terminalReason,
    }
  }

  const classification = classifyPosterior({
    posterior,
    scale: runtime.scale,
    credibleMass: runtime.settings.credibleMass,
    probabilityThreshold: runtime.settings.classificationProbabilityThreshold,
    evidenceSatisfied: evidenceState.satisfied,
    evidenceReachable: evidenceState.reachable,
    calibratedCoverageSatisfied: evidenceState.calibratedCoverageSatisfied,
    integritySatisfied: true,
    terminalReason,
  })
  const gatedClassification =
    !classificationGateSatisfied && classification.status === 'CLASSIFIED'
      ? {
          status: evidenceState.reachable
            ? ('INSUFFICIENT_EVIDENCE' as const)
            : ('POOL_LIMITED' as const),
          levelId: null,
          probability: 0,
          leadingLevelIds: [],
        }
      : classification
  return {
    nodeKind,
    nodeId,
    posterior,
    responseCount,
    administeredResponseCount,
    classifiedLevelId: gatedClassification.levelId,
    classificationProbability:
      gatedClassification.status === 'CLASSIFIED' ||
      gatedClassification.status === 'BETWEEN_LEVELS'
        ? gatedClassification.probability
        : null,
    resultStatus: gatedClassification.status,
    leadingLevelIds: gatedClassification.leadingLevelIds,
    evidenceSatisfied: evidenceState.satisfied,
    evidenceReachable: evidenceState.reachable,
    calibratedCoverageSatisfied: evidenceState.calibratedCoverageSatisfied,
    stopReason: terminalReason,
  }
}

function computeEvidenceState({
  node,
  runtime,
  counts,
  eligibleScoringItems,
}: {
  node: AdaptiveRuntimeNode
  runtime: PreparedAdaptiveV2Runtime
  counts: AdaptiveV2ResponseCounts
  eligibleScoringItems: AdaptiveV2PoolItem[]
}): EvidenceState {
  const leafIds = runtime.descendantLeafIdsByNode.get(node.id) ?? []
  const requiredNodeResponses =
    node.parentId === null
      ? runtime.settings.minimumRootResponses
      : Math.max(
          MIN_ADAPTIVE_REPORTING_RESPONSES,
          node.id === leafIds[0] ? runtime.settings.minQuestionsPerLeaf : 0
        )
  const poolScoringByLeaf = groupBy(
    runtime.pool.filter(({ contributesToEstimate }) => contributesToEstimate),
    ({ leafNodeId }) => leafNodeId
  )
  const eligibleByLeaf = groupBy(
    eligibleScoringItems,
    ({ leafNodeId }) => leafNodeId
  )
  const calibratedCoverageSatisfied =
    leafIds.every(
      (leafId) =>
        (poolScoringByLeaf.get(leafId)?.length ?? 0) >=
        runtime.settings.minQuestionsPerLeaf
    ) &&
    leafIds.reduce(
      (sum, leafId) => sum + (poolScoringByLeaf.get(leafId)?.length ?? 0),
      0
    ) >= requiredNodeResponses
  const satisfied =
    leafIds.every(
      (leafId) =>
        (counts.evidenceByLeaf.get(leafId) ?? 0) >=
        runtime.settings.minQuestionsPerLeaf
    ) && (counts.evidenceByNode.get(node.id) ?? 0) >= requiredNodeResponses
  const leafReachable = leafIds.every(
    (leafId) =>
      (counts.evidenceByLeaf.get(leafId) ?? 0) +
        (eligibleByLeaf.get(leafId)?.length ?? 0) >=
      runtime.settings.minQuestionsPerLeaf
  )
  const remainingForNode = eligibleScoringItems.filter((item) =>
    item.nodePath.includes(node.id)
  ).length
  const totalReachable =
    (counts.evidenceByNode.get(node.id) ?? 0) + remainingForNode >=
    requiredNodeResponses
  const capReachable = descendantsHaveCapCapacity({
    node,
    leafIds,
    requiredNodeResponses,
    runtime,
    counts,
  })

  return {
    satisfied,
    reachable: satisfied || (leafReachable && totalReachable && capReachable),
    calibratedCoverageSatisfied,
  }
}

function descendantsHaveCapCapacity({
  node,
  leafIds,
  requiredNodeResponses,
  runtime,
  counts,
}: {
  node: AdaptiveRuntimeNode
  leafIds: readonly number[]
  requiredNodeResponses: number
  runtime: PreparedAdaptiveV2Runtime
  counts: AdaptiveV2ResponseCounts
}) {
  const nodeEvidenceDeficit = Math.max(
    requiredNodeResponses - (counts.evidenceByNode.get(node.id) ?? 0),
    0
  )
  const leafEvidenceDeficit = leafIds.reduce(
    (sum, leafId) =>
      sum +
      Math.max(
        runtime.settings.minQuestionsPerLeaf -
          (counts.evidenceByLeaf.get(leafId) ?? 0),
        0
      ),
    0
  )
  if (
    Math.max(nodeEvidenceDeficit, leafEvidenceDeficit) >
    runtime.settings.totalQuestionCap - counts.totalAdministered
  ) {
    return false
  }
  for (const ancestorId of runtime.nodePathById.get(node.id) ?? []) {
    const ancestor = runtime.nodesById.get(ancestorId)!
    if (
      ancestor.questionCap !== null &&
      Math.max(nodeEvidenceDeficit, leafEvidenceDeficit) >
        ancestor.questionCap - (counts.byNode.get(ancestor.id) ?? 0)
    ) {
      return false
    }
  }
  for (const candidate of runtime.nodes) {
    if (!runtime.nodePathById.get(candidate.id)?.includes(node.id)) continue
    if (candidate.questionCap === null) continue
    const descendantLeaves =
      runtime.descendantLeafIdsByNode.get(candidate.id) ?? []
    const deficit = descendantLeaves.reduce(
      (sum, leafId) =>
        sum +
        Math.max(
          runtime.settings.minQuestionsPerLeaf -
            (counts.evidenceByLeaf.get(leafId) ?? 0),
          0
        ),
      0
    )
    const remainingCap =
      candidate.questionCap - (counts.byNode.get(candidate.id) ?? 0)
    const requiredDeficit =
      candidate.id === node.id
        ? Math.max(deficit, nodeEvidenceDeficit)
        : deficit
    if (requiredDeficit > remainingCap) return false
  }
  if (runtime.settings.perLeafQuestionCap !== null) {
    for (const leafId of leafIds) {
      const deficit = Math.max(
        runtime.settings.minQuestionsPerLeaf -
          (counts.evidenceByLeaf.get(leafId) ?? 0),
        0
      )
      const remainingCap =
        runtime.settings.perLeafQuestionCap - (counts.byLeaf.get(leafId) ?? 0)
      if (deficit > remainingCap) return false
    }
  }
  return true
}

function toScoredResponse(
  response: AdaptiveRuntimeResponse<AdaptiveV2PoolItem>
) {
  const item = response.poolItem
  return {
    item: {
      id: item.id,
      itemType: item.itemType,
      choiceCount: item.choiceCount,
      model: item.model,
      calibrationId: item.calibrationId!,
      discrimination: item.discrimination,
      difficulty: item.difficulty,
      guessing: item.guessing,
    },
    correct: response.correct,
  }
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

function increment(map: Map<number, number>, key: number) {
  map.set(key, (map.get(key) ?? 0) + 1)
}

type EvidenceState = {
  satisfied: boolean
  reachable: boolean
  calibratedCoverageSatisfied: boolean
}
