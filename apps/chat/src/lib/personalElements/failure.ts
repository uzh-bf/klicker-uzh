export type PersonalElementToolName = 'generate_cards' | 'revise_cards'

type CandidatePart = {
  type?: unknown
  name?: unknown
  toolCallId?: unknown
  toolName?: unknown
  isError?: unknown
  result?: unknown
}

function resultIsFailed(result: unknown): boolean {
  if (!result || typeof result !== 'object') return false
  const value = result as {
    isError?: unknown
    status?: unknown
    candidates?: unknown
    failedCards?: unknown
    total?: unknown
  }
  const allCardsFailed =
    value.status === 'partial' &&
    Array.isArray(value.candidates) &&
    value.candidates.length === 0 &&
    Array.isArray(value.failedCards) &&
    typeof value.total === 'number' &&
    value.total > 0 &&
    value.failedCards.length === value.total
  return value.isError === true || value.status === 'error' || allCardsFailed
}

function resultIsTerminalPartial(result: unknown): boolean {
  if (!result || typeof result !== 'object') return false
  const value = result as {
    status?: unknown
    completed?: unknown
    total?: unknown
    candidates?: unknown
    failedCards?: unknown
  }
  return (
    value.status === 'partial' &&
    Array.isArray(value.candidates) &&
    value.candidates.length > 0 &&
    Array.isArray(value.failedCards) &&
    value.failedCards.length > 0 &&
    typeof value.completed === 'number' &&
    typeof value.total === 'number' &&
    value.total > 0 &&
    value.completed >= value.total
  )
}

export function isPersonalElementFailureMarker(part: unknown): boolean {
  if (!part || typeof part !== 'object') return false
  const value = part as CandidatePart

  return (
    value.type === 'data' &&
    (value.name === 'chat-stopped' || value.name === 'chat-error')
  )
}

export function isFailedPersonalElementPart(
  part: unknown,
  toolName: PersonalElementToolName
): boolean {
  if (!part || typeof part !== 'object') return false
  const value = part as CandidatePart

  if (isPersonalElementFailureMarker(value)) return true
  if (value.toolName !== toolName) return false

  return value.isError === true || resultIsFailed(value.result)
}

export function isTerminalPartialPersonalElementPart(
  part: unknown,
  toolName: PersonalElementToolName
): boolean {
  if (!part || typeof part !== 'object') return false
  const value = part as CandidatePart
  return value.toolName === toolName && resultIsTerminalPartial(value.result)
}

export function isSettledTerminalPartialPersonalElementPart(
  part: unknown,
  toolName: PersonalElementToolName
): boolean {
  if (!isTerminalPartialPersonalElementPart(part, toolName)) return false
  const result = (part as CandidatePart).result
  return (
    result !== null &&
    typeof result === 'object' &&
    (result as { settlement?: unknown }).settlement === 'partial'
  )
}

export function isFailedPersonalElementAttempt(
  parts: readonly unknown[],
  toolCallId: string,
  toolName: PersonalElementToolName
): boolean {
  const attempt = parts.find((part) => {
    if (!part || typeof part !== 'object') return false
    const value = part as CandidatePart
    return value.toolName === toolName && value.toolCallId === toolCallId
  })
  if (!attempt) return false

  return (
    isFailedPersonalElementPart(attempt, toolName) ||
    parts.some(isPersonalElementFailureMarker)
  )
}
