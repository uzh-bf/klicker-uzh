import { normalizeEnabledRootWeights } from '@klicker-uzh/adaptive-contract'
import { getEffectivelyEnabledRuntimeNodes } from './adaptivePracticeQuizEstimatePersistence.js'
import type { AdaptiveRuntimeNode } from './adaptivePracticeQuizRuntime.js'

/**
 * Share of each enabled competence (root node) in the overall estimate, as
 * a fraction summing to 1. The overall estimate is the weighted combination
 * of the root estimates, so this is each competence's contribution to the
 * overall level. Subcompetence weights only steer item sampling and never
 * enter a score, so subcompetences have no share. Empty when the published
 * root weights are not usable.
 */
export function getAdaptiveRootWeightShares(
  nodes: AdaptiveRuntimeNode[]
): Map<number, number> {
  const roots = getEffectivelyEnabledRuntimeNodes(nodes).filter(
    (node) => node.parentId === null
  )
  const result = normalizeEnabledRootWeights(
    roots.map((node) => ({ key: node.id, weight: node.weight ?? 0 }))
  )
  return result.ok
    ? new Map(result.normalized.map(({ key, weight }) => [key, weight]))
    : new Map()
}
