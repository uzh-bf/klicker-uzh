import {
  information,
  informationAtDifficulty,
  MAX_DISCRIMINATION,
} from '@klicker-uzh/adaptive-learning'

export const ADAPTIVE_PLANNING_BUDGET_MINUTES = 30
export const ADAPTIVE_SECONDS_PER_ITEM = 60
export const MAX_ADAPTIVE_QUESTION_CAP = 1000

export type AdaptiveConfiguredNode = {
  id: number
  parentId: number | null
  kind: 'COMPETENCE' | 'SUBCOMPETENCE'
  name: string
  depth: number
  enabled: boolean
  weight: number | null
  questionCap: number | null
}

export type AdaptiveConfiguredCoverage = {
  id: number
  leafNodeId: number
  levelId: number
  targetItemCount: number
  enabled: boolean
}

export type AdaptiveConfiguredLevel = {
  id: number
  theta: number
  lowerBound: number
  upperBound: number
}

export type AdaptiveConfiguredAssignment = {
  id: number
  elementId: number
  elementName: string
  elementType: string
  leafNodeId: number
  levelId: number
  enabled: boolean
  available: boolean
  discrimination: number
  difficulty: number
  guessing: number
  controlledAnswerReady: boolean
}

export type AdaptiveConfiguredSettings = {
  totalQuestionCap: number
  perLeafQuestionCap: number | null
  minQuestionsPerLeaf: number
  classificationZ: number
  standardErrorThreshold: number | null
  topInformationRatio: number
  defaultDiscrimination: number
}

export type AdaptiveReadinessIssue = {
  code: string
  message: string
  path?: string
  nodeId?: number
  leafNodeId?: number
  levelId?: number
  assignmentId?: number
}

export type AdaptiveCoverageReadiness = {
  coverageId: number
  leafNodeId: number
  levelId: number
  targetItemCount: number
  enabledAssignmentCount: number
  ready: boolean
}

export type AdaptiveRootReachability = {
  nodeId: number
  availableItemCount: number
  allocatedQuestionCount: number
  minimumReachableStandardError: number | null
  thresholdReachable: boolean | null
  classifiableLevelCount: number
  levelCount: number
  allLevelsPotentiallyClassifiable: boolean
}

export type AdaptiveQuizReadiness = {
  ready: boolean
  errors: AdaptiveReadinessIssue[]
  warnings: AdaptiveReadinessIssue[]
  coverages: AdaptiveCoverageReadiness[]
  rootReachability: AdaptiveRootReachability[]
  enabledRootCount: number
  enabledLeafCount: number
  enabledAssignmentCount: number
  expectedQuestionCount: number
  estimatedDurationMinutes: number
}

export function validateAdaptiveQuizReadiness({
  settings,
  nodes,
  coverages,
  assignments,
  levels,
  thetaRange,
}: {
  settings: AdaptiveConfiguredSettings
  nodes: AdaptiveConfiguredNode[]
  coverages: AdaptiveConfiguredCoverage[]
  assignments: AdaptiveConfiguredAssignment[]
  levels: AdaptiveConfiguredLevel[]
  thetaRange: { min: number; max: number }
}): AdaptiveQuizReadiness {
  const errors: AdaptiveReadinessIssue[] = []
  const warnings: AdaptiveReadinessIssue[] = []
  const childrenByParent = new Map<number, AdaptiveConfiguredNode[]>()

  for (const node of nodes) {
    if (node.parentId === null) continue
    const children = childrenByParent.get(node.parentId) ?? []
    children.push(node)
    childrenByParent.set(node.parentId, children)
  }

  errors.push(...validateAdaptiveSettings(settings))

  const effectivelyEnabled = new Map<number, boolean>()
  const rootByNode = new Map<number, number>()
  for (const node of nodes.slice().sort((a, b) => a.depth - b.depth)) {
    const parentEnabled =
      node.parentId === null
        ? true
        : (effectivelyEnabled.get(node.parentId) ?? false)
    effectivelyEnabled.set(node.id, node.enabled && parentEnabled)
    rootByNode.set(
      node.id,
      node.parentId === null
        ? node.id
        : (rootByNode.get(node.parentId) ?? node.id)
    )
  }

  const enabledRoots = nodes.filter(
    (node) =>
      node.parentId === null && (effectivelyEnabled.get(node.id) ?? false)
  )
  const enabledLeaves = nodes.filter(
    (node) =>
      (effectivelyEnabled.get(node.id) ?? false) &&
      (childrenByParent.get(node.id)?.length ?? 0) === 0
  )
  const enabledLeafIds = new Set(enabledLeaves.map(({ id }) => id))

  if (enabledRoots.length === 0) {
    errors.push({
      code: 'ADAPTIVE_NO_ENABLED_COMPETENCE',
      message: 'At least one root competence must be enabled.',
      path: 'nodeOverrides',
    })
  }

  for (const root of enabledRoots) {
    const hasEnabledLeaf = enabledLeaves.some(
      (leaf) => rootByNode.get(leaf.id) === root.id
    )
    if (!hasEnabledLeaf) {
      errors.push({
        code: 'ADAPTIVE_COMPETENCE_WITHOUT_ENABLED_LEAF',
        message: `Enabled competence ${root.name} has no enabled subcompetence leaf.`,
        path: `nodes.${root.id}`,
        nodeId: root.id,
      })
    }
  }

  const selectedAssignments = assignments.filter(
    (assignment) =>
      assignment.enabled && enabledLeafIds.has(assignment.leafNodeId)
  )
  const enabledAssignments = selectedAssignments.filter(
    ({ available }) => available
  )
  const assignmentsByCell = new Map<string, AdaptiveConfiguredAssignment[]>()
  const assignmentsByLeaf = new Map<number, AdaptiveConfiguredAssignment[]>()

  for (const assignment of selectedAssignments) {
    if (!assignment.available) {
      errors.push({
        code: 'ADAPTIVE_ITEM_UNAVAILABLE',
        message: `Element ${assignment.elementName} has been deleted and cannot be included in a new adaptive pool.`,
        path: `assignments.${assignment.id}`,
        leafNodeId: assignment.leafNodeId,
        levelId: assignment.levelId,
        assignmentId: assignment.id,
      })
      continue
    }

    const cellKey = `${assignment.leafNodeId}:${assignment.levelId}`
    const cellAssignments = assignmentsByCell.get(cellKey) ?? []
    cellAssignments.push(assignment)
    assignmentsByCell.set(cellKey, cellAssignments)

    const leafAssignments = assignmentsByLeaf.get(assignment.leafNodeId) ?? []
    leafAssignments.push(assignment)
    assignmentsByLeaf.set(assignment.leafNodeId, leafAssignments)

    if (!assignment.controlledAnswerReady) {
      errors.push({
        code: 'ADAPTIVE_ITEM_NOT_SCORABLE',
        message: `Element ${assignment.elementName} does not contain a controlled answer that can be graded adaptively.`,
        path: `assignments.${assignment.id}`,
        leafNodeId: assignment.leafNodeId,
        levelId: assignment.levelId,
        assignmentId: assignment.id,
      })
    }

    if (
      !Number.isFinite(assignment.discrimination) ||
      assignment.discrimination <= 0 ||
      assignment.discrimination > MAX_DISCRIMINATION ||
      !Number.isFinite(assignment.difficulty) ||
      !Number.isFinite(assignment.guessing) ||
      assignment.guessing < 0 ||
      assignment.guessing >= 1
    ) {
      errors.push({
        code: 'ADAPTIVE_ITEM_PARAMETERS_INVALID',
        message: `Element ${assignment.elementName} has invalid effective item parameters.`,
        path: `assignments.${assignment.id}`,
        assignmentId: assignment.id,
      })
    }
  }

  const coverageReadiness: AdaptiveCoverageReadiness[] = []
  let targetQuestionCount = 0
  for (const coverage of coverages) {
    if (!coverage.enabled || !enabledLeafIds.has(coverage.leafNodeId)) continue

    const enabledAssignmentCount =
      assignmentsByCell.get(`${coverage.leafNodeId}:${coverage.levelId}`)
        ?.length ?? 0
    const ready = enabledAssignmentCount > 0
    targetQuestionCount += coverage.targetItemCount
    coverageReadiness.push({
      coverageId: coverage.id,
      leafNodeId: coverage.leafNodeId,
      levelId: coverage.levelId,
      targetItemCount: coverage.targetItemCount,
      enabledAssignmentCount,
      ready,
    })

    if (!ready) {
      errors.push({
        code: 'ADAPTIVE_COVERAGE_CELL_EMPTY',
        message:
          'Every enabled leaf-level coverage cell needs at least one enabled element.',
        path: `coverages.${coverage.id}`,
        leafNodeId: coverage.leafNodeId,
        levelId: coverage.levelId,
      })
    } else if (enabledAssignmentCount < coverage.targetItemCount) {
      warnings.push({
        code: 'ADAPTIVE_COVERAGE_BELOW_TARGET',
        message: `Coverage target is ${coverage.targetItemCount}, but only ${enabledAssignmentCount} enabled element${enabledAssignmentCount === 1 ? '' : 's'} are available.`,
        path: `coverages.${coverage.id}`,
        leafNodeId: coverage.leafNodeId,
        levelId: coverage.levelId,
      })
    }
  }

  for (const leaf of enabledLeaves) {
    const itemCount = assignmentsByLeaf.get(leaf.id)?.length ?? 0
    if (itemCount < settings.minQuestionsPerLeaf) {
      warnings.push({
        code: 'ADAPTIVE_MINIMUM_EVIDENCE_UNREACHABLE',
        message: `Leaf ${leaf.name} requires ${settings.minQuestionsPerLeaf} questions, but only ${itemCount} enabled elements are available.`,
        path: `nodes.${leaf.id}`,
        leafNodeId: leaf.id,
      })
    }
  }

  const minimumEvidenceByNode = computeMinimumEvidenceByNode({
    nodes,
    childrenByParent,
    effectivelyEnabled,
    minQuestionsPerLeaf: settings.minQuestionsPerLeaf,
  })
  for (const node of nodes) {
    if (!(effectivelyEnabled.get(node.id) ?? false)) continue
    const required = minimumEvidenceByNode.get(node.id) ?? 0
    const effectiveCap = minimumDefined([
      node.questionCap,
      (childrenByParent.get(node.id)?.length ?? 0) === 0
        ? settings.perLeafQuestionCap
        : null,
    ])
    if (effectiveCap !== null && effectiveCap < required) {
      warnings.push({
        code: 'ADAPTIVE_MINIMUM_EVIDENCE_CAPPED',
        message: `Node ${node.name} requires ${required} minimum-evidence question${required === 1 ? '' : 's'}, but its effective cap is ${effectiveCap}.`,
        path: `nodes.${node.id}.questionCap`,
        nodeId: node.id,
      })
    }
  }

  const totalMinimumEvidence = enabledRoots.reduce(
    (sum, root) => sum + (minimumEvidenceByNode.get(root.id) ?? 0),
    0
  )
  if (settings.totalQuestionCap < totalMinimumEvidence) {
    warnings.push({
      code: 'ADAPTIVE_GLOBAL_MINIMUM_EVIDENCE_CAPPED',
      message: `The enabled leaves require ${totalMinimumEvidence} minimum-evidence questions, but the total cap is ${settings.totalQuestionCap}.`,
      path: 'totalQuestionCap',
    })
  }

  const cappedAssignmentsByRoot = capAssignmentsByRoot({
    roots: enabledRoots,
    assignments: enabledAssignments,
    settings,
    nodes,
    childrenByParent,
    effectivelyEnabled,
  })
  const rootAllocations = allocateRootQuestionBudget({
    roots: enabledRoots,
    capacities: new Map(
      enabledRoots.map((root) => [
        root.id,
        cappedAssignmentsByRoot.get(root.id)?.length ?? 0,
      ])
    ),
    minimumEvidenceByNode,
    totalQuestionCap: settings.totalQuestionCap,
  })
  const thetaGrid = buildThetaGrid(thetaRange, levels, enabledAssignments)

  const rootReachability = enabledRoots.map((root) => {
    const cappedAssignments = cappedAssignmentsByRoot.get(root.id) ?? []
    const allocatedQuestionCount = rootAllocations.get(root.id) ?? 0
    const allocatedAssignments = cappedAssignments.slice(
      0,
      allocatedQuestionCount
    )
    const maximumInformation = Math.max(
      0,
      ...thetaGrid.map((theta) =>
        allocatedAssignments.reduce(
          (sum, assignment) => sum + itemInformation(theta, assignment),
          0
        )
      )
    )
    const minimumReachableStandardError =
      maximumInformation > 0 ? 1 / Math.sqrt(maximumInformation) : null
    const thresholdReachable =
      settings.standardErrorThreshold === null ||
      minimumReachableStandardError === null
        ? settings.standardErrorThreshold === null
          ? null
          : false
        : minimumReachableStandardError <= settings.standardErrorThreshold

    if (thresholdReachable === false) {
      warnings.push({
        code: 'ADAPTIVE_STANDARD_ERROR_UNREACHABLE',
        message: `The configured standard-error threshold is not reachable for competence ${root.name} with the enabled pool and caps.`,
        path: `nodes.${root.id}`,
        nodeId: root.id,
      })
    }

    const classifiableLevelCount = levels.filter((level) => {
      const theta = representativeBandTheta(level, thetaRange)
      const totalInformation = allocatedAssignments.reduce(
        (sum, assignment) => sum + itemInformation(theta, assignment),
        0
      )
      if (totalInformation <= 0) return false
      const halfWidth = settings.classificationZ / Math.sqrt(totalInformation)
      return (
        theta - halfWidth >= level.lowerBound &&
        theta + halfWidth < level.upperBound
      )
    }).length
    const allLevelsPotentiallyClassifiable =
      classifiableLevelCount === levels.length
    if (!allLevelsPotentiallyClassifiable) {
      warnings.push({
        code: 'ADAPTIVE_CLASSIFICATION_BANDS_UNREACHABLE',
        message: `${classifiableLevelCount} of ${levels.length} level bands are potentially classifiable for competence ${root.name} under the shared question cap and configured uncertainty interval.`,
        path: `nodes.${root.id}`,
        nodeId: root.id,
      })
    }

    return {
      nodeId: root.id,
      availableItemCount: cappedAssignments.length,
      allocatedQuestionCount,
      minimumReachableStandardError,
      thresholdReachable,
      classifiableLevelCount,
      levelCount: levels.length,
      allLevelsPotentiallyClassifiable,
    }
  })

  const maximumQuestionCount = Array.from(rootAllocations.values()).reduce(
    (sum, count) => sum + count,
    0
  )
  if (targetQuestionCount > maximumQuestionCount) {
    warnings.push({
      code: 'ADAPTIVE_COVERAGE_TARGETS_CAPPED',
      message: `Enabled coverage targets request ${targetQuestionCount} questions, but the shared and nested caps allow at most ${maximumQuestionCount}.`,
      path: 'totalQuestionCap',
    })
  }
  const expectedQuestionCount = Math.min(
    targetQuestionCount,
    maximumQuestionCount
  )
  const estimatedDurationMinutes =
    (expectedQuestionCount * ADAPTIVE_SECONDS_PER_ITEM) / 60
  if (estimatedDurationMinutes > ADAPTIVE_PLANNING_BUDGET_MINUTES) {
    warnings.push({
      code: 'ADAPTIVE_TIME_BUDGET_EXCEEDED',
      message: `The configured coverage is expected to require about ${estimatedDurationMinutes} minutes at the conservative planning estimate of 60 seconds per item.`,
      path: 'totalQuestionCap',
    })
  }

  return {
    ready: errors.length === 0,
    errors,
    warnings,
    coverages: coverageReadiness,
    rootReachability,
    enabledRootCount: enabledRoots.length,
    enabledLeafCount: enabledLeaves.length,
    enabledAssignmentCount: enabledAssignments.length,
    expectedQuestionCount,
    estimatedDurationMinutes,
  }
}

export function validateAdaptiveSettings(
  settings: AdaptiveConfiguredSettings
): AdaptiveReadinessIssue[] {
  const errors: AdaptiveReadinessIssue[] = []
  const integerBounds: Array<{
    key: 'totalQuestionCap' | 'minQuestionsPerLeaf'
    min: number
    max: number
  }> = [
    { key: 'totalQuestionCap', min: 1, max: MAX_ADAPTIVE_QUESTION_CAP },
    { key: 'minQuestionsPerLeaf', min: 1, max: MAX_ADAPTIVE_QUESTION_CAP },
  ]
  for (const { key, min, max } of integerBounds) {
    const value = settings[key]
    if (!Number.isInteger(value) || value < min || value > max) {
      errors.push({
        code: 'ADAPTIVE_CONFIG_VALUE_INVALID',
        message: `${key} must be an integer between ${min} and ${max}.`,
        path: key,
      })
    }
  }

  if (
    settings.perLeafQuestionCap !== null &&
    (!Number.isInteger(settings.perLeafQuestionCap) ||
      settings.perLeafQuestionCap < 1 ||
      settings.perLeafQuestionCap > settings.totalQuestionCap)
  ) {
    errors.push({
      code: 'ADAPTIVE_CONFIG_VALUE_INVALID',
      message:
        'perLeafQuestionCap must be positive and no larger than the total cap.',
      path: 'perLeafQuestionCap',
    })
  }
  if (settings.minQuestionsPerLeaf > settings.totalQuestionCap) {
    errors.push({
      code: 'ADAPTIVE_CONFIG_VALUE_INVALID',
      message: 'minQuestionsPerLeaf cannot exceed the total question cap.',
      path: 'minQuestionsPerLeaf',
    })
  }
  if (
    !Number.isFinite(settings.classificationZ) ||
    settings.classificationZ <= 0 ||
    settings.classificationZ > 5
  ) {
    errors.push({
      code: 'ADAPTIVE_CONFIG_VALUE_INVALID',
      message: 'classificationZ must be greater than 0 and at most 5.',
      path: 'classificationZ',
    })
  }
  if (
    settings.standardErrorThreshold !== null &&
    (!Number.isFinite(settings.standardErrorThreshold) ||
      settings.standardErrorThreshold <= 0)
  ) {
    errors.push({
      code: 'ADAPTIVE_CONFIG_VALUE_INVALID',
      message: 'standardErrorThreshold must be a positive finite number.',
      path: 'standardErrorThreshold',
    })
  }
  if (
    !Number.isFinite(settings.topInformationRatio) ||
    settings.topInformationRatio <= 0 ||
    settings.topInformationRatio > 1
  ) {
    errors.push({
      code: 'ADAPTIVE_CONFIG_VALUE_INVALID',
      message: 'topInformationRatio must be greater than 0 and at most 1.',
      path: 'topInformationRatio',
    })
  }
  if (
    !Number.isFinite(settings.defaultDiscrimination) ||
    settings.defaultDiscrimination <= 0 ||
    settings.defaultDiscrimination > MAX_DISCRIMINATION
  ) {
    errors.push({
      code: 'ADAPTIVE_CONFIG_VALUE_INVALID',
      message: `defaultDiscrimination must be greater than 0 and at most ${MAX_DISCRIMINATION}.`,
      path: 'defaultDiscrimination',
    })
  }

  return errors
}

function computeMinimumEvidenceByNode({
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

function minimumDefined(values: Array<number | null>): number | null {
  const defined = values.filter((value): value is number => value !== null)
  return defined.length > 0 ? Math.min(...defined) : null
}

function capAssignmentsByRoot({
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

function allocateRootQuestionBudget({
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
    const hasPositiveWeight = candidates.some((root) => (root.weight ?? 0) > 0)
    candidates.sort((a, b) => {
      const score = (root: AdaptiveConfiguredNode) =>
        (hasPositiveWeight ? (root.weight ?? 0) : 1) /
        ((allocations.get(root.id) ?? 0) + 1)
      return score(b) - score(a) || a.id - b.id
    })
    const selected = candidates[0]!
    allocations.set(selected.id, (allocations.get(selected.id) ?? 0) + 1)
    remaining -= 1
  }

  return allocations
}

function buildThetaGrid(
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

function representativeBandTheta(
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

function itemInformation(
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
