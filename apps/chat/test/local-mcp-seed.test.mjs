import { requireDisposableDatabase } from '@klicker-uzh/prisma'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import {
  LOCAL_CHATBOT_ID,
  LOCAL_COURSE_ID,
  LOCAL_COURSE_PIN,
  LOCAL_FIXTURE_MARKER,
  LOCAL_KB_ID,
  LOCAL_OWNER_ID,
  LOCAL_SCOPE,
  LOCAL_SERVER_ID,
  localFixtureScope,
} from '../scripts/local-mcp-auth.mjs'
import {
  LOCAL_KB_CHATBOT_ID,
  LOCAL_PARTICIPANT_ID,
  LOCAL_USER_LOGIN_ID,
  repairLocalMcpSeed,
} from '../scripts/local-mcp-seed.mjs'

vi.mock('@klicker-uzh/prisma', () => ({
  requireDisposableDatabase: vi.fn(async () => {}),
}))

// The mocked ciphertext keeps the encrypted-secret shape the seed asserts on,
// while the recorded calls prove which value was actually encrypted.
const utilMocks = vi.hoisted(() => ({
  ciphertext: ['a'.repeat(32), 'b'.repeat(32), 'c'.repeat(16)].join(':'),
  encryptCalls: [],
}))

vi.mock('@klicker-uzh/util', () => ({
  encrypt: (value) => {
    utilMocks.encryptCalls.push(value)
    return utilMocks.ciphertext
  },
  getZurichMonthStart: () => new Date('2026-09-01T00:00:00.000Z'),
}))

vi.mock('bcryptjs', () => ({
  default: { hash: async () => 'synthetic-password-hash' },
}))

const SYNTHETIC_FIXTURE = {
  chatbotId: '11111111-1111-4111-8111-111111111111',
  kbId: '44444444-4444-4444-8444-444444444444',
  chatMode: 'synthetic-help',
  documentsFile: '/synthetic/documents.json',
}

const MODEL_STATE_KEYS = {
  user: 'users',
  userLogin: 'userLogins',
  participant: 'participants',
  course: 'courses',
  participation: 'participations',
  chatbot: 'chatbots',
  kB: 'kbs',
  kBChatbot: 'kbChatbots',
  chatbotMCPServer: 'servers',
  chatbotMCPConfig: 'configurations',
  chatUsageCredits: 'usageCredits',
  chatAccountUsage: 'accountUsages',
}

function dedicatedConfiguration(chatMode, overrides = {}) {
  return {
    id: `synthetic-${chatMode}`,
    mcpServerId: LOCAL_SERVER_ID,
    chatbotId: LOCAL_CHATBOT_ID,
    chatMode,
    isEnabled: true,
    priority: 0,
    allowedTools: ['doc_query'],
    parameters: { ...LOCAL_SCOPE },
    ...overrides,
  }
}

function fixtureConfiguration(overrides = {}) {
  return {
    mcpServerId: LOCAL_SERVER_ID,
    chatbotId: SYNTHETIC_FIXTURE.chatbotId,
    chatMode: SYNTHETIC_FIXTURE.chatMode,
    isEnabled: true,
    priority: 0,
    allowedTools: ['doc_query'],
    parameters: localFixtureScope(SYNTHETIC_FIXTURE.kbId),
    ...overrides,
  }
}

function dedicatedState() {
  const monthStart = new Date('2026-09-01T00:00:00.000Z')

  return {
    users: [
      {
        id: LOCAL_OWNER_ID,
        shortname: 'lecturer',
        aiFeaturesEnabled: true,
        betaEnabled: true,
      },
    ],
    userLogins: [
      {
        id: LOCAL_USER_LOGIN_ID,
        userId: LOCAL_OWNER_ID,
        name: 'lecturer',
        scope: 'FULL_ACCESS',
      },
    ],
    participants: [
      { id: LOCAL_PARTICIPANT_ID, username: 'testuser1', isActive: true },
    ],
    courses: [
      {
        id: LOCAL_COURSE_ID,
        ownerId: LOCAL_OWNER_ID,
        pinCode: LOCAL_COURSE_PIN,
      },
    ],
    participations: [
      {
        id: 'synthetic-participation',
        courseId: LOCAL_COURSE_ID,
        participantId: LOCAL_PARTICIPANT_ID,
        isActive: false,
      },
    ],
    chatbots: [
      {
        id: LOCAL_CHATBOT_ID,
        ownerId: LOCAL_OWNER_ID,
        courseId: LOCAL_COURSE_ID,
        status: 'PUBLISHED',
        systemPrompts: { tutor: {}, explainer: {} },
      },
    ],
    kbs: [{ id: LOCAL_KB_ID, ownerId: LOCAL_OWNER_ID, deletedAt: null }],
    kbChatbots: [
      {
        id: LOCAL_KB_CHATBOT_ID,
        kbId: LOCAL_KB_ID,
        chatbotId: LOCAL_CHATBOT_ID,
        isEnabled: true,
      },
    ],
    servers: [
      {
        id: LOCAL_SERVER_ID,
        name: 'KB',
        url: 'http://localhost:1417/mcp',
        authType: 'bearer',
        authSecret: [
          `${'a'.repeat(32)}`,
          `${'b'.repeat(32)}`,
          'c'.repeat(16),
        ].join(':'),
        parameters: { ...LOCAL_FIXTURE_MARKER },
        isActive: true,
        passChatbotId: false,
        chatbotIdHeader: null,
      },
    ],
    configurations: [
      dedicatedConfiguration('tutor'),
      dedicatedConfiguration('explainer'),
    ],
    usageCredits: [
      { participantId: LOCAL_PARTICIPANT_ID, chatbotId: LOCAL_CHATBOT_ID },
    ],
    accountUsages: [
      { ownerId: LOCAL_OWNER_ID, usageClass: 'BASE', monthStart },
      { ownerId: LOCAL_OWNER_ID, usageClass: 'ADVANCED', monthStart },
    ],
  }
}

function withFixtureIdentity(state, overrides = {}) {
  return {
    ...state,
    chatbots: [
      ...state.chatbots,
      {
        id: SYNTHETIC_FIXTURE.chatbotId,
        ownerId: LOCAL_OWNER_ID,
        courseId: LOCAL_COURSE_ID,
        status: 'DRAFT',
        systemPrompts: { [SYNTHETIC_FIXTURE.chatMode]: {} },
        ...overrides.chatbot,
      },
    ],
    kbs: [
      ...state.kbs,
      {
        id: SYNTHETIC_FIXTURE.kbId,
        ownerId: LOCAL_OWNER_ID,
        deletedAt: null,
        ...overrides.kb,
      },
    ],
    kbChatbots: [
      ...state.kbChatbots,
      {
        id: 'synthetic-fixture-binding',
        kbId: SYNTHETIC_FIXTURE.kbId,
        chatbotId: SYNTHETIC_FIXTURE.chatbotId,
        isEnabled: true,
        ...overrides.binding,
      },
    ],
    configurations: [
      ...state.configurations,
      fixtureConfiguration(overrides.configuration),
    ],
  }
}

function createTransaction(state, calls) {
  const models = new Map()

  return new Proxy(
    {},
    {
      get(_target, property) {
        if (typeof property !== 'string') return undefined

        const stateKey = MODEL_STATE_KEYS[property]
        if (stateKey === undefined) {
          throw new Error(`Unexpected Prisma model ${property}`)
        }

        if (!models.has(property)) {
          models.set(property, {
            findMany: async (args) => {
              calls.push({ model: property, operation: 'findMany', args })
              return state[stateKey] ?? []
            },
            create: async (args) => {
              calls.push({ model: property, operation: 'create', args })
              return args.data
            },
            createMany: async (args) => {
              calls.push({ model: property, operation: 'createMany', args })
              return { count: args.data.length }
            },
            update: async (args) => {
              calls.push({ model: property, operation: 'update', args })
              return args.data
            },
          })
        }

        return models.get(property)
      },
    }
  )
}

function createSeedClient(state = {}) {
  const calls = []
  const transaction = createTransaction(state, calls)

  return {
    calls,
    db: {
      $transaction: async (run, options) => {
        calls.push({
          model: '$transaction',
          operation: 'transaction',
          args: options,
        })
        return run(transaction)
      },
    },
  }
}

function callsFor(calls, model, operation) {
  return calls.filter(
    (call) => call.model === model && call.operation === operation
  )
}

function createdData(calls, model) {
  return callsFor(calls, model, 'create').map((call) => call.args.data)
}

describe('repairLocalMcpSeed', () => {
  beforeEach(() => {
    utilMocks.encryptCalls.length = 0
  })

  test('creates the whole dedicated domain in one serializable transaction', async () => {
    const { calls, db } = createSeedClient()

    await expect(
      repairLocalMcpSeed(db, 'synthetic-token')
    ).resolves.toBeUndefined()

    const transactions = callsFor(calls, '$transaction', 'transaction')
    expect(transactions).toHaveLength(1)
    expect(transactions[0].args).toEqual({
      isolationLevel: 'Serializable',
      maxWait: 5000,
      timeout: 10000,
    })
    expect(createdData(calls, 'chatbotMCPServer')).toEqual([
      expect.objectContaining({
        id: LOCAL_SERVER_ID,
        authType: 'bearer',
        authSecret: utilMocks.ciphertext,
        parameters: LOCAL_FIXTURE_MARKER,
        isActive: true,
        passChatbotId: false,
      }),
    ])
    expect(utilMocks.encryptCalls).toEqual(['synthetic-token'])
    const configurations = createdData(calls, 'chatbotMCPConfig')
    expect(
      configurations.map((configuration) => configuration.chatMode)
    ).toEqual(['tutor', 'explainer'])
    expect(
      configurations.map((configuration) => configuration.parameters)
    ).toEqual([LOCAL_SCOPE, LOCAL_SCOPE])
    expect(createdData(calls, 'user')).toHaveLength(1)
    expect(createdData(calls, 'chatbot')).toHaveLength(1)
    expect(createdData(calls, 'kB')).toHaveLength(1)
    expect(createdData(calls, 'kBChatbot')).toHaveLength(1)
    expect(createdData(calls, 'chatUsageCredits')).toHaveLength(1)
    expect(
      callsFor(calls, 'chatAccountUsage', 'createMany')[0].args.data
    ).toHaveLength(2)
    expect(callsFor(calls, 'chatbotMCPServer', 'update')).toHaveLength(0)
  })

  test('creates the optional fixture identity when one is configured', async () => {
    const { calls, db } = createSeedClient()

    await expect(
      repairLocalMcpSeed(db, 'synthetic-token', () => false, SYNTHETIC_FIXTURE)
    ).resolves.toBeUndefined()

    const chatbots = createdData(calls, 'chatbot')
    expect(chatbots.map((chatbot) => chatbot.id)).toEqual([
      LOCAL_CHATBOT_ID,
      SYNTHETIC_FIXTURE.chatbotId,
    ])
    expect(chatbots[1]).toMatchObject({
      ownerId: LOCAL_OWNER_ID,
      courseId: LOCAL_COURSE_ID,
      status: 'DRAFT',
    })
    expect(Object.keys(chatbots[1].systemPrompts)).toEqual([
      SYNTHETIC_FIXTURE.chatMode,
    ])
    expect(createdData(calls, 'kB').map((kb) => kb.id)).toEqual([
      LOCAL_KB_ID,
      SYNTHETIC_FIXTURE.kbId,
    ])
    expect(createdData(calls, 'kBChatbot')[1]).toEqual({
      kbId: SYNTHETIC_FIXTURE.kbId,
      chatbotId: SYNTHETIC_FIXTURE.chatbotId,
      isEnabled: true,
    })
    const fixtureBindings = createdData(calls, 'chatbotMCPConfig').filter(
      (configuration) => configuration.chatbotId === SYNTHETIC_FIXTURE.chatbotId
    )
    expect(fixtureBindings).toEqual([fixtureConfiguration()])
  })

  test('rotates the credential for an already complete dedicated domain', async () => {
    const { calls, db } = createSeedClient(dedicatedState())

    await expect(
      repairLocalMcpSeed(db, 'synthetic-token')
    ).resolves.toBeUndefined()

    expect(callsFor(calls, 'chatbotMCPServer', 'update')).toEqual([
      {
        model: 'chatbotMCPServer',
        operation: 'update',
        args: {
          where: { id: LOCAL_SERVER_ID },
          data: { authSecret: utilMocks.ciphertext },
        },
      },
    ])
    expect(utilMocks.encryptCalls).toEqual(['synthetic-token'])
    expect(callsFor(calls, 'chatbot', 'create')).toHaveLength(0)
  })

  test('completes a dedicated domain by adding the configured fixture identity', async () => {
    const { calls, db } = createSeedClient(dedicatedState())

    await expect(
      repairLocalMcpSeed(db, 'synthetic-token', () => false, SYNTHETIC_FIXTURE)
    ).resolves.toBeUndefined()

    expect(createdData(calls, 'chatbot').map((chatbot) => chatbot.id)).toEqual([
      SYNTHETIC_FIXTURE.chatbotId,
    ])
    expect(createdData(calls, 'kB').map((kb) => kb.id)).toEqual([
      SYNTHETIC_FIXTURE.kbId,
    ])
    expect(createdData(calls, 'kBChatbot')).toHaveLength(1)
    expect(createdData(calls, 'chatbotMCPConfig')).toEqual([
      fixtureConfiguration(),
    ])
    expect(callsFor(calls, 'chatbotMCPServer', 'update')).toHaveLength(1)
  })

  test('rejects a conflicting fixture identity before rotating the credential', async () => {
    const { calls, db } = createSeedClient(
      withFixtureIdentity(dedicatedState(), {
        configuration: { isEnabled: false },
      })
    )

    await expect(
      repairLocalMcpSeed(db, 'synthetic-token', () => false, SYNTHETIC_FIXTURE)
    ).rejects.toThrow('Local MCP seed repair rejected')

    expect(callsFor(calls, 'chatbotMCPServer', 'update')).toHaveLength(0)
    expect(callsFor(calls, 'chatbot', 'create')).toHaveLength(0)
  })

  test('rejects an unexpected additional binding without a configured fixture', async () => {
    const state = withFixtureIdentity(dedicatedState())
    state.chatbots = state.chatbots.filter(
      (chatbot) => chatbot.id !== SYNTHETIC_FIXTURE.chatbotId
    )
    const { calls, db } = createSeedClient(state)

    await expect(repairLocalMcpSeed(db, 'synthetic-token')).rejects.toThrow(
      'Local MCP seed repair rejected'
    )

    expect(callsFor(calls, 'chatbotMCPServer', 'update')).toHaveLength(0)
  })

  test('aborts an interrupted startup and rejects invalid arguments', async () => {
    const interrupted = createSeedClient()
    await expect(
      repairLocalMcpSeed(interrupted.db, 'synthetic-token', () => true)
    ).rejects.toThrow('Local MCP seed repair rejected')
    expect(createdData(interrupted.calls, 'user')).toHaveLength(0)

    const emptyToken = createSeedClient()
    await expect(repairLocalMcpSeed(emptyToken.db, '')).rejects.toThrow(
      'Local MCP seed repair rejected'
    )
    expect(createdData(emptyToken.calls, 'chatbotMCPServer')).toHaveLength(0)

    const guarded = createSeedClient()
    vi.mocked(requireDisposableDatabase).mockRejectedValueOnce(
      new Error('synthetic guard rejection')
    )
    await expect(
      repairLocalMcpSeed(guarded.db, 'synthetic-token')
    ).rejects.toThrow('Local MCP seed repair rejected')
    expect(callsFor(guarded.calls, '$transaction', 'transaction')).toHaveLength(
      0
    )
  })
})
