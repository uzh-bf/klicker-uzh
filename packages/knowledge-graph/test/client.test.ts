import { beforeEach, describe, expect, it, vi } from 'vitest'

const sdk = vi.hoisted(() => ({
  close: vi.fn(),
  connect: vi.fn(),
  on: vi.fn(),
  removeListener: vi.fn(),
  roQuery: vi.fn(),
  query: vi.fn(),
  selectGraph: vi.fn(),
}))

vi.mock('falkordb', () => ({
  FalkorDB: { connect: sdk.connect },
}))

import {
  closeKnowledgeGraphClient,
  readKnowledgeGraphNeighbors,
  readKnowledgeGraphOverview,
  searchKnowledgeGraph,
} from '../src/client.js'
import type { PublishedKnowledgeGraph } from '../src/publication.js'
import {
  exampleLectureEdgeRows,
  exampleLectureNodeRows,
  exampleLectureSources,
} from './fixtures/exampleLectureGraph.js'

const context: PublishedKnowledgeGraph = {
  chatbotId: '00000000-0000-4000-8000-000000000001',
  builtRevision: 4,
  graphName: 'klickeruzh:00000000-0000-4000-8000-000000000001',
  sources: exampleLectureSources,
}

describe('knowledge graph client', () => {
  beforeEach(async () => {
    await closeKnowledgeGraphClient()
    vi.clearAllMocks()
    process.env.KB_FALKORDB_HOST = 'falkordb.test'
    process.env.KB_FALKORDB_PORT = '6380'
    process.env.KB_FALKORDB_USERNAME = 'reader'
    process.env.KB_FALKORDB_PASSWORD = 'test-password'
    process.env.KB_FALKORDB_TLS = 'true'
    process.env.KB_FALKORDB_QUERY_TIMEOUT_MS = '4321'

    sdk.connect.mockResolvedValue({
      close: sdk.close,
      on: sdk.on,
      removeListener: sdk.removeListener,
      selectGraph: sdk.selectGraph,
    })
    sdk.selectGraph.mockReturnValue({
      query: sdk.query,
      roQuery: sdk.roQuery,
    })
    sdk.close.mockResolvedValue(undefined)
  })

  it('connects once with strict socket and credential configuration', async () => {
    sdk.roQuery
      .mockResolvedValueOnce({ data: exampleLectureNodeRows })
      .mockResolvedValueOnce({ data: exampleLectureEdgeRows })
      .mockResolvedValueOnce({ data: exampleLectureNodeRows })

    await readKnowledgeGraphOverview(context)
    await searchKnowledgeGraph(context, 'Android')

    expect(sdk.connect).toHaveBeenCalledTimes(1)
    expect(sdk.connect).toHaveBeenCalledWith({
      username: 'reader',
      password: 'test-password',
      socket: {
        host: 'falkordb.test',
        port: 6380,
        tls: true,
        connectTimeout: 4321,
      },
    })
    expect(sdk.on).toHaveBeenCalledWith('error', expect.any(Function))
    expect(sdk.selectGraph).toHaveBeenCalledWith(context.graphName)
  })

  it('uses roQuery with parameters and the configured timeout only', async () => {
    sdk.roQuery
      .mockResolvedValueOnce({ data: exampleLectureNodeRows })
      .mockResolvedValueOnce({ data: exampleLectureEdgeRows })

    await readKnowledgeGraphOverview(context)

    expect(sdk.roQuery).toHaveBeenCalledTimes(2)
    for (const [cypher, options] of sdk.roQuery.mock.calls) {
      expect(cypher).toEqual(expect.any(String))
      expect(options).toMatchObject({ TIMEOUT: 4321 })
    }
    expect(sdk.roQuery.mock.calls[1]?.[1]).toMatchObject({
      params: { nodeIds: ['12', '27', '31', '44', '58'] },
    })
    expect(sdk.query).not.toHaveBeenCalled()
  })

  it('closes and resets the reusable client', async () => {
    sdk.roQuery.mockResolvedValue({ data: [] })

    await readKnowledgeGraphOverview(context)
    await closeKnowledgeGraphClient()
    await readKnowledgeGraphOverview(context)

    expect(sdk.close).toHaveBeenCalledTimes(1)
    expect(sdk.connect).toHaveBeenCalledTimes(2)
  })

  it('omits absent optional credentials', async () => {
    delete process.env.KB_FALKORDB_USERNAME
    delete process.env.KB_FALKORDB_PASSWORD
    sdk.roQuery.mockResolvedValue({ data: [] })

    await readKnowledgeGraphOverview(context)

    expect(sdk.connect).toHaveBeenCalledWith(
      expect.objectContaining({ username: undefined, password: undefined })
    )
  })

  it('normalizes and bounds overview results', async () => {
    const extraNodes = Array.from({ length: 249 }, (_, index) => ({
      id: index + 100,
      labels: ['Concept'],
      properties: { name: `Concept ${index}` },
      degree: 1,
    }))
    const extraEdges = Array.from({ length: 500 }, (_, index) => ({
      id: index + 1000,
      source: 12,
      target: 27,
      type: 'RELATED_TO',
      properties: { position: index },
    }))
    sdk.roQuery
      .mockResolvedValueOnce({
        data: [...exampleLectureNodeRows, ...extraNodes],
      })
      .mockResolvedValueOnce({
        data: [...exampleLectureEdgeRows, ...extraEdges],
      })

    const result = await readKnowledgeGraphOverview(context)

    expect(result).toMatchObject({
      chatbotId: context.chatbotId,
      builtRevision: 4,
      truncated: true,
    })
    expect(result.nodes).toHaveLength(250)
    expect(result.edges).toHaveLength(500)
  })

  it('parameterizes search and returns no arbitrary edge data', async () => {
    const userText = 'Android Security'
    sdk.roQuery.mockResolvedValueOnce({ data: exampleLectureNodeRows })

    const result = await searchKnowledgeGraph(context, userText)

    expect(sdk.roQuery.mock.calls[0]?.[0]).not.toContain(userText)
    expect(sdk.roQuery.mock.calls[0]?.[1]).toEqual({
      params: { searchText: userText },
      TIMEOUT: 4321,
    })
    expect(result.edges).toEqual([])
  })

  it('returns at most 20 search results and reports truncation', async () => {
    const matches = Array.from({ length: 21 }, (_, index) => ({
      id: index,
      labels: ['Concept'],
      properties: { name: `Result ${index}` },
      degree: 1,
    }))
    sdk.roQuery.mockResolvedValueOnce({ data: matches })

    const result = await searchKnowledgeGraph(context, 'Result')

    expect(result.nodes).toHaveLength(20)
    expect(result.truncated).toBe(true)
  })

  it('returns at most 100 additional neighborhood nodes and 200 edges', async () => {
    const center = exampleLectureNodeRows[0]!
    const neighbors = Array.from({ length: 101 }, (_, index) => ({
      id: index + 100,
      labels: ['Concept'],
      properties: { name: `Neighbor ${index}` },
      degree: 1,
    }))
    const edges = Array.from({ length: 201 }, (_, index) => ({
      id: index + 1000,
      source: 12,
      target: index + 100,
      type: 'RELATED_TO',
      properties: {},
    }))
    sdk.roQuery
      .mockResolvedValueOnce({ data: [center, ...neighbors] })
      .mockResolvedValueOnce({ data: edges })

    const result = await readKnowledgeGraphNeighbors(context, '12')

    expect(result.nodes).toHaveLength(100)
    expect(result.edges).toHaveLength(200)
    expect(result.truncated).toBe(true)
    expect(sdk.roQuery.mock.calls[0]?.[0]).not.toContain(context.chatbotId)
    expect(sdk.roQuery.mock.calls[0]?.[1]).toMatchObject({
      params: { nodeId: '12' },
    })
  })
})
