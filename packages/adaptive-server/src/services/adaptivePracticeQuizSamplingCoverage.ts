import type { AdaptiveLeafCoverageStatus } from '@klicker-uzh/adaptive-contract'
import type {
  AdaptiveRuntimeNode,
  AdaptiveRuntimeRoutingPoolItem,
  AdaptiveRuntimeSettings,
} from './adaptivePracticeQuizRuntime.js'
import { getMappedRuntimeLeafIds } from './adaptivePracticeQuizRuntime.js'

/**
 * Host-side breadth checks for IRT_V1 subcompetence sampling.
 *
 * This mirrors only the ACTIVATION rule of Catalyst routing
 * SEQUENTIAL_ROOTS_V3: sampling is active when the summed per-leaf minimum
 * coverage over all enabled leaves exceeds the total question cap, where a
 * leaf's coverage is min(minQuestionsPerLeaf, items eligible before any
 * answer). It is derived from the published configuration only, so it never
 * changes during an attempt. Keep it in sync with Catalyst if that rule
 * changes.
 *
 * The root share and leaf-order sampling algorithm is deliberately NOT
 * re-implemented. Under sampling, the leaves that were sampled for an attempt
 * are taken from the attempt itself: every leaf that received at least one
 * response. Multi-leaf items count for every effectively enabled mapped leaf.
 */
type SamplingRuntime = {
  pool: ReadonlyArray<
    Pick<
      AdaptiveRuntimeRoutingPoolItem,
      'leafNodeId' | 'additionalLeafNodeIds' | 'nodePath'
    >
  >
  algorithm: {
    nodes: AdaptiveRuntimeNode[]
    settings: Pick<
      AdaptiveRuntimeSettings,
      'minQuestionsPerLeaf' | 'totalQuestionCap'
    >
  }
}

export type AdaptiveV1LeafCoverage = {
  sampling: boolean
  /** min(minQuestionsPerLeaf, items eligible before any answer) per leaf. */
  coverageByLeaf: ReadonlyMap<number, number>
}

export function resolveAdaptiveV1LeafCoverage(
  runtime: SamplingRuntime,
  enabledNodeIds: ReadonlySet<number>
): AdaptiveV1LeafCoverage {
  const { minQuestionsPerLeaf, totalQuestionCap } = runtime.algorithm.settings
  const eligibleByLeaf = new Map<number, number>()
  for (const item of runtime.pool) {
    if (!item.nodePath.every((nodeId) => enabledNodeIds.has(nodeId))) continue
    for (const leafId of getMappedRuntimeLeafIds(item, enabledNodeIds)) {
      eligibleByLeaf.set(leafId, (eligibleByLeaf.get(leafId) ?? 0) + 1)
    }
  }
  const parentIds = new Set(
    runtime.algorithm.nodes.map(({ parentId }) => parentId)
  )
  const coverageByLeaf = new Map<number, number>()
  for (const node of runtime.algorithm.nodes) {
    if (!enabledNodeIds.has(node.id) || parentIds.has(node.id)) continue
    coverageByLeaf.set(
      node.id,
      Math.min(minQuestionsPerLeaf, eligibleByLeaf.get(node.id) ?? 0)
    )
  }
  const totalCoverage = [...coverageByLeaf.values()].reduce(
    (sum, coverage) => sum + coverage,
    0
  )
  return { sampling: totalCoverage > totalQuestionCap, coverageByLeaf }
}

/**
 * Whether the given leaves have enough breadth for a classification.
 * Without sampling every leaf needs minQuestionsPerLeaf responses (the
 * unchanged all-leaves rule). Under sampling, unanswered leaves were not
 * sampled and are ignored; every answered leaf needs its coverage, and at
 * least one leaf must have been answered.
 */
export function hasAdaptiveV1LeafBreadth({
  leafIds,
  leafCounts,
  minQuestionsPerLeaf,
  coverage,
}: {
  leafIds: readonly number[]
  leafCounts: ReadonlyMap<number, number>
  minQuestionsPerLeaf: number
  coverage: AdaptiveV1LeafCoverage
}): boolean {
  if (!coverage.sampling) {
    return leafIds.every(
      (leafId) => (leafCounts.get(leafId) ?? 0) >= minQuestionsPerLeaf
    )
  }
  const sampled = leafIds.filter((leafId) => (leafCounts.get(leafId) ?? 0) > 0)
  return (
    sampled.length > 0 &&
    sampled.every(
      (leafId) =>
        (leafCounts.get(leafId) ?? 0) >=
        (coverage.coverageByLeaf.get(leafId) ?? minQuestionsPerLeaf)
    )
  )
}

/**
 * Breadth from the engine's own per-leaf coverage status (Catalyst routing
 * SEQUENTIAL_ROOTS_V5), persisted with the decision that produced it. A leaf
 * is required iff it is COVERED or SAMPLED_PENDING; OUT_OF_RANGE and
 * NOT_SAMPLED leaves are not required. Breadth holds when at least one leaf is
 * required and no required leaf is still SAMPLED_PENDING, matching the
 * engine's CLASSIFIED rule.
 *
 * Returns null when any of the leaves has no status (an older engine or an
 * attempt persisted before the field existed); callers then keep the
 * response-count rules of hasAdaptiveV1LeafBreadth unchanged.
 */
export function resolveAdaptiveV1EngineLeafBreadth({
  leafIds,
  coverageStatusByLeaf,
}: {
  leafIds: readonly number[]
  coverageStatusByLeaf: ReadonlyMap<
    number,
    AdaptiveLeafCoverageStatus | null | undefined
  >
}): boolean | null {
  if (leafIds.length === 0) return null
  const statuses: AdaptiveLeafCoverageStatus[] = []
  for (const leafId of leafIds) {
    const status = coverageStatusByLeaf.get(leafId)
    if (!status) return null
    statuses.push(status)
  }
  const required = statuses.filter(
    (status) => status === 'COVERED' || status === 'SAMPLED_PENDING'
  )
  return required.length > 0 && required.every((status) => status === 'COVERED')
}
