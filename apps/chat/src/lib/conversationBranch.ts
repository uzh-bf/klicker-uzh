export type ConversationBranchMessage = {
  id?: string
  parentId?: string | null
}

/**
 * Walk one parent chain without using timestamps or sibling messages.
 * Invalid chains return no path so callers cannot treat a partial browser
 * projection as authoritative.
 */
export function walkConversationBranch<T extends ConversationBranchMessage>(
  messages: readonly T[],
  leafId: string
): T[] {
  const messageMap = new Map(
    messages.flatMap((message) =>
      typeof message.id === 'string' ? [[message.id, message] as const] : []
    )
  )
  const leaf = messageMap.get(leafId)
  if (!leaf) return []

  const leafToRoot: T[] = []
  const visited = new Set<string>()
  let current: T | undefined = leaf

  while (current) {
    const currentId = current.id
    if (typeof currentId !== 'string' || visited.has(currentId)) {
      return []
    }

    visited.add(currentId)
    leafToRoot.push(current)

    if (!current.parentId) {
      return leafToRoot.reverse()
    }

    const parent = messageMap.get(current.parentId)
    if (!parent) return []
    current = parent
  }

  return []
}
