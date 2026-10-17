import {
  AdaptiveNodeKind,
  type CompetenceTreeDataFragment,
  ElementType,
} from '@klicker-uzh/graphql/dist/ops'

export type AdaptiveTreeDetail = CompetenceTreeDataFragment
export type AdaptiveTreeAssignment =
  AdaptiveTreeDetail['elementAssignments'][number]

export interface AdaptiveMappingAssignmentInput {
  leafNodeId: number
  additionalLeafNodeIds?: number[]
  levelId: number
  enabled: boolean
  enablePercentInput: boolean
  discrimination?: number | null
}

export interface PendingAdaptiveMapping {
  treeId: string
  assignment: AdaptiveMappingAssignmentInput
}

export interface PendingAdaptiveMappingDraft {
  treeId: string
  assignment: AdaptiveMappingDraft
}

export interface AdaptiveMappingDraft {
  leafNodeId: number | null
  additionalLeafNodeIds: number[]
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

/** Root competence id of a node, used to keep extra mappings in one root. */
export function getRootNodeId(
  tree: AdaptiveTreeDetail,
  nodeId: number
): number | null {
  const nodesById = new Map(tree.nodes.map((node) => [node.id, node]))
  const visited = new Set<number>()
  let current = nodesById.get(nodeId)
  while (current && !visited.has(current.id)) {
    visited.add(current.id)
    if (typeof current.parentId !== 'number') return current.id
    current = nodesById.get(current.parentId)
  }
  return null
}

export function createMappingDraft(
  assignment?: AdaptiveTreeAssignment
): AdaptiveMappingDraft {
  return assignment
    ? {
        leafNodeId: assignment.leafNodeId,
        additionalLeafNodeIds: Array.from(
          new Set(
            assignment.additionalLeafNodeIds.filter(
              (nodeId) => nodeId !== assignment.leafNodeId
            )
          )
        ),
        levelId: assignment.levelId,
        enabled: assignment.enabled,
        enablePercentInput: assignment.enablePercentInput,
        discrimination: assignment.discrimination,
      }
    : {
        leafNodeId: null,
        additionalLeafNodeIds: [],
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
      additionalLeafNodeIds: Array.from(
        new Set(
          draft.additionalLeafNodeIds.filter(
            (nodeId) => nodeId !== draft.leafNodeId
          )
        )
      ),
      levelId: draft.levelId,
      enabled: draft.enabled,
      enablePercentInput: draft.enablePercentInput,
      discrimination: null,
    },
  }
}
