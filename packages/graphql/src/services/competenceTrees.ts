import {
  DEFAULT_DISCRIMINATION,
  DEFAULT_THETA_RANGE,
  MAX_ABSOLUTE_THETA,
  MAX_COMPETENCE_TREE_DEPTH,
  MAX_DISCRIMINATION,
  normalizeEnabledRootWeights,
} from '@klicker-uzh/adaptive-learning'
import { GraphQLError } from 'graphql'
import { isSupportedAdaptiveElementType } from './adaptiveElementValidation.js'
import {
  getEnabledLeafDescendants,
  isCompetenceTreeLeafNode,
  isCompetenceTreeNodeEnabled,
  toCompetenceTreeKey,
} from './competenceTreeValidationHierarchy.js'
import type {
  CompetenceTreeValidationCoverage,
  CompetenceTreeValidationInput,
  CompetenceTreeValidationIssue,
  CompetenceTreeValidationLevel,
  CompetenceTreeValidationNode,
  CompetenceTreeValidationResult,
  NormalizedCompetenceWeight,
} from './competenceTreeValidationTypes.js'

export {
  deriveAdaptiveItemParameters,
  hasControlledAdaptiveAnswer,
  isSupportedAdaptiveElementType,
} from './adaptiveElementValidation.js'
export type {
  CompetenceTreeId,
  CompetenceTreeValidationAssignment,
  CompetenceTreeValidationCoverage,
  CompetenceTreeValidationInput,
  CompetenceTreeValidationIssue,
  CompetenceTreeValidationLevel,
  CompetenceTreeValidationNode,
  CompetenceTreeValidationNodeKind,
  CompetenceTreeValidationResult,
  NormalizedCompetenceWeight,
} from './competenceTreeValidationTypes.js'

export function assertValidCompetenceTreeShape(
  tree: CompetenceTreeValidationInput
) {
  const result = validateCompetenceTreeShape(tree)

  if (!result.valid) {
    throw new GraphQLError('Competence tree is invalid.', {
      extensions: {
        code: 'COMPETENCE_TREE_INVALID',
        issues: result.errors,
      },
    })
  }

  return result
}

export function validateCompetenceTreeShape(
  tree: CompetenceTreeValidationInput
): CompetenceTreeValidationResult {
  const errors: CompetenceTreeValidationIssue[] = []
  const warnings: CompetenceTreeValidationIssue[] = []
  const maxDepth = tree.maxDepth ?? MAX_COMPETENCE_TREE_DEPTH
  const effectiveMaxDepth = Math.min(maxDepth, MAX_COMPETENCE_TREE_DEPTH)
  const thetaMin = tree.thetaMin ?? DEFAULT_THETA_RANGE.min
  const thetaMax = tree.thetaMax ?? DEFAULT_THETA_RANGE.max
  const defaultDiscrimination =
    tree.defaultDiscrimination ?? DEFAULT_DISCRIMINATION

  const addError = (code: string, message: string, path?: string): void => {
    errors.push({ code, message, path })
  }
  const addWarning = (code: string, message: string, path?: string): void => {
    warnings.push({ code, message, path })
  }

  if (typeof tree.name !== 'undefined' && !tree.name?.trim()) {
    addError('TREE_NAME_EMPTY', 'Competence tree name is required.', 'name')
  }
  if (typeof tree.displayName !== 'undefined' && !tree.displayName?.trim()) {
    addError(
      'TREE_DISPLAY_NAME_EMPTY',
      'Competence tree display name is required.',
      'displayName'
    )
  }
  if (
    !Number.isFinite(thetaMin) ||
    !Number.isFinite(thetaMax) ||
    !Number.isFinite(thetaMax - thetaMin) ||
    Math.abs(thetaMin) > MAX_ABSOLUTE_THETA ||
    Math.abs(thetaMax) > MAX_ABSOLUTE_THETA
  ) {
    addError(
      'TREE_THETA_RANGE_INVALID',
      `Competence tree theta bounds must be finite and within +/-${MAX_ABSOLUTE_THETA}.`,
      'thetaMin'
    )
  } else if (thetaMin >= thetaMax) {
    addError(
      'TREE_THETA_RANGE_INVALID',
      'Competence tree thetaMin must be smaller than thetaMax.',
      'thetaMin'
    )
  }
  if (
    !Number.isFinite(defaultDiscrimination) ||
    defaultDiscrimination <= 0 ||
    defaultDiscrimination > MAX_DISCRIMINATION
  ) {
    addError(
      'TREE_DISCRIMINATION_INVALID',
      `Competence tree default discrimination must be between 0 and ${MAX_DISCRIMINATION}.`,
      'defaultDiscrimination'
    )
  }

  if (!Number.isInteger(maxDepth) || maxDepth < 1) {
    addError(
      'TREE_MAX_DEPTH_INVALID',
      'Competence tree maxDepth must be a positive integer.',
      'maxDepth'
    )
  } else if (maxDepth > MAX_COMPETENCE_TREE_DEPTH) {
    addError(
      'TREE_MAX_DEPTH_TOO_DEEP',
      `Competence tree maxDepth cannot exceed ${MAX_COMPETENCE_TREE_DEPTH}.`,
      'maxDepth'
    )
  }

  if (tree.levels.length < 2) {
    addError(
      'LEVEL_COUNT_TOO_LOW',
      'Competence trees require at least two levels.',
      'levels'
    )
  } else if (tree.levels.length < 3) {
    addWarning(
      'LEVEL_COUNT_LOW',
      'At least three levels are recommended for useful adaptive classification.',
      'levels'
    )
  }

  const levelsById = new Map<string, CompetenceTreeValidationLevel>()
  const levelLabels = new Set<string>()
  const levelOrders = new Set<number>()

  for (const [index, level] of tree.levels.entries()) {
    const key = toCompetenceTreeKey(level.id)

    if (!key.trim()) {
      addError(
        'LEVEL_ID_EMPTY',
        'Competence tree level ids cannot be empty.',
        `levels.${index}.id`
      )
    } else if (levelsById.has(key)) {
      addError(
        'LEVEL_ID_DUPLICATE',
        `Level id ${level.id} is used more than once.`,
        `levels.${index}.id`
      )
    }
    levelsById.set(key, level)

    const normalizedLabel = level.label.trim().toLocaleLowerCase()
    if (!normalizedLabel) {
      addError(
        'LEVEL_LABEL_EMPTY',
        'Competence tree level labels cannot be empty.',
        `levels.${index}.label`
      )
    } else if (levelLabels.has(normalizedLabel)) {
      addError(
        'LEVEL_LABEL_DUPLICATE',
        `Level label ${level.label} is used more than once.`,
        `levels.${index}.label`
      )
    }
    levelLabels.add(normalizedLabel)

    if (!Number.isInteger(level.order) || level.order < 0) {
      addError(
        'LEVEL_ORDER_INVALID',
        `Level order ${level.order} must be a non-negative integer.`,
        `levels.${index}.order`
      )
    } else if (levelOrders.has(level.order)) {
      addError(
        'LEVEL_ORDER_DUPLICATE',
        `Level order ${level.order} is used more than once.`,
        `levels.${index}.order`
      )
    }
    levelOrders.add(level.order)
  }

  if (
    [...levelOrders]
      .sort((a, b) => a - b)
      .some((order, index) => order !== index)
  ) {
    addError(
      'LEVEL_ORDER_NOT_CONTIGUOUS',
      'Competence tree level order must start at 0 and remain contiguous.',
      'levels'
    )
  }

  const nodesById = new Map<string, CompetenceTreeValidationNode>()
  const childrenByParentId = new Map<string, CompetenceTreeValidationNode[]>()
  const roots: CompetenceTreeValidationNode[] = []
  const siblingOrders = new Set<string>()
  const siblingOrderGroups = new Map<string, number[]>()

  for (const [index, node] of tree.nodes.entries()) {
    const key = toCompetenceTreeKey(node.id)

    if (!key.trim()) {
      addError(
        'NODE_ID_EMPTY',
        'Competence tree node ids cannot be empty.',
        `nodes.${index}.id`
      )
    } else if (nodesById.has(key)) {
      addError(
        'NODE_ID_DUPLICATE',
        `Node id ${node.id} is used more than once.`,
        `nodes.${index}.id`
      )
    }
    nodesById.set(key, node)
  }

  for (const [index, node] of tree.nodes.entries()) {
    const parentId = node.parentId ?? null
    const parentKey = parentId === null ? 'root' : toCompetenceTreeKey(parentId)
    const siblingOrderKey = `${parentKey}:${node.order}`

    if (!node.name?.trim()) {
      addError(
        'NODE_NAME_EMPTY',
        `Node ${node.id} must have a name.`,
        `nodes.${index}.name`
      )
    }

    if (!Number.isInteger(node.order) || node.order < 0) {
      addError(
        'NODE_ORDER_INVALID',
        `Node ${node.id} order must be a non-negative integer.`,
        `nodes.${index}.order`
      )
    } else if (siblingOrders.has(siblingOrderKey)) {
      addError(
        'NODE_SIBLING_ORDER_DUPLICATE',
        `Node order ${node.order} is used more than once under the same parent.`,
        `nodes.${index}.order`
      )
    }
    siblingOrders.add(siblingOrderKey)
    if (Number.isInteger(node.order) && node.order >= 0) {
      siblingOrderGroups.set(parentKey, [
        ...(siblingOrderGroups.get(parentKey) ?? []),
        node.order,
      ])
    }

    if (parentId === null) {
      roots.push(node)
    } else {
      const parentKey = toCompetenceTreeKey(parentId)
      const parentChildren = childrenByParentId.get(parentKey) ?? []
      parentChildren.push(node)
      childrenByParentId.set(parentKey, parentChildren)

      if (!nodesById.has(parentKey)) {
        addError(
          'NODE_PARENT_MISSING',
          `Node ${node.id} references missing parent ${parentId}.`,
          `nodes.${index}.parentId`
        )
      }
    }
  }

  if (roots.length === 0) {
    addError(
      'ROOT_COUNT_TOO_LOW',
      'Competence trees require at least one root competence.',
      'nodes'
    )
  }

  for (const orders of siblingOrderGroups.values()) {
    const uniqueOrders = [...new Set(orders)].sort((a, b) => a - b)
    if (uniqueOrders.some((order, index) => order !== index)) {
      addError(
        'NODE_SIBLING_ORDER_NOT_CONTIGUOUS',
        'Sibling node order must start at 0 and remain contiguous.',
        'nodes'
      )
    }
  }

  const visitedNodeIds = new Set<string>()
  for (const node of tree.nodes) {
    const path = new Set<string>()
    let current: CompetenceTreeValidationNode | undefined = node

    while (current && !visitedNodeIds.has(toCompetenceTreeKey(current.id))) {
      const key = toCompetenceTreeKey(current.id)
      if (path.has(key)) {
        addError(
          'NODE_CYCLE',
          `Node ${current.id} is part of a parent cycle.`,
          `nodes.${tree.nodes.indexOf(current)}.parentId`
        )
        break
      }
      path.add(key)
      current =
        current.parentId === null || typeof current.parentId === 'undefined'
          ? undefined
          : nodesById.get(toCompetenceTreeKey(current.parentId))
    }

    path.forEach((key) => visitedNodeIds.add(key))
  }

  for (const [index, node] of tree.nodes.entries()) {
    const path = `nodes.${index}`
    const isRoot =
      node.parentId === null || typeof node.parentId === 'undefined'
    const parent = isRoot
      ? null
      : nodesById.get(toCompetenceTreeKey(node.parentId!))

    if (!Number.isInteger(node.depth)) {
      addError(
        'NODE_DEPTH_INVALID',
        `Node ${node.id} depth must be an integer.`,
        `${path}.depth`
      )
    } else if (node.depth < 1 || node.depth > effectiveMaxDepth) {
      addError(
        'NODE_DEPTH_OUT_OF_RANGE',
        `Node ${node.id} depth must be between 1 and ${effectiveMaxDepth}.`,
        `${path}.depth`
      )
    }

    if (isRoot) {
      if (node.kind !== 'COMPETENCE') {
        addError(
          'ROOT_KIND_INVALID',
          `Root node ${node.id} must be a competence.`,
          `${path}.kind`
        )
      }
      if (node.depth !== 1) {
        addError(
          'ROOT_DEPTH_INVALID',
          `Root node ${node.id} must have depth 1.`,
          `${path}.depth`
        )
      }
      if (
        (childrenByParentId.get(toCompetenceTreeKey(node.id)) ?? []).length ===
        0
      ) {
        addError(
          'ROOT_WITHOUT_SUBCOMPETENCE',
          `Root competence ${node.id} must contain at least one subcompetence.`,
          path
        )
      }
    } else {
      if (node.kind !== 'SUBCOMPETENCE') {
        addError(
          'CHILD_KIND_INVALID',
          `Non-root node ${node.id} must be a subcompetence.`,
          `${path}.kind`
        )
      }
      if (parent && node.depth !== parent.depth + 1) {
        addError(
          'NODE_DEPTH_MISMATCH',
          `Node ${node.id} depth must be exactly one greater than its parent.`,
          `${path}.depth`
        )
      }
      if (typeof node.weight === 'number' && node.weight !== 1) {
        addWarning(
          'NON_ROOT_WEIGHT_IGNORED',
          `Non-root node ${node.id} has a weight; v1 aggregation uses root weights only.`,
          `${path}.weight`
        )
      }
    }
  }

  const coverageByLeafId = new Map<string, CompetenceTreeValidationCoverage[]>()
  const coverageCells = new Set<string>()
  const enabledCoverageCells = new Set<string>()
  for (const [index, coverage] of (tree.coverages ?? []).entries()) {
    const path = `coverages.${index}`
    const leafKey = toCompetenceTreeKey(coverage.leafNodeId)
    const levelKey = toCompetenceTreeKey(coverage.levelId)
    const leaf = nodesById.get(leafKey)
    const coverageCell = `${leafKey}:${levelKey}`

    if (coverageCells.has(coverageCell)) {
      addError(
        'COVERAGE_DUPLICATE',
        'Each leaf and level combination can only have one coverage entry.',
        path
      )
    }
    coverageCells.add(coverageCell)

    if (!leaf) {
      addError(
        'COVERAGE_LEAF_MISSING',
        `Coverage references missing leaf node ${coverage.leafNodeId}.`,
        `${path}.leafNodeId`
      )
    } else if (!isCompetenceTreeLeafNode(leaf, childrenByParentId)) {
      addError(
        'COVERAGE_LEAF_NOT_LEAF',
        `Coverage node ${coverage.leafNodeId} is not a leaf.`,
        `${path}.leafNodeId`
      )
    } else if (leaf.kind !== 'SUBCOMPETENCE') {
      addError(
        'COVERAGE_LEAF_KIND_INVALID',
        `Coverage node ${coverage.leafNodeId} must be a subcompetence leaf.`,
        `${path}.leafNodeId`
      )
    }

    if (!levelsById.has(levelKey)) {
      addError(
        'COVERAGE_LEVEL_MISSING',
        `Coverage references missing level ${coverage.levelId}.`,
        `${path}.levelId`
      )
    }

    if (
      typeof coverage.targetItemCount === 'number' &&
      coverage.targetItemCount < 1
    ) {
      addError(
        'COVERAGE_TARGET_INVALID',
        'Coverage targetItemCount must be at least 1.',
        `${path}.targetItemCount`
      )
    }

    if (coverage.enabled !== false) {
      enabledCoverageCells.add(coverageCell)
      const existing = coverageByLeafId.get(leafKey) ?? []
      existing.push(coverage)
      coverageByLeafId.set(leafKey, existing)
    }
  }

  const assignedElementIds = new Set<number>()
  for (const [index, assignment] of (tree.assignments ?? []).entries()) {
    const path = `assignments.${index}`
    const leaf = nodesById.get(toCompetenceTreeKey(assignment.leafNodeId))

    if (assignedElementIds.has(assignment.elementId)) {
      addError(
        'ASSIGNMENT_ELEMENT_DUPLICATE',
        `Element ${assignment.elementId} can only be assigned once per competence tree.`,
        `${path}.elementId`
      )
    }
    assignedElementIds.add(assignment.elementId)

    if (!isSupportedAdaptiveElementType(assignment.type)) {
      addError(
        'ASSIGNMENT_TYPE_UNSUPPORTED',
        `Element ${assignment.elementId} has unsupported adaptive type ${assignment.type}.`,
        `${path}.type`
      )
    }

    if (
      assignment.type === 'FREE_TEXT' &&
      assignment.controlledAnswerReady === false
    ) {
      addError(
        'ASSIGNMENT_CONTROLLED_ANSWER_REQUIRED',
        `Free-text element ${assignment.elementId} requires one or more controlled answers, all of which must be non-empty text.`,
        `${path}.elementId`
      )
    }

    if (assignment.enablePercentInput && assignment.type !== 'NUMERICAL') {
      addError(
        'ASSIGNMENT_PERCENT_INPUT_INVALID',
        `Percent input can only be enabled for numerical element ${assignment.elementId}.`,
        `${path}.enablePercentInput`
      )
    }

    if (!leaf) {
      addError(
        'ASSIGNMENT_LEAF_MISSING',
        `Assignment for element ${assignment.elementId} references missing leaf ${assignment.leafNodeId}.`,
        `${path}.leafNodeId`
      )
    } else if (!isCompetenceTreeLeafNode(leaf, childrenByParentId)) {
      addError(
        'ASSIGNMENT_LEAF_NOT_LEAF',
        `Assignment for element ${assignment.elementId} must point to a leaf node.`,
        `${path}.leafNodeId`
      )
    } else if (leaf.kind !== 'SUBCOMPETENCE') {
      addError(
        'ASSIGNMENT_LEAF_KIND_INVALID',
        `Assignment for element ${assignment.elementId} must point to a subcompetence leaf.`,
        `${path}.leafNodeId`
      )
    }

    if (!levelsById.has(toCompetenceTreeKey(assignment.levelId))) {
      addError(
        'ASSIGNMENT_LEVEL_MISSING',
        `Assignment for element ${assignment.elementId} references missing level ${assignment.levelId}.`,
        `${path}.levelId`
      )
    }

    if (
      !coverageCells.has(
        `${toCompetenceTreeKey(assignment.leafNodeId)}:${toCompetenceTreeKey(assignment.levelId)}`
      )
    ) {
      addError(
        'ASSIGNMENT_COVERAGE_MISSING',
        `Assignment for element ${assignment.elementId} requires coverage for its leaf and level.`,
        path
      )
    } else if (
      assignment.enabled !== false &&
      !enabledCoverageCells.has(
        `${toCompetenceTreeKey(assignment.leafNodeId)}:${toCompetenceTreeKey(assignment.levelId)}`
      )
    ) {
      addError(
        'ASSIGNMENT_COVERAGE_DISABLED',
        `Enabled assignment for element ${assignment.elementId} requires enabled coverage.`,
        path
      )
    }

    if (
      assignment.discrimination !== null &&
      typeof assignment.discrimination !== 'undefined' &&
      (!Number.isFinite(assignment.discrimination) ||
        assignment.discrimination <= 0 ||
        assignment.discrimination > MAX_DISCRIMINATION)
    ) {
      addError(
        'ASSIGNMENT_DISCRIMINATION_INVALID',
        `Element ${assignment.elementId} discrimination must be between 0 and ${MAX_DISCRIMINATION}.`,
        `${path}.discrimination`
      )
    }
  }

  for (const root of roots) {
    if (!isCompetenceTreeNodeEnabled(root)) continue

    if (getEnabledLeafDescendants(root, childrenByParentId).length === 0) {
      addError(
        'ROOT_WITHOUT_ENABLED_LEAF',
        `Enabled root competence ${root.id} must have at least one enabled leaf.`,
        `nodes.${tree.nodes.indexOf(root)}`
      )
    }
  }

  for (const node of tree.nodes) {
    if (
      !isCompetenceTreeNodeEnabled(node) ||
      !isCompetenceTreeLeafNode(node, childrenByParentId)
    ) {
      continue
    }

    if (
      (coverageByLeafId.get(toCompetenceTreeKey(node.id)) ?? []).length === 0
    ) {
      addError(
        'LEAF_WITHOUT_COVERAGE',
        `Enabled leaf ${node.id} must have at least one enabled coverage level.`,
        `nodes.${tree.nodes.indexOf(node)}`
      )
    }
  }

  const normalizedRootWeights = normalizeRootWeights(roots, tree.nodes, errors)

  return {
    valid: errors.length === 0,
    effectiveMaxDepth,
    errors,
    warnings,
    normalizedRootWeights,
  }
}

function normalizeRootWeights(
  roots: CompetenceTreeValidationNode[],
  nodes: CompetenceTreeValidationNode[],
  errors: CompetenceTreeValidationIssue[]
): NormalizedCompetenceWeight[] {
  const enabledRoots = roots.filter(isCompetenceTreeNodeEnabled)
  const result = normalizeEnabledRootWeights(
    enabledRoots.map((node) => ({ key: node, weight: node.weight ?? 1 }))
  )
  if (!result.ok && result.reason === 'NO_ENABLED_ROOTS') {
    errors.push({
      code: 'ENABLED_ROOT_COUNT_TOO_LOW',
      message: 'Competence trees require at least one enabled root competence.',
      path: 'nodes',
    })
    return []
  }
  if (!result.ok) {
    for (const node of result.invalidKeys) {
      errors.push({
        code: 'ROOT_WEIGHT_INVALID',
        message: `Enabled root competence ${node.id} weight must be positive and finite.`,
        path: `nodes.${nodes.indexOf(node)}.weight`,
      })
    }
    return []
  }
  return result.normalized.map(({ key: node, weight }) => ({
    nodeId: node.id,
    weight,
  }))
}
