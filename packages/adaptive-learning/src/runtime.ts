import {
  aggregateWeightedEstimates,
  classificationIntervalWithinLevelBand,
  information,
  mapThetaToLevel,
  normalizeAdaptiveEstimateForChart,
  updateTheta,
  type AdaptiveResponse,
  type LevelDefinition,
  type LevelMappingRule,
  type ThetaRange,
} from './core.js'
import {
  AdaptiveRuntimeConfigurationError,
  resolveAdaptiveEstimator,
  type AdaptiveMeasurementVersion,
} from './estimator.js'
import { normalizeEnabledRootWeights } from './weights.js'

export { AdaptiveRuntimeConfigurationError } from './estimator.js'

export const MIN_ADAPTIVE_REPORTING_RESPONSES = 4

export type AdaptiveRuntimeStopReason =
  | 'CLASSIFIED'
  | 'ALL_ROOTS_CLASSIFIED'
  | 'TOTAL_QUESTION_CAP'
  | 'NODE_QUESTION_CAP'
  | 'POOL_EXHAUSTED'
  | 'INSUFFICIENT_DATA'
  | 'ABANDONED'

export type AdaptiveRuntimeSettings = {
  totalQuestionCap: number
  perLeafQuestionCap: number | null
  minQuestionsPerLeaf: number
  classificationZ: number
  topInformationRatio: number
  levelMappingRule: LevelMappingRule
  thetaRange: ThetaRange
}

export type AdaptiveRuntimeLevel = LevelDefinition & {
  id: number
}

export type AdaptiveRuntimeNode = {
  id: number
  parentId: number | null
  kind: 'COMPETENCE' | 'SUBCOMPETENCE'
  depth: number
  order: number
  enabled: boolean
  weight: number | null
  questionCap: number | null
}

export type AdaptiveRuntimePoolItem = {
  id: number
  leafNodeId: number
  nodePath: readonly number[]
  levelId: number
  discrimination: number
  difficulty: number
  guessing: number
}

export type AdaptiveRuntimeResponse<
  TPoolItem extends AdaptiveRuntimePoolItem = AdaptiveRuntimePoolItem,
> = {
  order: number
  poolItemId: number
  correct: boolean
  poolItem: TPoolItem
}

export type AdaptiveRuntimeEstimate = {
  nodeKind: 'OVERALL' | 'COMPETENCE' | 'SUBCOMPETENCE'
  nodeId: number | null
  theta: number | null
  standardError: number | null
  responseCount: number
  levelId: number | null
  stopReason: AdaptiveRuntimeStopReason | null
}

export type AdaptiveRuntimeEstimates = {
  overall: AdaptiveRuntimeEstimate
  nodes: Map<number, AdaptiveRuntimeEstimate>
}

export type PreparedAdaptiveRuntime<
  TPoolItem extends AdaptiveRuntimePoolItem = AdaptiveRuntimePoolItem,
> = {
  measurementVersion: 'IRT_V1'
  nodes: AdaptiveRuntimeNode[]
  levels: AdaptiveRuntimeLevel[]
  pool: TPoolItem[]
  settings: AdaptiveRuntimeSettings
  enabledNodeIds: ReadonlySet<number>
  roots: AdaptiveRuntimeNode[]
  nodesById: ReadonlyMap<number, AdaptiveRuntimeNode>
  poolByRoot: ReadonlyMap<number, TPoolItem[]>
  poolByRootLeaf: ReadonlyMap<string, TPoolItem[]>
  leafIdsByRoot: ReadonlyMap<number, number[]>
}

export type AdaptiveRuntimeDecision<
  TPoolItem extends AdaptiveRuntimePoolItem = AdaptiveRuntimePoolItem,
> = {
  nextPoolItem: TPoolItem | null
  stopReason: AdaptiveRuntimeStopReason | null
  estimates: AdaptiveRuntimeEstimates
}

export function prepareAdaptiveRuntime<
  TPoolItem extends AdaptiveRuntimePoolItem,
>({
  nodes,
  levels,
  pool,
  settings,
  measurementVersion = 'IRT_V1',
}: {
  nodes: AdaptiveRuntimeNode[]
  levels: AdaptiveRuntimeLevel[]
  pool: TPoolItem[]
  settings: AdaptiveRuntimeSettings
  measurementVersion?: AdaptiveMeasurementVersion
}): PreparedAdaptiveRuntime<TPoolItem> {
  const estimator = resolveAdaptiveEstimator(measurementVersion)
  if (estimator.version !== 'IRT_V1') {
    throw new AdaptiveRuntimeConfigurationError(
      'The legacy adaptive runtime requires the IRT_V1 estimator.',
      'ADAPTIVE_ESTIMATOR_RUNTIME_MISMATCH'
    )
  }
  const enabledNodeIds = getEffectivelyEnabledNodes(nodes)
  const roots = normalizeRuntimeRootWeights(
    getEnabledRoots(nodes, enabledNodeIds)
  )

  const poolByRoot = new Map<number, TPoolItem[]>()
  const poolByRootLeaf = new Map<string, TPoolItem[]>()
  const leafIdsByRoot = new Map<number, Set<number>>()
  for (const item of pool) {
    const rootId = item.nodePath[0]
    if (typeof rootId !== 'number') continue
    appendToMap(poolByRoot, rootId, item)
    appendToMap(poolByRootLeaf, rootLeafKey(rootId, item.leafNodeId), item)
    const leafIds = leafIdsByRoot.get(rootId) ?? new Set<number>()
    leafIds.add(item.leafNodeId)
    leafIdsByRoot.set(rootId, leafIds)
  }

  return {
    measurementVersion: 'IRT_V1',
    nodes,
    levels,
    pool,
    settings,
    enabledNodeIds,
    roots,
    nodesById: new Map(nodes.map((node) => [node.id, node])),
    poolByRoot,
    poolByRootLeaf,
    leafIdsByRoot: new Map(
      [...leafIdsByRoot].map(([rootId, leafIds]) => [
        rootId,
        [...leafIds].sort((left, right) => left - right),
      ])
    ),
  }
}

export function computeAdaptiveRuntimeEstimates<
  TPoolItem extends AdaptiveRuntimePoolItem,
>({
  nodes,
  levels,
  responses,
  settings,
  terminalStopReason = null,
}: {
  nodes: AdaptiveRuntimeNode[]
  levels: AdaptiveRuntimeLevel[]
  responses: AdaptiveRuntimeResponse<TPoolItem>[]
  settings: AdaptiveRuntimeSettings
  terminalStopReason?: AdaptiveRuntimeStopReason | null
}): AdaptiveRuntimeEstimates {
  const enabledNodeIds = getEffectivelyEnabledNodes(nodes)
  const roots = normalizeRuntimeRootWeights(
    getEnabledRoots(nodes, enabledNodeIds)
  )

  return computeEstimates({
    nodes,
    levels,
    responses,
    settings,
    terminalStopReason,
    enabledNodeIds,
    roots,
  })
}

export function advanceAdaptiveRuntime<
  TPoolItem extends AdaptiveRuntimePoolItem,
>({
  attemptId,
  runtime,
  responses,
}: {
  attemptId: string
  runtime: PreparedAdaptiveRuntime<TPoolItem>
  responses: AdaptiveRuntimeResponse<TPoolItem>[]
}): AdaptiveRuntimeDecision<TPoolItem> {
  if (runtime.measurementVersion !== 'IRT_V1') {
    throw new AdaptiveRuntimeConfigurationError(
      'The legacy adaptive runtime requires the IRT_V1 estimator.',
      'ADAPTIVE_ESTIMATOR_RUNTIME_MISMATCH'
    )
  }
  const estimates = computeEstimates({
    nodes: runtime.nodes,
    levels: runtime.levels,
    responses,
    settings: runtime.settings,
    terminalStopReason: null,
    enabledNodeIds: runtime.enabledNodeIds,
    roots: runtime.roots,
  })
  const countsByNode = countResponsesByNode(responses)
  const countsByLeaf = countResponsesByLeaf(responses)
  const answeredPoolIds = new Set(responses.map(({ poolItemId }) => poolItemId))
  const eligibleByRoot = new Map<number, TPoolItem[]>()
  const eligibleByRootLeaf = new Map<string, TPoolItem[]>()

  for (const item of runtime.pool) {
    if (
      !isEligiblePoolItem({
        item,
        answeredPoolIds,
        enabledNodeIds: runtime.enabledNodeIds,
        nodesById: runtime.nodesById,
        countsByNode,
        countsByLeaf,
        perLeafQuestionCap: runtime.settings.perLeafQuestionCap,
      })
    ) {
      continue
    }
    const rootId = item.nodePath[0]
    if (typeof rootId !== 'number') continue
    appendToMap(eligibleByRoot, rootId, item)
    appendToMap(eligibleByRootLeaf, rootLeafKey(rootId, item.leafNodeId), item)
  }

  const rootStates = runtime.roots.map((root) =>
    getRootState({
      root,
      leafIds: runtime.leafIdsByRoot.get(root.id) ?? [],
      hasEligibleItem: (eligibleByRoot.get(root.id)?.length ?? 0) > 0,
      countsByLeaf,
      estimate: estimates.nodes.get(root.id)!,
      levels: runtime.levels,
      settings: runtime.settings,
    })
  )

  if (rootStates.every(({ classified }) => classified)) {
    return {
      nextPoolItem: null,
      stopReason: 'ALL_ROOTS_CLASSIFIED',
      estimates,
    }
  }
  if (responses.length >= runtime.settings.totalQuestionCap) {
    return {
      nextPoolItem: null,
      stopReason: 'TOTAL_QUESTION_CAP',
      estimates,
    }
  }

  const activeRoots = rootStates.filter(
    ({ classified, hasEligibleItem }) => !classified && hasEligibleItem
  )
  if (activeRoots.length === 0) {
    const hasUnservedItem = runtime.pool.some(
      (item) => !answeredPoolIds.has(item.id)
    )
    const anyRootWithoutEvidence = rootStates.some(
      ({ estimate }) => estimate.responseCount === 0
    )
    return {
      nextPoolItem: null,
      stopReason: anyRootWithoutEvidence
        ? 'INSUFFICIENT_DATA'
        : hasUnservedItem
          ? 'NODE_QUESTION_CAP'
          : 'POOL_EXHAUSTED',
      estimates,
    }
  }

  const selected = selectRootAndLeaf({
    activeRoots,
    eligibleByRootLeaf,
    responses,
    countsByLeaf,
    settings: runtime.settings,
  })
  const candidates =
    eligibleByRootLeaf.get(rootLeafKey(selected.rootId, selected.leafId)) ?? []
  const routingTheta = computeRoutingTheta(
    responses.filter(
      ({ poolItem }) => poolItem.nodePath[0] === selected.rootId
    ),
    runtime.settings.thetaRange
  )
  const nextPoolItem = selectDeterministicInformationCandidate({
    attemptId,
    responseOrder: responses.length + 1,
    theta: routingTheta,
    items: candidates,
    topInformationRatio: runtime.settings.topInformationRatio,
  })

  return { nextPoolItem, stopReason: null, estimates }
}

export function normalizeAdaptiveRuntimeEstimateForChart({
  estimate,
  settings,
}: {
  estimate: Pick<AdaptiveRuntimeEstimate, 'theta' | 'standardError'>
  settings: Pick<AdaptiveRuntimeSettings, 'thetaRange' | 'classificationZ'>
}) {
  if (estimate.theta === null || estimate.standardError === null) return null
  return normalizeAdaptiveEstimateForChart({
    theta: estimate.theta,
    standardError: estimate.standardError,
    range: settings.thetaRange,
    z: settings.classificationZ,
  })
}

function computeEstimates<TPoolItem extends AdaptiveRuntimePoolItem>({
  nodes,
  levels,
  responses,
  settings,
  terminalStopReason,
  enabledNodeIds,
  roots,
}: {
  nodes: AdaptiveRuntimeNode[]
  levels: AdaptiveRuntimeLevel[]
  responses: AdaptiveRuntimeResponse<TPoolItem>[]
  settings: AdaptiveRuntimeSettings
  terminalStopReason: AdaptiveRuntimeStopReason | null
  enabledNodeIds: ReadonlySet<number>
  roots: AdaptiveRuntimeNode[]
}) {
  const evidenceByNode = new Map<number, AdaptiveRuntimeResponse<TPoolItem>[]>()
  for (const response of responses) {
    for (const nodeId of new Set(response.poolItem.nodePath)) {
      if (!enabledNodeIds.has(nodeId)) continue
      appendToMap(evidenceByNode, nodeId, response)
    }
  }

  const nodeEstimates = new Map<number, AdaptiveRuntimeEstimate>()
  for (const node of nodes) {
    if (!enabledNodeIds.has(node.id)) continue
    const evidence = evidenceByNode.get(node.id) ?? []
    const estimate = computeEvidenceEstimate({ evidence, levels, settings })
    nodeEstimates.set(node.id, {
      nodeKind: node.kind === 'COMPETENCE' ? 'COMPETENCE' : 'SUBCOMPETENCE',
      nodeId: node.id,
      ...estimate,
      stopReason: terminalStopReason
        ? evidence.length < MIN_ADAPTIVE_REPORTING_RESPONSES
          ? 'INSUFFICIENT_DATA'
          : terminalStopReason
        : null,
    })
  }

  const rootEstimates = roots.map((root) => ({
    root,
    estimate: nodeEstimates.get(root.id)!,
  }))
  const everyRootHasEvidence = rootEstimates.every(
    ({ estimate }) =>
      estimate.responseCount > 0 &&
      estimate.theta !== null &&
      estimate.standardError !== null
  )
  const weighted = everyRootHasEvidence
    ? aggregateWeightedEstimates(
        rootEstimates.map(({ root, estimate }) => ({
          theta: estimate.theta!,
          standardError: estimate.standardError!,
          weight: root.weight ?? 0,
        }))
      )
    : null
  if (everyRootHasEvidence && weighted === null) {
    throw new AdaptiveRuntimeConfigurationError(
      'Enabled root competence weights must have a positive total.',
      'ADAPTIVE_ROOT_WEIGHT_INVALID'
    )
  }
  const everyRootReportable = rootEstimates.every(
    ({ estimate }) => estimate.responseCount >= MIN_ADAPTIVE_REPORTING_RESPONSES
  )
  const overallLevel =
    weighted && everyRootReportable
      ? getMappedRuntimeLevel(weighted.theta, levels, settings)
      : null

  return {
    overall: {
      nodeKind: 'OVERALL',
      nodeId: null,
      theta: weighted?.theta ?? null,
      standardError: weighted?.standardError ?? null,
      responseCount: responses.length,
      levelId: overallLevel?.id ?? null,
      stopReason: terminalStopReason
        ? !everyRootReportable
          ? 'INSUFFICIENT_DATA'
          : terminalStopReason
        : null,
    },
    nodes: nodeEstimates,
  } satisfies AdaptiveRuntimeEstimates
}

function computeEvidenceEstimate<TPoolItem extends AdaptiveRuntimePoolItem>({
  evidence,
  levels,
  settings,
}: {
  evidence: AdaptiveRuntimeResponse<TPoolItem>[]
  levels: AdaptiveRuntimeLevel[]
  settings: AdaptiveRuntimeSettings
}): Omit<AdaptiveRuntimeEstimate, 'nodeKind' | 'nodeId' | 'stopReason'> {
  if (evidence.length === 0) {
    return {
      theta: null,
      standardError: null,
      responseCount: 0,
      levelId: null,
    }
  }
  const state = updateTheta({
    responses: toAdaptiveResponses(evidence),
    range: settings.thetaRange,
    usePrior: false,
  })
  const mapped =
    evidence.length >= MIN_ADAPTIVE_REPORTING_RESPONSES
      ? getMappedRuntimeLevel(state.theta, levels, settings)
      : null

  return {
    theta: state.theta,
    standardError: state.standardError,
    responseCount: evidence.length,
    levelId: mapped?.id ?? null,
  }
}

function getRootState({
  root,
  leafIds,
  hasEligibleItem,
  countsByLeaf,
  estimate,
  levels,
  settings,
}: {
  root: AdaptiveRuntimeNode
  leafIds: number[]
  hasEligibleItem: boolean
  countsByLeaf: Map<number, number>
  estimate: AdaptiveRuntimeEstimate
  levels: AdaptiveRuntimeLevel[]
  settings: AdaptiveRuntimeSettings
}) {
  const breadthSatisfied = leafIds.every(
    (leafId) => (countsByLeaf.get(leafId) ?? 0) >= settings.minQuestionsPerLeaf
  )
  const classified =
    breadthSatisfied &&
    estimate.responseCount >= MIN_ADAPTIVE_REPORTING_RESPONSES &&
    estimate.theta !== null &&
    estimate.standardError !== null &&
    classificationIntervalWithinLevelBand({
      theta: estimate.theta,
      standardError: estimate.standardError,
      levels,
      range: settings.thetaRange,
      mappingRule: settings.levelMappingRule,
      z: settings.classificationZ,
    })

  return {
    root,
    estimate,
    leafIds,
    breadthSatisfied,
    classified,
    hasEligibleItem,
  }
}

function selectRootAndLeaf<TPoolItem extends AdaptiveRuntimePoolItem>({
  activeRoots,
  eligibleByRootLeaf,
  responses,
  countsByLeaf,
  settings,
}: {
  activeRoots: ReturnType<typeof getRootState>[]
  eligibleByRootLeaf: Map<string, TPoolItem[]>
  responses: AdaptiveRuntimeResponse<TPoolItem>[]
  countsByLeaf: Map<number, number>
  settings: AdaptiveRuntimeSettings
}) {
  const rootsWithoutEvidence = activeRoots.filter(
    ({ estimate }) => estimate.responseCount === 0
  )
  const root =
    rootsWithoutEvidence.sort(compareRootState)[0] ??
    selectBreadthRoot(activeRoots, countsByLeaf, settings) ??
    activeRoots.slice().sort((left, right) => {
      const leftDeficit =
        (left.root.weight ?? 0) * (responses.length + 1) -
        left.estimate.responseCount
      const rightDeficit =
        (right.root.weight ?? 0) * (responses.length + 1) -
        right.estimate.responseCount
      return rightDeficit - leftDeficit || compareRootState(left, right)
    })[0]!
  const availableLeaves = root.leafIds.filter(
    (leafId) =>
      (eligibleByRootLeaf.get(rootLeafKey(root.root.id, leafId))?.length ?? 0) >
      0
  )
  const deficitLeaves = availableLeaves.filter(
    (leafId) => (countsByLeaf.get(leafId) ?? 0) < settings.minQuestionsPerLeaf
  )
  const leafIds = deficitLeaves.length > 0 ? deficitLeaves : availableLeaves
  const leafId = leafIds.slice().sort((left, right) => {
    const leftCount = countsByLeaf.get(left) ?? 0
    const rightCount = countsByLeaf.get(right) ?? 0
    return leftCount - rightCount || left - right
  })[0]!

  return {
    rootId: root.root.id,
    leafId,
  }
}

function selectBreadthRoot(
  roots: ReturnType<typeof getRootState>[],
  countsByLeaf: Map<number, number>,
  settings: AdaptiveRuntimeSettings
) {
  return roots
    .filter(({ leafIds }) =>
      leafIds.some(
        (leafId) =>
          (countsByLeaf.get(leafId) ?? 0) < settings.minQuestionsPerLeaf
      )
    )
    .sort((left, right) => {
      const leftDeficit = left.leafIds.reduce(
        (sum, leafId) =>
          sum +
          Math.max(
            settings.minQuestionsPerLeaf - (countsByLeaf.get(leafId) ?? 0),
            0
          ),
        0
      )
      const rightDeficit = right.leafIds.reduce(
        (sum, leafId) =>
          sum +
          Math.max(
            settings.minQuestionsPerLeaf - (countsByLeaf.get(leafId) ?? 0),
            0
          ),
        0
      )
      return rightDeficit - leftDeficit || compareRootState(left, right)
    })[0]
}

function selectDeterministicInformationCandidate<
  TPoolItem extends AdaptiveRuntimePoolItem,
>({
  attemptId,
  responseOrder,
  theta,
  items,
  topInformationRatio,
}: {
  attemptId: string
  responseOrder: number
  theta: number
  items: TPoolItem[]
  topInformationRatio: number
}) {
  if (items.length === 0) return null
  const scored = items.map((item) => ({
    item,
    information: information(theta, {
      a: item.discrimination,
      b: item.difficulty,
      c: item.guessing,
    }),
  }))
  const maximum = Math.max(...scored.map(({ information }) => information))
  const ratio = Math.min(Math.max(topInformationRatio, 0), 1)
  const candidates = scored
    .filter(({ information }) => maximum <= 0 || information >= maximum * ratio)
    .sort(
      (left, right) =>
        stableHash(`${attemptId}:${responseOrder}:${left.item.id}`) -
          stableHash(`${attemptId}:${responseOrder}:${right.item.id}`) ||
        left.item.id - right.item.id
    )
  return candidates[0]?.item ?? null
}

function computeRoutingTheta<TPoolItem extends AdaptiveRuntimePoolItem>(
  evidence: AdaptiveRuntimeResponse<TPoolItem>[],
  range: ThetaRange
) {
  return updateTheta({
    responses: toAdaptiveResponses(evidence),
    range,
    usePrior: true,
    priorMean: 0,
    priorSD: 1,
  }).theta
}

function toAdaptiveResponses<TPoolItem extends AdaptiveRuntimePoolItem>(
  evidence: AdaptiveRuntimeResponse<TPoolItem>[]
): AdaptiveResponse[] {
  return evidence.map(({ poolItem, correct }) => ({
    item: {
      id: poolItem.id,
      a: poolItem.discrimination,
      b: poolItem.difficulty,
      c: poolItem.guessing,
    },
    correct,
  }))
}

function isEligiblePoolItem<TPoolItem extends AdaptiveRuntimePoolItem>({
  item,
  answeredPoolIds,
  enabledNodeIds,
  nodesById,
  countsByNode,
  countsByLeaf,
  perLeafQuestionCap,
}: {
  item: TPoolItem
  answeredPoolIds: Set<number>
  enabledNodeIds: ReadonlySet<number>
  nodesById: ReadonlyMap<number, AdaptiveRuntimeNode>
  countsByNode: Map<number, number>
  countsByLeaf: Map<number, number>
  perLeafQuestionCap: number | null
}) {
  if (answeredPoolIds.has(item.id)) return false
  if (!item.nodePath.every((nodeId) => enabledNodeIds.has(nodeId))) return false
  if (
    perLeafQuestionCap !== null &&
    (countsByLeaf.get(item.leafNodeId) ?? 0) >= perLeafQuestionCap
  ) {
    return false
  }
  return item.nodePath.every((nodeId) => {
    const cap = nodesById.get(nodeId)?.questionCap
    return cap === null || typeof cap === 'undefined'
      ? true
      : (countsByNode.get(nodeId) ?? 0) < cap
  })
}

function getEffectivelyEnabledNodes(nodes: AdaptiveRuntimeNode[]) {
  const enabled = new Set<number>()
  for (const node of nodes.slice().sort((a, b) => a.depth - b.depth)) {
    if (
      node.enabled &&
      (node.parentId === null || enabled.has(node.parentId))
    ) {
      enabled.add(node.id)
    }
  }
  return enabled
}

function getEnabledRoots(
  nodes: AdaptiveRuntimeNode[],
  enabledNodeIds: ReadonlySet<number>
) {
  return nodes
    .filter(
      (node) =>
        node.parentId === null &&
        node.kind === 'COMPETENCE' &&
        enabledNodeIds.has(node.id)
    )
    .sort((a, b) => a.order - b.order || a.id - b.id)
}

function normalizeRuntimeRootWeights(roots: AdaptiveRuntimeNode[]) {
  const result = normalizeEnabledRootWeights(
    roots.map((root) => ({ key: root, weight: root.weight ?? 0 }))
  )
  if (!result.ok) {
    throw new AdaptiveRuntimeConfigurationError(
      'Every enabled root competence requires a positive finite weight.',
      'ADAPTIVE_ROOT_WEIGHT_INVALID'
    )
  }
  return result.normalized.map(({ key: root, weight }) => ({
    ...root,
    weight,
  }))
}

function countResponsesByNode<TPoolItem extends AdaptiveRuntimePoolItem>(
  responses: AdaptiveRuntimeResponse<TPoolItem>[]
) {
  const counts = new Map<number, number>()
  for (const response of responses) {
    for (const nodeId of new Set(response.poolItem.nodePath)) {
      counts.set(nodeId, (counts.get(nodeId) ?? 0) + 1)
    }
  }
  return counts
}

function countResponsesByLeaf<TPoolItem extends AdaptiveRuntimePoolItem>(
  responses: AdaptiveRuntimeResponse<TPoolItem>[]
) {
  const counts = new Map<number, number>()
  for (const response of responses) {
    counts.set(
      response.poolItem.leafNodeId,
      (counts.get(response.poolItem.leafNodeId) ?? 0) + 1
    )
  }
  return counts
}

function compareRootState(
  left: ReturnType<typeof getRootState>,
  right: ReturnType<typeof getRootState>
) {
  return left.root.order - right.root.order || left.root.id - right.root.id
}

function getMappedRuntimeLevel(
  theta: number,
  levels: AdaptiveRuntimeLevel[],
  settings: Pick<AdaptiveRuntimeSettings, 'thetaRange' | 'levelMappingRule'>
) {
  const mapped = mapThetaToLevel(
    theta,
    levels,
    settings.thetaRange,
    settings.levelMappingRule
  )
  return mapped
    ? (levels.find(
        (level) => level.label === mapped.label && level.order === mapped.order
      ) ?? null)
    : null
}

function rootLeafKey(rootId: number, leafId: number) {
  return `${rootId}:${leafId}`
}

function appendToMap<K, V>(map: Map<K, V[]>, key: K, value: V) {
  const values = map.get(key) ?? []
  values.push(value)
  map.set(key, values)
}

function stableHash(value: string) {
  let hash = 2166136261
  for (let index = 0; index < value.length; index++) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  hash ^= hash >>> 16
  hash = Math.imul(hash, 0x85ebca6b)
  hash ^= hash >>> 13
  hash = Math.imul(hash, 0xc2b2ae35)
  hash ^= hash >>> 16
  return hash >>> 0
}
