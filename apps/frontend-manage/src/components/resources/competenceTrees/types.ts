import {
  AdaptiveLevelMappingRule,
  AdaptiveNodeKind,
  CompetenceTreeDataFragment,
  CompetenceTreeInput,
  ElementType,
} from '@klicker-uzh/graphql/dist/ops'

export interface CompetenceTreeLevelForm {
  key: string
  label: string
  order: number
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
  tree: CompetenceTreeDataFragment
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
    thetaMin: tree.thetaMin,
    thetaMax: tree.thetaMax,
    defaultDiscrimination: tree.defaultDiscrimination,
    levelMappingRule: tree.levelMappingRule,
    levels: tree.levels
      .map((level) => ({
        key: levelKeyById.get(level.id)!,
        label: level.label,
        order: level.order,
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

      return {
        key: `assignment:${assignment.id}`,
        sourceId: assignment.id,
        elementId: assignment.elementId,
        elementName: assignment.elementName,
        elementType: assignment.elementType,
        elementVersion: assignment.elementVersion,
        leafKey,
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
    coverages: form.coverages.map((coverage) => ({
      leafKey: coverage.leafKey,
      levelKey: coverage.levelKey,
      targetItemCount: coverage.targetItemCount,
      enabled: coverage.enabled,
    })),
    assignments: form.assignments.map((assignment) => ({
      elementId: assignment.elementId,
      leafKey: assignment.leafKey,
      levelKey: assignment.levelKey,
      enabled: assignment.enabled,
      discrimination: null,
      enablePercentInput: assignment.enablePercentInput,
    })),
  }
}
