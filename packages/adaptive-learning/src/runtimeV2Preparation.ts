import { MAX_COMPETENCE_TREE_DEPTH, type AdaptiveItemType } from './core.js'
import { AdaptiveRuntimeConfigurationError } from './estimator.js'
import { ADAPTIVE_CLASSIFICATION_POLICY_V1 } from './policy.js'
import { assertAdaptiveScoredItem } from './posterior.js'
import type { AdaptiveRuntimeNode } from './runtime.js'
import type {
  AdaptiveV2RuntimeSettings,
  PreparedAdaptiveV2Runtime,
} from './runtimeV2.js'
import { validateAdaptiveScale, type AdaptiveScaleDefinition } from './scale.js'
import {
  ADAPTIVE_V2_EXPOSURE_CEILING,
  type AdaptiveV2PoolItem,
} from './selectionV2.js'
import { normalizeEnabledRootWeights } from './weights.js'

const PREPARED_V2_RUNTIMES = new WeakSet<object>()

export function isPreparedAdaptiveV2Runtime(
  value: unknown
): value is PreparedAdaptiveV2Runtime {
  return (
    typeof value === 'object' &&
    value !== null &&
    PREPARED_V2_RUNTIMES.has(value)
  )
}

export function buildPreparedAdaptiveV2Runtime({
  nodes,
  scale,
  pool,
  settings,
}: {
  nodes: AdaptiveRuntimeNode[]
  scale: AdaptiveScaleDefinition
  pool: AdaptiveV2PoolItem[]
  settings: AdaptiveV2RuntimeSettings
}): PreparedAdaptiveV2Runtime {
  const nodeSnapshot = nodes.map((node) => Object.freeze({ ...node }))
  if (!Array.isArray(scale.levels)) {
    throw configurationError(
      'Adaptive scale levels must be an array.',
      'ADAPTIVE_SCALE_INVALID'
    )
  }
  const scaleSnapshot: AdaptiveScaleDefinition = {
    ...scale,
    levels: scale.levels.map((level) => Object.freeze({ ...level })),
  }
  const poolSnapshot = pool.map((item) => {
    if (!Array.isArray(item.nodePath)) {
      throw configurationError(
        'Adaptive pool item paths must be arrays.',
        'ADAPTIVE_POOL_INVALID'
      )
    }
    return Object.freeze({
      ...item,
      nodePath: Object.freeze([...item.nodePath]),
    })
  })
  const settingsSnapshot: AdaptiveV2RuntimeSettings = {
    ...settings,
    thetaRange: Object.freeze({ ...settings.thetaRange }),
    researchPolicy:
      settings.researchPolicy === null
        ? null
        : Object.freeze({ ...settings.researchPolicy }),
  }
  assertV2Settings(settingsSnapshot, scaleSnapshot)
  const scaleErrors = validateAdaptiveScale(scaleSnapshot)
  if (scaleErrors.length > 0) {
    throw configurationError(
      `Invalid adaptive scale: ${scaleErrors.join(' ')}`,
      'ADAPTIVE_SCALE_INVALID'
    )
  }

  const topology = prepareTopology(nodeSnapshot)
  assertResearchCapFeasibility({
    settings: settingsSnapshot,
    scale: scaleSnapshot,
    leafCount: topology.leafIds.length,
  })
  const poolState = preparePool({
    pool: poolSnapshot,
    scale: scaleSnapshot,
    settings: settingsSnapshot,
    topology,
  })
  const effectiveLeafWeights = computeEffectiveLeafWeights({
    roots: topology.roots,
    childrenByParent: topology.childrenByParent,
  })

  Object.freeze(nodeSnapshot)
  Object.freeze(scaleSnapshot.levels)
  Object.freeze(scaleSnapshot)
  Object.freeze(poolSnapshot)
  Object.freeze(settingsSnapshot)

  const prepared = Object.freeze({
    measurementVersion: 'IRT_V2_EAP_GRID_1',
    nodes: Object.freeze(
      nodeSnapshot.filter((node) => topology.enabledNodeIds.has(node.id))
    ),
    scale: scaleSnapshot,
    pool: poolSnapshot,
    settings: settingsSnapshot,
    roots: Object.freeze([...topology.roots]),
    nodesById: readonlyMap(topology.nodesById),
    poolById: readonlyMap(poolState.poolById),
    poolByLeaf: readonlyMap(
      new Map(
        [...poolState.poolByLeaf].map(([key, values]) => [
          key,
          Object.freeze([...values]),
        ])
      )
    ),
    nodePathById: readonlyMap(
      new Map(
        [...topology.nodePathById].map(([key, values]) => [
          key,
          Object.freeze([...values]),
        ])
      )
    ),
    descendantLeafIdsByNode: readonlyMap(
      new Map(
        [...topology.descendantLeafIdsByNode].map(([key, values]) => [
          key,
          Object.freeze([...values]),
        ])
      )
    ),
    effectiveLeafWeights: readonlyMap(effectiveLeafWeights),
  }) satisfies PreparedAdaptiveV2Runtime
  PREPARED_V2_RUNTIMES.add(prepared)
  return prepared
}

function prepareTopology(nodes: AdaptiveRuntimeNode[]) {
  if (nodes.length === 0) {
    throw configurationError(
      'At least one adaptive competence node is required.',
      'ADAPTIVE_TREE_INVALID'
    )
  }
  const nodesById = new Map<number, AdaptiveRuntimeNode>()
  for (const node of nodes) {
    if (!Number.isInteger(node.id) || node.id < 1 || nodesById.has(node.id)) {
      throw configurationError(
        'Adaptive node IDs must be unique positive integers.',
        'ADAPTIVE_TREE_INVALID'
      )
    }
    if (
      !Number.isInteger(node.depth) ||
      node.depth < 1 ||
      node.depth > MAX_COMPETENCE_TREE_DEPTH ||
      !Number.isInteger(node.order) ||
      node.order < 0
    ) {
      throw configurationError(
        'Adaptive node depth and order are invalid.',
        'ADAPTIVE_TREE_INVALID'
      )
    }
    if (
      typeof node.enabled !== 'boolean' ||
      (node.kind !== 'COMPETENCE' && node.kind !== 'SUBCOMPETENCE') ||
      (node.weight !== null &&
        (!Number.isFinite(node.weight) || node.weight < 0)) ||
      (node.questionCap !== null &&
        (!Number.isInteger(node.questionCap) || node.questionCap < 1))
    ) {
      throw configurationError(
        'Adaptive node flags, weights, or caps are invalid.',
        'ADAPTIVE_TREE_INVALID'
      )
    }
    nodesById.set(node.id, node)
  }

  const enabled = new Set<number>()
  const childrenByParent = new Map<number, AdaptiveRuntimeNode[]>()
  const siblingOrders = new Set<string>()
  for (const node of [...nodes].sort(
    (left, right) => left.depth - right.depth
  )) {
    const parent = node.parentId === null ? null : nodesById.get(node.parentId)
    if (node.parentId === null) {
      if (node.depth !== 1 || node.kind !== 'COMPETENCE') {
        throw configurationError(
          'Adaptive roots must be depth-one competences.',
          'ADAPTIVE_TREE_INVALID'
        )
      }
    } else if (
      parent === undefined ||
      parent === null ||
      node.kind !== 'SUBCOMPETENCE' ||
      node.depth !== parent.depth + 1
    ) {
      throw configurationError(
        'Adaptive subcompetence parentage is invalid.',
        'ADAPTIVE_TREE_INVALID'
      )
    }
    const siblingKey = `${node.parentId ?? 'root'}:${node.order}`
    if (siblingOrders.has(siblingKey)) {
      throw configurationError(
        'Adaptive sibling node orders must be unique.',
        'ADAPTIVE_TREE_INVALID'
      )
    }
    siblingOrders.add(siblingKey)
    if (node.enabled) {
      const enabledParent =
        node.parentId === null ? null : nodesById.get(node.parentId)!
      if (enabledParent !== null && !enabled.has(enabledParent.id)) {
        throw configurationError(
          'An enabled adaptive node cannot have a disabled parent.',
          'ADAPTIVE_TREE_INVALID'
        )
      }
      enabled.add(node.id)
      if (enabledParent !== null) {
        appendToMap(childrenByParent, enabledParent.id, node)
      }
    }
  }

  const enabledRoots = nodes
    .filter((node) => node.parentId === null && enabled.has(node.id))
    .sort(compareNodes)
  const normalizedRootWeights = normalizeEnabledRootWeights(
    enabledRoots.map((root) => ({ key: root, weight: root.weight ?? 0 }))
  )
  if (!normalizedRootWeights.ok) {
    throw configurationError(
      'Enabled root competences require positive finite weights.',
      'ADAPTIVE_ROOT_WEIGHT_INVALID'
    )
  }
  const roots = normalizedRootWeights.normalized.map(
    ({ key: root, weight }) => ({ ...root, weight })
  )
  if (
    roots.some((root) => (childrenByParent.get(root.id)?.length ?? 0) === 0)
  ) {
    throw configurationError(
      'Every enabled competence root requires at least one subcompetence.',
      'ADAPTIVE_TREE_INVALID'
    )
  }

  const nodePathById = new Map<number, number[]>()
  for (const node of [...nodes].sort(
    (left, right) => left.depth - right.depth
  )) {
    if (!enabled.has(node.id)) continue
    nodePathById.set(
      node.id,
      node.parentId === null
        ? [node.id]
        : [...nodePathById.get(node.parentId)!, node.id]
    )
  }
  const leafIds = [...enabled].filter(
    (nodeId) => (childrenByParent.get(nodeId)?.length ?? 0) === 0
  )
  if (
    leafIds.some((leafId) => nodesById.get(leafId)?.kind !== 'SUBCOMPETENCE')
  ) {
    throw configurationError(
      'Adaptive pool leaves must be subcompetences.',
      'ADAPTIVE_TREE_INVALID'
    )
  }
  const descendantLeafIdsByNode = new Map<number, number[]>()
  for (const nodeId of enabled) {
    descendantLeafIdsByNode.set(
      nodeId,
      leafIds.filter((leafId) => nodePathById.get(leafId)!.includes(nodeId))
    )
  }

  return {
    nodesById,
    enabledNodeIds: enabled,
    childrenByParent,
    roots,
    nodePathById,
    descendantLeafIdsByNode,
    leafIds,
  }
}

function preparePool({
  pool,
  scale,
  settings,
  topology,
}: {
  pool: AdaptiveV2PoolItem[]
  scale: AdaptiveScaleDefinition
  settings: AdaptiveV2RuntimeSettings
  topology: ReturnType<typeof prepareTopology>
}) {
  const poolById = new Map<number, AdaptiveV2PoolItem>()
  const poolByLeaf = new Map<number, AdaptiveV2PoolItem[]>()
  const calibrationIds = new Set<string>()
  const levelIds = new Set(scale.levels.map(({ id }) => id))
  for (const item of pool) {
    if (
      !Number.isInteger(item.id) ||
      item.id < 1 ||
      poolById.has(item.id) ||
      !Number.isInteger(item.leafNodeId) ||
      !Array.isArray(item.nodePath) ||
      item.nodePath.some((nodeId) => !Number.isInteger(nodeId)) ||
      !Number.isInteger(item.levelId) ||
      typeof item.contributesToEstimate !== 'boolean' ||
      (item.role !== 'SCORING' &&
        item.role !== 'ANCHOR' &&
        item.role !== 'FIELD_TEST')
    ) {
      throw configurationError(
        'Adaptive pool item identity or role is invalid.',
        'ADAPTIVE_POOL_INVALID'
      )
    }
    const expectedPath = topology.nodePathById.get(item.leafNodeId)
    if (
      expectedPath === undefined ||
      !topology.leafIds.includes(item.leafNodeId) ||
      !arraysEqual(expectedPath, item.nodePath)
    ) {
      throw configurationError(
        'Adaptive pool item paths must match an enabled tree leaf.',
        'ADAPTIVE_POOL_INVALID'
      )
    }
    if (!levelIds.has(item.levelId)) {
      throw configurationError(
        'Adaptive pool item levels must belong to the published scale.',
        'ADAPTIVE_POOL_INVALID'
      )
    }
    assertPoolItemModel(item)
    if (item.calibrationId === null || calibrationIds.has(item.calibrationId)) {
      throw configurationError(
        'Adaptive pool items require unique calibration identities.',
        'ADAPTIVE_POOL_CALIBRATION_INVALID'
      )
    }
    calibrationIds.add(item.calibrationId)
    if (item.contributesToEstimate) {
      if (item.role === 'FIELD_TEST') {
        throw configurationError(
          'Field-test items cannot contribute to proficiency estimates.',
          'ADAPTIVE_POOL_CALIBRATION_INVALID'
        )
      }
    } else if (item.role !== 'FIELD_TEST') {
      throw configurationError(
        'Non-scoring pool items must be field tests.',
        'ADAPTIVE_POOL_CALIBRATION_INVALID'
      )
    }
    if (settings.mode === 'DIAGNOSTIC' && !item.contributesToEstimate) {
      throw configurationError(
        'Diagnostic pools may contain only calibrated scoring items.',
        'ADAPTIVE_DIAGNOSTIC_POOL_UNCALIBRATED'
      )
    }
    poolById.set(item.id, item)
    appendToMap(poolByLeaf, item.leafNodeId, item)
  }
  if (
    topology.leafIds.some(
      (leafId) => (poolByLeaf.get(leafId)?.length ?? 0) === 0
    )
  ) {
    throw configurationError(
      'Every enabled adaptive leaf requires pool items.',
      'ADAPTIVE_POOL_INVALID'
    )
  }
  if (settings.mode === 'RESEARCH') {
    const minimumDistinctAnchorsPerLeafLevel = minimumDistinctItemsForExposure(
      settings.researchPolicy!.anchorResponsesPerLeafLevel
    )
    const minimumDistinctFieldTestsPerLeaf = minimumDistinctItemsForExposure(
      settings.researchPolicy!.fieldTestResponsesPerLeaf
    )
    for (const leafId of topology.leafIds) {
      const leafPool = poolByLeaf.get(leafId) ?? []
      for (const level of scale.levels) {
        if (
          leafPool.filter(
            (item) =>
              item.role === 'ANCHOR' &&
              item.contributesToEstimate &&
              item.levelId === level.id
          ).length < minimumDistinctAnchorsPerLeafLevel
        ) {
          throw configurationError(
            'Research pools require exposure-safe calibrated anchor coverage for every leaf and level.',
            'ADAPTIVE_RESEARCH_ANCHOR_COVERAGE_INVALID'
          )
        }
      }
      if (
        leafPool.filter(({ role }) => role === 'FIELD_TEST').length <
          minimumDistinctFieldTestsPerLeaf ||
        (settings.researchPolicy!.fieldTestResponsesPerLeaf > 0 &&
          leafPool.filter(({ role }) => role !== 'FIELD_TEST').length <=
            minimumDistinctAnchorsPerLeafLevel * scale.levels.length)
      ) {
        throw configurationError(
          'Research pools require enough field-test and scoring items for the collection design.',
          'ADAPTIVE_RESEARCH_FIELD_TEST_COVERAGE_INVALID'
        )
      }
    }
  }

  return { poolById, poolByLeaf }
}

function minimumDistinctItemsForExposure(requiredResponsesPerAttempt: number) {
  return Math.ceil(requiredResponsesPerAttempt / ADAPTIVE_V2_EXPOSURE_CEILING)
}

function computeEffectiveLeafWeights({
  roots,
  childrenByParent,
}: {
  roots: AdaptiveRuntimeNode[]
  childrenByParent: ReadonlyMap<number, AdaptiveRuntimeNode[]>
}) {
  const result = new Map<number, number>()
  const rootTotal = roots.reduce((sum, root) => sum + root.weight!, 0)
  for (const root of roots) visit(root, root.weight! / rootTotal)
  return result

  function visit(node: AdaptiveRuntimeNode, effectiveWeight: number) {
    const children = (childrenByParent.get(node.id) ?? []).sort(compareNodes)
    if (children.length === 0) {
      result.set(node.id, effectiveWeight)
      return
    }
    const weights = children.map((child) => child.weight ?? 1)
    if (weights.some((weight) => !Number.isFinite(weight) || weight <= 0)) {
      throw configurationError(
        'Enabled sibling nodes require positive finite weights.',
        'ADAPTIVE_NODE_WEIGHT_INVALID'
      )
    }
    const total = weights.reduce((sum, weight) => sum + weight, 0)
    children.forEach((child, index) =>
      visit(child, effectiveWeight * (weights[index]! / total))
    )
  }
}

function assertV2Settings(
  settings: AdaptiveV2RuntimeSettings,
  scale: AdaptiveScaleDefinition
) {
  if (
    !Number.isInteger(settings.totalQuestionCap) ||
    settings.totalQuestionCap < 1 ||
    (settings.perLeafQuestionCap !== null &&
      (!Number.isInteger(settings.perLeafQuestionCap) ||
        settings.perLeafQuestionCap < 1)) ||
    !Number.isInteger(settings.minQuestionsPerLeaf) ||
    settings.minQuestionsPerLeaf < 1 ||
    !Number.isInteger(settings.minimumRootResponses) ||
    settings.minimumRootResponses < 1
  ) {
    throw configurationError(
      'Adaptive v2 question limits are invalid.',
      'ADAPTIVE_SETTINGS_INVALID'
    )
  }
  if (
    !Number.isFinite(settings.classificationZ) ||
    settings.classificationZ < 0 ||
    (settings.levelMappingRule !== 'NEAREST' &&
      settings.levelMappingRule !== 'MASTERY') ||
    !Number.isFinite(settings.thetaRange.min) ||
    !Number.isFinite(settings.thetaRange.max) ||
    settings.thetaRange.min >= settings.thetaRange.max
  ) {
    throw configurationError(
      'Shared adaptive runtime settings are invalid.',
      'ADAPTIVE_SETTINGS_INVALID'
    )
  }
  if (
    !Number.isFinite(settings.topInformationRatio) ||
    settings.topInformationRatio < 0 ||
    settings.topInformationRatio > 1 ||
    !Number.isFinite(settings.credibleMass) ||
    settings.credibleMass <= 0 ||
    settings.credibleMass >= 1 ||
    !Number.isFinite(settings.classificationProbabilityThreshold) ||
    !ADAPTIVE_CLASSIFICATION_POLICY_V1.candidateProbabilityThresholds.includes(
      settings.classificationProbabilityThreshold
    )
  ) {
    throw configurationError(
      'Adaptive v2 probability settings must use an approved policy threshold.',
      'ADAPTIVE_SETTINGS_INVALID'
    )
  }
  if (
    scale.classificationPolicyVersion !==
      ADAPTIVE_CLASSIFICATION_POLICY_V1.version ||
    settings.credibleMass !== ADAPTIVE_CLASSIFICATION_POLICY_V1.credibleMass
  ) {
    throw configurationError(
      'Adaptive scale and classification policy versions disagree.',
      'ADAPTIVE_CLASSIFICATION_POLICY_MISMATCH'
    )
  }
  if (settings.mode === 'DIAGNOSTIC') {
    if (settings.researchPolicy !== null) {
      throw configurationError(
        'Diagnostic runtimes must not define a research policy.',
        'ADAPTIVE_SETTINGS_INVALID'
      )
    }
    return
  }
  const research = settings.researchPolicy
  if (
    settings.mode !== 'RESEARCH' ||
    research === null ||
    !Number.isInteger(research.anchorResponsesPerLeafLevel) ||
    research.anchorResponsesPerLeafLevel < 1 ||
    !Number.isInteger(research.fieldTestResponsesPerLeaf) ||
    research.fieldTestResponsesPerLeaf < 0 ||
    !Number.isFinite(research.fieldTestInclusionProbability) ||
    research.fieldTestInclusionProbability <= 0 ||
    research.fieldTestInclusionProbability >= 1 ||
    typeof research.collectionDesignVersion !== 'string' ||
    research.collectionDesignVersion.trim().length === 0
  ) {
    throw configurationError(
      'Research runtime policy is invalid.',
      'ADAPTIVE_RESEARCH_POLICY_INVALID'
    )
  }
}

function assertResearchCapFeasibility({
  settings,
  scale,
  leafCount,
}: {
  settings: AdaptiveV2RuntimeSettings
  scale: AdaptiveScaleDefinition
  leafCount: number
}) {
  if (settings.mode !== 'RESEARCH') return

  const policy = settings.researchPolicy!
  const requiredPerLeaf =
    policy.anchorResponsesPerLeafLevel * scale.levels.length +
    policy.fieldTestResponsesPerLeaf
  if (
    settings.totalQuestionCap < requiredPerLeaf * leafCount ||
    (settings.perLeafQuestionCap !== null &&
      settings.perLeafQuestionCap < requiredPerLeaf)
  ) {
    throw configurationError(
      'Research question caps cannot satisfy the required anchor and field-test allocation.',
      'ADAPTIVE_RESEARCH_CAPACITY_INVALID'
    )
  }
}

function assertPoolItemModel(item: AdaptiveV2PoolItem) {
  try {
    assertAdaptiveScoredItem({
      id: item.id,
      itemType: item.itemType as AdaptiveItemType,
      choiceCount: item.choiceCount,
      model: item.model,
      calibrationId: item.calibrationId ?? 'PROVISIONAL',
      discrimination: item.discrimination,
      difficulty: item.difficulty,
      guessing: item.guessing,
    })
  } catch (error) {
    throw configurationError(
      error instanceof Error
        ? error.message
        : 'Adaptive item model is invalid.',
      'ADAPTIVE_POOL_MODEL_INVALID'
    )
  }
}

function compareNodes(left: AdaptiveRuntimeNode, right: AdaptiveRuntimeNode) {
  return left.order - right.order || left.id - right.id
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

function readonlyMap<K, V>(source: ReadonlyMap<K, V>): ReadonlyMap<K, V> {
  const snapshot = new Map(source)
  let view: ReadonlyMap<K, V>
  view = Object.freeze({
    get size() {
      return snapshot.size
    },
    get(key: K) {
      return snapshot.get(key)
    },
    has(key: K) {
      return snapshot.has(key)
    },
    forEach(
      callback: (value: V, key: K, map: ReadonlyMap<K, V>) => void,
      thisArg?: unknown
    ) {
      snapshot.forEach((value, key) => callback.call(thisArg, value, key, view))
    },
    entries() {
      return snapshot.entries()
    },
    keys() {
      return snapshot.keys()
    },
    values() {
      return snapshot.values()
    },
    [Symbol.iterator]() {
      return snapshot[Symbol.iterator]()
    },
    [Symbol.toStringTag]: 'ReadonlyMap',
  })
  return view
}

function configurationError(message: string, code: string) {
  return new AdaptiveRuntimeConfigurationError(message, code)
}
