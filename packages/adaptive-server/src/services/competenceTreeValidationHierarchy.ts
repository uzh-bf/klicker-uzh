import type {
  CompetenceTreeId,
  CompetenceTreeValidationNode,
} from './competenceTreeValidationTypes.js'

export function getEnabledLeafDescendants(
  node: CompetenceTreeValidationNode,
  childrenByParentId: Map<string, CompetenceTreeValidationNode[]>
): CompetenceTreeValidationNode[] {
  const leaves: CompetenceTreeValidationNode[] = []
  const pending = [node]
  const visited = new Set<string>()

  while (pending.length > 0) {
    const current = pending.pop()!
    const key = toCompetenceTreeKey(current.id)
    if (visited.has(key)) continue
    visited.add(key)

    const enabledChildren = (childrenByParentId.get(key) ?? []).filter(
      isCompetenceTreeNodeEnabled
    )
    if (enabledChildren.length === 0) {
      if (isCompetenceTreeLeafNode(current, childrenByParentId)) {
        leaves.push(current)
      }
    } else {
      pending.push(...enabledChildren)
    }
  }

  return leaves
}

export function isCompetenceTreeLeafNode(
  node: CompetenceTreeValidationNode,
  childrenByParentId: Map<string, CompetenceTreeValidationNode[]>
): boolean {
  return (
    (childrenByParentId.get(toCompetenceTreeKey(node.id)) ?? []).length === 0
  )
}

export function isCompetenceTreeNodeEnabled(
  node: Pick<CompetenceTreeValidationNode, 'enabled'>
): boolean {
  return node.enabled !== false
}

export function toCompetenceTreeKey(id: CompetenceTreeId): string {
  return String(id)
}
