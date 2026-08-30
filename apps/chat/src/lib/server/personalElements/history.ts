import {
  isFailedPersonalElementPart,
  isSettledTerminalPartialPersonalElementPart,
  isTerminalPartialPersonalElementPart,
} from '@/src/lib/personalElements/failure'
import { isDocQueryToolName } from '@/src/lib/sources/normalizeSources'
import {
  type CardPlan,
  cardPlanSchema,
  type GeneratedCardCandidate,
  MAX_CARDS,
  normalizeRetrievedChunks,
  parseStoredGeneratedCardCandidate,
} from './contracts'

export type PersistedChatContentPart = {
  type?: unknown
  name?: unknown
  toolCallId?: unknown
  toolName?: unknown
  args?: unknown
  input?: unknown
  output?: unknown
  result?: unknown
  isError?: unknown
}

export type ThreadHistoryMessage = {
  id: string
  parentId: string | null
  role: string
  content: unknown
  createdAt: Date
}

export function hasToolPart(content: unknown, toolName: string): boolean {
  return (
    Array.isArray(content) &&
    content.some(
      (part) => part.type === 'tool-call' && part.toolName === toolName
    )
  )
}

export function hasChunkedDocQueryResult(part: unknown): boolean {
  if (!part || typeof part !== 'object') return false
  const candidate = part as PersistedChatContentPart
  if (
    (candidate.type !== 'tool-call' && candidate.type !== 'tool-result') ||
    typeof candidate.toolName !== 'string' ||
    !isDocQueryToolName(candidate.toolName)
  ) {
    return false
  }

  try {
    const result = candidate.output ?? candidate.result
    return normalizeRetrievedChunks(result).chunks.length > 0
  } catch {
    return false
  }
}

export function getActiveBranchMessageIds(
  messages: readonly ThreadHistoryMessage[],
  leafId: string | null
) {
  const byId = new Map(messages.map((message) => [message.id, message]))
  const ids = new Set<string>()
  let currentId = leafId
  while (currentId && !ids.has(currentId)) {
    ids.add(currentId)
    currentId = byId.get(currentId)?.parentId ?? null
  }
  return ids
}

export function parseAcceptedCardPlan(
  content: unknown,
  toolCallId: string
): CardPlan | null {
  if (!Array.isArray(content)) return null
  const part = (content as PersistedChatContentPart[]).find(
    (candidate) =>
      candidate.type === 'tool-call' &&
      candidate.toolCallId === toolCallId &&
      candidate.toolName === 'propose_card_plan'
  )
  if (!part || !part.result || typeof part.result !== 'object') return null
  const parsed = cardPlanSchema.safeParse(part.result)
  return parsed.success ? parsed.data : null
}

export function hasNewerCardPlan(
  messages: readonly ThreadHistoryMessage[],
  branchIds: ReadonlySet<string>,
  acceptedPlanMessage: ThreadHistoryMessage
): boolean {
  return messages.some(
    (message) =>
      message.role === 'assistant' &&
      branchIds.has(message.id) &&
      message.createdAt > acceptedPlanMessage.createdAt &&
      hasToolPart(message.content, 'propose_card_plan')
  )
}

export function isFailedGenerationContent(content: unknown): boolean {
  if (!Array.isArray(content)) return false
  return content.some(
    (part) =>
      isFailedPersonalElementPart(part, 'generate_cards') ||
      isTerminalPartialPersonalElementPart(part, 'generate_cards')
  )
}

/**
 * Reads successful generated candidates from one active branch. Saved
 * candidates are removed by their stable plan-scoped candidate ID.
 */
export function extractUnsavedCandidates(
  messages: readonly ThreadHistoryMessage[],
  branchIds: ReadonlySet<string>,
  completedGenerationMessageIds: ReadonlySet<string>,
  savedCandidateIds: ReadonlySet<string> = new Set()
) {
  const candidates = new Map<string, GeneratedCardCandidate>()
  for (const message of messages) {
    if (
      message.role !== 'assistant' ||
      !branchIds.has(message.id) ||
      !hasToolPart(message.content, 'generate_cards')
    ) {
      continue
    }
    const parts = message.content as PersistedChatContentPart[]
    if (
      parts.some(
        (part) =>
          part.type === 'data' &&
          (part.name === 'chat-stopped' || part.name === 'chat-error')
      )
    ) {
      continue
    }

    for (const part of parts) {
      if (part.type !== 'tool-call' || part.toolName !== 'generate_cards') {
        continue
      }
      if (
        !completedGenerationMessageIds.has(message.id) &&
        !isSettledTerminalPartialPersonalElementPart(part, 'generate_cards')
      ) {
        continue
      }
      if (isFailedPersonalElementPart(part, 'generate_cards')) continue

      const result =
        part.result && typeof part.result === 'object'
          ? (part.result as { candidates?: unknown[]; total?: unknown })
          : null
      const values = result?.candidates
      if (
        !Array.isArray(values) ||
        values.length > MAX_CARDS ||
        (typeof result?.total === 'number' && result.total > MAX_CARDS)
      ) {
        continue
      }
      for (const value of values) {
        const parsed = parseStoredGeneratedCardCandidate(value)
        if (!parsed || savedCandidateIds.has(parsed.candidateId)) {
          continue
        }
        candidates.set(parsed.candidateId, parsed)
      }
    }
  }
  return candidates
}
