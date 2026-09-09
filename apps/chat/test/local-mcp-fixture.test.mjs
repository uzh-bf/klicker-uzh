import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { exportSPKI, generateKeyPair, SignJWT } from 'jose'
import { afterEach, describe, expect, test } from 'vitest'

import {
  assertLocalSeedOwnership,
  createLocalAuthenticator,
  LOCAL_CHATBOT_ID,
  LOCAL_FIXTURE_MARKER,
  LOCAL_KB_ID,
  LOCAL_SCOPE,
} from '../scripts/local-mcp-auth.mjs'
import { loadLocalMcpFixture } from '../scripts/local-mcp-fixture.mjs'

const SYNTHETIC_FIXTURE = {
  chatbotId: '11111111-1111-4111-8111-111111111111',
  ownerId: '22222222-2222-4222-8222-222222222222',
  courseId: '33333333-3333-4333-8333-333333333333',
  kbId: '44444444-4444-4444-8444-444444444444',
  chatMode: 'biology-help',
  documentsFile: 'synthetic-documents.json',
}

const ORIGINAL_OWNER_ID = '76047345-3801-4628-ae7b-adbebcfe8821'
const ORIGINAL_COURSE_ID = '7c12e44e-d083-4acf-845e-4c34aaff6b49'
const SYNTHETIC_TRANSPORT_TOKEN = 'synthetic-transport-token'
const SYNTHETIC_GENERATION = 'synthetic-generation'
const SYNTHETIC_ISSUER = 'synthetic-local-chat'
const SYNTHETIC_AUDIENCE = 'synthetic-doc-query'
const SYNTHETIC_AUTH_SECRET = [
  'a'.repeat(32),
  'b'.repeat(32),
  'c'.repeat(16),
].join(':')

const temporaryDirectories = []

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true }))
  )
})

async function temporaryRoot() {
  const directory = await mkdtemp(join(tmpdir(), 'local-mcp-fixture-'))
  temporaryDirectories.push(directory)
  return directory
}

async function writeFixture(root, value, relativePath) {
  const filePath = join(root, relativePath)
  await mkdir(dirname(filePath), { recursive: true })
  await writeFile(
    filePath,
    typeof value === 'string' ? value : JSON.stringify(value),
    'utf8'
  )
  return filePath
}

function fixtureWith(changes) {
  return { ...SYNTHETIC_FIXTURE, ...changes }
}

function loadedFixture(root, changes = {}) {
  const fixture = fixtureWith(changes)
  return { ...fixture, documentsFile: resolve(root, fixture.documentsFile) }
}

describe('local MCP fixture loading', () => {
  test('returns null when the optional default fixture is absent', async () => {
    const root = await temporaryRoot()

    expect(loadLocalMcpFixture({}, root)).toBeNull()
  })

  test('loads the exact configuration from the default fixture path', async () => {
    const root = await temporaryRoot()
    await writeFixture(
      root,
      SYNTHETIC_FIXTURE,
      'project/_local/local-mcp-fixture.json'
    )

    const fixture = loadLocalMcpFixture({}, root)

    expect(fixture).toEqual(loadedFixture(root))
    expect(Object.keys(fixture).sort()).toEqual([
      'chatMode',
      'chatbotId',
      'courseId',
      'documentsFile',
      'kbId',
      'ownerId',
    ])
  })

  test('uses the selected file and fails closed when it is missing', async () => {
    const root = await temporaryRoot()
    await writeFixture(
      root,
      fixtureWith({ chatMode: 'default-file' }),
      'project/_local/local-mcp-fixture.json'
    )
    const selectedPath = await writeFixture(
      root,
      fixtureWith({ chatMode: 'selected-file' }),
      'selected-fixture.json'
    )

    expect(
      loadLocalMcpFixture({ LOCAL_MCP_FIXTURE_FILE: selectedPath }, root)
    ).toEqual(loadedFixture(root, { chatMode: 'selected-file' }))

    expect(() =>
      loadLocalMcpFixture(
        { LOCAL_MCP_FIXTURE_FILE: join(root, 'missing-fixture.json') },
        root
      )
    ).toThrow()
  })

  test('rejects malformed JSON and invalid fixture configurations', async () => {
    const invalidFixtures = [
      fixtureWith({ chatbotId: 'synthetic-chatbot' }),
      fixtureWith({ ownerId: 'synthetic-owner' }),
      fixtureWith({ courseId: 'synthetic-course' }),
      fixtureWith({ kbId: 'synthetic-kb' }),
      fixtureWith({ chatbotId: LOCAL_CHATBOT_ID }),
      fixtureWith({ kbId: LOCAL_KB_ID }),
      fixtureWith({ chatMode: '' }),
      fixtureWith({ chatMode: '   ' }),
      fixtureWith({ chatMode: 'm'.repeat(5000) }),
      fixtureWith({ documentsFile: '' }),
      fixtureWith({ documentsFile: '   ' }),
      fixtureWith({ extra: 'unexpected' }),
      (() => {
        const { ownerId: _ownerId, ...withoutOwner } = SYNTHETIC_FIXTURE
        return withoutOwner
      })(),
    ]

    for (const [index, value] of invalidFixtures.entries()) {
      const root = await temporaryRoot()
      await writeFixture(root, value, `fixture-${index}.json`)

      expect(() =>
        loadLocalMcpFixture(
          { LOCAL_MCP_FIXTURE_FILE: join(root, `fixture-${index}.json`) },
          root
        )
      ).toThrow()
    }

    const malformedRoot = await temporaryRoot()
    await writeFixture(
      malformedRoot,
      '{ malformed synthetic fixture',
      'malformed.json'
    )

    expect(() =>
      loadLocalMcpFixture(
        { LOCAL_MCP_FIXTURE_FILE: join(malformedRoot, 'malformed.json') },
        malformedRoot
      )
    ).toThrow()
  })
})

async function createAuthState(fixture = null, options = {}) {
  const { privateKey, publicKey } = await generateKeyPair('ES256')
  const env = {
    LOCAL_MCP_GENERATION: SYNTHETIC_GENERATION,
    LOCAL_MCP_PUBLIC_KEY: await exportSPKI(publicKey),
    LOCAL_MCP_TRANSPORT_TOKEN: SYNTHETIC_TRANSPORT_TOKEN,
    DOC_QUERY_SCOPE_KID: SYNTHETIC_GENERATION,
    DOC_QUERY_SCOPE_ISSUER: SYNTHETIC_ISSUER,
    DOC_QUERY_SCOPE_AUDIENCE: SYNTHETIC_AUDIENCE,
  }

  return {
    env,
    privateKey,
    authenticate: await createLocalAuthenticator(env, fixture, options),
  }
}

async function signScopeToken(state, chatbotId, kbId) {
  const now = Math.floor(Date.now() / 1000)

  return new SignJWT({
    sub: 'synthetic-session',
    jti: 'synthetic-jti',
    chatbot_id: chatbotId,
    kb_id: kbId,
  })
    .setProtectedHeader({
      alg: 'ES256',
      typ: 'JWT',
      kid: state.env.DOC_QUERY_SCOPE_KID,
    })
    .setIssuedAt(now - 1)
    .setExpirationTime(now + 298)
    .setIssuer(state.env.DOC_QUERY_SCOPE_ISSUER)
    .setAudience(state.env.DOC_QUERY_SCOPE_AUDIENCE)
    .sign(state.privateKey)
}

function headersFor(state, token) {
  return {
    authorization: `Bearer ${state.env.LOCAL_MCP_TRANSPORT_TOKEN}`,
    'x-doc-query-scope-token': `Bearer ${token}`,
  }
}

describe('local MCP scope isolation', () => {
  test('keeps the boolean authentication result as the default', async () => {
    const state = await createAuthState()
    const token = await signScopeToken(state, LOCAL_CHATBOT_ID, LOCAL_KB_ID)

    await expect(state.authenticate(headersFor(state, token))).resolves.toBe(
      true
    )
  })

  test('returns the bound chatbot identity only for valid default and configured pairs', async () => {
    const state = await createAuthState(SYNTHETIC_FIXTURE, {
      returnIdentity: true,
    })
    const cases = [
      [LOCAL_CHATBOT_ID, LOCAL_KB_ID, LOCAL_CHATBOT_ID],
      [
        SYNTHETIC_FIXTURE.chatbotId,
        SYNTHETIC_FIXTURE.kbId,
        SYNTHETIC_FIXTURE.chatbotId,
      ],
      [LOCAL_CHATBOT_ID, SYNTHETIC_FIXTURE.kbId, false],
      [SYNTHETIC_FIXTURE.chatbotId, LOCAL_KB_ID, false],
      [
        SYNTHETIC_FIXTURE.chatbotId,
        '55555555-5555-4555-8555-555555555555',
        false,
      ],
    ]

    for (const [chatbotId, kbId, expected] of cases) {
      const token = await signScopeToken(state, chatbotId, kbId)
      await expect(state.authenticate(headersFor(state, token))).resolves.toBe(
        expected
      )
    }
  })
})

function authenticatedServer(overrides = {}) {
  return {
    name: 'KB',
    url: 'http://localhost:1417/mcp',
    isActive: true,
    passChatbotId: true,
    chatbotIdHeader: null,
    authType: 'bearer',
    authSecret: SYNTHETIC_AUTH_SECRET,
    parameters: { ...LOCAL_FIXTURE_MARKER },
    ...overrides,
  }
}

function originalConfig(chatMode, overrides = {}) {
  return {
    chatbotId: LOCAL_CHATBOT_ID,
    ownerId: ORIGINAL_OWNER_ID,
    courseId: ORIGINAL_COURSE_ID,
    chatMode,
    isEnabled: true,
    priority: 0,
    allowedTools: ['doc_query'],
    parameters: { ...LOCAL_SCOPE },
    ...overrides,
  }
}

function originalConfigs() {
  return [originalConfig('tutor'), originalConfig('explainer')]
}

function configuredConfig(overrides = {}) {
  return {
    chatbotId: SYNTHETIC_FIXTURE.chatbotId,
    ownerId: SYNTHETIC_FIXTURE.ownerId,
    courseId: SYNTHETIC_FIXTURE.courseId,
    chatMode: SYNTHETIC_FIXTURE.chatMode,
    isEnabled: true,
    priority: 0,
    allowedTools: ['doc_query'],
    parameters: {
      required: true,
      toolAlias: 'doc_query',
      kb_id: SYNTHETIC_FIXTURE.kbId,
    },
    ...overrides,
  }
}

describe('local MCP seed ownership', () => {
  test('accepts the original finance bindings plus one exact configured binding', () => {
    expect(() =>
      assertLocalSeedOwnership(
        authenticatedServer(),
        [...originalConfigs(), configuredConfig()],
        SYNTHETIC_FIXTURE
      )
    ).not.toThrow()
  })

  test('rejects an additional binding when no fixture is configured', () => {
    expect(() =>
      assertLocalSeedOwnership(authenticatedServer(), [
        ...originalConfigs(),
        configuredConfig(),
      ])
    ).toThrow()
  })

  test.each([
    ['owner', { ownerId: '55555555-5555-4555-8555-555555555555' }],
    ['course', { courseId: '66666666-6666-4666-8666-666666666666' }],
    ['mode', { chatMode: 'biology-other-mode' }],
    ['tool set', { allowedTools: ['doc_query', 'other_tool'] }],
    [
      'knowledge-base scope',
      {
        parameters: {
          required: true,
          toolAlias: 'doc_query',
          kb_id: '77777777-7777-4777-8777-777777777777',
        },
      },
    ],
  ])('rejects a configured binding with a mutated %s', (_label, mutation) => {
    expect(() =>
      assertLocalSeedOwnership(
        authenticatedServer(),
        [...originalConfigs(), configuredConfig(mutation)],
        SYNTHETIC_FIXTURE
      )
    ).toThrow()
  })
})
