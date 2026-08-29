export type ConversationBranchMessage = {
  id?: string
  parentId?: string | null
  role?: string
}

export type ConversationBranchWalk<T extends ConversationBranchMessage> = {
  path: T[]
  status: 'complete' | 'missing-leaf' | 'missing-parent' | 'cycle'
  missingParentId: string | null
}

/**
 * Walk one parent chain without using timestamps or sibling messages.
 * Invalid chains return no path so callers cannot treat a partial browser
 * projection as authoritative.
 */
export function walkConversationBranch<T extends ConversationBranchMessage>(
  messages: readonly T[],
  leafId: string
): ConversationBranchWalk<T> {
  const messageMap = new Map(
    messages.flatMap((message) =>
      typeof message.id === 'string' ? [[message.id, message] as const] : []
    )
  )
  const leaf = messageMap.get(leafId)
  if (!leaf) {
    return { path: [], status: 'missing-leaf', missingParentId: null }
  }

  const leafToRoot: T[] = []
  const visited = new Set<string>()
  let current: T | undefined = leaf

  while (current) {
    const currentId = current.id
    if (typeof currentId !== 'string' || visited.has(currentId)) {
      return { path: [], status: 'cycle', missingParentId: null }
    }

    visited.add(currentId)
    leafToRoot.push(current)

    if (!current.parentId) {
      return {
        path: leafToRoot.reverse(),
        status: 'complete',
        missingParentId: null,
      }
    }

    const parent = messageMap.get(current.parentId)
    if (!parent) {
      return {
        path: [],
        status: 'missing-parent',
        missingParentId: current.parentId,
      }
    }
    current = parent
  }

  return { path: [], status: 'missing-parent', missingParentId: null }
}
