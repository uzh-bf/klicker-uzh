import {
  type AdaptiveLeafCoverageStatus,
  classificationIntervalWithinLevelBand,
} from '@klicker-uzh/adaptive-contract'
import {
  type AdaptiveRuntimeLevel,
  type AdaptiveRuntimeNode,
  type AdaptiveRuntimeRoutingPoolItem,
  type AdaptiveRuntimeSettings,
  getMappedRuntimeLeafIds,
} from './adaptivePracticeQuizRuntime.js'
import {
  hasAdaptiveV1LeafBreadth,
  resolveAdaptiveV1EngineLeafBreadth,
  resolveAdaptiveV1LeafCoverage,
} from './adaptivePracticeQuizSamplingCoverage.js'

type DeterminationRuntime = {
  pool: ReadonlyArray<
    Pick<
      AdaptiveRuntimeRoutingPoolItem,
      'id' | 'leafNodeId' | 'additionalLeafNodeIds' | 'nodePath'
    >
  >
  algorithm: {
    nodes: AdaptiveRuntimeNode[]
    levels: AdaptiveRuntimeLevel[]
    settings: AdaptiveRuntimeSettings
  }
}

/**
 * Host rule for whether an IRT_V1 node level counts as determined in one
 * attempt. Shared by the lecturer cohort ("level determined") and the
 * student result, so both views agree:
 *
 * - The node interval must lie within the configured tolerance bands
 *   (classificationToleranceBands, the engine's SEQUENTIAL_ROOTS_V6 rule), and
 *   its descendant leaves must have breadth: the engine's leaf coverage status
 *   when every relevant leaf has one, else the response-count rules.
 * - An engine-CLASSIFIED estimate is trusted under subcompetence sampling or
 *   when the engine reported leaf coverage.
 *
 * `nodeId` null is the overall estimate over every enabled leaf.
 */
export function createAdaptiveV1LevelDetermination({
  runtime,
  answeredPoolItemIds,
  coverageStatusByLeaf,
}: {
  runtime: DeterminationRuntime
  answeredPoolItemIds: readonly (number | null)[]
  coverageStatusByLeaf: ReadonlyMap<
    number,
    AdaptiveLeafCoverageStatus | null | undefined
  >
}) {
  const enabledNodes = effectivelyEnabledNodes(runtime.algorithm.nodes)
  const enabledNodeIds = new Set(enabledNodes.map(({ id }) => id))
  const parentIds = new Set(enabledNodes.map(({ parentId }) => parentId))
  const nodesById = new Map(enabledNodes.map((node) => [node.id, node]))
  const leaves = enabledNodes.filter((node) => !parentIds.has(node.id))
  const poolById = new Map(runtime.pool.map((item) => [item.id, item]))
  // One answer covers every enabled leaf its item is mapped to (once each).
  const leafCounts = new Map<number, number>()
  for (const poolItemId of answeredPoolItemIds) {
    const item = poolItemId === null ? undefined : poolById.get(poolItemId)
    if (!item) continue
    for (const leafId of getMappedRuntimeLeafIds(item, enabledNodeIds)) {
      leafCounts.set(leafId, (leafCounts.get(leafId) ?? 0) + 1)
    }
  }
  const coverage = resolveAdaptiveV1LeafCoverage(runtime, enabledNodeIds)
  const settings = runtime.algorithm.settings

  function relevantLeafIds(nodeId: number | null) {
    return leaves
      .filter((leaf) => {
        if (nodeId === null) return true
        let current: typeof leaf | undefined = leaf
        while (current) {
          if (current.id === nodeId) return true
          current =
            current.parentId === null
              ? undefined
              : nodesById.get(current.parentId)
        }
        return false
      })
      .map(({ id }) => id)
  }
  // Engine coverage status of the persisted decision, or null when any
  // relevant leaf lacks one (older engine): then the count rules apply.
  function engineBreadth(nodeId: number | null) {
    return resolveAdaptiveV1EngineLeafBreadth({
      leafIds: relevantLeafIds(nodeId),
      coverageStatusByLeaf,
    })
  }
  function hasCoverage(nodeId: number | null) {
    return (
      engineBreadth(nodeId) ??
      hasAdaptiveV1LeafBreadth({
        leafIds: relevantLeafIds(nodeId),
        leafCounts,
        minQuestionsPerLeaf: settings.minQuestionsPerLeaf,
        coverage,
      })
    )
  }

  return {
    isDetermined(
      nodeId: number | null,
      estimate: {
        theta: number
        standardError: number
        stopReason?: string | null
      }
    ) {
      if (
        (coverage.sampling || engineBreadth(nodeId) !== null) &&
        estimate.stopReason === 'CLASSIFIED'
      ) {
        return true
      }
      return (
        hasCoverage(nodeId) &&
        classificationIntervalWithinLevelBand({
          theta: estimate.theta,
          standardError: estimate.standardError,
          levels: runtime.algorithm.levels,
          range: settings.thetaRange,
          mappingRule: settings.levelMappingRule,
          z: settings.classificationZ,
          toleranceBands: settings.classificationToleranceBands ?? 0,
        })
      )
    },
  }
}

function effectivelyEnabledNodes(nodes: AdaptiveRuntimeNode[]) {
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
