import { CompetenceTreeForm, CompetenceTreeNodeForm } from './types'

export function getChildren(
  nodes: CompetenceTreeNodeForm[],
  parentKey: string | null
) {
  return nodes
    .filter((node) => node.parentKey === parentKey)
    .sort((a, b) => a.order - b.order)
}

export function getDescendantKeys(
  nodes: CompetenceTreeNodeForm[],
  nodeKey: string
): Set<string> {
  const descendants = new Set<string>()
  const pending = [nodeKey]

  while (pending.length > 0) {
    const currentKey = pending.pop()!
    for (const child of getChildren(nodes, currentKey)) {
      if (descendants.has(child.key)) continue
      descendants.add(child.key)
      pending.push(child.key)
    }
  }

  return descendants
}

export function getNodeDepth(
  nodes: CompetenceTreeNodeForm[],
  nodeKey: string
): number {
  const nodesByKey = new Map(nodes.map((node) => [node.key, node]))
  const visited = new Set<string>()
  let current = nodesByKey.get(nodeKey)
  let depth = 0

  while (current) {
    if (visited.has(current.key)) return Number.POSITIVE_INFINITY
    visited.add(current.key)
    depth += 1
    current = current.parentKey ? nodesByKey.get(current.parentKey) : undefined
  }

  return depth
}

export function getSubtreeHeight(
  nodes: CompetenceTreeNodeForm[],
  nodeKey: string
): number {
  const children = getChildren(nodes, nodeKey)
  if (children.length === 0) return 1

  return (
    1 + Math.max(...children.map((child) => getSubtreeHeight(nodes, child.key)))
  )
}

export function getLeafNodes(nodes: CompetenceTreeNodeForm[]) {
  const parentKeys = new Set(
    nodes.flatMap((node) => (node.parentKey ? [node.parentKey] : []))
  )
  return nodes.filter((node) => !parentKeys.has(node.key))
}

export function getRootNode(nodes: CompetenceTreeNodeForm[], nodeKey: string) {
  const nodesByKey = new Map(nodes.map((node) => [node.key, node]))
  const visited = new Set<string>()
  let current = nodesByKey.get(nodeKey)

  while (current?.parentKey) {
    if (visited.has(current.key)) return undefined
    visited.add(current.key)
    current = nodesByKey.get(current.parentKey)
  }

  return current
}

export function getBreadcrumb(
  nodes: CompetenceTreeNodeForm[],
  nodeKey: string
): string {
  const nodesByKey = new Map(nodes.map((node) => [node.key, node]))
  const path: string[] = []
  const visited = new Set<string>()
  let current = nodesByKey.get(nodeKey)

  while (current) {
    if (visited.has(current.key)) break
    visited.add(current.key)
    path.unshift(current.name)
    current = current.parentKey ? nodesByKey.get(current.parentKey) : undefined
  }

  return path.join(' / ')
}

export function getNextLocalKey(existingKeys: string[], prefix: string) {
  const used = new Set(existingKeys)
  let index = 1
  let candidate = `${prefix}:local:${index}`

  while (used.has(candidate)) {
    index += 1
    candidate = `${prefix}:local:${index}`
  }

  return candidate
}

export function normalizeSiblingOrders(
  nodes: CompetenceTreeNodeForm[],
  parentKey: string | null
) {
  const orderByKey = new Map(
    getChildren(nodes, parentKey).map((node, order) => [node.key, order])
  )

  return nodes.map((node) =>
    orderByKey.has(node.key)
      ? { ...node, order: orderByKey.get(node.key)! }
      : node
  )
}

export function moveNodeAmongSiblings(
  nodes: CompetenceTreeNodeForm[],
  nodeKey: string,
  direction: -1 | 1
) {
  const node = nodes.find((candidate) => candidate.key === nodeKey)
  if (!node) return nodes

  const siblings = getChildren(nodes, node.parentKey)
  const currentIndex = siblings.findIndex((sibling) => sibling.key === nodeKey)
  const targetIndex = currentIndex + direction
  if (currentIndex < 0 || targetIndex < 0 || targetIndex >= siblings.length) {
    return nodes
  }

  const target = siblings[targetIndex]
  return nodes.map((candidate) => {
    if (candidate.key === node.key) {
      return { ...candidate, order: target.order }
    }
    if (candidate.key === target.key) {
      return { ...candidate, order: node.order }
    }
    return candidate
  })
}

export function canReparentNode({
  nodes,
  nodeKey,
  parentKey,
  maxDepth,
}: {
  nodes: CompetenceTreeNodeForm[]
  nodeKey: string
  parentKey: string
  maxDepth: number
}) {
  const node = nodes.find((candidate) => candidate.key === nodeKey)
  if (!node || node.parentKey === null || nodeKey === parentKey) return false

  const descendants = getDescendantKeys(nodes, nodeKey)
  if (descendants.has(parentKey)) return false

  const parentDepth = getNodeDepth(nodes, parentKey)
  const subtreeHeight = getSubtreeHeight(nodes, nodeKey)
  return parentDepth + subtreeHeight <= maxDepth
}

export function reparentNode(
  nodes: CompetenceTreeNodeForm[],
  nodeKey: string,
  parentKey: string,
  maxDepth: number
) {
  if (!canReparentNode({ nodes, nodeKey, parentKey, maxDepth })) return nodes

  const node = nodes.find((candidate) => candidate.key === nodeKey)!
  const nextOrder = getChildren(nodes, parentKey).length
  let updated = nodes.map((candidate) =>
    candidate.key === nodeKey
      ? { ...candidate, parentKey, order: nextOrder }
      : candidate
  )
  updated = normalizeSiblingOrders(updated, node.parentKey)
  return normalizeSiblingOrders(updated, parentKey)
}

export function removeBranch(form: CompetenceTreeForm, nodeKey: string) {
  const removedKeys = getDescendantKeys(form.nodes, nodeKey)
  removedKeys.add(nodeKey)
  const removedNode = form.nodes.find((node) => node.key === nodeKey)
  const nodes = form.nodes.filter((node) => !removedKeys.has(node.key))

  return {
    ...form,
    nodes: removedNode
      ? normalizeSiblingOrders(nodes, removedNode.parentKey)
      : nodes,
    coverages: form.coverages.filter(
      (coverage) => !removedKeys.has(coverage.leafKey)
    ),
    assignments: form.assignments.filter(
      (assignment) => !removedKeys.has(assignment.leafKey)
    ),
  }
}

export function duplicateBranch(form: CompetenceTreeForm, nodeKey: string) {
  const source = form.nodes.find((node) => node.key === nodeKey)
  if (!source) return form

  const branchKeys = getDescendantKeys(form.nodes, nodeKey)
  branchKeys.add(nodeKey)
  const sourceNodes = form.nodes.filter((node) => branchKeys.has(node.key))
  const keyMap = new Map<string, string>()
  const usedKeys = form.nodes.map((node) => node.key)

  for (const node of sourceNodes) {
    const key = getNextLocalKey(
      [...usedKeys, ...Array.from(keyMap.values())],
      'node'
    )
    keyMap.set(node.key, key)
  }

  const duplicatedNodes = sourceNodes.map((node) => ({
    ...node,
    key: keyMap.get(node.key)!,
    parentKey:
      node.key === source.key
        ? source.parentKey
        : node.parentKey
          ? (keyMap.get(node.parentKey) ?? node.parentKey)
          : null,
    order:
      node.key === source.key
        ? getChildren(form.nodes, source.parentKey).length
        : node.order,
  }))
  const duplicatedCoverages = form.coverages.flatMap((coverage) => {
    const leafKey = keyMap.get(coverage.leafKey)
    return leafKey ? [{ ...coverage, leafKey }] : []
  })

  return {
    ...form,
    nodes: [...form.nodes, ...duplicatedNodes],
    coverages: [...form.coverages, ...duplicatedCoverages],
  }
}

export function getNormalizedRootWeights(nodes: CompetenceTreeNodeForm[]) {
  const roots = getChildren(nodes, null)
  const total = roots.reduce(
    (sum, root) =>
      sum + (Number.isFinite(root.weight) && root.weight > 0 ? root.weight : 0),
    0
  )

  return new Map(
    roots.map((root) => [
      root.key,
      total > 0 && root.weight > 0 ? root.weight / total : 0,
    ])
  )
}
