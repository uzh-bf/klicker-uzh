import {
  AdaptiveLevelMappingRule,
  AdaptiveNodeKind,
  type CompetenceTreeDataFragment,
  type CompetenceTreeInput,
  type CompetenceTreeMetadataInput,
  type ElementType,
} from '@klicker-uzh/graphql/dist/ops'

export interface CompetenceTreeLevelForm {
  key: string
  label: string
  order: number
  /** Lowercase `#rrggbb` override; null/undefined uses the default palette. */
  color?: string | null
}

export interface CompetenceTreeNodeForm {
  key: string
  parentKey: string | null
  kind: AdaptiveNodeKind
  name: string
  description: string
  order: number
  weight: number
}

export interface CompetenceTreeCoverageForm {
  leafKey: string
  levelKey: string
  targetItemCount: number
  enabled: boolean
}

export interface CompetenceTreeAssignmentForm {
  key: string
  sourceId: number
  elementId: number
  elementName: string
  elementType: ElementType
  elementVersion: number
  leafKey: string
  additionalLeafKeys: string[]
  levelKey: string
  enabled: boolean
  discrimination: number | null
  enablePercentInput: boolean
  choiceCount: number | null
  a: number
  b: number
  c: number
}

export interface CompetenceTreeForm {
  name: string
  displayName: string
  description: string
  maxDepth: number
  defaultTotalQuestionCap: number
  defaultTimeLimitSeconds: number | null
  thetaMin: number
  thetaMax: number
  defaultDiscrimination: number
  levelMappingRule: AdaptiveLevelMappingRule
  levels: CompetenceTreeLevelForm[]
  nodes: CompetenceTreeNodeForm[]
  coverages: CompetenceTreeCoverageForm[]
  assignments: CompetenceTreeAssignmentForm[]
}

export interface DefaultCompetenceTreeLabels {
  levels: [string, string, string]
  root: string
  leaf: string
}

export interface CompetenceTreeValidationIssueView {
  code: string
  message: string
  path?: string | null
}

export interface CompetenceTreeValidationView {
  valid: boolean
  effectiveMaxDepth: number
  errors: CompetenceTreeValidationIssueView[]
  warnings: CompetenceTreeValidationIssueView[]
  normalizedRootWeights: Array<{ nodeId: string; weight: number }>
}

export function createDefaultCompetenceTreeForm(
  labels: DefaultCompetenceTreeLabels
): CompetenceTreeForm {
  const levels = labels.levels.map((label, index) => ({
    key: `level:local:${index + 1}`,
    label,
    order: index,
  }))
  const rootKey = 'node:local:1'
  const leafKey = 'node:local:2'

  return {
    name: '',
    displayName: '',
    description: '',
    maxDepth: 5,
    defaultTotalQuestionCap: 50,
    defaultTimeLimitSeconds: null,
    thetaMin: -3,
    thetaMax: 3,
    defaultDiscrimination: 1.2,
    levelMappingRule: AdaptiveLevelMappingRule.Nearest,
    levels,
    nodes: [
      {
        key: rootKey,
        parentKey: null,
        kind: AdaptiveNodeKind.Competence,
        name: labels.root,
        description: '',
        order: 0,
        weight: 1,
      },
      {
        key: leafKey,
        parentKey: rootKey,
        kind: AdaptiveNodeKind.Subcompetence,
        name: labels.leaf,
        description: '',
        order: 0,
        weight: 1,
      },
    ],
    coverages: levels.map((level) => ({
      leafKey,
      levelKey: level.key,
      targetItemCount: 5,
      enabled: true,
    })),
    assignments: [],
  }
}

export function competenceTreeToForm(
  tree: CompetenceTreeDataFragment & {
    defaultTotalQuestionCap?: number
    defaultTimeLimitSeconds?: number | null
  }
): CompetenceTreeForm {
  const levelKeyById = new Map(
    tree.levels.map((level) => [level.id, `level:${level.id}`])
  )
  const nodeKeyById = new Map(
    tree.nodes.map((node) => [node.id, `node:${node.id}`])
  )

  return {
    name: tree.name,
    displayName: tree.displayName,
    description: tree.description ?? '',
    maxDepth: tree.maxDepth,
    defaultTotalQuestionCap: tree.defaultTotalQuestionCap ?? 50,
    defaultTimeLimitSeconds: tree.defaultTimeLimitSeconds ?? null,
    thetaMin: tree.thetaMin,
    thetaMax: tree.thetaMax,
    defaultDiscrimination: tree.defaultDiscrimination,
    levelMappingRule: tree.levelMappingRule,
    levels: tree.levels
      .map((level) => ({
        key: levelKeyById.get(level.id)!,
        label: level.label,
        order: level.order,
        color: level.color ?? null,
      }))
      .sort((a, b) => a.order - b.order),
    nodes: tree.nodes.map((node) => ({
      key: nodeKeyById.get(node.id)!,
      parentKey:
        typeof node.parentId === 'number'
          ? (nodeKeyById.get(node.parentId) ?? `node:${node.parentId}`)
          : null,
      kind: node.kind,
      name: node.name,
      description: node.description ?? '',
      order: node.order,
      weight: node.weight,
    })),
    coverages: tree.levelCoverages.map((coverage) => {
      const leafKey =
        nodeKeyById.get(coverage.leafNodeId) ?? `node:${coverage.leafNodeId}`
      const levelKey =
        levelKeyById.get(coverage.levelId) ?? `level:${coverage.levelId}`

      return {
        leafKey,
        levelKey,
        targetItemCount: coverage.targetItemCount,
        enabled: coverage.enabled,
      }
    }),
    assignments: tree.elementAssignments.map((assignment) => {
      const leafKey =
        nodeKeyById.get(assignment.leafNodeId) ??
        `node:${assignment.leafNodeId}`
      const levelKey =
        levelKeyById.get(assignment.levelId) ?? `level:${assignment.levelId}`
      const additionalLeafKeys = Array.from(
        new Set(
          assignment.additionalLeafNodeIds
            .filter((nodeId) => nodeId !== assignment.leafNodeId)
            .map((nodeId) => nodeKeyById.get(nodeId) ?? `node:${nodeId}`)
        )
      )

      return {
        key: `assignment:${assignment.id}`,
        sourceId: assignment.id,
        elementId: assignment.elementId,
        elementName: assignment.elementName,
        elementType: assignment.elementType,
        elementVersion: assignment.elementVersion,
        leafKey,
        additionalLeafKeys,
        levelKey,
        enabled: assignment.enabled,
        discrimination: assignment.discrimination ?? null,
        enablePercentInput: assignment.enablePercentInput,
        choiceCount: assignment.choiceCount ?? null,
        a: assignment.a,
        b: assignment.b,
        c: assignment.c,
      }
    }),
  }
}

export function competenceTreeFormToInput(
  form: CompetenceTreeForm
): CompetenceTreeInput {
  return {
    name: form.name.trim(),
    displayName: form.displayName.trim(),
    description: form.description.trim() || null,
    maxDepth: form.maxDepth,
    defaultTotalQuestionCap: form.defaultTotalQuestionCap ?? 50,
    defaultTimeLimitSeconds: form.defaultTimeLimitSeconds ?? null,
    thetaMin: form.thetaMin,
    thetaMax: form.thetaMax,
    defaultDiscrimination: form.defaultDiscrimination,
    levelMappingRule: form.levelMappingRule,
    levels: form.levels
      .slice()
      .sort((a, b) => a.order - b.order)
      .map((level, order) => ({
        key: level.key,
        label: level.label.trim(),
        order,
        color: level.color?.toLowerCase() || null,
      })),
    nodes: form.nodes.map((node) => ({
      key: node.key,
      parentKey: node.parentKey,
      kind: node.kind,
      name: node.name.trim(),
      description: node.description.trim() || null,
      order: node.order,
      weight: node.parentKey ? 1 : node.weight,
    })),
    coverages: [
      ...form.coverages,
      ...form.nodes
        .filter(
          (node) =>
            node.parentKey !== null &&
            !form.nodes.some((child) => child.parentKey === node.key)
        )
        .flatMap((leaf) =>
          form.levels
            .filter(
              (level) =>
                !form.coverages.some(
                  (cell) =>
                    cell.leafKey === leaf.key && cell.levelKey === level.key
                )
            )
            .map((level) => ({
              leafKey: leaf.key,
              levelKey: level.key,
              enabled: true,
              targetItemCount: 5,
            }))
        ),
    ].map((coverage) => ({
      leafKey: coverage.leafKey,
      levelKey: coverage.levelKey,
      targetItemCount: coverage.targetItemCount,
      enabled: coverage.enabled,
    })),
    assignments: form.assignments.map((assignment) => ({
      elementId: assignment.elementId,
      leafKey: assignment.leafKey,
      additionalLeafKeys: Array.from(
        new Set(
          assignment.additionalLeafKeys.filter(
            (key) => key !== assignment.leafKey
          )
        )
      ),
      levelKey: assignment.levelKey,
      enabled: assignment.enabled,
      discrimination: null,
      enablePercentInput: assignment.enablePercentInput,
    })),
  }
}

const SAVED_LEVEL_KEY = /^level:(\d+)$/

/**
 * Input for the metadata save that is used while a practice quiz locks the
 * tree structure. Level colors are cosmetic, so they are included for every
 * saved level (null clears an override).
 */
export function competenceTreeFormToMetadataInput(
  form: CompetenceTreeForm
): CompetenceTreeMetadataInput {
  return {
    name: form.name.trim(),
    displayName: form.displayName.trim(),
    description: form.description.trim() || null,
    defaultTotalQuestionCap: form.defaultTotalQuestionCap,
    defaultTimeLimitSeconds: form.defaultTimeLimitSeconds,
    levelColors: form.levels.flatMap((level) => {
      const match = SAVED_LEVEL_KEY.exec(level.key)
      return match
        ? [
            {
              levelId: Number(match[1]),
              color: level.color?.toLowerCase() || null,
            },
          ]
        : []
    }),
  }
}
