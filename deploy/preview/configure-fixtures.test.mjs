import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  bindFixtureEndpoint,
  fixtureConfiguration,
} from './configure-fixtures.mjs'

const OWNER_ID = 'synthetic-owner'
const COURSE_ID = 'synthetic-course'
const CHATBOT_ID = 'synthetic-chatbot'
const KB_ID = 'synthetic-kb'
const KB_SERVER_ID = 'synthetic-kb-server'
const CONTEXT7_SERVER_ID = 'synthetic-context7-server'
const GENERATION = 'a'.repeat(24)
const TRANSPORT_TOKEN = 'b'.repeat(64)
const ACCESS_KEY = 'c'.repeat(64)
const ENCRYPTED_TOKEN = 'synthetic-encrypted-token'
const DOMAIN = 'preview.example'
const ENDPOINT = 'http://10.24.0.8:1417/mcp'
const ROTATED_ENDPOINT = 'http://10.24.0.9:1417/mcp'
const BLOB_URL = 'http://azurite:10000/klickerdev'

const BASE_ENV = Object.freeze({
  BLOB_STORAGE_ACCESS_KEY: ACCESS_KEY,
  BLOB_STORAGE_ACCOUNT_NAME: 'klickerdev',
  BLOB_STORAGE_INTERNAL_ACCOUNT_URL: BLOB_URL,
  KLICKER_PREVIEW_BLOB_HOST: 'azurite',
  KLICKER_PREVIEW_CHAT_ORIGIN: `https://chat.${DOMAIN}`,
  KLICKER_PREVIEW_DISPOSABLE: '1',
  KLICKER_PREVIEW_DOMAIN: DOMAIN,
  KLICKER_PREVIEW_GENERATION: GENERATION,
  KLICKER_PREVIEW_MANAGE_ORIGIN: `https://manage.${DOMAIN}`,
  KLICKER_PREVIEW_MCP_HOST: 'mcp.preview.internal',
  KLICKER_PREVIEW_PWA_ORIGIN: `https://pwa.${DOMAIN}`,
  LOCAL_MCP_TRANSPORT_TOKEN: TRANSPORT_TOKEN,
})

const privateResolver = async () => ({
  address: '10.24.0.8',
  family: 4,
})

const WRITE_OPERATIONS = new Set(['create', 'update', 'upsert'])
const MODEL_STATE_KEYS = {
  chatbot: 'chatbots',
  chatbotMCPConfig: 'configurations',
  chatbotMCPServer: 'servers',
  course: 'courses',
  kB: 'kbs',
  kBChatbot: 'kbChatbots',
}

function createConfiguration(overrides = {}) {
  return {
    endpoint: new URL(ENDPOINT),
    blob: new URL(BLOB_URL),
    origins: [
      `https://manage.${DOMAIN}`,
      `https://pwa.${DOMAIN}`,
      `https://chat.${DOMAIN}`,
    ],
    generation: GENERATION,
    ...overrides,
  }
}

function createContract(overrides = {}) {
  return {
    chatbotId: CHATBOT_ID,
    kbId: KB_ID,
    ownerId: OWNER_ID,
    courseId: COURSE_ID,
    legacyUrl: 'http://localhost:1417/mcp',
    encryptToken: () => ENCRYPTED_TOKEN,
    tokenMatches: (value) => value === ENCRYPTED_TOKEN,
    ...overrides,
  }
}

function createFixtureState() {
  return {
    chatbots: [
      {
        id: CHATBOT_ID,
        ownerId: OWNER_ID,
        courseId: COURSE_ID,
      },
    ],
    courses: [
      {
        id: COURSE_ID,
        ownerId: OWNER_ID,
      },
    ],
    servers: [
      {
        id: KB_SERVER_ID,
        name: 'KB',
        isActive: true,
        passChatbotId: false,
        chatbotIdHeader: null,
        url: 'http://localhost:1417/mcp',
        authType: 'scope_token',
        authSecret: null,
        parameters: {},
      },
      {
        id: CONTEXT7_SERVER_ID,
        name: 'Context7',
        url: 'https://mcp.context7.com/mcp',
        authSecret: null,
      },
    ],
    kbs: [{ id: KB_ID, ownerId: OWNER_ID, deletedAt: null }],
    kbChatbots: [{ kbId: KB_ID, chatbotId: CHATBOT_ID, isEnabled: true }],
    configurations: [
      {
        id: 'synthetic-kb-tutor',
        chatbotId: CHATBOT_ID,
        mcpServerId: KB_SERVER_ID,
        chatMode: 'tutor',
        priority: 0,
        allowedTools: ['doc_query'],
        isEnabled: true,
        parameters: { required: true, toolAlias: 'doc_query', kb_ids: [KB_ID] },
      },
      {
        id: 'synthetic-kb-explainer',
        chatbotId: CHATBOT_ID,
        mcpServerId: KB_SERVER_ID,
        chatMode: 'explainer',
        priority: 0,
        allowedTools: ['doc_query'],
        isEnabled: true,
        parameters: { required: true, toolAlias: 'doc_query', kb_ids: [KB_ID] },
      },
      {
        id: 'synthetic-context7',
        chatbotId: CHATBOT_ID,
        mcpServerId: CONTEXT7_SERVER_ID,
        chatMode: 'tutor',
        priority: 10,
        allowedTools: ['resolve-library-id', 'get-library-docs'],
        isEnabled: true,
        parameters: {},
      },
    ],
  }
}

function clone(value) {
  return structuredClone(value)
}

function rowMatches(row, where = {}) {
  return Object.entries(where).every(([key, expected]) => {
    if (key === 'kbId_chatbotId') {
      return row.kbId === expected.kbId && row.chatbotId === expected.chatbotId
    }
    if (key === 'chatbotId_mcpServerId_chatMode') {
      return (
        row.chatbotId === expected.chatbotId &&
        row.mcpServerId === expected.mcpServerId &&
        row.chatMode === expected.chatMode
      )
    }
    if (expected && typeof expected === 'object' && 'not' in expected) {
      return row[key] !== expected.not
    }
    return row[key] === expected
  })
}

function createTransaction(state, calls, failWrite) {
  function record(model, operation, args) {
    const call = { model, operation, args }
    calls.push(call)
    return call
  }

  function write(model, operation, args) {
    const call = record(model, operation, args)
    if (failWrite?.(call)) {
      throw new Error('Synthetic write failure')
    }
  }

  return new Proxy(
    {},
    {
      get(_target, model) {
        if (typeof model !== 'string') return undefined
        const stateKey = MODEL_STATE_KEYS[model]
        if (!stateKey) throw new Error(`Unexpected Prisma model ${model}`)

        return {
          async create(args) {
            write(model, 'create', args)
            const row = clone(args.data)
            if (model === 'kB' && row.deletedAt === undefined) {
              row.deletedAt = null
            }
            state[stateKey].push(row)
            return clone(row)
          },
          async findMany(args = {}) {
            record(model, 'findMany', args)
            let rows = state[stateKey].filter((row) =>
              rowMatches(row, args.where)
            )
            if (args.include?.mcpServer) {
              rows = rows.map((row) => ({
                ...row,
                mcpServer: state.servers.find(
                  (server) => server.id === row.mcpServerId
                ),
              }))
            }
            return clone(rows)
          },
          async findUnique(args) {
            record(model, 'findUnique', args)
            const row = state[stateKey].find((candidate) =>
              rowMatches(candidate, args.where)
            )
            return row ? clone(row) : null
          },
          async update(args) {
            write(model, 'update', args)
            const row = state[stateKey].find((candidate) =>
              rowMatches(candidate, args.where)
            )
            if (!row) throw new Error(`Synthetic ${model} row not found`)
            Object.assign(row, clone(args.data))
            return clone(row)
          },
          async upsert(args) {
            write(model, 'upsert', args)
            let row = state[stateKey].find((candidate) =>
              rowMatches(candidate, args.where)
            )
            if (row) {
              Object.assign(row, clone(args.update))
            } else {
              row = {
                ...clone(args.where.chatbotId_mcpServerId_chatMode),
                ...clone(args.create),
              }
              state[stateKey].push(row)
            }
            return clone(row)
          },
        }
      },
    }
  )
}

function createPrismaFake(initialState, { failWrite } = {}) {
  let state = clone(initialState)
  const transactions = []

  return {
    snapshot() {
      return clone(state)
    },
    transactions,
    async $transaction(run, options) {
      const workingState = clone(state)
      const calls = []
      try {
        const result = await run(
          createTransaction(workingState, calls, failWrite)
        )
        state = workingState
        transactions.push({ status: 'committed', options, calls })
        return result
      } catch (error) {
        transactions.push({ status: 'rolled_back', options, calls })
        throw error
      }
    },
  }
}

function writes(transaction) {
  return transaction.calls.filter(({ operation }) =>
    WRITE_OPERATIONS.has(operation)
  )
}

test('fixtureConfiguration requires the disposable generation and secrets', async () => {
  for (const key of [
    'KLICKER_PREVIEW_DISPOSABLE',
    'KLICKER_PREVIEW_GENERATION',
    'LOCAL_MCP_TRANSPORT_TOKEN',
    'BLOB_STORAGE_ACCESS_KEY',
  ]) {
    const env = { ...BASE_ENV }
    delete env[key]
    await assert.rejects(fixtureConfiguration(env, privateResolver), Error)
  }
})

test('fixtureConfiguration refuses public MCP DNS', async () => {
  await assert.rejects(
    fixtureConfiguration(BASE_ENV, async () => ({
      address: '8.8.8.8',
      family: 4,
    })),
    Error
  )
})

test('fixtureConfiguration refuses a mismatched Blob target', async () => {
  await assert.rejects(
    fixtureConfiguration(
      { ...BASE_ENV, KLICKER_PREVIEW_BLOB_HOST: 'different-service' },
      privateResolver
    ),
    Error
  )
})

test('fixtureConfiguration refuses foreign browser origins', async () => {
  await assert.rejects(
    fixtureConfiguration(
      {
        ...BASE_ENV,
        KLICKER_PREVIEW_CHAT_ORIGIN: 'https://chat.foreign.example',
      },
      privateResolver
    ),
    Error
  )
})

test('first binding preserves the owned KB and scopes MCP configuration', async () => {
  const configuration = await fixtureConfiguration(BASE_ENV, privateResolver)
  assert.equal(configuration.endpoint.href, ENDPOINT)
  assert.equal(configuration.blob.href, BLOB_URL)
  assert.deepEqual(configuration.origins, [
    `https://manage.${DOMAIN}`,
    `https://pwa.${DOMAIN}`,
    `https://chat.${DOMAIN}`,
  ])

  const db = createPrismaFake(createFixtureState())
  await bindFixtureEndpoint(db, configuration, createContract())

  assert.equal(db.transactions.length, 1)
  assert.equal(db.transactions[0].status, 'committed')
  assert.deepEqual(db.transactions[0].options, {
    isolationLevel: 'Serializable',
    timeout: 10000,
  })

  const state = db.snapshot()
  assert.equal(state.kbs.length, 1)
  assert.equal(state.kbs[0].id, KB_ID)
  assert.equal(state.kbs[0].ownerId, OWNER_ID)
  assert.deepEqual(state.kbChatbots, [
    { kbId: KB_ID, chatbotId: CHATBOT_ID, isEnabled: true },
  ])

  const server = state.servers.find(({ id }) => id === KB_SERVER_ID)
  assert.equal(server.url, ENDPOINT)
  assert.equal(server.authType, 'bearer')
  assert.equal(server.authSecret, ENCRYPTED_TOKEN)
  assert.deepEqual(server.parameters, {
    previewFixture: true,
    previewGeneration: GENERATION,
  })

  const fixtureConfigurations = state.configurations.filter(
    ({ mcpServerId }) => mcpServerId === KB_SERVER_ID
  )
  assert.deepEqual(
    fixtureConfigurations.map(({ chatMode }) => chatMode),
    ['tutor', 'explainer']
  )
  for (const row of fixtureConfigurations) {
    assert.equal(row.isEnabled, true)
    assert.equal(row.priority, 0)
    assert.deepEqual(row.allowedTools, ['doc_query'])
    assert.deepEqual(row.parameters, {
      required: true,
      toolAlias: 'doc_query',
      kb_ids: [KB_ID],
    })
  }

  const context7 = state.configurations.find(
    ({ id }) => id === 'synthetic-context7'
  )
  assert.equal(context7.isEnabled, false)
})

test('same-generation reconfiguration changes only the private endpoint', async () => {
  const db = createPrismaFake(createFixtureState())
  await bindFixtureEndpoint(db, createConfiguration(), createContract())
  const before = db.snapshot()

  await bindFixtureEndpoint(
    db,
    createConfiguration({ endpoint: new URL(ROTATED_ENDPOINT) }),
    createContract()
  )
  const after = db.snapshot()

  assert.equal(db.transactions[1].status, 'committed')
  assert.equal(after.kbs.length, 1)
  assert.equal(after.kbChatbots.length, 1)
  assert.deepEqual(after.kbs, before.kbs)
  assert.deepEqual(after.kbChatbots, before.kbChatbots)
  assert.deepEqual(after.configurations, before.configurations)

  const beforeServer = before.servers.find(({ id }) => id === KB_SERVER_ID)
  const afterServer = after.servers.find(({ id }) => id === KB_SERVER_ID)
  assert.equal(afterServer.url, ROTATED_ENDPOINT)
  assert.equal(afterServer.authSecret, ENCRYPTED_TOKEN)
  assert.deepEqual({ ...afterServer, url: beforeServer.url }, beforeServer)
})

const refusalCases = [
  {
    name: 'a knowledge base owned by another account',
    arrange(state) {
      state.kbs[0].ownerId = 'foreign-owner'
    },
  },
  {
    name: 'a deleted knowledge base',
    arrange(state) {
      state.kbs[0].deletedAt = new Date().toISOString()
    },
  },
  {
    name: 'a disabled knowledge base binding',
    arrange(state) {
      state.kbChatbots[0].isEnabled = false
    },
  },
  {
    name: 'a missing knowledge base binding',
    arrange(state) {
      state.kbChatbots = []
    },
  },
  {
    name: 'a foreign owner',
    arrange(state) {
      state.chatbots[0].ownerId = 'foreign-owner'
    },
  },
  {
    name: 'another KB consumer',
    arrange(state) {
      state.configurations.push({
        id: 'synthetic-other-consumer',
        chatbotId: 'other-chatbot',
        mcpServerId: KB_SERVER_ID,
        chatMode: 'tutor',
        priority: 0,
        allowedTools: ['doc_query'],
        isEnabled: false,
        parameters: {},
      })
    },
  },
  {
    name: 'an altered owned configuration',
    arrange(state) {
      state.configurations.find(
        ({ id }) => id === 'synthetic-kb-tutor'
      ).priority = 1
    },
  },
  {
    name: 'another preview generation',
    bound: true,
    configuration: () => createConfiguration({ generation: 'd'.repeat(24) }),
  },
  {
    name: 'a token mismatch',
    bound: true,
    contract: () => createContract({ tokenMatches: () => false }),
  },
  {
    name: 'an unknown external tool',
    arrange(state) {
      state.configurations
        .find(({ id }) => id === 'synthetic-context7')
        .allowedTools.push('unexpected-tool')
    },
  },
]

for (const refusal of refusalCases) {
  test(`bindFixtureEndpoint refuses ${refusal.name} before mutation`, async () => {
    const prepared = createPrismaFake(createFixtureState())
    if (refusal.bound) {
      await bindFixtureEndpoint(
        prepared,
        createConfiguration(),
        createContract()
      )
    }

    const arranged = prepared.snapshot()
    refusal.arrange?.(arranged)

    const db = createPrismaFake(arranged)
    const initial = db.snapshot()
    await assert.rejects(
      bindFixtureEndpoint(
        db,
        refusal.configuration?.() ?? createConfiguration(),
        refusal.contract?.() ?? createContract()
      ),
      Error
    )

    assert.deepEqual(db.snapshot(), initial)
    assert.equal(db.transactions.length, 1)
    assert.equal(db.transactions[0].status, 'rolled_back')
    assert.equal(writes(db.transactions[0]).length, 0)
  })
}

test('bindFixtureEndpoint rolls back earlier writes when a write fails', async () => {
  const db = createPrismaFake(createFixtureState(), {
    failWrite: ({ model, operation, args }) =>
      model === 'chatbotMCPConfig' &&
      operation === 'upsert' &&
      args.create.chatMode === 'explainer',
  })
  const initial = db.snapshot()

  await assert.rejects(
    bindFixtureEndpoint(db, createConfiguration(), createContract()),
    /Synthetic write failure/
  )

  assert.deepEqual(db.snapshot(), initial)
  assert.equal(db.transactions.length, 1)
  assert.equal(db.transactions[0].status, 'rolled_back')
  assert.ok(
    writes(db.transactions[0]).some(
      ({ model, operation }) =>
        model === 'chatbotMCPServer' && operation === 'update'
    )
  )
})
