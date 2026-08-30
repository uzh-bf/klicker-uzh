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

/**
 * A turn the participant stopped before any answer text arrived. Such a turn
 * has nothing to rate or timestamp, so it shares the error turns' chrome
 * treatment; a stopped turn WITH text is a real partial answer and keeps the
 * normal metadata and feedback controls.
 */
export function isStoppedWithoutText(message: {
  content?: readonly (MessagePartWithName & { text?: string })[]
}): boolean {
  const parts = message.content ?? []
  return (
    parts.some(
      (part) => part.type === 'data' && part.name === 'chat-stopped'
    ) &&
    !parts.some(
      (part) =>
        part.type === 'text' &&
        typeof part.text === 'string' &&
        part.text.trim() !== ''
    )
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

export type PersonalElementToolPresentation =
  | 'plan'
  | 'generated-candidates'
  | 'saved-revision'
  | null

export function getPersonalElementToolPresentation(
  toolName: string
): PersonalElementToolPresentation {
  if (toolName === 'propose_card_plan') return 'plan'
  if (toolName === 'generate_cards') return 'generated-candidates'
  if (toolName === 'revise_personal_element') return 'saved-revision'
  return null
}

export function isInternalChatTool(toolName: string): boolean {
  return toolName === 'select_response_type'
}

export function shouldGroupToolCalls(toolNames: readonly string[]): boolean {
  const visibleToolNames = toolNames.filter(
    (toolName) => !isInternalChatTool(toolName)
  )
  return (
    visibleToolNames.length > 1 &&
    !visibleToolNames.some(
      (toolName) => getPersonalElementToolPresentation(toolName) !== null
    )
  )
}
