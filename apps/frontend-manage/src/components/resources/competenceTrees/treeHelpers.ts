import { normalizeEnabledRootWeights } from '@klicker-uzh/adaptive-learning'
import { AdaptiveNodeKind } from '@klicker-uzh/graphql/dist/ops'
import {
  CompetenceTreeCoverageForm,
  CompetenceTreeForm,
  CompetenceTreeNodeForm,
  CompetenceTreeValidationView,
} from './types'

const MAX_TREE_DEPTH = 5
const DEFAULT_COVERAGE_TARGET = 5

export interface CompetenceTreeStructuralState {
  form: CompetenceTreeForm
  selectedNodeKey: string | null
  selectedCell: { leafKey: string; levelKey: string } | null
  validation: CompetenceTreeValidationView | null
}

export type CompetenceTreeStructuralCommand =
  | { type: 'addRoot'; name: string }
  | { type: 'addChild'; parentKey: string; name: string }
  | { type: 'move'; nodeKey: string; direction: -1 | 1 }
  | { type: 'reorder'; nodeKey: string; order: number }
  | { type: 'reparent'; nodeKey: string; parentKey: string }
  | { type: 'duplicate'; nodeKey: string }
  | { type: 'delete'; nodeKey: string }

interface NodeMutation {
  nodes: CompetenceTreeNodeForm[]
  addedRootKey: string | null
  addedLeafKeys: Set<string>
  removedKeys: Set<string>
  duplicateKeyMap: Map<string, string> | null
  fallbackParentKey: string | null
}

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

function reorderNode(
  nodes: CompetenceTreeNodeForm[],
  nodeKey: string,
  targetIndex: number
): CompetenceTreeNodeForm[] | null {
  const node = nodes.find((candidate) => candidate.key === nodeKey)
  if (!node || !Number.isInteger(targetIndex)) return null

  const siblings = getChildren(nodes, node.parentKey)
  const currentIndex = siblings.findIndex((sibling) => sibling.key === nodeKey)
  if (
    currentIndex < 0 ||
    targetIndex < 0 ||
    targetIndex >= siblings.length ||
    currentIndex === targetIndex
  ) {
    return null
  }

  const reordered = siblings.filter((sibling) => sibling.key !== nodeKey)
  reordered.splice(targetIndex, 0, node)
  const orderByKey = new Map(
    reordered.map((sibling, order) => [sibling.key, order])
  )

  return nodes.map((candidate) =>
    orderByKey.has(candidate.key)
      ? { ...candidate, order: orderByKey.get(candidate.key)! }
      : candidate
  )
}

function hasValidHierarchy(
  nodes: CompetenceTreeNodeForm[],
  configuredMaxDepth: number
) {
  if (!Number.isInteger(configuredMaxDepth) || configuredMaxDepth < 1) {
    return false
  }

  const maxDepth = Math.min(configuredMaxDepth, MAX_TREE_DEPTH)
  const nodesByKey = new Map<string, CompetenceTreeNodeForm>()
  const childrenByParent = new Map<string | null, CompetenceTreeNodeForm[]>()

  for (const node of nodes) {
    if (!node.key || nodesByKey.has(node.key)) return false
    nodesByKey.set(node.key, node)
    childrenByParent.set(node.parentKey, [
      ...(childrenByParent.get(node.parentKey) ?? []),
      node,
    ])
  }

  const roots = childrenByParent.get(null) ?? []
  if (roots.length === 0) return false

  for (const node of nodes) {
    const isRoot = node.parentKey === null
    if (
      (isRoot && node.kind !== AdaptiveNodeKind.Competence) ||
      (!isRoot && node.kind !== AdaptiveNodeKind.Subcompetence)
    ) {
      return false
    }
    if (!isRoot && !nodesByKey.has(node.parentKey!)) return false
  }

  for (const siblings of Array.from(childrenByParent.values())) {
    const orders = siblings.map((node) => node.order).sort((a, b) => a - b)
    if (
      orders.some(
        (order, index) =>
          !Number.isInteger(order) || order < 0 || order !== index
      )
    ) {
      return false
    }
  }

  for (const node of nodes) {
    const visited = new Set<string>()
    let current: CompetenceTreeNodeForm | undefined = node
    let depth = 0

    while (current) {
      if (visited.has(current.key)) return false
      visited.add(current.key)
      depth += 1
      if (depth > maxDepth) return false
      current = current.parentKey
        ? nodesByKey.get(current.parentKey)
        : undefined
    }
  }

  return true
}

function hasOnlyDefaultLeafData(form: CompetenceTreeForm, leafKey: string) {
  if (form.assignments.some((assignment) => assignment.leafKey === leafKey)) {
    return false
  }

  const levelKeys = new Set(form.levels.map((level) => level.key))
  const seenLevelKeys = new Set<string>()

  return form.coverages
    .filter((coverage) => coverage.leafKey === leafKey)
    .every((coverage) => {
      if (
        !levelKeys.has(coverage.levelKey) ||
        seenLevelKeys.has(coverage.levelKey) ||
        !coverage.enabled ||
        coverage.targetItemCount !== DEFAULT_COVERAGE_TARGET
      ) {
        return false
      }
      seenLevelKeys.add(coverage.levelKey)
      return true
    })
}

function addDefaultCoverages(
  coverages: CompetenceTreeCoverageForm[],
  form: CompetenceTreeForm,
  leafKeys: Set<string>
) {
  if (leafKeys.size === 0) return coverages

  const existingLevelsByLeaf = new Map<string, Set<string>>()
  for (const coverage of coverages) {
    existingLevelsByLeaf.set(
      coverage.leafKey,
      new Set([
        ...Array.from(existingLevelsByLeaf.get(coverage.leafKey) ?? []),
        coverage.levelKey,
      ])
    )
  }

  const additions = Array.from(leafKeys).flatMap((leafKey) =>
    form.levels.flatMap((level) =>
      existingLevelsByLeaf.get(leafKey)?.has(level.key)
        ? []
        : [
            {
              leafKey,
              levelKey: level.key,
              targetItemCount: DEFAULT_COVERAGE_TARGET,
              enabled: true,
            },
          ]
    )
  )

  return additions.length > 0 ? [...coverages, ...additions] : coverages
}

function buildNodeMutation(
  form: CompetenceTreeForm,
  command: CompetenceTreeStructuralCommand
): NodeMutation | null {
  const emptyMutation = {
    addedRootKey: null,
    addedLeafKeys: new Set<string>(),
    removedKeys: new Set<string>(),
    duplicateKeyMap: null,
    fallbackParentKey: null,
  }

  switch (command.type) {
    case 'addRoot': {
      const rootKey = getNextLocalKey(
        form.nodes.map((node) => node.key),
        'node'
      )
      return {
        ...emptyMutation,
        nodes: [
          ...form.nodes,
          {
            key: rootKey,
            parentKey: null,
            kind: AdaptiveNodeKind.Competence,
            name: command.name,
            description: '',
            order: getChildren(form.nodes, null).length,
            weight: 1,
          },
        ],
        addedRootKey: rootKey,
      }
    }
    case 'addChild': {
      const parent = form.nodes.find((node) => node.key === command.parentKey)
      if (!parent) return null

      const childKey = getNextLocalKey(
        form.nodes.map((node) => node.key),
        'node'
      )
      return {
        ...emptyMutation,
        nodes: [
          ...form.nodes,
          {
            key: childKey,
            parentKey: parent.key,
            kind: AdaptiveNodeKind.Subcompetence,
            name: command.name,
            description: '',
            order: getChildren(form.nodes, parent.key).length,
            weight: 1,
          },
        ],
        addedLeafKeys: new Set([childKey]),
      }
    }
    case 'move': {
      const node = form.nodes.find(
        (candidate) => candidate.key === command.nodeKey
      )
      if (!node) return null
      const siblings = getChildren(form.nodes, node.parentKey)
      const currentIndex = siblings.findIndex(
        (sibling) => sibling.key === command.nodeKey
      )
      const nodes = reorderNode(
        form.nodes,
        command.nodeKey,
        currentIndex + command.direction
      )
      return nodes ? { ...emptyMutation, nodes } : null
    }
    case 'reorder': {
      const nodes = reorderNode(form.nodes, command.nodeKey, command.order)
      return nodes ? { ...emptyMutation, nodes } : null
    }
    case 'reparent': {
      const node = form.nodes.find(
        (candidate) => candidate.key === command.nodeKey
      )
      const parent = form.nodes.find(
        (candidate) => candidate.key === command.parentKey
      )
      if (
        !node ||
        !parent ||
        node.parentKey === null ||
        node.parentKey === parent.key ||
        node.key === parent.key
      ) {
        return null
      }

      const oldParentKey = node.parentKey
      let nodes = form.nodes.map((candidate) =>
        candidate.key === node.key
          ? {
              ...candidate,
              parentKey: parent.key,
              order: getChildren(form.nodes, parent.key).length,
            }
          : candidate
      )
      nodes = normalizeSiblingOrders(nodes, oldParentKey)
      nodes = normalizeSiblingOrders(nodes, parent.key)
      return {
        ...emptyMutation,
        nodes,
        fallbackParentKey: oldParentKey,
      }
    }
    case 'duplicate': {
      const source = form.nodes.find((node) => node.key === command.nodeKey)
      if (!source) return null

      const branchKeys = getDescendantKeys(form.nodes, source.key)
      branchKeys.add(source.key)
      const sourceNodes = form.nodes.filter((node) => branchKeys.has(node.key))
      const duplicateKeyMap = new Map<string, string>()
      const usedKeys = form.nodes.map((node) => node.key)

      for (const node of sourceNodes) {
        const key = getNextLocalKey(
          [...usedKeys, ...Array.from(duplicateKeyMap.values())],
          'node'
        )
        duplicateKeyMap.set(node.key, key)
      }

      const duplicatedNodes = sourceNodes.map((node) => ({
        ...node,
        key: duplicateKeyMap.get(node.key)!,
        parentKey:
          node.key === source.key
            ? source.parentKey
            : node.parentKey
              ? (duplicateKeyMap.get(node.parentKey) ?? node.parentKey)
              : null,
        order:
          node.key === source.key
            ? getChildren(form.nodes, source.parentKey).length
            : node.order,
      }))

      return {
        ...emptyMutation,
        nodes: [...form.nodes, ...duplicatedNodes],
        duplicateKeyMap,
      }
    }
    case 'delete': {
      const removedNode = form.nodes.find(
        (node) => node.key === command.nodeKey
      )
      if (!removedNode) return null

      const removedKeys = getDescendantKeys(form.nodes, command.nodeKey)
      removedKeys.add(command.nodeKey)
      const remainingNodes = form.nodes.filter(
        (node) => !removedKeys.has(node.key)
      )

      return {
        ...emptyMutation,
        nodes: normalizeSiblingOrders(remainingNodes, removedNode.parentKey),
        removedKeys,
        fallbackParentKey: removedNode.parentKey,
      }
    }
  }
}

export function canAddChild(form: CompetenceTreeForm, parentKey: string) {
  const state: CompetenceTreeStructuralState = {
    form,
    selectedNodeKey: parentKey,
    selectedCell: null,
    validation: null,
  }
  return (
    applyCompetenceTreeStructuralCommand(state, {
      type: 'addChild',
      parentKey,
      name: '',
    }) !== state
  )
}

export function canReparentNode({
  form,
  nodeKey,
  parentKey,
}: {
  form: CompetenceTreeForm
  nodeKey: string
  parentKey: string
}) {
  const state: CompetenceTreeStructuralState = {
    form,
    selectedNodeKey: nodeKey,
    selectedCell: null,
    validation: null,
  }
  return (
    applyCompetenceTreeStructuralCommand(state, {
      type: 'reparent',
      nodeKey,
      parentKey,
    }) !== state
  )
}

export function applyCompetenceTreeStructuralCommand(
  state: CompetenceTreeStructuralState,
  command: CompetenceTreeStructuralCommand
): CompetenceTreeStructuralState {
  if (!hasValidHierarchy(state.form.nodes, state.form.maxDepth)) return state

  const mutation = buildNodeMutation(state.form, command)
  if (!mutation || !hasValidHierarchy(mutation.nodes, state.form.maxDepth)) {
    return state
  }

  const previousParentKeys = new Set(
    state.form.nodes.flatMap((node) => (node.parentKey ? [node.parentKey] : []))
  )
  const nextParentKeys = new Set(
    mutation.nodes.flatMap((node) => (node.parentKey ? [node.parentKey] : []))
  )
  const nextNodeKeys = new Set(mutation.nodes.map((node) => node.key))
  const becameInternalKeys = new Set(
    state.form.nodes.flatMap((node) =>
      nextNodeKeys.has(node.key) &&
      !previousParentKeys.has(node.key) &&
      nextParentKeys.has(node.key)
        ? [node.key]
        : []
    )
  )
  const becameLeafKeys = new Set(
    state.form.nodes.flatMap((node) =>
      nextNodeKeys.has(node.key) &&
      previousParentKeys.has(node.key) &&
      !nextParentKeys.has(node.key) &&
      node.kind === AdaptiveNodeKind.Subcompetence
        ? [node.key]
        : []
    )
  )

  if (
    Array.from(becameInternalKeys).some(
      (leafKey) => !hasOnlyDefaultLeafData(state.form, leafKey)
    )
  ) {
    return state
  }

  let coverages = state.form.coverages
  let assignments = state.form.assignments

  if (mutation.removedKeys.size > 0) {
    coverages = coverages.filter(
      (coverage) => !mutation.removedKeys.has(coverage.leafKey)
    )
    assignments = assignments.filter(
      (assignment) => !mutation.removedKeys.has(assignment.leafKey)
    )
  }

  if (mutation.duplicateKeyMap) {
    const duplicatedCoverages = state.form.coverages.flatMap((coverage) => {
      const leafKey = mutation.duplicateKeyMap?.get(coverage.leafKey)
      return leafKey ? [{ ...coverage, leafKey }] : []
    })
    coverages = [...coverages, ...duplicatedCoverages]
  }

  if (becameInternalKeys.size > 0) {
    coverages = coverages.filter(
      (coverage) => !becameInternalKeys.has(coverage.leafKey)
    )
  }

  coverages = addDefaultCoverages(
    coverages,
    state.form,
    new Set([
      ...Array.from(becameLeafKeys),
      ...Array.from(mutation.addedLeafKeys),
    ])
  )

  let selectedNodeKey = state.selectedNodeKey
  let selectedCell = state.selectedCell

  if (command.type === 'addRoot') {
    selectedNodeKey = mutation.addedRootKey ?? selectedNodeKey
    selectedCell = null
  } else if (command.type === 'addChild') {
    selectedNodeKey = Array.from(mutation.addedLeafKeys)[0] ?? selectedNodeKey
  } else if (command.type === 'duplicate' && mutation.duplicateKeyMap) {
    selectedNodeKey =
      (selectedNodeKey
        ? mutation.duplicateKeyMap.get(selectedNodeKey)
        : undefined) ?? mutation.duplicateKeyMap.get(command.nodeKey)!
    if (selectedCell && mutation.duplicateKeyMap.has(selectedCell.leafKey)) {
      selectedCell = {
        ...selectedCell,
        leafKey: mutation.duplicateKeyMap.get(selectedCell.leafKey)!,
      }
    }
  } else if (command.type === 'delete') {
    if (selectedNodeKey && mutation.removedKeys.has(selectedNodeKey)) {
      selectedNodeKey =
        (mutation.fallbackParentKey &&
        nextNodeKeys.has(mutation.fallbackParentKey)
          ? mutation.fallbackParentKey
          : getChildren(mutation.nodes, null)[0]?.key) ?? null
    }
    if (selectedCell && mutation.removedKeys.has(selectedCell.leafKey)) {
      selectedCell = null
    }
  }

  if (selectedCell && becameInternalKeys.has(selectedCell.leafKey)) {
    selectedCell = null
  }

  return {
    form: {
      ...state.form,
      nodes: mutation.nodes,
      coverages,
      assignments,
    },
    selectedNodeKey,
    selectedCell,
    validation: null,
  }
}

export function getNormalizedRootWeights(nodes: CompetenceTreeNodeForm[]) {
  const roots = getChildren(nodes, null)
  const result = normalizeEnabledRootWeights(
    roots.map((root) => ({ key: root.key, weight: root.weight }))
  )
  return result.ok
    ? new Map(result.normalized.map(({ key, weight }) => [key, weight]))
    : new Map(roots.map(({ key }) => [key, 0]))
}
