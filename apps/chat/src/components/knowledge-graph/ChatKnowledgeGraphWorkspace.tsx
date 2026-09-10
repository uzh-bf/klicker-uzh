'use client'

import { authedFetch } from '@/src/lib/client/authedFetch'
import { useChatStore } from '@/src/stores/chatStore'
import type { KnowledgeGraphDataSource } from '@klicker-uzh/shared-components/src/knowledgeGraph/knowledgeGraphState'
import { KnowledgeGraphUnavailableError } from '@klicker-uzh/shared-components/src/knowledgeGraph/knowledgeGraphState'
import type { KnowledgeGraphResponse } from '@klicker-uzh/types'
import { SelectField } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useMemo, useState, useLayoutEffect, useRef } from 'react'
import { ChatKnowledgeGraphViewer } from './ChatKnowledgeGraphViewer'

type KnowledgeGraphFetch = (
  input: RequestInfo | URL,
  init?: RequestInit
) => Promise<Response>

type PublicationStatus = 'EMPTY' | 'QUEUED' | 'PROCESSING' | 'FAILED'

const PUBLICATION_STATUSES = new Set<PublicationStatus>([
  'EMPTY',
  'QUEUED',
  'PROCESSING',
  'FAILED',
])

type UnknownRecord = Record<string, unknown>

type GraphChoice = { id: string; name: string }

export class ChatKnowledgeGraphSelectionRequiredError extends KnowledgeGraphUnavailableError {
  constructor(readonly choices: GraphChoice[]) {
    super('Select an attached knowledge graph')
  }
}

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
  input?: { key: 'q' | 'nodeId'; value: string },
  kbId?: string
): string {
  const searchParams = new URLSearchParams({ operation })
  if (kbId !== undefined) searchParams.set('kbId', kbId)
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
    const body: unknown = await response
      .clone()
      .json()
      .catch(() => null)
    if (
      isRecord(body) &&
      body.code === 'KNOWLEDGE_GRAPH_SELECTION_REQUIRED' &&
      Array.isArray(body.choices) &&
      body.choices.every(
        (choice) =>
          isRecord(choice) &&
          typeof choice.id === 'string' &&
          typeof choice.name === 'string'
      )
    ) {
      throw new ChatKnowledgeGraphSelectionRequiredError(
        body.choices as GraphChoice[]
      )
    }
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
    typeof value.kbId === 'string' &&
    typeof value.buildId === 'string' &&
    typeof value.isStale === 'boolean' &&
    Array.isArray(value.nodes) &&
    value.nodes.every(isKnowledgeGraphNode) &&
    Array.isArray(value.edges) &&
    value.edges.every(isKnowledgeGraphEdge) &&
    typeof value.truncated === 'boolean'
  )
}

export function createChatKnowledgeGraphDataSource(
  chatbotId: string,
  fetcher: KnowledgeGraphFetch = authedFetch,
  kbId?: string
): KnowledgeGraphDataSource {
  return {
    overview: () =>
      readKnowledgeGraphResponse(
        knowledgeGraphUrl(chatbotId, 'overview', undefined, kbId),
        fetcher
      ),
    search: (query) =>
      readKnowledgeGraphResponse(
        knowledgeGraphUrl(
          chatbotId,
          'search',
          { key: 'q', value: query },
          kbId
        ),
        fetcher
      ),
    neighbors: (nodeId) =>
      readKnowledgeGraphResponse(
        knowledgeGraphUrl(
          chatbotId,
          'neighbors',
          {
            key: 'nodeId',
            value: nodeId,
          },
          kbId
        ),
        fetcher
      ),
  }
}

export function ChatKnowledgeGraphWorkspace({
  chatbotId,
}: {
  chatbotId: string
}) {
  const t = useTranslations('pwa.chatbot')
  const [selection, setSelection] = useState<{
    chatbotId: string
    kbId?: string
    choices: GraphChoice[]
  }>({ chatbotId, choices: [] })
  const kbId = selection.chatbotId === chatbotId ? selection.kbId : undefined
  const choices = selection.chatbotId === chatbotId ? selection.choices : []
  const activeSource = useRef<KnowledgeGraphDataSource | null>(null)
  const dataSource = useMemo(() => {
    const source = createChatKnowledgeGraphDataSource(
      chatbotId,
      authedFetch,
      kbId
    )
    const observe = async (request: Promise<KnowledgeGraphResponse>) => {
      try {
        return await request
      } catch (error) {
        if (
          activeSource.current === wrapped &&
          error instanceof ChatKnowledgeGraphSelectionRequiredError
        ) {
          setSelection({ chatbotId, choices: error.choices })
        }
        throw error
      }
    }
    const wrapped: KnowledgeGraphDataSource = {
      overview: () => observe(source.overview()),
      search: (query) => observe(source.search(query)),
      neighbors: (nodeId) => observe(source.neighbors(nodeId)),
    }
    return wrapped
  }, [chatbotId, kbId])

  useLayoutEffect(() => {
    activeSource.current = dataSource
    return () => {
      activeSource.current = null
    }
  }, [dataSource])

  return (
    <section
      aria-label="Knowledge graph workspace"
      className="flex min-h-0 flex-1 flex-col gap-3 bg-[#FAFAFA] p-2 sm:p-3 md:p-4"
      data-cy="chat-knowledge-graph-workspace"
    >
      {choices.length > 0 ? (
        <SelectField
          label={t('graphChoiceLabel')}
          placeholder={t('graphChoicePlaceholder')}
          data={{ cy: 'chat-knowledge-graph-choice' }}
          items={choices.map((choice) => ({
            value: choice.id,
            label: choice.name,
          }))}
          value={kbId}
          onChange={(value) =>
            setSelection({ chatbotId, kbId: value, choices })
          }
        />
      ) : null}
      {choices.length === 0 || kbId !== undefined ? (
        <ChatKnowledgeGraphViewer
          key={`${chatbotId}:${kbId ?? ''}`}
          dataSource={dataSource}
        />
      ) : null}
    </section>
  )
}
