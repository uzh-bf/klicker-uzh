export type AdditionalLeafMappingIssue =
  | 'ADAPTIVE_ASSIGNMENT_ADDITIONAL_LEAVES_INVALID'
  | 'ADAPTIVE_ASSIGNMENT_ADDITIONAL_LEAF_OTHER_ROOT'

/**
 * An element may additionally count for other subcompetence leaves of the
 * same root competence only. Cross-root reuse would count one answer in two
 * roots and therefore twice in the overall result.
 */
export function findAdditionalLeafMappingIssue({
  leafNodeId,
  additionalLeafNodeIds,
  nodesById,
  parentIds,
  requireEnabled,
  effectiveNodeEnabled,
}: {
  leafNodeId: number
  additionalLeafNodeIds: readonly number[]
  nodesById: ReadonlyMap<number, { id: number; parentId: number | null }>
  parentIds: ReadonlySet<number>
  requireEnabled: boolean
  effectiveNodeEnabled: ReadonlyMap<number, boolean>
}): AdditionalLeafMappingIssue | null {
  if (additionalLeafNodeIds.length === 0) return null
  const mappedLeafNodeIds = [leafNodeId, ...additionalLeafNodeIds]
  if (
    new Set(mappedLeafNodeIds).size !== mappedLeafNodeIds.length ||
    additionalLeafNodeIds.some(
      (id) =>
        !nodesById.has(id) ||
        parentIds.has(id) ||
        (requireEnabled && !effectiveNodeEnabled.get(id))
    )
  ) {
    return 'ADAPTIVE_ASSIGNMENT_ADDITIONAL_LEAVES_INVALID'
  }
  const primaryRootId = rootNodeId(leafNodeId, nodesById)
  return additionalLeafNodeIds.some(
    (id) => rootNodeId(id, nodesById) !== primaryRootId
  )
    ? 'ADAPTIVE_ASSIGNMENT_ADDITIONAL_LEAF_OTHER_ROOT'
    : null
}

function rootNodeId(
  nodeId: number,
  nodesById: ReadonlyMap<number, { id: number; parentId: number | null }>
) {
  let current = nodesById.get(nodeId)
  while (current?.parentId !== null && current !== undefined) {
    current = nodesById.get(current.parentId)
  }
  return current?.id
}
