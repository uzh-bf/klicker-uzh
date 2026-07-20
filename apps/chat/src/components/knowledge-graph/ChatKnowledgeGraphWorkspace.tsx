'use client'

import { authedFetch } from '@/src/lib/client/authedFetch'
import { useChatStore } from '@/src/stores/chatStore'
import type { KnowledgeGraphDataSource } from '@klicker-uzh/shared-components/src/knowledgeGraph/knowledgeGraphState'
import { KnowledgeGraphUnavailableError } from '@klicker-uzh/shared-components/src/knowledgeGraph/knowledgeGraphState'
import type { KnowledgeGraphResponse } from '@klicker-uzh/types'
import { useMemo } from 'react'
import { ChatKnowledgeGraphViewer } from './ChatKnowledgeGraphViewer'

type KnowledgeGraphFetch = (
  input: RequestInfo | URL,
  init?: RequestInit
) => Promise<Response>

type PublicationStatus = 'EMPTY' | 'DIRTY' | 'QUEUED' | 'PROCESSING' | 'FAILED'

const PUBLICATION_STATUSES = new Set<PublicationStatus>([
  'EMPTY',
  'DIRTY',
  'QUEUED',
  'PROCESSING',
  'FAILED',
])

type UnknownRecord = Record<string, unknown>

export class ChatKnowledgeGraphUnavailableError extends KnowledgeGraphUnavailableError {
  readonly status = 409
  readonly publicationStatus?: PublicationStatus

  constructor(publicationStatus?: PublicationStatus) {
    super('Knowledge graph is not published')
    this.name = 'ChatKnowledgeGraphUnavailableError'
    this.publicationStatus = publicationStatus
  }
}

export class ChatKnowledgeGraphRequestError extends Error {
  readonly retryable: boolean
  readonly status: number

  constructor(status: number, retryable: boolean) {
    super(
      retryable
        ? 'Knowledge graph is temporarily unavailable'
        : 'Knowledge graph request failed'
    )
    this.name = 'ChatKnowledgeGraphRequestError'
    this.retryable = retryable
    this.status = status
  }
}

function knowledgeGraphUrl(
  chatbotId: string,
  operation: 'overview' | 'search' | 'neighbors',
  input?: { key: 'q' | 'nodeId'; value: string }
): string {
  const searchParams = new URLSearchParams({ operation })
  if (input !== undefined) {
    searchParams.set(input.key, input.value)
  }
  return `/api/chatbots/${encodeURIComponent(chatbotId)}/knowledge-graph?${searchParams.toString()}`
}

async function publicationStatus(
  response: Response
): Promise<PublicationStatus | undefined> {
  try {
    const body = (await response.json()) as { publicationStatus?: unknown }
    return typeof body.publicationStatus === 'string' &&
      PUBLICATION_STATUSES.has(body.publicationStatus as PublicationStatus)
      ? (body.publicationStatus as PublicationStatus)
      : undefined
  } catch {
    return undefined
  }
}

async function readKnowledgeGraphResponse(
  url: string,
  fetcher: KnowledgeGraphFetch
): Promise<KnowledgeGraphResponse> {
  const response = await fetcher(url)
  if (response.status === 409) {
    throw new ChatKnowledgeGraphUnavailableError(
      await publicationStatus(response)
    )
  }
  if (response.status === 403) {
    useChatStore.getState().setParticipationRequired(true)
    throw new ChatKnowledgeGraphRequestError(403, false)
  }
  if (!response.ok) {
    throw new ChatKnowledgeGraphRequestError(
      response.status,
      response.status === 503
    )
  }

  let body: unknown
  try {
    body = await response.json()
  } catch {
    throw new ChatKnowledgeGraphRequestError(502, false)
  }
  if (!isKnowledgeGraphResponse(body)) {
    throw new ChatKnowledgeGraphRequestError(502, false)
  }
  return body
}

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isOptionalString(value: unknown): boolean {
  return value === undefined || typeof value === 'string'
}

function isSourceReference(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value.resourceId === 'string' &&
    typeof value.title === 'string' &&
    isOptionalString(value.reference)
  )
}

function isKnowledgeGraphNode(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    Array.isArray(value.labels) &&
    value.labels.every((label) => typeof label === 'string') &&
    typeof value.kind === 'string' &&
    typeof value.displayLabel === 'string' &&
    isOptionalString(value.summary) &&
    isOptionalString(value.content) &&
    typeof value.degree === 'number' &&
    Number.isSafeInteger(value.degree) &&
    value.degree >= 0 &&
    Array.isArray(value.sourceReferences) &&
    value.sourceReferences.every(isSourceReference)
  )
}

function isEdgeProperty(value: unknown): boolean {
  return (
    typeof value === 'string' ||
    typeof value === 'boolean' ||
    (typeof value === 'number' && Number.isFinite(value))
  )
}

function isKnowledgeGraphEdge(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.source === 'string' &&
    typeof value.target === 'string' &&
    typeof value.type === 'string' &&
    typeof value.label === 'string' &&
    isRecord(value.properties) &&
    Object.values(value.properties).every(isEdgeProperty)
  )
}

function isKnowledgeGraphResponse(
  value: unknown
): value is KnowledgeGraphResponse {
  return (
    isRecord(value) &&
    typeof value.chatbotId === 'string' &&
    typeof value.builtRevision === 'number' &&
    Number.isSafeInteger(value.builtRevision) &&
    value.builtRevision >= 0 &&
    Array.isArray(value.nodes) &&
    value.nodes.every(isKnowledgeGraphNode) &&
    Array.isArray(value.edges) &&
    value.edges.every(isKnowledgeGraphEdge) &&
    typeof value.truncated === 'boolean'
  )
}

export function createChatKnowledgeGraphDataSource(
  chatbotId: string,
  fetcher: KnowledgeGraphFetch = authedFetch
): KnowledgeGraphDataSource {
  return {
    overview: () =>
      readKnowledgeGraphResponse(
        knowledgeGraphUrl(chatbotId, 'overview'),
        fetcher
      ),
    search: (query) =>
      readKnowledgeGraphResponse(
        knowledgeGraphUrl(chatbotId, 'search', { key: 'q', value: query }),
        fetcher
      ),
    neighbors: (nodeId) =>
      readKnowledgeGraphResponse(
        knowledgeGraphUrl(chatbotId, 'neighbors', {
          key: 'nodeId',
          value: nodeId,
        }),
        fetcher
      ),
  }
}

export function ChatKnowledgeGraphWorkspace({
  chatbotId,
}: {
  chatbotId: string
}) {
  const dataSource = useMemo(
    () => createChatKnowledgeGraphDataSource(chatbotId),
    [chatbotId]
  )

  return (
    <section
      aria-label="Knowledge graph workspace"
      className="flex min-h-0 flex-1 bg-[#FAFAFA] p-2 sm:p-3 md:p-4"
      data-cy="chat-knowledge-graph-workspace"
    >
      <ChatKnowledgeGraphViewer dataSource={dataSource} />
    </section>
  )
}
