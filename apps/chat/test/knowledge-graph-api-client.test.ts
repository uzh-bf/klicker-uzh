import {
  ChatKnowledgeGraphRequestError,
  createChatKnowledgeGraphDataSource,
} from '@/src/components/knowledge-graph/ChatKnowledgeGraphWorkspace'
import { CHAT_GUEST_SESSION_STORAGE_KEY } from '@/src/hooks/useChatGuestTokenBootstrap'
import {
  DEFAULT_PARTICIPATION_MESSAGE,
  useChatStore,
} from '@/src/stores/chatStore'
import { KnowledgeGraphUnavailableError } from '@klicker-uzh/shared-components/src/knowledgeGraph/knowledgeGraphState'
import type { KnowledgeGraphResponse } from '@klicker-uzh/types'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const chatbotId = '11111111-1111-4111-8111-111111111111'
const graphResponse: KnowledgeGraphResponse = {
  kbId: '22222222-2222-4222-8222-222222222222',
  buildId: '33333333-3333-4333-8333-333333333333',
  isStale: false,
  nodes: [
    {
      id: '12',
      labels: ['Concept'],
      kind: 'Concept',
      displayLabel: 'Android security',
      degree: 2,
      sourceReferences: [],
    },
  ],
  edges: [],
  truncated: false,
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('chat knowledge graph API client', () => {
  let originalFetch: typeof globalThis.fetch
  const originalSessionStorage = globalThis.sessionStorage

  beforeEach(() => {
    originalFetch = globalThis.fetch
    const store = new Map<string, string>()
    Object.defineProperty(globalThis, 'sessionStorage', {
      configurable: true,
      value: {
        getItem: (key: string) => store.get(key) ?? null,
        setItem: (key: string, value: string) => store.set(key, value),
        removeItem: (key: string) => store.delete(key),
        clear: () => store.clear(),
        key: (index: number) => Array.from(store.keys())[index] ?? null,
        length: 0,
      },
    })
    useChatStore.getState().setParticipationRequired(false)
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
    Object.defineProperty(globalThis, 'sessionStorage', {
      configurable: true,
      value: originalSessionStorage,
    })
    vi.restoreAllMocks()
  })

  it('encodes search text with URLSearchParams', async () => {
    const fetcher = vi.fn().mockResolvedValue(jsonResponse(graphResponse))
    const dataSource = createChatKnowledgeGraphDataSource(chatbotId, fetcher)

    await dataSource.search('Android security & privacy')

    expect(fetcher).toHaveBeenCalledWith(
      `/api/chatbots/${chatbotId}/knowledge-graph?operation=search&q=Android+security+%26+privacy`
    )
  })

  it('passes decimal FalkorDB node IDs through the neighbors operation', async () => {
    const fetcher = vi.fn().mockResolvedValue(jsonResponse(graphResponse))
    const dataSource = createChatKnowledgeGraphDataSource(chatbotId, fetcher)

    await dataSource.neighbors('12004')

    expect(fetcher).toHaveBeenCalledWith(
      `/api/chatbots/${chatbotId}/knowledge-graph?operation=neighbors&nodeId=12004`
    )
  })

  it('maps unpublished responses to an unavailable graph error with status', async () => {
    const fetcher = vi.fn().mockResolvedValue(
      jsonResponse(
        {
          code: 'KNOWLEDGE_GRAPH_NOT_PUBLISHED',
          error: 'Knowledge graph is not published',
          publicationStatus: 'PROCESSING',
        },
        409
      )
    )
    const dataSource = createChatKnowledgeGraphDataSource(chatbotId, fetcher)

    const error = await dataSource.overview().catch((caught) => caught)

    expect(error).toBeInstanceOf(KnowledgeGraphUnavailableError)
    expect(error).toMatchObject({
      status: 409,
      publicationStatus: 'PROCESSING',
    })
  })

  it('maps a temporary read failure to a safe retryable error', async () => {
    const fetcher = vi.fn().mockResolvedValue(
      jsonResponse(
        {
          code: 'KNOWLEDGE_GRAPH_TEMPORARILY_UNAVAILABLE',
          error: 'redis://reader:secret@falkordb.internal',
        },
        503
      )
    )
    const dataSource = createChatKnowledgeGraphDataSource(chatbotId, fetcher)

    const error = await dataSource.overview().catch((caught) => caught)

    expect(error).toBeInstanceOf(ChatKnowledgeGraphRequestError)
    expect(error).toMatchObject({
      message: 'Knowledge graph is temporarily unavailable',
      retryable: true,
      status: 503,
    })
    expect(JSON.stringify(error)).not.toContain('secret')
  })

  it('opens the existing participation gate when an embedded graph gets a 403 on its first request', async () => {
    const fetcher = vi.fn().mockResolvedValue(
      jsonResponse(
        {
          error:
            'No valid participation found for this chatbot; redis://secret',
        },
        403
      )
    )
    const dataSource = createChatKnowledgeGraphDataSource(chatbotId, fetcher)

    await expect(dataSource.overview()).rejects.toMatchObject({
      message: 'Knowledge graph request failed',
      retryable: false,
      status: 403,
    })
    expect(useChatStore.getState()).toMatchObject({
      participationRequired: true,
      participationMessage: DEFAULT_PARTICIPATION_MESSAGE,
    })
    expect(useChatStore.getState().participationMessage).not.toContain('secret')
  })

  it('uses authedFetch so the guest bearer token reaches the API', async () => {
    sessionStorage.setItem(CHAT_GUEST_SESSION_STORAGE_KEY, 'guest-token')
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(graphResponse))
    globalThis.fetch = fetchMock as unknown as typeof globalThis.fetch
    const dataSource = createChatKnowledgeGraphDataSource(chatbotId)

    await dataSource.overview()

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ]
    expect(url).toBe(
      `/api/chatbots/${chatbotId}/knowledge-graph?operation=overview`
    )
    expect(new Headers(init.headers).get('authorization')).toBe(
      'Bearer guest-token'
    )
  })

  it('decodes a successful browser-safe DTO', async () => {
    const fetcher = vi.fn().mockResolvedValue(jsonResponse(graphResponse))
    const dataSource = createChatKnowledgeGraphDataSource(chatbotId, fetcher)

    await expect(dataSource.overview()).resolves.toEqual(graphResponse)
  })

  it.each([
    {
      name: 'invalid top-level nodes',
      value: { ...graphResponse, nodes: 'not-an-array' },
    },
    {
      name: 'invalid nested node degree',
      value: {
        ...graphResponse,
        nodes: [{ ...graphResponse.nodes[0]!, degree: 'secret-degree' }],
      },
    },
    {
      name: 'invalid nested edge properties',
      value: {
        ...graphResponse,
        edges: [
          {
            id: '41',
            source: '12',
            target: '13',
            type: 'RELATED_TO',
            label: 'related to',
            properties: { embedding: ['secret'] },
          },
        ],
      },
    },
  ])('rejects a malformed 2xx DTO safely: $name', async ({ value }) => {
    const fetcher = vi.fn().mockResolvedValue(jsonResponse(value))
    const dataSource = createChatKnowledgeGraphDataSource(chatbotId, fetcher)

    const error = await dataSource.overview().catch((caught) => caught)

    expect(error).toBeInstanceOf(ChatKnowledgeGraphRequestError)
    expect(error).toMatchObject({
      message: 'Knowledge graph request failed',
      retryable: false,
      status: 502,
    })
    expect(JSON.stringify(error)).not.toContain('secret')
  })

  it('rejects malformed 2xx JSON without leaking parser input', async () => {
    const fetcher = vi.fn().mockResolvedValue(
      new Response('{"password":"secret"', {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    )
    const dataSource = createChatKnowledgeGraphDataSource(chatbotId, fetcher)

    const error = await dataSource.overview().catch((caught) => caught)

    expect(error).toBeInstanceOf(ChatKnowledgeGraphRequestError)
    expect(error).toMatchObject({
      message: 'Knowledge graph request failed',
      retryable: false,
      status: 502,
    })
    expect(JSON.stringify(error)).not.toContain('secret')
  })
})
