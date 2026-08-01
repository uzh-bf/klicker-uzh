import {
  AdaptiveNodeKind,
  CompetenceTreeDataFragment,
  ElementType,
} from '@klicker-uzh/graphql/dist/ops'

export type AdaptiveTreeDetail = CompetenceTreeDataFragment
export type AdaptiveTreeAssignment =
  AdaptiveTreeDetail['elementAssignments'][number]

export interface AdaptiveMappingAssignmentInput {
  leafNodeId: number
  levelId: number
  enabled: boolean
  enablePercentInput: boolean
  discrimination?: number | null
}

export interface PendingAdaptiveMapping {
  treeId: string
  assignment: AdaptiveMappingAssignmentInput
}

export interface AdaptiveMappingDraft {
  leafNodeId: number | null
  levelId: number | null
  enabled: boolean
  enablePercentInput: boolean
  discrimination?: number | null
}

const SUPPORTED_ELEMENT_TYPES = new Set<ElementType>([
  ElementType.Numerical,
  ElementType.Sc,
  ElementType.Mc,
  ElementType.Kprim,
  ElementType.FreeText,
])

export function supportsAdaptiveMapping(type: ElementType): boolean {
  return SUPPORTED_ELEMENT_TYPES.has(type)
}

export function getElementAssignment(
  tree: AdaptiveTreeDetail,
  elementId: number
): AdaptiveTreeAssignment | undefined {
  return tree.elementAssignments.find(
    (assignment) => assignment.elementId === elementId
  )
}

export function getSubcompetenceLeaves(tree: AdaptiveTreeDetail) {
  const parentIds = new Set(
    tree.nodes.flatMap((node) =>
      typeof node.parentId === 'number' ? [node.parentId] : []
    )
  )

  return tree.nodes
    .filter(
      (node) =>
        node.kind === AdaptiveNodeKind.Subcompetence && !parentIds.has(node.id)
    )
    .toSorted(
      (left, right) =>
        left.depth - right.depth ||
        left.order - right.order ||
        left.name.localeCompare(right.name)
    )
}

export function getNodeBreadcrumb(
  tree: AdaptiveTreeDetail,
  nodeId: number
): string {
  const nodesById = new Map(tree.nodes.map((node) => [node.id, node]))
  const names: string[] = []
  let current = nodesById.get(nodeId)

  while (current) {
    names.unshift(current.name)
    current =
      typeof current.parentId === 'number'
        ? nodesById.get(current.parentId)
        : undefined
  }

  return names.join(' / ')
}

export function createMappingDraft(
  assignment?: AdaptiveTreeAssignment
): AdaptiveMappingDraft {
  return assignment
    ? {
        leafNodeId: assignment.leafNodeId,
        levelId: assignment.levelId,
        enabled: assignment.enabled,
        enablePercentInput: assignment.enablePercentInput,
        discrimination: assignment.discrimination,
      }
    : {
        leafNodeId: null,
        levelId: null,
        enabled: true,
        enablePercentInput: false,
        discrimination: null,
      }
}

export function toPendingAdaptiveMapping(
  treeId: string,
  draft: AdaptiveMappingDraft
): PendingAdaptiveMapping | null {
  if (
    typeof draft.leafNodeId !== 'number' ||
    typeof draft.levelId !== 'number'
  ) {
    return null
  }

  return {
    treeId,
    assignment: {
      leafNodeId: draft.leafNodeId,
      levelId: draft.levelId,
      enabled: draft.enabled,
      enablePercentInput: draft.enablePercentInput,
      discrimination: null,
    },
  }
}
