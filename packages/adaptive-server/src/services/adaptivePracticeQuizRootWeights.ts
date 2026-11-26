import { normalizeEnabledRootWeights } from '@klicker-uzh/adaptive-contract'
import * as DB from '@klicker-uzh/prisma/client'
import type { AdaptivePracticeQuizNodeOverrideInput } from './adaptivePracticeQuizConfigTypes.js'
import type { AdaptiveReadinessIssue } from './adaptivePracticeQuizReadiness.js'

export function normalizeRootWeights(
  nodes: DB.CompetenceTreeNode[],
  overrides: Map<number, AdaptivePracticeQuizNodeOverrideInput>,
  errors: AdaptiveReadinessIssue[]
): Map<number, number> {
  const enabledRoots = nodes
    .filter((node) => node.kind === DB.AdaptiveNodeKind.COMPETENCE)
    .filter((node) => overrides.get(node.id)?.enabled ?? true)
    .map((node) => ({
      node,
      weight: overrides.get(node.id)?.weight ?? node.weight,
    }))
  const result = normalizeEnabledRootWeights(
    enabledRoots.map(({ node, weight }) => ({ key: node, weight }))
  )
  if (!result.ok && result.reason === 'NO_ENABLED_ROOTS') {
    errors.push({
      code: 'ADAPTIVE_ROOT_WEIGHT_INVALID',
      message: 'At least one competence with positive weight must be enabled.',
      parameters: {},
      path: 'nodeOverrides',
    })
    return new Map()
  }
  if (!result.ok) {
    for (const node of result.invalidKeys) {
      errors.push({
        code: 'ADAPTIVE_ROOT_WEIGHT_INVALID',
        message: `Enabled competence ${node.name} must have a positive finite weight.`,
        parameters: { nodeName: node.name },
        path: `nodeOverrides.${node.id}.weight`,
        nodeId: node.id,
      })
    }
    return new Map()
  }
  return new Map(
    result.normalized.map(({ key: node, weight }) => [node.id, weight])
  )
}
