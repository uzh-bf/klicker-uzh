import type {
  AdaptiveQuizReadiness,
  AdaptiveReadinessIssue,
} from './adaptivePracticeQuizReadiness.js'

export type AdaptiveReadinessLabelNode = {
  id: number
  parentId: number | null
  name: string
  depth: number
  order: number
}

export type AdaptiveReadinessLabelLevel = {
  id: number
  label: string
  order: number
}

/**
 * Adds display-only names to readiness issues that reference a leaf or level,
 * so clients can name the affected cell and sort issues in tree order without
 * loading the competence tree. Readiness semantics are left untouched.
 */
export function annotateAdaptiveReadinessIssueLabels(
  readiness: AdaptiveQuizReadiness,
  {
    nodes,
    levels,
  }: {
    nodes: AdaptiveReadinessLabelNode[]
    levels: AdaptiveReadinessLabelLevel[]
  }
): AdaptiveQuizReadiness {
  const nodesById = new Map(nodes.map((node) => [node.id, node]))
  const levelsById = new Map(levels.map((level) => [level.id, level]))
  const leafOrderById = computeTreeOrder(nodes)

  const annotate = (issue: AdaptiveReadinessIssue): AdaptiveReadinessIssue => {
    const leaf =
      typeof issue.leafNodeId === 'number'
        ? nodesById.get(issue.leafNodeId)
        : undefined
    const level =
      typeof issue.levelId === 'number'
        ? levelsById.get(issue.levelId)
        : undefined
    if (!leaf && !level) return issue

    const root = leaf ? findRoot(leaf, nodesById) : undefined
    return {
      ...issue,
      parameters: {
        ...issue.parameters,
        ...(leaf
          ? {
              leafName: leaf.name,
              leafOrder: leafOrderById.get(leaf.id),
              rootName: root?.name,
            }
          : {}),
        ...(level ? { levelLabel: level.label, levelOrder: level.order } : {}),
      },
    }
  }

  return {
    ...readiness,
    errors: readiness.errors.map(annotate),
    warnings: readiness.warnings.map(annotate),
  }
}

function findRoot(
  node: AdaptiveReadinessLabelNode,
  nodesById: Map<number, AdaptiveReadinessLabelNode>
) {
  const visited = new Set<number>()
  let current = node
  while (current.parentId !== null && !visited.has(current.id)) {
    visited.add(current.id)
    const parent = nodesById.get(current.parentId)
    if (!parent) break
    current = parent
  }
  return current
}

// Pre-order position of every node, matching the order the editor shows.
function computeTreeOrder(nodes: AdaptiveReadinessLabelNode[]) {
  const childrenByParent = new Map<
    number | null,
    AdaptiveReadinessLabelNode[]
  >()
  for (const node of nodes) {
    const siblings = childrenByParent.get(node.parentId) ?? []
    siblings.push(node)
    childrenByParent.set(node.parentId, siblings)
  }
  for (const siblings of childrenByParent.values()) {
    siblings.sort((a, b) => a.order - b.order || a.id - b.id)
  }

  const orderById = new Map<number, number>()
  const pending = (childrenByParent.get(null) ?? []).slice().reverse()
  while (pending.length > 0) {
    const node = pending.pop()!
    if (orderById.has(node.id)) continue
    orderById.set(node.id, orderById.size)
    pending.push(...(childrenByParent.get(node.id) ?? []).slice().reverse())
  }
  return orderById
}
