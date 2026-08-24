import { encrypt } from '@klicker-uzh/util'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from 'node:http'
import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, test } from 'vitest'
import { z } from 'zod'
import {
  CANARY_SERVER_NAME,
  CanaryBindingError,
  type CanaryBindingSettings,
  type CanaryBindingStore,
  type CanaryBindingTransactionStore,
  type CanaryConfigRecord,
  type CanaryConfigSnapshot,
  type CanaryReceipt,
  type CanaryReceiptStore,
  type CanaryServerRecord,
  type CanaryServerSnapshot,
  type SyntheticChatbotRecord,
  cleanupCanaryBinding,
  dryRunCanaryBinding,
  prepareCanaryBinding,
  readbackCanaryBinding,
  rollbackCanaryBinding,
  switchCanaryBinding,
  SYNTHETIC_CANARY_CHATBOT_NAME,
  SYNTHETIC_CANARY_COURSE_NAME,
} from '../../../packages/prisma-data/src/scripts/doc-query-canary-binding'
import { getAggregatedMCPTools } from '../src/services/mcpClients'

const CHATBOT_ID = '00000000-0000-4000-8000-000000000001'
const LEGACY_CONFIG_ID = '00000000-0000-4000-8000-000000000002'
const LEGACY_SERVER_ID = '00000000-0000-4000-8000-000000000003'
const CANDIDATE_SERVER_ID = '00000000-0000-4000-8000-000000000004'
const CANDIDATE_CONFIG_ID = '00000000-0000-4000-8000-000000000005'
const SYNTHETIC_BEARER = 'synthetic-bearer-for-test'
const APP_SECRET = 'synthetic-app-secret-for-test'
const CANDIDATE_URL = 'http://127.0.0.1:0/mcp'
const INITIAL_TIME = new Date('2026-08-15T12:00:00.000Z')
const ORIGINAL_APP_SECRET = process.env.APP_SECRET

function clone<T>(value: T): T {
  return structuredClone(value)
}

function nextTime(date: Date): Date {
  return new Date(date.getTime() + 1)
}

class MemoryReceiptStore implements CanaryReceiptStore {
  receipt: CanaryReceipt | null = null
  writes = 0

  async read(): Promise<CanaryReceipt | null> {
    return this.receipt ? clone(this.receipt) : null
  }

  async write(receipt: CanaryReceipt): Promise<void> {
    this.receipt = clone(receipt)
    this.writes += 1
  }
}

class MemoryBindingStore implements CanaryBindingStore {
  chatbots = new Map<string, SyntheticChatbotRecord>([
    [
      CHATBOT_ID,
      {
        id: CHATBOT_ID,
        name: SYNTHETIC_CANARY_CHATBOT_NAME,
        courseName: SYNTHETIC_CANARY_COURSE_NAME,
      },
    ],
  ])
  servers = new Map<string, CanaryServerRecord>([
    [
      LEGACY_SERVER_ID,
      {
        id: LEGACY_SERVER_ID,
        name: 'KB',
        description: 'legacy synthetic MCP server',
        url: 'http://127.0.0.1:9/legacy',
        authType: 'none',
        authSecret: null,
        passChatbotId: false,
        chatbotIdHeader: null,
        parameters: {},
        isActive: true,
        updatedAt: INITIAL_TIME,
      },
    ],
  ])
  configs = new Map<string, CanaryConfigRecord>([
    [
      LEGACY_CONFIG_ID,
      {
        id: LEGACY_CONFIG_ID,
        chatbotId: CHATBOT_ID,
        mcpServerId: LEGACY_SERVER_ID,
        chatMode: 'tutor',
        allowedTools: ['doc_query'],
        priority: 0,
        isEnabled: true,
        parameters: {},
        updatedAt: INITIAL_TIME,
      },
    ],
  ])
  transactionCount = 0
  createCount = 0
  failOnServerUpdate = false

  async transaction<T>(
    fn: (store: CanaryBindingTransactionStore) => Promise<T>
  ): Promise<T> {
    this.transactionCount += 1
    const transactionStore = new MemoryBindingStore(this)
    try {
      const result = await fn(transactionStore)
      this.chatbots = transactionStore.chatbots
      this.servers = transactionStore.servers
      this.configs = transactionStore.configs
      return result
    } catch (error) {
      return Promise.reject(error)
    }
  }

  private constructor(source?: MemoryBindingStore) {
    if (source) {
      this.chatbots = clone(source.chatbots)
      this.servers = clone(source.servers)
      this.configs = clone(source.configs)
      this.transactionCount = source.transactionCount
      this.createCount = source.createCount
      this.failOnServerUpdate = source.failOnServerUpdate
    }
  }

  static create(): MemoryBindingStore {
    return new MemoryBindingStore()
  }

  async findSyntheticChatbot(id: string) {
    const chatbot = this.chatbots.get(id)
    return chatbot ? clone(chatbot) : null
  }

  async findServerByName(name: string) {
    const server = [...this.servers.values()].find(
      (entry) => entry.name === name
    )
    return server ? clone(server) : null
  }

  async findServerById(id: string) {
    const server = this.servers.get(id)
    return server ? clone(server) : null
  }

  async findConfigById(id: string) {
    const config = this.configs.get(id)
    return config ? clone(config) : null
  }

  async findConfigByChatbotServer(
    chatbotId: string,
    mcpServerId: string,
    chatMode: string
  ) {
    const config = [...this.configs.values()].find(
      (entry) =>
        entry.chatbotId === chatbotId &&
        entry.mcpServerId === mcpServerId &&
        entry.chatMode === chatMode
    )
    return config ? clone(config) : null
  }

  async createServer(
    data: Parameters<CanaryBindingTransactionStore['createServer']>[0]
  ) {
    this.createCount += 1
    const server: CanaryServerRecord = {
      id: CANDIDATE_SERVER_ID,
      ...data,
      parameters: clone(data.parameters) as CanaryServerRecord['parameters'],
      updatedAt: nextTime(INITIAL_TIME),
    }
    this.servers.set(server.id, server)
    return clone(server)
  }

  async createConfig(
    data: Parameters<CanaryBindingTransactionStore['createConfig']>[0]
  ) {
    const config: CanaryConfigRecord = {
      id: CANDIDATE_CONFIG_ID,
      ...data,
      allowedTools: clone(
        data.allowedTools
      ) as CanaryConfigRecord['allowedTools'],
      parameters: clone(data.parameters) as CanaryConfigRecord['parameters'],
      updatedAt: new Date('2026-08-15T12:00:00.002Z'),
    }
    this.configs.set(config.id, config)
    return clone(config)
  }

  async updateServer(
    snapshot: CanaryServerSnapshot,
    data: Parameters<CanaryBindingTransactionStore['updateServer']>[1]
  ) {
    if (this.failOnServerUpdate) {
      throw new CanaryBindingError(
        'SYNTHETIC_FAILURE',
        'synthetic update failure'
      )
    }
    const server = this.servers.get(snapshot.id)
    expect(server).toEqual(snapshot)
    if (!server) throw new Error('server missing')
    Object.assign(server, data, { updatedAt: nextTime(server.updatedAt) })
    return clone(server)
  }

  async updateConfig(
    snapshot: CanaryConfigSnapshot,
    data: Parameters<CanaryBindingTransactionStore['updateConfig']>[1]
  ) {
    const config = this.configs.get(snapshot.id)
    expect(config).toEqual(snapshot)
    if (!config) throw new Error('config missing')
    Object.assign(config, data, { updatedAt: nextTime(config.updatedAt) })
    return clone(config)
  }

  async deleteServer(snapshot: CanaryServerSnapshot) {
    const server = this.servers.get(snapshot.id)
    expect(server).toEqual(snapshot)
    this.servers.delete(snapshot.id)
  }

  async deleteConfig(snapshot: CanaryConfigSnapshot) {
    const config = this.configs.get(snapshot.id)
    expect(config).toEqual(snapshot)
    this.configs.delete(snapshot.id)
  }
}

function baseSettings(
  receiptStore: CanaryReceiptStore,
  overrides: Partial<CanaryBindingSettings> = {}
): CanaryBindingSettings {
  return {
    chatbotId: CHATBOT_ID,
    legacyConfigId: LEGACY_CONFIG_ID,
    chatMode: 'tutor',
    candidateUrl: CANDIDATE_URL,
    candidateAllowedTools: ['doc_query'],
    candidatePriority: 0,
    bearerToken: SYNTHETIC_BEARER,
    receiptStore,
    dryRun: false,
    ...overrides,
  }
}

function expectCanaryError(error: unknown, code: string): void {
  expect(error).toBeInstanceOf(CanaryBindingError)
  expect((error as CanaryBindingError).code).toBe(code)
}

describe('Klicker compatibility binding', () => {
  beforeAll(() => {
    process.env.APP_SECRET = APP_SECRET
  })

  afterAll(() => {
    if (ORIGINAL_APP_SECRET === undefined) {
      delete process.env.APP_SECRET
    } else {
      process.env.APP_SECRET = ORIGINAL_APP_SECRET
    }
  })

  test('dry-run is read-only, values-free, and refuses ordinary rows', async () => {
    const store = MemoryBindingStore.create()
    const receiptStore = new MemoryReceiptStore()
    const before = clone({
      servers: store.servers,
      configs: store.configs,
      transactions: store.transactionCount,
      creates: store.createCount,
    })

    const result = await dryRunCanaryBinding(
      store,
      baseSettings(receiptStore, { dryRun: true })
    )

    expect(result.status).toBe('dry-run')
    expect(store.transactionCount).toBe(before.transactions)
    expect(store.createCount).toBe(before.creates)
    expect(store.servers).toEqual(before.servers)
    expect(store.configs).toEqual(before.configs)
    expect(receiptStore.writes).toBe(0)
    expect(JSON.stringify(result)).not.toContain(SYNTHETIC_BEARER)

    const ordinaryStore = MemoryBindingStore.create()
    ordinaryStore.chatbots.set(CHATBOT_ID, {
      id: CHATBOT_ID,
      name: 'ordinary chatbot',
      courseName: 'ordinary course',
    })
    await expect(
      dryRunCanaryBinding(
        ordinaryStore,
        baseSettings(new MemoryReceiptStore(), { dryRun: true })
      )
    ).rejects.toSatisfy((error: unknown) => {
      expectCanaryError(error, 'ORDINARY_ROW_REFUSED')
      return true
    })
  })

  test('prepare, switch, and rollback are atomic and restore the prior binding', async () => {
    const store = MemoryBindingStore.create()
    const receiptStore = new MemoryReceiptStore()
    const settings = baseSettings(receiptStore)

    const prepared = await prepareCanaryBinding(store, settings)
    expect(prepared.status).toBe('prepared')
    expect(JSON.stringify(prepared)).not.toContain(SYNTHETIC_BEARER)
    expect(JSON.stringify(prepared)).not.toContain('authSecret')
    expect((await store.findServerByName(CANARY_SERVER_NAME))?.isActive).toBe(
      false
    )
    expect(
      (
        await store.findConfigByChatbotServer(
          CHATBOT_ID,
          CANDIDATE_SERVER_ID,
          'tutor'
        )
      )?.isEnabled
    ).toBe(false)

    await expect(prepareCanaryBinding(store, settings)).rejects.toSatisfy(
      (error: unknown) => {
        expectCanaryError(error, 'RECEIPT_EXISTS')
        return true
      }
    )

    const switched = await switchCanaryBinding(store, settings)
    expect(switched.status).toBe('switched')
    expect((await store.findConfigById(LEGACY_CONFIG_ID))?.isEnabled).toBe(
      false
    )
    expect((await store.findServerByName(CANARY_SERVER_NAME))?.isActive).toBe(
      true
    )
    expect(
      (
        await store.findConfigByChatbotServer(
          CHATBOT_ID,
          CANDIDATE_SERVER_ID,
          'tutor'
        )
      )?.isEnabled
    ).toBe(true)

    const rolledBack = await rollbackCanaryBinding(store, settings)
    expect(rolledBack.status).toBe('rolled_back')
    expect((await store.findConfigById(LEGACY_CONFIG_ID))?.isEnabled).toBe(true)
    expect(await store.findServerByName(CANARY_SERVER_NAME)).toBeNull()
    expect(
      await store.findConfigByChatbotServer(
        CHATBOT_ID,
        CANDIDATE_SERVER_ID,
        'tutor'
      )
    ).toBeNull()

    const readback = await readbackCanaryBinding(store, settings)
    expect(readback).toMatchObject({
      status: 'readback',
      serverPresent: false,
      configPresent: false,
    })
    const cleaned = await cleanupCanaryBinding(store, settings)
    expect(cleaned).toMatchObject({
      status: 'cleaned',
      receipt: { state: 'cleaned' },
    })
    expect(receiptStore.receipt?.state).toBe('cleaned')
  })

  test('snapshot drift blocks the switch before a write', async () => {
    const store = MemoryBindingStore.create()
    const receiptStore = new MemoryReceiptStore()
    const settings = baseSettings(receiptStore)
    await prepareCanaryBinding(store, settings)

    const legacy = store.configs.get(LEGACY_CONFIG_ID)!
    legacy.allowedTools = ['different_tool']

    await expect(switchCanaryBinding(store, settings)).rejects.toSatisfy(
      (error: unknown) => {
        expectCanaryError(error, 'SNAPSHOT_MISMATCH')
        return true
      }
    )
    expect(store.configs.get(LEGACY_CONFIG_ID)?.isEnabled).toBe(true)
    expect(store.servers.get(CANDIDATE_SERVER_ID)?.isActive).toBe(false)
  })

  test('a transaction failure rolls back the earlier legacy update', async () => {
    const store = MemoryBindingStore.create()
    const receiptStore = new MemoryReceiptStore()
    const settings = baseSettings(receiptStore)
    await prepareCanaryBinding(store, settings)
    store.failOnServerUpdate = true

    await expect(switchCanaryBinding(store, settings)).rejects.toSatisfy(
      (error: unknown) => {
        expectCanaryError(error, 'SYNTHETIC_FAILURE')
        return true
      }
    )
    expect(store.configs.get(LEGACY_CONFIG_ID)?.isEnabled).toBe(true)
    expect(store.servers.get(CANDIDATE_SERVER_ID)?.isActive).toBe(false)
    expect(store.configs.get(CANDIDATE_CONFIG_ID)?.isEnabled).toBe(false)
  })

  test('duplicate candidate names and missing prior state fail closed', async () => {
    const duplicateStore = MemoryBindingStore.create()
    duplicateStore.servers.set(CANDIDATE_SERVER_ID, {
      id: CANDIDATE_SERVER_ID,
      name: CANARY_SERVER_NAME,
      description: 'pre-existing row',
      url: CANDIDATE_URL,
      authType: 'bearer',
      authSecret: 'encrypted-value-never-printed',
      passChatbotId: true,
      chatbotIdHeader: 'Chatbot-ID',
      parameters: {},
      isActive: false,
      updatedAt: INITIAL_TIME,
    })
    await expect(
      dryRunCanaryBinding(
        duplicateStore,
        baseSettings(new MemoryReceiptStore(), { dryRun: true })
      )
    ).rejects.toSatisfy((error: unknown) => {
      expectCanaryError(error, 'DUPLICATE_SERVER')
      return true
    })

    const missingPriorStore = MemoryBindingStore.create()
    missingPriorStore.configs.delete(LEGACY_CONFIG_ID)
    await expect(
      dryRunCanaryBinding(
        missingPriorStore,
        baseSettings(new MemoryReceiptStore(), { dryRun: true })
      )
    ).rejects.toSatisfy((error: unknown) => {
      expectCanaryError(error, 'PRIOR_STATE_MISSING')
      return true
    })
  })
})

async function readJsonBody(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = []
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  }
  return chunks.length > 0
    ? JSON.parse(Buffer.concat(chunks).toString('utf8'))
    : undefined
}

async function listen(
  server: ReturnType<typeof createServer>
): Promise<string> {
  await new Promise<void>((resolvePromise) =>
    server.listen(0, '127.0.0.1', resolvePromise)
  )
  const address = server.address()
  if (!address || typeof address === 'string')
    throw new Error('MCP server did not bind')
  return `http://127.0.0.1:${address.port}/mcp`
}

function closeServer(server: ReturnType<typeof createServer>): Promise<void> {
  return new Promise((resolvePromise, reject) => {
    server.close((error) => (error ? reject(error) : resolvePromise()))
  })
}

describe('direct Prisma-shaped Chat MCP consumer', () => {
  let server: ReturnType<typeof createServer>
  let candidateUrl: string

  beforeAll(async () => {
    process.env.APP_SECRET = APP_SECRET
    let transport: StreamableHTTPServerTransport | undefined

    server = createServer(
      async (request: IncomingMessage, response: ServerResponse) => {
        const authorization = request.headers.authorization
        const chatbotId = request.headers['chatbot-id']
        if (
          authorization !== `Bearer ${SYNTHETIC_BEARER}` ||
          chatbotId !== CHATBOT_ID
        ) {
          response.writeHead(401).end()
          return
        }

        if (request.method === 'GET') {
          response.writeHead(405).end()
          return
        }
        if (request.method !== 'POST') {
          response.writeHead(405).end()
          return
        }

        const body = await readJsonBody(request)
        if (!transport) {
          if (
            !body ||
            typeof body !== 'object' ||
            !('method' in body) ||
            body.method !== 'initialize'
          ) {
            response.writeHead(400).end()
            return
          }
          transport = new StreamableHTTPServerTransport({
            sessionIdGenerator: () => randomUUID(),
            enableJsonResponse: true,
          })
          const mcpServer = new McpServer({
            name: 'synthetic-doc-query',
            version: '1.0.0',
          })
          mcpServer.tool(
            'doc_query',
            { query: z.string() },
            async ({ query }) => ({
              content: [
                {
                  type: 'text',
                  text: JSON.stringify({
                    query,
                    sources: [
                      {
                        title: 'Synthetic canary source',
                        tenant: 'synthetic-canary',
                      },
                    ],
                  }),
                },
              ],
            })
          )
          await mcpServer.connect(transport)
        }

        await transport.handleRequest(request, response, body)
      }
    )
    candidateUrl = await listen(server)
  })

  afterAll(async () => {
    await closeServer(server)
    if (ORIGINAL_APP_SECRET === undefined) {
      delete process.env.APP_SECRET
    } else {
      process.env.APP_SECRET = ORIGINAL_APP_SECRET
    }
  })

  test('discovers and calls the direct bearer-bound tool, while wrong or missing auth fails closed', async () => {
    const bindingStore = MemoryBindingStore.create()
    const bindingReceipt = new MemoryReceiptStore()
    await prepareCanaryBinding(
      bindingStore,
      baseSettings(bindingReceipt, { candidateUrl })
    )
    const preparedServer =
      await bindingStore.findServerByName(CANARY_SERVER_NAME)
    expect(preparedServer?.authSecret).toBeTruthy()
    expect(preparedServer?.authSecret).not.toBe(SYNTHETIC_BEARER)

    const directConfig = {
      server: {
        id: CANDIDATE_SERVER_ID,
        name: CANARY_SERVER_NAME,
        url: candidateUrl,
        authType: 'bearer',
        authSecret: preparedServer?.authSecret ?? undefined,
        passChatbotId: true,
        chatbotIdHeader: 'Chatbot-ID',
      },
      config: {
        allowedTools: ['doc_query'],
        priority: 0,
      },
    }

    const tools = await getAggregatedMCPTools([directConfig], CHATBOT_ID)
    expect(Object.keys(tools)).toEqual(['Klicker-compat_doc_query'])
    const tool = tools['Klicker-compat_doc_query'] as {
      execute?: (input: { query: string }) => Promise<unknown>
    }
    await expect(
      tool.execute?.({ query: 'synthetic query' })
    ).resolves.toMatchObject({
      content: [
        {
          type: 'text',
          text: expect.stringContaining('Synthetic canary source'),
        },
      ],
    })

    const wrongBearer = await getAggregatedMCPTools(
      [
        {
          ...directConfig,
          server: {
            ...directConfig.server,
            authSecret: encrypt('wrong-bearer'),
          },
        },
      ],
      CHATBOT_ID
    )
    expect(wrongBearer).toEqual({})

    const missingBearer = await getAggregatedMCPTools(
      [
        {
          ...directConfig,
          server: { ...directConfig.server, authSecret: undefined },
        },
      ],
      CHATBOT_ID
    )
    expect(missingBearer).toEqual({})

    const wrongTenant = await getAggregatedMCPTools(
      [directConfig],
      'wrong-chatbot'
    )
    expect(wrongTenant).toEqual({})
  })
})
