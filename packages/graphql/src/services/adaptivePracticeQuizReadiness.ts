import {
  ADAPTIVE_PLANNING_BUDGET_MINUTES,
  ADAPTIVE_SECONDS_PER_ITEM,
  isAdaptiveProductPreset,
  MAX_DISCRIMINATION,
  MIN_PRODUCT_ITEMS_PER_COVERAGE_CELL,
} from '@klicker-uzh/adaptive-learning'

import {
  allocateRootQuestionBudget,
  buildThetaGrid,
  capAssignmentsByRoot,
  computeMinimumEvidenceByNode,
  itemInformation,
  minimumDefined,
  representativeBandTheta,
} from './adaptivePracticeQuizReachability.js'
import type {
  AdaptiveConfiguredAssignment,
  AdaptiveConfiguredCoverage,
  AdaptiveConfiguredLevel,
  AdaptiveConfiguredNode,
  AdaptiveConfiguredSettings,
} from './adaptivePracticeQuizReadinessTypes.js'

export type {
  AdaptiveConfiguredAssignment,
  AdaptiveConfiguredCoverage,
  AdaptiveConfiguredLevel,
  AdaptiveConfiguredNode,
  AdaptiveConfiguredSettings,
} from './adaptivePracticeQuizReadinessTypes.js'

export {
  ADAPTIVE_PLANNING_BUDGET_MINUTES,
  ADAPTIVE_SECONDS_PER_ITEM,
} from '@klicker-uzh/adaptive-learning'
export const MAX_ADAPTIVE_QUESTION_CAP = 1000

export const ADAPTIVE_PUBLICATION_BLOCKING_WARNING_CODES = new Set([
  'ADAPTIVE_MINIMUM_EVIDENCE_UNREACHABLE',
  'ADAPTIVE_MINIMUM_EVIDENCE_CAPPED',
  'ADAPTIVE_GLOBAL_MINIMUM_EVIDENCE_CAPPED',
  'ADAPTIVE_CLASSIFICATION_BANDS_UNREACHABLE',
])

export type AdaptiveReadinessIssue = {
  code: string
  message: string
  parameters: AdaptiveReadinessIssueParameters
  path?: string
  nodeId?: number
  leafNodeId?: number
  levelId?: number
  assignmentId?: number
}

export type AdaptiveReadinessIssueParameters = {
  nodeName?: string
  elementName?: string
  field?: string
  minimumValue?: number
  maximumValue?: number
  targetItemCount?: number
  enabledAssignmentCount?: number
  requiredQuestionCount?: number
  availableItemCount?: number
  effectiveQuestionCap?: number
  totalQuestionCap?: number
  classifiableLevelCount?: number
  levelCount?: number
  estimatedDurationMinutes?: number
  secondsPerItem?: number
  assignmentId?: number
  nodeId?: number
  scaleVersionId?: string
  calibrationStatus?: string
  elementVersion?: number
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
  const strictProductReadiness = isAdaptiveProductPreset(settings.preset)
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
      parameters: {},
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
        parameters: { nodeName: root.name },
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
    isUsableAdaptiveAssignment
  )
  const assignmentsByCell = new Map<string, AdaptiveConfiguredAssignment[]>()
  const assignmentsByLeaf = new Map<number, AdaptiveConfiguredAssignment[]>()

  for (const assignment of selectedAssignments) {
    if (!assignment.available) {
      const accessRevoked =
        assignment.availabilityReason === 'OWNER_ACCESS_REVOKED'
      errors.push({
        code: accessRevoked
          ? 'ADAPTIVE_ITEM_ACCESS_REVOKED'
          : 'ADAPTIVE_ITEM_UNAVAILABLE',
        message: accessRevoked
          ? `The competence tree owner can no longer read element ${assignment.elementName}.`
          : `Element ${assignment.elementName} has been deleted and cannot be included in a new adaptive pool.`,
        parameters: { elementName: assignment.elementName },
        path: `assignments.${assignment.id}`,
        leafNodeId: assignment.leafNodeId,
        levelId: assignment.levelId,
        assignmentId: assignment.id,
      })
      continue
    }

    let usable = true
    if (!assignment.controlledAnswerReady) {
      errors.push({
        code: 'ADAPTIVE_ITEM_NOT_SCORABLE',
        message: `Element ${assignment.elementName} does not contain a controlled answer that can be graded adaptively.`,
        parameters: { elementName: assignment.elementName },
        path: `assignments.${assignment.id}`,
        leafNodeId: assignment.leafNodeId,
        levelId: assignment.levelId,
        assignmentId: assignment.id,
      })
      usable = false
    }

    if (!hasValidAdaptiveItemParameters(assignment)) {
      errors.push({
        code: 'ADAPTIVE_ITEM_PARAMETERS_INVALID',
        message: `Element ${assignment.elementName} has invalid effective item parameters.`,
        parameters: { elementName: assignment.elementName },
        path: `assignments.${assignment.id}`,
        assignmentId: assignment.id,
      })
      usable = false
    }
    if (!usable) continue

    const cellKey = `${assignment.leafNodeId}:${assignment.levelId}`
    const cellAssignments = assignmentsByCell.get(cellKey) ?? []
    cellAssignments.push(assignment)
    assignmentsByCell.set(cellKey, cellAssignments)

    const leafAssignments = assignmentsByLeaf.get(assignment.leafNodeId) ?? []
    leafAssignments.push(assignment)
    assignmentsByLeaf.set(assignment.leafNodeId, leafAssignments)
  }

  const coverageReadiness: AdaptiveCoverageReadiness[] = []
  for (const coverage of coverages) {
    if (!coverage.enabled || !enabledLeafIds.has(coverage.leafNodeId)) continue

    const enabledAssignmentCount =
      assignmentsByCell.get(`${coverage.leafNodeId}:${coverage.levelId}`)
        ?.length ?? 0
    const requiredItemCount = strictProductReadiness
      ? MIN_PRODUCT_ITEMS_PER_COVERAGE_CELL
      : 1
    const ready = enabledAssignmentCount >= requiredItemCount
    coverageReadiness.push({
      coverageId: coverage.id,
      leafNodeId: coverage.leafNodeId,
      levelId: coverage.levelId,
      targetItemCount: coverage.targetItemCount,
      enabledAssignmentCount,
      ready,
    })

    if (enabledAssignmentCount === 0) {
      errors.push({
        code: 'ADAPTIVE_COVERAGE_CELL_EMPTY',
        message:
          'Every enabled leaf-level coverage cell needs at least one enabled element.',
        parameters: {},
        path: `coverages.${coverage.id}`,
        leafNodeId: coverage.leafNodeId,
        levelId: coverage.levelId,
      })
    } else if (!ready) {
      errors.push({
        code: 'ADAPTIVE_COVERAGE_BELOW_PRODUCT_MINIMUM',
        message: `Production presets require at least ${MIN_PRODUCT_ITEMS_PER_COVERAGE_CELL} independent, enabled, scorable elements in every enabled leaf-level cell; this cell has ${enabledAssignmentCount}.`,
        parameters: {
          minimumValue: MIN_PRODUCT_ITEMS_PER_COVERAGE_CELL,
          enabledAssignmentCount,
        },
        path: `coverages.${coverage.id}`,
        leafNodeId: coverage.leafNodeId,
        levelId: coverage.levelId,
      })
    } else if (enabledAssignmentCount < coverage.targetItemCount) {
      warnings.push({
        code: 'ADAPTIVE_COVERAGE_BELOW_TARGET',
        message: `Coverage target is ${coverage.targetItemCount}, but only ${enabledAssignmentCount} enabled element${enabledAssignmentCount === 1 ? '' : 's'} are available.`,
        parameters: {
          targetItemCount: coverage.targetItemCount,
          enabledAssignmentCount,
        },
        path: `coverages.${coverage.id}`,
        leafNodeId: coverage.leafNodeId,
        levelId: coverage.levelId,
      })
    }
  }

  for (const leaf of enabledLeaves) {
    const itemCount = assignmentsByLeaf.get(leaf.id)?.length ?? 0
    if (itemCount < settings.minQuestionsPerLeaf) {
      const issues = strictProductReadiness ? errors : warnings
      issues.push({
        code: 'ADAPTIVE_MINIMUM_EVIDENCE_UNREACHABLE',
        message: `Leaf ${leaf.name} requires ${settings.minQuestionsPerLeaf} questions, but only ${itemCount} enabled elements are available.`,
        parameters: {
          nodeName: leaf.name,
          requiredQuestionCount: settings.minQuestionsPerLeaf,
          availableItemCount: itemCount,
        },
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
      const issues = strictProductReadiness ? errors : warnings
      issues.push({
        code: 'ADAPTIVE_MINIMUM_EVIDENCE_CAPPED',
        message: `Node ${node.name} requires ${required} minimum-evidence question${required === 1 ? '' : 's'}, but its effective cap is ${effectiveCap}.`,
        parameters: {
          nodeName: node.name,
          requiredQuestionCount: required,
          effectiveQuestionCap: effectiveCap,
        },
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
    const issues = strictProductReadiness ? errors : warnings
    issues.push({
      code: 'ADAPTIVE_GLOBAL_MINIMUM_EVIDENCE_CAPPED',
      message: `The enabled leaves require ${totalMinimumEvidence} minimum-evidence questions, but the total cap is ${settings.totalQuestionCap}.`,
      parameters: {
        requiredQuestionCount: totalMinimumEvidence,
        totalQuestionCap: settings.totalQuestionCap,
      },
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
      const issues = strictProductReadiness ? errors : warnings
      issues.push({
        code: 'ADAPTIVE_CLASSIFICATION_BANDS_UNREACHABLE',
        message: `${classifiableLevelCount} of ${levels.length} level bands are potentially classifiable for competence ${root.name} under the shared question cap and configured uncertainty interval.`,
        parameters: {
          nodeName: root.name,
          classifiableLevelCount,
          levelCount: levels.length,
        },
        path: `nodes.${root.id}`,
        nodeId: root.id,
      })
    }

    return {
      nodeId: root.id,
      availableItemCount: cappedAssignments.length,
      allocatedQuestionCount,
      minimumReachableStandardError,
      classifiableLevelCount,
      levelCount: levels.length,
      allLevelsPotentiallyClassifiable,
    }
  })

  const maximumQuestionCount = Array.from(rootAllocations.values()).reduce(
    (sum, count) => sum + count,
    0
  )
  const expectedQuestionCount = maximumQuestionCount
  const estimatedDurationMinutes =
    (expectedQuestionCount * ADAPTIVE_SECONDS_PER_ITEM) / 60
  if (estimatedDurationMinutes > ADAPTIVE_PLANNING_BUDGET_MINUTES) {
    warnings.push({
      code: 'ADAPTIVE_TIME_BUDGET_EXCEEDED',
      message: `The configured coverage is expected to require about ${estimatedDurationMinutes} minutes at the conservative planning estimate of 60 seconds per item.`,
      parameters: {
        estimatedDurationMinutes,
        secondsPerItem: ADAPTIVE_SECONDS_PER_ITEM,
      },
      path: 'totalQuestionCap',
    })
  }

  const hasPublicationBlockingWarning = warnings.some(({ code }) =>
    ADAPTIVE_PUBLICATION_BLOCKING_WARNING_CODES.has(code)
  )

  return {
    ready: errors.length === 0 && !hasPublicationBlockingWarning,
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
        code: 'ADAPTIVE_CONFIG_INTEGER_RANGE',
        message: `${key} must be an integer between ${min} and ${max}.`,
        parameters: {
          field: key,
          minimumValue: min,
          maximumValue: max,
        },
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
      code: 'ADAPTIVE_PER_LEAF_CAP_INVALID',
      message:
        'perLeafQuestionCap must be positive and no larger than the total cap.',
      parameters: { totalQuestionCap: settings.totalQuestionCap },
      path: 'perLeafQuestionCap',
    })
  }
  if (settings.minQuestionsPerLeaf > settings.totalQuestionCap) {
    errors.push({
      code: 'ADAPTIVE_MIN_QUESTIONS_EXCEEDS_TOTAL',
      message: 'minQuestionsPerLeaf cannot exceed the total question cap.',
      parameters: { totalQuestionCap: settings.totalQuestionCap },
      path: 'minQuestionsPerLeaf',
    })
  }
  if (
    !Number.isFinite(settings.classificationZ) ||
    settings.classificationZ <= 0 ||
    settings.classificationZ > 5
  ) {
    errors.push({
      code: 'ADAPTIVE_CLASSIFICATION_Z_INVALID',
      message: 'classificationZ must be greater than 0 and at most 5.',
      parameters: { minimumValue: 0, maximumValue: 5 },
      path: 'classificationZ',
    })
  }
  if (
    !Number.isFinite(settings.topInformationRatio) ||
    settings.topInformationRatio <= 0 ||
    settings.topInformationRatio > 1
  ) {
    errors.push({
      code: 'ADAPTIVE_TOP_INFORMATION_RATIO_INVALID',
      message: 'topInformationRatio must be greater than 0 and at most 1.',
      parameters: { minimumValue: 0, maximumValue: 1 },
      path: 'topInformationRatio',
    })
  }
  if (
    !Number.isFinite(settings.defaultDiscrimination) ||
    settings.defaultDiscrimination <= 0 ||
    settings.defaultDiscrimination > MAX_DISCRIMINATION
  ) {
    errors.push({
      code: 'ADAPTIVE_DEFAULT_DISCRIMINATION_INVALID',
      message: `defaultDiscrimination must be greater than 0 and at most ${MAX_DISCRIMINATION}.`,
      parameters: {
        minimumValue: 0,
        maximumValue: MAX_DISCRIMINATION,
      },
      path: 'defaultDiscrimination',
    })
  }

  return errors
}

function isUsableAdaptiveAssignment(assignment: AdaptiveConfiguredAssignment) {
  return (
    assignment.available &&
    assignment.controlledAnswerReady &&
    hasValidAdaptiveItemParameters(assignment)
  )
}

function hasValidAdaptiveItemParameters(
  assignment: AdaptiveConfiguredAssignment
) {
  return (
    Number.isFinite(assignment.discrimination) &&
    assignment.discrimination > 0 &&
    assignment.discrimination <= MAX_DISCRIMINATION &&
    Number.isFinite(assignment.difficulty) &&
    Number.isFinite(assignment.guessing) &&
    assignment.guessing >= 0 &&
    assignment.guessing < 1
  )
}
