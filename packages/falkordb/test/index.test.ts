import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  BENIBOT_CHATBOT_ID,
  createChatbotGraph,
  createPrototypeFinanceGraphQuery,
  deleteChatbotGraph,
  getChatbotGraphName,
  getChatbotGraphSnapshot,
  loadFalkorDBConfig,
  readChatbotGraph,
  seedPrototypeFinanceGraph,
  writeChatbotGraph,
  type FalkorDBClient,
} from '../src/index.js'

const CHATBOT_ID = '8f9c2e1d-4b7a-4c3e-9f5d-1a2b3c4d5e6f'
const GRAPH_NAME = `klickeruzh:chatbot:${CHATBOT_ID}`

function createMockClient(): FalkorDBClient & {
  call: ReturnType<typeof vi.fn>
} {
  return {
    call: vi.fn().mockResolvedValue(['ok']),
  }
}

describe('getChatbotGraphName', () => {
  it('derives the FalkorDB graph name from a chatbot UUID', () => {
    expect(getChatbotGraphName(CHATBOT_ID)).toBe(GRAPH_NAME)
  })

  it('rejects empty chatbot ids', () => {
    expect(() => getChatbotGraphName('')).toThrow(
      'chatbotId must be a valid UUID'
    )
  })

  it('rejects non-UUID chatbot ids', () => {
    expect(() => getChatbotGraphName('not-a-uuid')).toThrow(
      'chatbotId must be a valid UUID'
    )
  })
})

describe('loadFalkorDBConfig', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('loads FalkorDB connection config from env vars', () => {
    const config = loadFalkorDBConfig({
      FALKORDB_HOST: 'falkordb.local',
      FALKORDB_PORT: '6379',
      FALKORDB_USERNAME: 'chatbot-user',
      FALKORDB_PASSWORD: 'secret',
    })

    expect(config).toEqual({
      host: 'falkordb.local',
      port: 6379,
      username: 'chatbot-user',
      password: 'secret',
    })
  })

  it.each([
    'FALKORDB_HOST',
    'FALKORDB_PORT',
    'FALKORDB_USERNAME',
    'FALKORDB_PASSWORD',
  ] as const)('throws when %s is missing', (missingKey) => {
    const env: Record<string, string | undefined> = {
      FALKORDB_HOST: 'falkordb.local',
      FALKORDB_PORT: '6379',
      FALKORDB_USERNAME: 'chatbot-user',
      FALKORDB_PASSWORD: 'secret',
    }
    delete env[missingKey]

    expect(() => loadFalkorDBConfig(env)).toThrow(`${missingKey} is required`)
  })

  it('throws when FALKORDB_PORT is invalid', () => {
    expect(() =>
      loadFalkorDBConfig({
        FALKORDB_HOST: 'falkordb.local',
        FALKORDB_PORT: 'not-a-port',
        FALKORDB_USERNAME: 'chatbot-user',
        FALKORDB_PASSWORD: 'secret',
      })
    ).toThrow('FALKORDB_PORT must be an integer between 1 and 65535')
  })
})

describe('chatbot graph commands', () => {
  it('creates chatbot graphs with metadata', async () => {
    const client = createMockClient()

    await createChatbotGraph({ chatbotId: CHATBOT_ID, client })

    expect(client.call).toHaveBeenCalledWith(
      'GRAPH.QUERY',
      GRAPH_NAME,
      expect.stringContaining(
        `managedBy: "klickeruzh", resource: "chatbot", chatbotId: "${CHATBOT_ID}"`
      )
    )
  })

  it('deletes chatbot graphs', async () => {
    const client = createMockClient()

    await deleteChatbotGraph({ chatbotId: CHATBOT_ID, client })

    expect(client.call).toHaveBeenCalledWith('GRAPH.DELETE', GRAPH_NAME)
  })

  it('runs read-only graph queries', async () => {
    const client = createMockClient()

    await readChatbotGraph({
      chatbotId: CHATBOT_ID,
      client,
      query: 'MATCH (n) RETURN count(n)',
    })

    expect(client.call).toHaveBeenCalledWith(
      'GRAPH.RO_QUERY',
      GRAPH_NAME,
      'MATCH (n) RETURN count(n)'
    )
  })

  it('runs write graph queries', async () => {
    const client = createMockClient()

    await writeChatbotGraph({
      chatbotId: CHATBOT_ID,
      client,
      query: 'CREATE (:Document {id: "test"})',
    })

    expect(client.call).toHaveBeenCalledWith(
      'GRAPH.QUERY',
      GRAPH_NAME,
      'CREATE (:Document {id: "test"})'
    )
  })
})

describe('chatbot graph snapshots', () => {
  it('normalizes FalkorDB node and edge responses', async () => {
    const client = createMockClient()
    client.call.mockImplementation((command, graphName, query) => {
      if (command !== 'GRAPH.RO_QUERY' || graphName !== GRAPH_NAME) {
        return Promise.resolve([])
      }

      if (String(query).includes('RETURN n')) {
        return Promise.resolve([
          ['n'],
          [
            [
              [
                ['id', 1],
                ['labels', ['PrototypeFinanceNode']],
                [
                  'properties',
                  [
                    ['id', 'finance'],
                    ['label', 'Finance'],
                    ['kind', 'domain'],
                    ['summary', 'Synthetic root'],
                    ['depth', 0],
                    ['prototype', true],
                  ],
                ],
              ],
            ],
            [
              [
                ['id', 2],
                ['labels', ['PrototypeFinanceNode']],
                [
                  'properties',
                  [
                    ['id', 'wacc'],
                    ['label', 'WACC'],
                    ['kind', 'concept'],
                    ['formula', 'WACC = ...'],
                    ['depth', 2],
                  ],
                ],
              ],
            ],
          ],
          ['Cached execution: 1'],
        ])
      }

      return Promise.resolve([
        ['r'],
        [
          [
            [
              ['id', 7],
              ['type', 'HAS_CONCEPT'],
              ['src_node', 1],
              ['dest_node', 2],
              [
                'properties',
                [
                  ['label', 'has concept'],
                  ['crossLevel', 'true'],
                  ['prototype', true],
                ],
              ],
            ],
          ],
        ],
        ['Cached execution: 1'],
      ])
    })

    const snapshot = await getChatbotGraphSnapshot({
      chatbotId: CHATBOT_ID,
      client,
    })

    expect(client.call).toHaveBeenCalledWith(
      'GRAPH.RO_QUERY',
      GRAPH_NAME,
      'MATCH (n) RETURN n LIMIT 101'
    )
    expect(client.call).toHaveBeenCalledWith(
      'GRAPH.RO_QUERY',
      GRAPH_NAME,
      'MATCH ()-[r]->() RETURN r LIMIT 151'
    )
    expect(snapshot).toEqual({
      nodes: [
        {
          id: '1',
          label: 'Finance',
          labels: ['PrototypeFinanceNode'],
          properties: {
            depth: 0,
            id: 'finance',
            kind: 'domain',
            label: 'Finance',
            prototype: true,
            summary: 'Synthetic root',
          },
          depth: 0,
          formula: undefined,
          kind: 'domain',
          summary: 'Synthetic root',
        },
        {
          id: '2',
          label: 'WACC',
          labels: ['PrototypeFinanceNode'],
          properties: {
            depth: 2,
            formula: 'WACC = ...',
            id: 'wacc',
            kind: 'concept',
            label: 'WACC',
          },
          depth: 2,
          formula: 'WACC = ...',
          kind: 'concept',
          summary: undefined,
        },
      ],
      edges: [
        {
          id: '7',
          label: 'has concept',
          source: '1',
          target: '2',
          type: 'HAS_CONCEPT',
          properties: {
            crossLevel: true,
            label: 'has concept',
            prototype: true,
          },
        },
      ],
      truncated: false,
      limits: {
        nodeLimit: 100,
        edgeLimit: 150,
      },
    })
  })

  it('truncates snapshots to the requested limits', async () => {
    const client = createMockClient()
    client.call.mockImplementation((command, graphName, query) => {
      if (command !== 'GRAPH.RO_QUERY' || graphName !== GRAPH_NAME) {
        return Promise.resolve([])
      }

      if (String(query).includes('RETURN n')) {
        return Promise.resolve([
          ['n'],
          [
            [
              [
                ['id', 1],
                ['labels', []],
                ['properties', [['label', 'One']]],
              ],
            ],
            [
              [
                ['id', 2],
                ['labels', []],
                ['properties', [['label', 'Two']]],
              ],
            ],
          ],
        ])
      }

      return Promise.resolve([
        ['r'],
        [
          [
            [
              ['id', 10],
              ['type', 'USES'],
              ['src_node', 1],
              ['dest_node', 2],
              ['properties', []],
            ],
          ],
          [
            [
              ['id', 11],
              ['type', 'EXPLAINS'],
              ['src_node', 1],
              ['dest_node', 2],
              ['properties', []],
            ],
          ],
        ],
      ])
    })

    const snapshot = await getChatbotGraphSnapshot({
      chatbotId: CHATBOT_ID,
      client,
      edgeLimit: 1,
      nodeLimit: 1,
    })

    expect(snapshot.nodes).toHaveLength(1)
    expect(snapshot.edges).toHaveLength(0)
    expect(snapshot.truncated).toBe(true)
    expect(snapshot.limits).toEqual({ edgeLimit: 1, nodeLimit: 1 })
  })

  it('returns an empty snapshot when the graph does not exist yet', async () => {
    const client = createMockClient()
    client.call.mockRejectedValue(new Error('Graph does not exist'))

    await expect(
      getChatbotGraphSnapshot({
        chatbotId: CHATBOT_ID,
        client,
      })
    ).resolves.toEqual({
      nodes: [],
      edges: [],
      truncated: false,
      limits: {
        nodeLimit: 100,
        edgeLimit: 150,
      },
    })
  })
})

describe('prototype finance seed', () => {
  it('targets Benibot by default', async () => {
    const client = createMockClient()

    const result = await seedPrototypeFinanceGraph({ client })

    expect(result.chatbotId).toBe(BENIBOT_CHATBOT_ID)
    expect(result.graphName).toBe(`klickeruzh:chatbot:${BENIBOT_CHATBOT_ID}`)
    expect(result.nodeCount).toBeGreaterThan(30)
    expect(result.relationshipCount).toBeGreaterThan(60)
    expect(client.call).toHaveBeenCalledWith(
      'GRAPH.QUERY',
      `klickeruzh:chatbot:${BENIBOT_CHATBOT_ID}`,
      expect.stringContaining('Finance')
    )
  })

  it('can reset the graph before seeding', async () => {
    const client = createMockClient()

    await seedPrototypeFinanceGraph({
      chatbotId: CHATBOT_ID,
      client,
      reset: true,
    })

    expect(client.call).toHaveBeenNthCalledWith(1, 'GRAPH.DELETE', GRAPH_NAME)
    expect(client.call).toHaveBeenNthCalledWith(
      2,
      'GRAPH.QUERY',
      GRAPH_NAME,
      expect.stringContaining('RETURN count(*) AS seeded')
    )
  })

  it('generates the expected synthetic finance graph query', () => {
    const query = createPrototypeFinanceGraphQuery()

    expect(query).toContain('MERGE (n0:PrototypeFinanceNode')
    expect(query).toContain('Finance')
    expect(query).toContain('WACC')
    expect(query).toContain('CAPM Formula')
    expect(query).toContain('HAS_TOPIC')
    expect(query).toContain('CONFLICTS_WITH')
    expect(query).toContain('uses accounting statement')
    expect(query).toContain('depends on risk concept')
    expect(query).toContain('depends on modeling assumptions')
    expect(query).toContain('depends on credit quality')
    expect(query).toContain('uses risk metric')
    expect(query).toContain('r0.crossLevel = true')
    expect(query).toContain('sourceDepth')
    expect(query).toContain('targetDepth')
  })
})
