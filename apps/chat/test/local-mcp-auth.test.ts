import {
  exportSPKI,
  generateKeyPair,
  type JWTPayload,
  type KeyLike,
  SignJWT,
} from 'jose'
import { beforeEach, describe, expect, test } from 'vitest'
import {
  assertLocalSeedOwnership,
  createLocalAuthenticator,
  LOCAL_CHATBOT_ID,
  LOCAL_COURSE_ID,
  LOCAL_FIXTURE_MARKER,
  LOCAL_KB_ID,
  LOCAL_OWNER_ID,
  LOCAL_SCOPE,
  LOCAL_SERVER_ID,
  LOCAL_SERVER_NAME,
} from '../scripts/local-mcp-auth.mjs'

const SYNTHETIC_TRANSPORT_TOKEN = 'synthetic-transport-token'
const SYNTHETIC_GENERATION = 'synthetic-generation'
const SYNTHETIC_ISSUER = 'synthetic-local-chat'
const SYNTHETIC_AUDIENCE = 'synthetic-doc-query'
const SYNTHETIC_SUBJECT = 'synthetic-session'
const SYNTHETIC_JTI = 'synthetic-jti'
const LEGACY_CHATBOT_ID = '8f9c2e1d-4b7a-4c3e-9f5d-1a2b3c4d5e6f'
const OTHER_CHATBOT_ID = '9f9c2e1d-4b7a-4c3e-9f5d-1a2b3c4d5e6f'
const SYNTHETIC_AUTH_SECRET = [
  'a'.repeat(32),
  'b'.repeat(32),
  'c'.repeat(16),
].join(':')

type AuthEnvironment = {
  LOCAL_MCP_GENERATION: string
  LOCAL_MCP_PUBLIC_KEY: string
  LOCAL_MCP_TRANSPORT_TOKEN: string
  DOC_QUERY_SCOPE_AUDIENCE: string
  DOC_QUERY_SCOPE_ISSUER: string
  DOC_QUERY_SCOPE_KID: string
}

type LocalAuthenticator = (headers: Record<string, string>) => Promise<boolean>

type SyntheticFixture = {
  authenticate: LocalAuthenticator
  env: AuthEnvironment
  privateKey: KeyLike
}

type ScopeTokenOptions = {
  audience?: string
  claims?: Record<string, unknown>
  exp?: number
  iat?: number
  issuer?: string
  kid?: string
}

let fixture: SyntheticFixture

async function createSyntheticFixture(
  overrides: Partial<
    Pick<AuthEnvironment, 'LOCAL_MCP_GENERATION' | 'LOCAL_MCP_TRANSPORT_TOKEN'>
  > = {}
): Promise<SyntheticFixture> {
  const { privateKey, publicKey } = await generateKeyPair('ES256')
  const generation = overrides.LOCAL_MCP_GENERATION ?? SYNTHETIC_GENERATION
  const env: AuthEnvironment = {
    LOCAL_MCP_GENERATION: generation,
    LOCAL_MCP_PUBLIC_KEY: await exportSPKI(publicKey),
    LOCAL_MCP_TRANSPORT_TOKEN:
      overrides.LOCAL_MCP_TRANSPORT_TOKEN ?? SYNTHETIC_TRANSPORT_TOKEN,
    DOC_QUERY_SCOPE_AUDIENCE: SYNTHETIC_AUDIENCE,
    DOC_QUERY_SCOPE_ISSUER: SYNTHETIC_ISSUER,
    DOC_QUERY_SCOPE_KID: generation,
  }

  return {
    authenticate: await createLocalAuthenticator(env),
    env,
    privateKey,
  }
}

async function signScopeToken(
  tokenFixture: SyntheticFixture = fixture,
  options: ScopeTokenOptions = {}
): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  const iat = options.iat ?? now - 1
  const exp = options.exp ?? now + 299

  return new SignJWT({
    sub: SYNTHETIC_SUBJECT,
    jti: SYNTHETIC_JTI,
    chatbot_id: LOCAL_CHATBOT_ID,
    kb_id: LOCAL_KB_ID,
    ...options.claims,
  } as JWTPayload)
    .setProtectedHeader({
      alg: 'ES256',
      typ: 'JWT',
      kid: options.kid ?? tokenFixture.env.DOC_QUERY_SCOPE_KID,
    })
    .setIssuedAt(iat)
    .setExpirationTime(exp)
    .setIssuer(options.issuer ?? tokenFixture.env.DOC_QUERY_SCOPE_ISSUER)
    .setAudience(options.audience ?? tokenFixture.env.DOC_QUERY_SCOPE_AUDIENCE)
    .sign(tokenFixture.privateKey)
}

function headersFor(
  scopeToken: string,
  transportToken = fixture.env.LOCAL_MCP_TRANSPORT_TOKEN
): Record<string, string> {
  return {
    authorization: `Bearer ${transportToken}`,
    'x-doc-query-scope-token': `Bearer ${scopeToken}`,
  }
}

async function expectRejectedScopeToken(
  label: string,
  options: ScopeTokenOptions
) {
  const token = await signScopeToken(fixture, options)
  expect(await fixture.authenticate(headersFor(token)), label).toBe(false)
}

function dedicatedServer(overrides: Record<string, unknown> = {}) {
  return {
    id: LOCAL_SERVER_ID,
    name: LOCAL_SERVER_NAME,
    url: 'http://localhost:1417/mcp',
    isActive: true,
    passChatbotId: false,
    chatbotIdHeader: null,
    authType: 'bearer',
    authSecret: SYNTHETIC_AUTH_SECRET,
    parameters: { ...LOCAL_FIXTURE_MARKER },
    ...overrides,
  }
}

function seedConfig(chatMode: string, overrides: Record<string, unknown> = {}) {
  return {
    id: `synthetic-${chatMode}`,
    mcpServerId: LOCAL_SERVER_ID,
    chatbotId: LOCAL_CHATBOT_ID,
    ownerId: LOCAL_OWNER_ID,
    courseId: LOCAL_COURSE_ID,
    chatMode,
    isEnabled: true,
    priority: 0,
    allowedTools: ['doc_query'],
    parameters: { ...LOCAL_SCOPE },
    ...overrides,
  }
}

function dedicatedConfigs(isEnabled: [boolean, boolean] = [true, true]) {
  return [
    seedConfig('tutor', { isEnabled: isEnabled[0] }),
    seedConfig('explainer', { isEnabled: isEnabled[1] }),
  ]
}

function expectOwnershipConflict(
  server: Record<string, unknown>,
  configs: Array<Record<string, unknown>>,
  chatbot: Record<string, unknown> | undefined = undefined
) {
  expect(() => assertLocalSeedOwnership(server, configs, chatbot)).toThrow(
    'Local MCP seed ownership conflict'
  )
}

describe('createLocalAuthenticator', () => {
  beforeEach(async () => {
    fixture = await createSyntheticFixture()
  })

  test('accepts a valid scope JWT when the same credentials are reused', async () => {
    const token = await signScopeToken()
    const headers = headersFor(token)

    await expect(fixture.authenticate(headers)).resolves.toBe(true)
    await expect(fixture.authenticate(headers)).resolves.toBe(true)
  })

  test('rejects missing or wrong transport and scope headers', async () => {
    const token = await signScopeToken()
    const validScopeHeader = `Bearer ${token}`
    const validTransportHeader = `Bearer ${fixture.env.LOCAL_MCP_TRANSPORT_TOKEN}`
    const cases: Array<[string, Record<string, string>]> = [
      ['missing transport', { 'x-doc-query-scope-token': validScopeHeader }],
      [
        'wrong transport',
        {
          authorization: 'Bearer synthetic-wrong-transport',
          'x-doc-query-scope-token': validScopeHeader,
        },
      ],
      ['missing scope', { authorization: validTransportHeader }],
      [
        'wrong scope scheme',
        {
          authorization: validTransportHeader,
          'x-doc-query-scope-token': `Basic ${token}`,
        },
      ],
      [
        'wrong scope token',
        {
          authorization: validTransportHeader,
          'x-doc-query-scope-token': 'Bearer synthetic-invalid-token',
        },
      ],
    ]

    for (const [label, headers] of cases) {
      expect(await fixture.authenticate(headers), label).toBe(false)
    }
  })

  test('rejects an expired scope JWT', async () => {
    const now = Math.floor(Date.now() / 1000)
    await expectRejectedScopeToken('expired', {
      iat: now - 10,
      exp: now - 1,
    })
  })

  test('rejects scope JWTs with invalid identifiers', async () => {
    const cases: Array<[string, ScopeTokenOptions]> = [
      ['empty subject', { claims: { sub: '' } }],
      ['whitespace-only subject', { claims: { sub: '   ' } }],
      ['long subject', { claims: { sub: 's'.repeat(257) } }],
      ['non-string subject', { claims: { sub: 42 } }],
      ['empty jti', { claims: { jti: '' } }],
      ['long jti', { claims: { jti: 'j'.repeat(257) } }],
      ['non-string jti', { claims: { jti: { value: 'synthetic' } } }],
    ]

    for (const [label, options] of cases) {
      await expectRejectedScopeToken(label, options)
    }
  })

  test('rejects scope JWTs with wrong binding claims or signing metadata', async () => {
    const cases: Array<[string, ScopeTokenOptions]> = [
      ['wrong knowledge base', { claims: { kb_id: 'synthetic-other-kb' } }],
      ['wrong chatbot', { claims: { chatbot_id: OTHER_CHATBOT_ID } }],
      [
        'old response-example chatbot',
        { claims: { chatbot_id: LEGACY_CHATBOT_ID } },
      ],
      ['wrong key id', { kid: 'synthetic-rotated-key' }],
      ['wrong issuer', { issuer: 'synthetic-other-issuer' }],
      ['wrong audience', { audience: 'synthetic-other-audience' }],
    ]

    for (const [label, options] of cases) {
      await expectRejectedScopeToken(label, options)
    }
  })

  test('rejects scope JWTs outside the five-minute lifetime', async () => {
    const now = Math.floor(Date.now() / 1000)
    const cases: Array<[string, ScopeTokenOptions]> = [
      ['lifetime too long', { iat: now - 1, exp: now + 300 }],
      ['expiration not after issued-at', { iat: now + 30, exp: now + 30 }],
    ]

    for (const [label, options] of cases) {
      await expectRejectedScopeToken(label, options)
    }
  })

  test('rejects credentials from before transport and signing-key rotation', async () => {
    const previous = await createSyntheticFixture({
      LOCAL_MCP_GENERATION: 'synthetic-previous-generation',
      LOCAL_MCP_TRANSPORT_TOKEN: 'synthetic-previous-transport-token',
    })
    const rotated = await createSyntheticFixture({
      LOCAL_MCP_GENERATION: 'synthetic-rotated-generation',
      LOCAL_MCP_TRANSPORT_TOKEN: 'synthetic-rotated-transport-token',
    })
    const previousToken = await signScopeToken(previous)
    const rotatedToken = await signScopeToken(rotated)

    await expect(
      rotated.authenticate(
        headersFor(rotatedToken, previous.env.LOCAL_MCP_TRANSPORT_TOKEN)
      )
    ).resolves.toBe(false)
    await expect(
      rotated.authenticate(
        headersFor(previousToken, rotated.env.LOCAL_MCP_TRANSPORT_TOKEN)
      )
    ).resolves.toBe(false)
    await expect(
      rotated.authenticate(
        headersFor(rotatedToken, rotated.env.LOCAL_MCP_TRANSPORT_TOKEN)
      )
    ).resolves.toBe(true)
  })
})
describe('assertLocalSeedOwnership', () => {
  test('accepts the exact dedicated marked fixture with disabled configs', () => {
    expect(() =>
      assertLocalSeedOwnership(
        dedicatedServer(),
        dedicatedConfigs([true, false]),
        {
          id: LOCAL_CHATBOT_ID,
          ownerId: LOCAL_OWNER_ID,
          courseId: LOCAL_COURSE_ID,
        }
      )
    ).not.toThrow()
  })

  test.each([
    { ...LOCAL_SCOPE, kb_ids: [LOCAL_KB_ID, 'other-kb'] },
    { ...LOCAL_SCOPE, kb_id: LOCAL_KB_ID },
    { ...LOCAL_SCOPE, extra: true },
  ])('rejects broadened or ambiguous fixture scopes', (parameters) => {
    expectOwnershipConflict(
      dedicatedServer(),
      dedicatedConfigs().map((config) => ({ ...config, parameters }))
    )
  })

  test('rejects an unmarked legacy KB server even with the old chatbot', () => {
    expectOwnershipConflict(
      {
        id: 'legacy-kb-server',
        name: 'KB',
        url: 'http://localhost:1417/mcp',
        isActive: true,
        passChatbotId: true,
        chatbotIdHeader: null,
        authType: 'none',
        authSecret: null,
        parameters: null,
      },
      dedicatedConfigs().map((config) => ({
        ...config,
        mcpServerId: 'legacy-kb-server',
        chatbotId: LEGACY_CHATBOT_ID,
      }))
    )
  })

  test.each([
    ['different server id', { id: 'another-server' }],
    ['different server name', { name: 'KB' }],
    ['different server URL', { url: 'http://localhost:2417/mcp' }],
    ['inactive server', { isActive: false }],
    ['chatbot header enabled', { chatbotIdHeader: 'x-chatbot-id' }],
    ['wrong auth type', { authType: 'scope_token' }],
    ['wrong auth secret shape', { authSecret: 'not-encrypted' }],
    ['unmarked server', { parameters: { localFixture: 'other-fixture' } }],
    [
      'extra server parameter',
      { parameters: { ...LOCAL_FIXTURE_MARKER, extra: true } },
    ],
  ])('rejects %s', (_label, overrides) => {
    expectOwnershipConflict(dedicatedServer(overrides), dedicatedConfigs())
  })

  test.each([
    ['changed chatbot', { chatbotId: OTHER_CHATBOT_ID }],
    ['changed owner', { ownerId: '86158456-2802-5739-bf8c-bee9dcff9932' }],
    ['changed course', { courseId: '8d23f55e-f194-5be0-bf5f-5d45bbc06750' }],
    ['nonboolean configuration state', { isEnabled: 'enabled' }],
    ['nonzero priority', { priority: 1 }],
    ['additional allowed tool', { allowedTools: ['doc_query', 'other_tool'] }],
    ['ambiguous scope', { parameters: { ...LOCAL_SCOPE, extra: true } }],
    ['unsupported chat mode', { chatMode: 'quizzer' }],
    ['wrong server relation', { mcpServerId: 'another-server' }],
  ])('rejects %s', (_label, overrides) => {
    expectOwnershipConflict(dedicatedServer(), [
      seedConfig('tutor', overrides),
      dedicatedConfigs()[1],
    ])
  })

  test('rejects duplicate modes and extra consumers', () => {
    expectOwnershipConflict(dedicatedServer(), [
      seedConfig('tutor'),
      seedConfig('tutor', { id: 'synthetic-extra-tutor' }),
    ])
    expectOwnershipConflict(dedicatedServer(), [
      ...dedicatedConfigs(),
      seedConfig('tutor', {
        id: 'synthetic-extra-consumer',
        chatbotId: OTHER_CHATBOT_ID,
      }),
    ])
  })

  test('rejects a mismatched parent identity when supplied', () => {
    expectOwnershipConflict(dedicatedServer(), dedicatedConfigs(), {
      id: LOCAL_CHATBOT_ID,
      ownerId: 'another-owner',
      courseId: LOCAL_COURSE_ID,
    })
  })
})
