import {
  DEFAULT_DISCRIMINATION,
  DEFAULT_THETA_RANGE,
  MAX_ABSOLUTE_THETA,
  MAX_COMPETENCE_TREE_DEPTH,
  MAX_DISCRIMINATION,
} from '@klicker-uzh/adaptive-learning'
import * as DB from '@klicker-uzh/prisma/client'
import { GraphQLError } from 'graphql'
import type { ContextWithUser } from '../lib/context.js'
import {
  hasControlledAdaptiveAnswer,
  validateCompetenceTreeShape,
  type CompetenceTreeValidationResult,
} from './competenceTrees.js'

// Initial production guardrails. Revisit with pilot measurements before
// accepting payloads large enough to monopolize a GraphQL worker.
const MAX_LEVEL_INPUTS = 20
const MAX_NODE_INPUTS = 500
const MAX_COVERAGE_INPUTS = 10_000
const MAX_ASSIGNMENT_INPUTS = 10_000

export type CompetenceTreeLevelInput = {
  key: string
  label: string
  order: number
}

export type CompetenceTreeNodeInput = {
  key: string
  parentKey?: string | null
  kind: DB.AdaptiveNodeKind
  name: string
  description?: string | null
  order: number
  weight?: number | null
}

export type CompetenceTreeCoverageInput = {
  leafKey: string
  levelKey: string
  targetItemCount: number
  enabled: boolean
}

export type CompetenceTreeAssignmentInput = {
  elementId: number
  leafKey: string
  levelKey: string
  enabled: boolean
  discrimination?: number | null
  enablePercentInput: boolean
}

export type CompetenceTreeInput = {
  name: string
  displayName: string
  description?: string | null
  maxDepth?: number | null
  thetaMin?: number | null
  thetaMax?: number | null
  defaultDiscrimination?: number | null
  levelMappingRule?: DB.AdaptiveLevelMappingRule | null
  levels: CompetenceTreeLevelInput[]
  nodes: CompetenceTreeNodeInput[]
  coverages: CompetenceTreeCoverageInput[]
  assignments: CompetenceTreeAssignmentInput[]
}

export type CompetenceTreeMetadataInput = {
  name: string
  displayName: string
  description?: string | null
}

export type DuplicateCompetenceTreeInput = {
  name?: string | null
  displayName?: string | null
}

type AccessibleElement = Pick<
  DB.Element,
  'id' | 'type' | 'name' | 'version' | 'options'
>

export type PreparedTreeInput = Omit<
  CompetenceTreeInput,
  'levels' | 'nodes'
> & {
  levels: CompetenceTreeLevelInput[]
  nodes: Array<CompetenceTreeNodeInput & { depth: number }>
}

export function prepareTreeInput(
  input: CompetenceTreeInput
): PreparedTreeInput {
  assertInputSize(input)

  const levels = input.levels.map((level) => ({
    ...level,
    key: level.key.trim(),
    label: level.label.trim(),
  }))
  const nodes = input.nodes.map((node) => ({
    ...node,
    key: node.key.trim(),
    parentKey: node.parentKey?.trim() || null,
    name: node.name.trim(),
    description: normalizeOptionalText(node.description),
  }))
  const nodesByKey = new Map(nodes.map((node) => [node.key, node]))

  const getDepth = (node: CompetenceTreeNodeInput): number => {
    let depth = 1
    let current = node
    const path = new Set([node.key])

    while (current.parentKey) {
      depth += 1
      const parent = nodesByKey.get(current.parentKey)
      if (!parent) return depth
      if (path.has(parent.key)) return MAX_COMPETENCE_TREE_DEPTH + 1
      if (depth > MAX_COMPETENCE_TREE_DEPTH) return depth
      path.add(parent.key)
      current = parent
    }

    return depth
  }

  return {
    ...input,
    name: input.name.trim(),
    displayName: input.displayName.trim(),
    description: normalizeOptionalText(input.description),
    levels,
    nodes: nodes.map((node) => ({
      ...node,
      depth: getDepth(node),
    })),
    coverages: input.coverages.map((coverage) => ({
      ...coverage,
      leafKey: coverage.leafKey.trim(),
      levelKey: coverage.levelKey.trim(),
    })),
    assignments: input.assignments.map((assignment) => ({
      ...assignment,
      leafKey: assignment.leafKey.trim(),
      levelKey: assignment.levelKey.trim(),
    })),
  }
}

function assertInputSize(input: CompetenceTreeInput): void {
  const limits = [
    ['levels', input.levels.length, MAX_LEVEL_INPUTS],
    ['nodes', input.nodes.length, MAX_NODE_INPUTS],
    ['coverages', input.coverages.length, MAX_COVERAGE_INPUTS],
    ['assignments', input.assignments.length, MAX_ASSIGNMENT_INPUTS],
  ] as const
  const exceeded = limits.find(([, size, maximum]) => size > maximum)

  if (exceeded) {
    const [field, size, maximum] = exceeded
    throw serviceError(
      `Competence tree ${field} contains ${size} entries; the maximum is ${maximum}.`,
      'COMPETENCE_TREE_INPUT_TOO_LARGE'
    )
  }
}

export function validatePreparedTree(
  input: PreparedTreeInput,
  elements: AccessibleElement[]
): CompetenceTreeValidationResult {
  const elementsById = new Map(elements.map((element) => [element.id, element]))

  return validateCompetenceTreeShape({
    name: input.name,
    displayName: input.displayName,
    maxDepth: input.maxDepth,
    thetaMin: input.thetaMin,
    thetaMax: input.thetaMax,
    defaultDiscrimination: input.defaultDiscrimination,
    levels: input.levels.map((level) => ({
      id: level.key,
      label: level.label,
      order: level.order,
    })),
    nodes: input.nodes.map((node) => ({
      id: node.key,
      parentId: node.parentKey,
      kind: node.kind,
      name: node.name,
      order: node.order,
      depth: node.depth,
      weight: node.weight,
    })),
    coverages: input.coverages.map((coverage) => ({
      leafNodeId: coverage.leafKey,
      levelId: coverage.levelKey,
      targetItemCount: coverage.targetItemCount,
      enabled: coverage.enabled,
    })),
    assignments: input.assignments.map((assignment) => ({
      elementId: assignment.elementId,
      type: elementsById.get(assignment.elementId)?.type ?? 'UNKNOWN',
      leafNodeId: assignment.leafKey,
      levelId: assignment.levelKey,
      discrimination: assignment.discrimination,
      enablePercentInput: assignment.enablePercentInput,
      enabled: assignment.enabled,
      controlledAnswerReady: hasControlledAdaptiveAnswer(
        elementsById.get(assignment.elementId)?.type ?? 'UNKNOWN',
        elementsById.get(assignment.elementId)?.options
      ),
    })),
  })
}

export function assertValidTree(
  input: PreparedTreeInput,
  elements: AccessibleElement[]
): void {
  const result = validatePreparedTree(input, elements)
  if (!result.valid) {
    throw new GraphQLError('Competence tree is invalid.', {
      extensions: {
        code: 'COMPETENCE_TREE_INVALID',
        issues: result.errors,
      },
    })
  }
}

export async function getAccessibleElements(
  assignments: CompetenceTreeAssignmentInput[],
  ctx: ContextWithUser
): Promise<AccessibleElement[]> {
  const elementIds = [...new Set(assignments.map(({ elementId }) => elementId))]
  if (elementIds.length === 0) return []

  const elements = await ctx.prisma.element.findMany({
    where: {
      id: { in: elementIds },
      isDeleted: false,
      OR: [
        { ownerId: ctx.user.sub },
        { permissions: { some: { userId: ctx.user.sub } } },
      ],
    },
    select: {
      id: true,
      type: true,
      name: true,
      version: true,
      options: true,
    },
  })

  if (elements.length !== elementIds.length) {
    throw serviceError(
      'At least one assigned element does not exist or is not readable.',
      'FORBIDDEN'
    )
  }
  return elements
}

export async function persistTreeStructure(
  tx: DB.Prisma.TransactionClient,
  treeId: string,
  input: PreparedTreeInput
): Promise<void> {
  const levelIds = new Map<string, number>()
  for (const level of input.levels.slice().sort((a, b) => a.order - b.order)) {
    const created = await tx.competenceTreeLevel.create({
      data: { treeId, label: level.label, order: level.order },
      select: { id: true },
    })
    levelIds.set(level.key, created.id)
  }

  const nodeIds = new Map<string, number>()
  const orderedNodes = input.nodes
    .slice()
    .sort((a, b) => a.depth - b.depth || a.order - b.order)
  for (const node of orderedNodes) {
    const parentId = node.parentKey ? nodeIds.get(node.parentKey) : null
    const created = await tx.competenceTreeNode.create({
      data: {
        treeId,
        parentId,
        kind: node.kind,
        name: node.name,
        description: node.description,
        order: node.order,
        depth: node.depth,
        weight: node.parentKey ? 1 : (node.weight ?? 1),
      },
      select: { id: true },
    })
    nodeIds.set(node.key, created.id)
  }

  if (input.coverages.length > 0) {
    await tx.competenceTreeLeafLevelCoverage.createMany({
      data: input.coverages.map((coverage) => ({
        treeId,
        leafNodeId: nodeIds.get(coverage.leafKey)!,
        levelId: levelIds.get(coverage.levelKey)!,
        targetItemCount: coverage.targetItemCount,
        enabled: coverage.enabled,
      })),
    })
  }

  if (input.assignments.length > 0) {
    await tx.competenceTreeElementAssignment.createMany({
      data: input.assignments.map((assignment) => ({
        treeId,
        elementId: assignment.elementId,
        leafNodeId: nodeIds.get(assignment.leafKey)!,
        levelId: levelIds.get(assignment.levelKey)!,
        enabled: assignment.enabled,
        discrimination: assignment.discrimination,
        enablePercentInput: assignment.enablePercentInput,
      })),
    })
  }
}

export function normalizeTreeMetadata(input: CompetenceTreeInput) {
  const metadata = normalizeEditableMetadata(input)
  const thetaMin = input.thetaMin ?? DEFAULT_THETA_RANGE.min
  const thetaMax = input.thetaMax ?? DEFAULT_THETA_RANGE.max
  const defaultDiscrimination =
    input.defaultDiscrimination ?? DEFAULT_DISCRIMINATION

  if (
    !Number.isFinite(thetaMin) ||
    !Number.isFinite(thetaMax) ||
    !Number.isFinite(thetaMax - thetaMin) ||
    Math.abs(thetaMin) > MAX_ABSOLUTE_THETA ||
    Math.abs(thetaMax) > MAX_ABSOLUTE_THETA
  ) {
    throw serviceError(
      `Theta bounds must be finite and within +/-${MAX_ABSOLUTE_THETA}.`,
      'BAD_USER_INPUT'
    )
  }
  if (thetaMin >= thetaMax) {
    throw serviceError(
      'thetaMin must be smaller than thetaMax.',
      'BAD_USER_INPUT'
    )
  }
  if (
    !Number.isFinite(defaultDiscrimination) ||
    defaultDiscrimination <= 0 ||
    defaultDiscrimination > MAX_DISCRIMINATION
  ) {
    throw serviceError(
      `Default discrimination must be between 0 and ${MAX_DISCRIMINATION}.`,
      'BAD_USER_INPUT'
    )
  }

  return {
    ...metadata,
    maxDepth: input.maxDepth ?? MAX_COMPETENCE_TREE_DEPTH,
    thetaMin,
    thetaMax,
    defaultDiscrimination,
    levelMappingRule:
      input.levelMappingRule ?? DB.AdaptiveLevelMappingRule.NEAREST,
  }
}

export function normalizeEditableMetadata(input: CompetenceTreeMetadataInput) {
  const name = input.name.trim()
  const displayName = input.displayName.trim()
  if (!name || !displayName) {
    throw serviceError(
      'Competence tree name and display name are required.',
      'BAD_USER_INPUT'
    )
  }

  return {
    name,
    displayName,
    description: normalizeOptionalText(input.description),
  }
}

function normalizeOptionalText(value?: string | null): string | null {
  const normalized = value?.trim()
  return normalized ? normalized : null
}

function serviceError(message: string, code: string): GraphQLError {
  return new GraphQLError(message, { extensions: { code } })
}
