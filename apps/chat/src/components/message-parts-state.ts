export function resolveDisclosureOpen(
  manualOpen: boolean | null,
  autoOpen: boolean,
  active: boolean
) {
  return manualOpen ?? (autoOpen && active)
}

type MessagePartWithName = {
  type: string
  name?: string
}

export function hasChatError(message: {
  content?: readonly MessagePartWithName[]
}): boolean {
  return (
    message.content?.some(
      (part) => part.type === 'data' && part.name === 'chat-error'
    ) ?? false
  )
}

export function truncateMessagesForReload<T extends { id?: string }>(
  messages: readonly T[],
  parentId: string | null
): T[] | null {
  const parentIndex = parentId
    ? messages.findIndex((message) => message.id === parentId)
    : -1

  if (parentId && parentIndex === -1) return null

  return parentIndex >= 0 ? messages.slice(0, parentIndex + 1) : []
}
