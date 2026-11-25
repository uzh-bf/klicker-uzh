import { isDocQueryToolName } from '../sources/normalizeSources'

export const RETRIEVAL_SOURCE_DATA_PART = 'retrieval-source'

/**
 * Original retrieval origin of one assistant turn. Media replay needs both
 * halves: the mode that produced the artifact and the exact knowledge-base
 * link that authorized it at the time. A later mode change never rewrites it.
 */
export interface MessageRetrievalSource {
  chatMode: string
  kbId: string
  kbLinkId: string
  revisionVersion: number
}

export type RetrievalSourceDataPart = {
  type: 'data'
  name: typeof RETRIEVAL_SOURCE_DATA_PART
  data: MessageRetrievalSource
}

type ContentPart = { type: string }

type UnknownPart = {
  type?: unknown
  name?: unknown
  data?: unknown
  toolName?: unknown
  result?: unknown
  isError?: unknown
}

function asPart(value: unknown): UnknownPart | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as UnknownPart
}

function readSource(value: unknown): MessageRetrievalSource | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const source = value as Record<string, unknown>
  const { chatMode, kbId, kbLinkId, revisionVersion } = source
  if (
    typeof chatMode !== 'string' ||
    chatMode.length === 0 ||
    typeof kbId !== 'string' ||
    kbId.length === 0 ||
    typeof kbLinkId !== 'string' ||
    kbLinkId.length === 0 ||
    typeof revisionVersion !== 'number' ||
    !Number.isInteger(revisionVersion)
  ) {
    return null
  }

  return { chatMode, kbId, kbLinkId, revisionVersion }
}

/**
 * Reads the persisted retrieval origin of a message. A managed chatbot whose
 * evidence carries no provenance stays ambiguous, so callers receive `null`
 * rather than an origin inferred from the currently selected mode.
 */
export function readMessageRetrievalSource(
  content: unknown
): MessageRetrievalSource | null {
  if (!Array.isArray(content)) return null

  for (const value of content) {
    const part = asPart(value)
    if (part?.type !== 'data' || part.name !== RETRIEVAL_SOURCE_DATA_PART) {
      continue
    }
    const source = readSource(part.data)
    return source
  }

  return null
}

/** Whether the persisted turn actually called Doc Query successfully. */
export function hasSuccessfulDocQueryResult(content: unknown): boolean {
  if (!Array.isArray(content)) return false

  return content.some((value) => {
    const part = asPart(value)
    return (
      part?.type === 'tool-call' &&
      typeof part.toolName === 'string' &&
      isDocQueryToolName(part.toolName) &&
      part.result !== undefined &&
      part.result !== null &&
      part.isError !== true
    )
  })
}

/**
 * Appends the retrieval origin to a persisted turn that performed a Doc Query
 * call. Turns without retrieval, and turns that already carry the marker, keep
 * their content untouched.
 */
export function withRetrievalSourceProvenance<T extends ContentPart>(
  content: T[],
  source: MessageRetrievalSource | null
): (T | RetrievalSourceDataPart)[] {
  if (
    !source ||
    !hasSuccessfulDocQueryResult(content) ||
    readMessageRetrievalSource(content) !== null
  ) {
    return content
  }

  return [
    ...content,
    { type: 'data', name: RETRIEVAL_SOURCE_DATA_PART, data: source },
  ]
}
