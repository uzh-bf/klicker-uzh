import type {
  KnowledgeGraphResponse,
  KnowledgeGraphSourceReference,
} from '@klicker-uzh/types'
import { NextRequest, NextResponse } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const boundaries = vi.hoisted(() => ({
  getPublishedKnowledgeGraph: vi.fn(),
  isKnowledgeGraphNotPublishedError: vi.fn(),
  readKnowledgeGraphNeighbors: vi.fn(),
  readKnowledgeGraphOverview: vi.fn(),
  searchKnowledgeGraph: vi.fn(),
  withChatbotAuth: vi.fn(),
}))

vi.mock('@/src/lib/server/apiGuards', () => ({
  withChatbotAuth: boundaries.withChatbotAuth,
}))

vi.mock('@klicker-uzh/prisma', () => ({
  prisma: { chatbotKnowledgeGraph: {} },
}))

vi.mock('@/src/lib/server/knowledgeGraphRuntime', () => {
  return {
    getPublishedKnowledgeGraph: boundaries.getPublishedKnowledgeGraph,
    isKnowledgeGraphNotPublishedError:
      boundaries.isKnowledgeGraphNotPublishedError,
    readKnowledgeGraphNeighbors: boundaries.readKnowledgeGraphNeighbors,
    readKnowledgeGraphOverview: boundaries.readKnowledgeGraphOverview,
    searchKnowledgeGraph: boundaries.searchKnowledgeGraph,
  }
})

import { GET } from '../src/app/api/chatbots/[chatbotId]/knowledge-graph/route'

const chatbotId = '11111111-1111-4111-8111-111111111111'
const publication = {
  chatbotId,
  builtRevision: 7,
  graphName: `klickeruzh:${chatbotId}`,
  sources: [
    {
      resourceId: '22222222-2222-4222-8222-222222222222',
      title: 'Lecture notes',
    },
  ],
}
const response: KnowledgeGraphResponse = {
  chatbotId,
  builtRevision: 7,
  nodes: [
    {
      id: '12',
      labels: ['Concept'],
      kind: 'Concept',
      displayLabel: 'Access control',
      summary: 'Authorization follows authentication.',
      content: 'A bounded piece of source content.',
      degree: 2,
      sourceReferences: [
        {
          resourceId: publication.sources[0]!.resourceId,
          title: publication.sources[0]!.title,
          reference: 'p. 4',
        },
      ],
    },
  ],
  edges: [
    {
      id: '41',
      source: '12',
      target: '13',
      type: 'RELATED_TO',
      label: 'related to',
      properties: { confidence: 0.8 },
    },
  ],
  truncated: false,
}

function graphRequest(search: string): NextRequest {
  return new NextRequest(
    `http://localhost/api/chatbots/${chatbotId}/knowledge-graph?${search}`
  )
}

async function callRoute(search: string) {
  return GET(graphRequest(search), {
    params: Promise.resolve({ chatbotId }),
  })
}

beforeEach(() => {
  vi.resetAllMocks()
  boundaries.withChatbotAuth.mockResolvedValue({
    participantId: 'participant-id',
    authMode: 'account',
    chatbot: { courseId: 'course-id' },
  })
  boundaries.getPublishedKnowledgeGraph.mockResolvedValue(publication)
  boundaries.isKnowledgeGraphNotPublishedError.mockImplementation(
    (error) =>
      error instanceof Error && error.name === 'KnowledgeGraphNotPublishedError'
  )
  boundaries.readKnowledgeGraphOverview.mockResolvedValue(response)
  boundaries.searchKnowledgeGraph.mockResolvedValue(response)
  boundaries.readKnowledgeGraphNeighbors.mockResolvedValue(response)
})

describe('participant knowledge graph route', () => {
  it('returns the authentication response before validation or graph access', async () => {
    boundaries.withChatbotAuth.mockResolvedValue({
      response: NextResponse.json(
        { error: 'No authentication token found' },
        { status: 401 }
      ),
    })

    const result = await callRoute('operation=arbitrary-cypher')

    expect(result.status).toBe(401)
    await expect(result.json()).resolves.toEqual({
      error: 'No authentication token found',
    })
    expect(boundaries.getPublishedKnowledgeGraph).not.toHaveBeenCalled()
    expect(boundaries.readKnowledgeGraphOverview).not.toHaveBeenCalled()
  })

  it('does not expose graph publication or data to a non-participant', async () => {
    boundaries.withChatbotAuth.mockResolvedValue({
      response: NextResponse.json(
        { error: 'No valid participation found for this chatbot' },
        { status: 403 }
      ),
    })

    const result = await callRoute('operation=overview')

    expect(result.status).toBe(403)
    expect(boundaries.getPublishedKnowledgeGraph).not.toHaveBeenCalled()
    expect(boundaries.readKnowledgeGraphOverview).not.toHaveBeenCalled()
  })

  it.each(['EMPTY', 'DIRTY', 'QUEUED', 'PROCESSING', 'FAILED'] as const)(
    'returns a safe 409 for an unpublished %s graph',
    async (publicationStatus) => {
      const error = Object.assign(
        new Error('Knowledge graph is not published'),
        {
          code: publicationStatus,
          name: 'KnowledgeGraphNotPublishedError',
        }
      )
      boundaries.getPublishedKnowledgeGraph.mockRejectedValue(error)

      const result = await callRoute('operation=overview')

      expect(result.status).toBe(409)
      await expect(result.json()).resolves.toEqual({
        code: 'KNOWLEDGE_GRAPH_NOT_PUBLISHED',
        error: 'Knowledge graph is not published',
        publicationStatus,
      })
      expect(boundaries.readKnowledgeGraphOverview).not.toHaveBeenCalled()
    }
  )

  it('returns the normalized overview DTO', async () => {
    const result = await callRoute('operation=overview')

    expect(result.status).toBe(200)
    await expect(result.json()).resolves.toEqual(response)
    expect(boundaries.getPublishedKnowledgeGraph).toHaveBeenCalledWith(
      expect.anything(),
      chatbotId
    )
    expect(boundaries.readKnowledgeGraphOverview).toHaveBeenCalledWith(
      publication
    )
    expect(boundaries.searchKnowledgeGraph).not.toHaveBeenCalled()
    expect(boundaries.readKnowledgeGraphNeighbors).not.toHaveBeenCalled()
  })

  it('trims and passes a valid bounded search only to the fixed reader', async () => {
    const result = await callRoute(
      `operation=search&q=${encodeURIComponent('  Android security  ')}`
    )

    expect(result.status).toBe(200)
    expect(boundaries.searchKnowledgeGraph).toHaveBeenCalledWith(
      publication,
      'Android security'
    )
    expect(boundaries.readKnowledgeGraphOverview).not.toHaveBeenCalled()
  })

  it.each([
    'operation=search',
    'operation=search&q=%20%20',
    `operation=search&q=${'a'.repeat(101)}`,
    'operation=delete',
  ])('rejects an invalid operation or search input: %s', async (search) => {
    const result = await callRoute(search)

    expect(result.status).toBe(400)
    await expect(result.json()).resolves.toEqual({
      code: 'INVALID_KNOWLEDGE_GRAPH_REQUEST',
      error: 'Invalid knowledge graph request',
    })
    expect(boundaries.getPublishedKnowledgeGraph).not.toHaveBeenCalled()
    expect(boundaries.searchKnowledgeGraph).not.toHaveBeenCalled()
  })

  it('passes a numeric node ID only to the fixed neighborhood reader', async () => {
    const result = await callRoute('operation=neighbors&nodeId=12004')

    expect(result.status).toBe(200)
    expect(boundaries.readKnowledgeGraphNeighbors).toHaveBeenCalledWith(
      publication,
      '12004'
    )
    expect(boundaries.readKnowledgeGraphOverview).not.toHaveBeenCalled()
  })

  it.each([
    'operation=neighbors',
    'operation=neighbors&nodeId=',
    'operation=neighbors&nodeId=-1',
    'operation=neighbors&nodeId=12.4',
    'operation=neighbors&nodeId=node-12',
  ])('rejects an invalid neighborhood node ID: %s', async (search) => {
    const result = await callRoute(search)

    expect(result.status).toBe(400)
    expect(boundaries.getPublishedKnowledgeGraph).not.toHaveBeenCalled()
    expect(boundaries.readKnowledgeGraphNeighbors).not.toHaveBeenCalled()
  })

  it('sanitizes temporary FalkorDB failures and operational logs', async () => {
    boundaries.readKnowledgeGraphOverview.mockRejectedValue(
      new Error(
        'redis://reader:secret@falkordb.internal/graph?source=https://private.example'
      )
    )
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined)

    try {
      const result = await callRoute('operation=overview')

      expect(result.status).toBe(503)
      await expect(result.json()).resolves.toEqual({
        code: 'KNOWLEDGE_GRAPH_TEMPORARILY_UNAVAILABLE',
        error: 'Knowledge graph is temporarily unavailable',
      })
      expect(consoleError).toHaveBeenCalledWith(
        'Participant knowledge graph read failed',
        { chatbotId, operation: 'overview' }
      )
      expect(JSON.stringify(consoleError.mock.calls)).not.toMatch(
        /secret|private\.example|redis:\/\//
      )
    } finally {
      consoleError.mockRestore()
    }
  })

  it('returns only the public DTO fields supplied by the fixed reader', async () => {
    const unsafeSource = {
      ...response.nodes[0]!.sourceReferences[0]!,
      sourceUrl: 'https://blob.example/private.pdf?sig=secret',
    } as KnowledgeGraphSourceReference
    boundaries.readKnowledgeGraphOverview.mockResolvedValue({
      ...response,
      graphName: publication.graphName,
      connectionString: 'redis://reader:secret@falkordb.internal',
      nodes: [
        {
          ...response.nodes[0]!,
          embedding: [1, 2, 3],
          sourceReferences: [unsafeSource],
        },
      ],
      edges: [{ ...response.edges[0]!, cypher: 'MATCH (n) RETURN n' }],
    })

    const result = await callRoute('operation=overview')
    const body = await result.json()

    expect(body).toEqual(response)
    expect(JSON.stringify(body)).not.toMatch(
      /connectionString|embedding|graphName|sourceUrl|cypher|secret/
    )
  })
})
