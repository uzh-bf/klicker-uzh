import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  createChatbotGraph,
  deleteChatbotGraph,
  getChatbotGraphName,
  loadFalkorDBConfig,
  readChatbotGraph,
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
