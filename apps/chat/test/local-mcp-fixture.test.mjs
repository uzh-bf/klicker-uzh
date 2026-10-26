import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { exportSPKI, generateKeyPair, SignJWT } from 'jose'
import { afterEach, describe, expect, test } from 'vitest'

import {
  assertLocalFixtureConfiguration,
  createLocalAuthenticator,
  LOCAL_CHATBOT_ID,
  LOCAL_KB_ID,
  LOCAL_SCOPE,
  LOCAL_SERVER_ID,
  localFixtureScope,
} from '../scripts/local-mcp-auth.mjs'
import { loadLocalMcpFixture } from '../scripts/local-mcp-fixture.mjs'

const SYNTHETIC_FIXTURE = {
  chatbotId: '11111111-1111-4111-8111-111111111111',
  kbId: '44444444-4444-4444-8444-444444444444',
  chatMode: 'synthetic-help',
  documentsFile: 'synthetic-documents.json',
}

const SYNTHETIC_TRANSPORT_TOKEN = 'synthetic-transport-token'
const SYNTHETIC_GENERATION = 'synthetic-generation'
const SYNTHETIC_ISSUER = 'synthetic-local-chat'
const SYNTHETIC_AUDIENCE = 'synthetic-doc-query'
const OTHER_KB_ID = '55555555-5555-4555-8555-555555555555'

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
      'documentsFile',
      'kbId',
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
      fixtureWith({ kbId: 'synthetic-kb' }),
      fixtureWith({ chatbotId: LOCAL_CHATBOT_ID }),
      fixtureWith({ kbId: LOCAL_KB_ID }),
      fixtureWith({ chatMode: '' }),
      fixtureWith({ chatMode: '   ' }),
      fixtureWith({ chatMode: 'm'.repeat(5000) }),
      fixtureWith({ documentsFile: '' }),
      fixtureWith({ documentsFile: '   ' }),
      fixtureWith({ extra: 'unexpected' }),
      Object.fromEntries(
        Object.entries(SYNTHETIC_FIXTURE).filter(([key]) => key !== 'kbId')
      ),
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
      [SYNTHETIC_FIXTURE.chatbotId, OTHER_KB_ID, false],
    ]

    for (const [chatbotId, kbId, expected] of cases) {
      const token = await signScopeToken(state, chatbotId, kbId)
      await expect(state.authenticate(headersFor(state, token))).resolves.toBe(
        expected
      )
    }
  })

  test('ignores a configured identity unless it is the accepted pair', async () => {
    const state = await createAuthState(SYNTHETIC_FIXTURE, {
      returnIdentity: true,
    })
    const token = await signScopeToken(
      state,
      SYNTHETIC_FIXTURE.chatbotId,
      OTHER_KB_ID
    )

    await expect(state.authenticate(headersFor(state, token))).resolves.toBe(
      false
    )
  })
})

function fixtureBinding(overrides = {}) {
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

describe('local MCP fixture configuration', () => {
  test('accepts only the exact binding of the configured identity', () => {
    expect(() =>
      assertLocalFixtureConfiguration(fixtureBinding(), SYNTHETIC_FIXTURE)
    ).not.toThrow()
    expect(localFixtureScope(SYNTHETIC_FIXTURE.kbId)).toEqual({
      required: true,
      toolAlias: 'doc_query',
      kb_ids: [SYNTHETIC_FIXTURE.kbId],
    })
  })

  test('rejects an additional binding when no fixture is configured', () => {
    expect(() =>
      assertLocalFixtureConfiguration(fixtureBinding(), null)
    ).toThrow('Local MCP fixture configuration conflict')
  })

  test.each([
    ['server relation', { mcpServerId: 'synthetic-other-server' }],
    ['chatbot', { chatbotId: LOCAL_CHATBOT_ID }],
    ['chat mode', { chatMode: 'synthetic-other-mode' }],
    ['enabled state', { isEnabled: false }],
    ['priority', { priority: 1 }],
    ['tool set', { allowedTools: ['doc_query', 'other_tool'] }],
    ['dedicated scope', { parameters: { ...LOCAL_SCOPE } }],
    ['knowledge-base scope', { parameters: localFixtureScope(OTHER_KB_ID) }],
    [
      'ambiguous scope',
      {
        parameters: {
          ...localFixtureScope(SYNTHETIC_FIXTURE.kbId),
          kb_id: SYNTHETIC_FIXTURE.kbId,
        },
      },
    ],
  ])('rejects a binding with a mutated %s', (_label, mutation) => {
    expect(() =>
      assertLocalFixtureConfiguration(
        fixtureBinding(mutation),
        SYNTHETIC_FIXTURE
      )
    ).toThrow('Local MCP fixture configuration conflict')
  })
})
