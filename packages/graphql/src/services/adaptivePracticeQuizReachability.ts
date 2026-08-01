import {
  information,
  informationAtDifficulty,
  normalizeEnabledRootWeights,
} from '@klicker-uzh/adaptive-learning'
import { GraphQLError } from 'graphql'

import type {
  AdaptiveConfiguredAssignment,
  AdaptiveConfiguredLevel,
  AdaptiveConfiguredNode,
  AdaptiveConfiguredSettings,
} from './adaptivePracticeQuizReadinessTypes.js'

export function computeMinimumEvidenceByNode({
  nodes,
  childrenByParent,
  effectivelyEnabled,
  minQuestionsPerLeaf,
}: {
  nodes: AdaptiveConfiguredNode[]
  childrenByParent: Map<number, AdaptiveConfiguredNode[]>
  effectivelyEnabled: Map<number, boolean>
  minQuestionsPerLeaf: number
}): Map<number, number> {
  const minimumByNode = new Map<number, number>()
  for (const node of nodes.slice().sort((a, b) => b.depth - a.depth)) {
    if (!(effectivelyEnabled.get(node.id) ?? false)) continue
    const structuralChildren = childrenByParent.get(node.id) ?? []
    const enabledChildren = structuralChildren.filter((child) =>
      effectivelyEnabled.get(child.id)
    )
    minimumByNode.set(
      node.id,
      structuralChildren.length === 0
        ? minQuestionsPerLeaf
        : enabledChildren.reduce(
            (sum, child) => sum + (minimumByNode.get(child.id) ?? 0),
            0
          )
    )
  }
  return minimumByNode
}

export function minimumDefined(values: Array<number | null>): number | null {
  const defined = values.filter((value): value is number => value !== null)
  return defined.length > 0 ? Math.min(...defined) : null
}

export function capAssignmentsByRoot({
  roots,
  assignments,
  settings,
  nodes,
  childrenByParent,
  effectivelyEnabled,
}: {
  roots: AdaptiveConfiguredNode[]
  assignments: AdaptiveConfiguredAssignment[]
  settings: AdaptiveConfiguredSettings
  nodes: AdaptiveConfiguredNode[]
  childrenByParent: Map<number, AdaptiveConfiguredNode[]>
  effectivelyEnabled: Map<number, boolean>
}): Map<number, AdaptiveConfiguredAssignment[]> {
  const byLeaf = new Map<number, AdaptiveConfiguredAssignment[]>()
  for (const assignment of assignments) {
    const entries = byLeaf.get(assignment.leafNodeId) ?? []
    entries.push(assignment)
    byLeaf.set(assignment.leafNodeId, entries)
  }

  const selectedByNode = new Map<number, AdaptiveConfiguredAssignment[]>()
  const nodesDeepestFirst = nodes.slice().sort((a, b) => b.depth - a.depth)
  for (const node of nodesDeepestFirst) {
    if (!(effectivelyEnabled.get(node.id) ?? false)) continue
    const structuralChildren = childrenByParent.get(node.id) ?? []
    const enabledChildren = structuralChildren.filter((child) =>
      effectivelyEnabled.get(child.id)
    )
    const candidates =
      structuralChildren.length === 0
        ? (byLeaf.get(node.id) ?? [])
        : enabledChildren.flatMap((child) => selectedByNode.get(child.id) ?? [])
    const cap = minimumDefined([
      ...(structuralChildren.length === 0 ? [settings.perLeafQuestionCap] : []),
      node.questionCap,
    ])
    selectedByNode.set(
      node.id,
      selectWithLeafMinimums({
        assignments: candidates,
        minQuestionsPerLeaf: settings.minQuestionsPerLeaf,
        cap,
      })
    )
  }

  return new Map(
    roots.map((root) => [root.id, selectedByNode.get(root.id) ?? []])
  )
}

function selectWithLeafMinimums({
  assignments,
  minQuestionsPerLeaf,
  cap,
}: {
  assignments: AdaptiveConfiguredAssignment[]
  minQuestionsPerLeaf: number
  cap: number | null
}): AdaptiveConfiguredAssignment[] {
  const byLeaf = new Map<number, AdaptiveConfiguredAssignment[]>()
  for (const assignment of assignments) {
    const entries = byLeaf.get(assignment.leafNodeId) ?? []
    entries.push(assignment)
    byLeaf.set(assignment.leafNodeId, entries)
  }
  for (const entries of byLeaf.values()) {
    entries.sort(compareItemInformationDescending)
  }

  const reserved: AdaptiveConfiguredAssignment[] = []
  const orderedLeaves = Array.from(byLeaf.entries()).sort(
    ([leftLeafId], [rightLeafId]) => leftLeafId - rightLeafId
  )
  for (let round = 0; round < minQuestionsPerLeaf; round++) {
    for (const [, entries] of orderedLeaves) {
      const assignment = entries[round]
      if (assignment) reserved.push(assignment)
    }
  }

  const reservedIds = new Set(reserved.map(({ id }) => id))
  const remaining = assignments
    .filter(({ id }) => !reservedIds.has(id))
    .sort(compareItemInformationDescending)
  const ordered = [...reserved, ...remaining]
  return cap === null ? ordered : ordered.slice(0, cap)
}

export function allocateRootQuestionBudget({
  roots,
  capacities,
  minimumEvidenceByNode,
  totalQuestionCap,
}: {
  roots: AdaptiveConfiguredNode[]
  capacities: Map<number, number>
  minimumEvidenceByNode: Map<number, number>
  totalQuestionCap: number
}): Map<number, number> {
  const normalized = normalizeEnabledRootWeights(
    roots.map((root) => ({ key: root.id, weight: root.weight ?? 0 }))
  )
  if (!normalized.ok) {
    throw new GraphQLError(
      'Enabled root competences require positive finite weights.',
      { extensions: { code: 'ADAPTIVE_ROOT_WEIGHT_INVALID' } }
    )
  }
  const normalizedWeights = new Map(
    normalized.normalized.map(({ key, weight }) => [key, weight])
  )
  const allocations = new Map(roots.map((root) => [root.id, 0]))
  let remaining = Math.min(
    totalQuestionCap,
    roots.reduce((sum, root) => sum + (capacities.get(root.id) ?? 0), 0)
  )

  while (remaining > 0) {
    const withCapacity = roots.filter(
      (root) => (allocations.get(root.id) ?? 0) < (capacities.get(root.id) ?? 0)
    )
    if (withCapacity.length === 0) break
    const belowMinimum = withCapacity.filter(
      (root) =>
        (allocations.get(root.id) ?? 0) <
        Math.min(
          capacities.get(root.id) ?? 0,
          minimumEvidenceByNode.get(root.id) ?? 0
        )
    )
    const candidates = belowMinimum.length > 0 ? belowMinimum : withCapacity
    candidates.sort((a, b) => {
      const score = (root: AdaptiveConfiguredNode) =>
        normalizedWeights.get(root.id)! / ((allocations.get(root.id) ?? 0) + 1)
      return score(b) - score(a) || a.id - b.id
    })
    const selected = candidates[0]!
    allocations.set(selected.id, (allocations.get(selected.id) ?? 0) + 1)
    remaining -= 1
  }

  return allocations
}

export function buildThetaGrid(
  range: { min: number; max: number },
  levels: AdaptiveConfiguredLevel[],
  assignments: AdaptiveConfiguredAssignment[]
): number[] {
  const values = new Set<number>()
  const steps = 60
  for (let index = 0; index <= steps; index++) {
    values.add(range.min + ((range.max - range.min) * index) / steps)
  }
  for (const level of levels) {
    values.add(level.theta)
    values.add(representativeBandTheta(level, range))
  }
  for (const assignment of assignments) {
    if (
      assignment.difficulty >= range.min &&
      assignment.difficulty <= range.max
    ) {
      values.add(assignment.difficulty)
    }
  }
  return Array.from(values).sort((a, b) => a - b)
}

export function representativeBandTheta(
  level: AdaptiveConfiguredLevel,
  range: { min: number; max: number }
): number {
  const lower = Number.isFinite(level.lowerBound)
    ? Math.max(level.lowerBound, range.min)
    : range.min
  const upper = Number.isFinite(level.upperBound)
    ? Math.min(level.upperBound, range.max)
    : range.max
  return lower + (upper - lower) / 2
}

export function itemInformation(
  theta: number,
  assignment: AdaptiveConfiguredAssignment
): number {
  return information(theta, {
    a: assignment.discrimination,
    b: assignment.difficulty,
    c: assignment.guessing,
  })
}

function compareItemInformationDescending(
  a: AdaptiveConfiguredAssignment,
  b: AdaptiveConfiguredAssignment
): number {
  return (
    informationAtDifficulty({ a: b.discrimination, c: b.guessing }) -
    informationAtDifficulty({ a: a.discrimination, c: a.guessing })
  )
}
