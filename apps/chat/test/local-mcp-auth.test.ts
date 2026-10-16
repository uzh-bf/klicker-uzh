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
  LOCAL_FIXTURE_MARKER,
  LOCAL_KB_ID,
  LOCAL_SCOPE,
} from '../scripts/local-mcp-auth.mjs'

const SYNTHETIC_TRANSPORT_TOKEN = 'synthetic-transport-token'
const SYNTHETIC_GENERATION = 'synthetic-generation'
const SYNTHETIC_ISSUER = 'synthetic-local-chat'
const SYNTHETIC_AUDIENCE = 'synthetic-doc-query'
const SYNTHETIC_SUBJECT = 'synthetic-session'
const SYNTHETIC_JTI = 'synthetic-jti'
const SYNTHETIC_OWNER_ID = '76047345-3801-4628-ae7b-adbebcfe8821'
const SYNTHETIC_COURSE_ID = '7c12e44e-d083-4acf-845e-4c34aaff6b49'
const SYNTHETIC_OTHER_CHATBOT_ID = '9f9c2e1d-4b7a-4c3e-9f5d-1a2b3c4d5e6f'
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
  const env: AuthEnvironment = {
    LOCAL_MCP_GENERATION:
      overrides.LOCAL_MCP_GENERATION ?? SYNTHETIC_GENERATION,
    LOCAL_MCP_PUBLIC_KEY: await exportSPKI(publicKey),
    LOCAL_MCP_TRANSPORT_TOKEN:
      overrides.LOCAL_MCP_TRANSPORT_TOKEN ?? SYNTHETIC_TRANSPORT_TOKEN,
    DOC_QUERY_SCOPE_AUDIENCE: SYNTHETIC_AUDIENCE,
    DOC_QUERY_SCOPE_ISSUER: SYNTHETIC_ISSUER,
    DOC_QUERY_SCOPE_KID: overrides.LOCAL_MCP_GENERATION ?? SYNTHETIC_GENERATION,
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

function legacyServer(overrides: Record<string, unknown> = {}) {
  return {
    name: 'KB',
    url: 'http://localhost:1417/mcp',
    isActive: true,
    passChatbotId: true,
    chatbotIdHeader: null,
    authType: 'none',
    authSecret: null,
    parameters: null,
    ...overrides,
  }
}

function authenticatedServer(overrides: Record<string, unknown> = {}) {
  return legacyServer({
    authType: 'bearer',
    authSecret: SYNTHETIC_AUTH_SECRET,
    parameters: { ...LOCAL_FIXTURE_MARKER },
    ...overrides,
  })
}

function seedConfig(chatMode: string, overrides: Record<string, unknown> = {}) {
  return {
    chatbotId: LOCAL_CHATBOT_ID,
    ownerId: SYNTHETIC_OWNER_ID,
    courseId: SYNTHETIC_COURSE_ID,
    chatMode,
    isEnabled: true,
    priority: 0,
    allowedTools: ['doc_query'],
    parameters: null,
    ...overrides,
  }
}

function legacyConfigs() {
  return [seedConfig('tutor'), seedConfig('explainer')]
}

function authenticatedConfigs() {
  return [
    seedConfig('tutor', { parameters: { ...LOCAL_SCOPE } }),
    seedConfig('explainer', { parameters: { ...LOCAL_SCOPE } }),
  ]
}

function expectOwnershipConflict(
  server: Record<string, unknown>,
  configs: Array<Record<string, unknown>>
) {
  expect(() => assertLocalSeedOwnership(server, configs)).toThrow(
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
      ['wrong chatbot', { claims: { chatbot_id: SYNTHETIC_OTHER_CHATBOT_ID } }],
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
  test.each([
    ['null parameters', null],
    ['empty parameters', {}],
  ])('accepts the exact legacy seed with %s', (_label, parameters) => {
    expect(() =>
      assertLocalSeedOwnership(legacyServer({ parameters }), legacyConfigs())
    ).not.toThrow()
  })

  test('accepts the exact marked authenticated seed', () => {
    expect(() =>
      assertLocalSeedOwnership(authenticatedServer(), authenticatedConfigs())
    ).not.toThrow()
  })

  test.each([
    ['legacy', legacyServer(), legacyConfigs()],
    ['authenticated', authenticatedServer(), authenticatedConfigs()],
  ])('rejects an additional chatbot consumer for the %s seed', (_label, server, configs) => {
    expectOwnershipConflict(server, [
      ...configs,
      seedConfig('tutor', {
        chatbotId: SYNTHETIC_OTHER_CHATBOT_ID,
        parameters: server.authType === 'none' ? null : { ...LOCAL_SCOPE },
      }),
    ])
  })

  test('rejects a configuration change for either seed mode', () => {
    expectOwnershipConflict(legacyServer(), [
      seedConfig('tutor', { parameters: { ...LOCAL_SCOPE } }),
      seedConfig('explainer'),
    ])
    expectOwnershipConflict(authenticatedServer(), [
      seedConfig('tutor', {
        allowedTools: ['doc_query', 'other_tool'],
        parameters: { ...LOCAL_SCOPE },
      }),
      ...authenticatedConfigs().slice(1),
    ])
  })

  test('rejects server and configuration changes outside the owned seed', () => {
    const cases: Array<
      [string, Record<string, unknown>, Array<Record<string, unknown>>]
    > = [
      ['different server name', { name: 'KB-copy' }, authenticatedConfigs()],
      [
        'different server URL',
        { url: 'http://localhost:2417/mcp' },
        authenticatedConfigs(),
      ],
      ['inactive server', { isActive: false }, authenticatedConfigs()],
      [
        'chatbot header enabled',
        { chatbotIdHeader: 'x-chatbot-id' },
        authenticatedConfigs(),
      ],
      [
        'unmarked bearer server',
        { parameters: { localFixture: 'other-fixture' } },
        authenticatedConfigs(),
      ],
      [
        'extra server parameter',
        { parameters: { ...LOCAL_FIXTURE_MARKER, extra: true } },
        authenticatedConfigs(),
      ],
      [
        'changed chatbot',
        {},
        [
          seedConfig('tutor', {
            chatbotId: SYNTHETIC_OTHER_CHATBOT_ID,
            parameters: { ...LOCAL_SCOPE },
          }),
          ...authenticatedConfigs().slice(1),
        ],
      ],
      [
        'changed owner',
        {},
        [
          seedConfig('tutor', {
            ownerId: '86158456-2802-5739-bf8c-bee9dcff9932',
            parameters: { ...LOCAL_SCOPE },
          }),
          ...authenticatedConfigs().slice(1),
        ],
      ],
      [
        'changed course',
        {},
        [
          seedConfig('tutor', {
            courseId: '8d23f55e-f194-5be0-bf5f-5d45bbc06750',
            parameters: { ...LOCAL_SCOPE },
          }),
          ...authenticatedConfigs().slice(1),
        ],
      ],
      [
        'disabled configuration',
        {},
        [
          seedConfig('tutor', {
            isEnabled: false,
            parameters: { ...LOCAL_SCOPE },
          }),
          ...authenticatedConfigs().slice(1),
        ],
      ],
      [
        'nonzero priority',
        {},
        [
          seedConfig('tutor', {
            priority: 1,
            parameters: { ...LOCAL_SCOPE },
          }),
          ...authenticatedConfigs().slice(1),
        ],
      ],
      [
        'additional allowed tool',
        {},
        [
          seedConfig('tutor', {
            allowedTools: ['doc_query', 'other_tool'],
            parameters: { ...LOCAL_SCOPE },
          }),
          ...authenticatedConfigs().slice(1),
        ],
      ],
      [
        'extra configuration parameter',
        {},
        [
          seedConfig('tutor', {
            parameters: { ...LOCAL_SCOPE, extra: true },
          }),
          ...authenticatedConfigs().slice(1),
        ],
      ],
      [
        'unsupported chat mode',
        {},
        [
          seedConfig('quizzer', { parameters: { ...LOCAL_SCOPE } }),
          ...authenticatedConfigs().slice(1),
        ],
      ],
    ]

    for (const [_label, serverOverrides, configs] of cases) {
      expectOwnershipConflict(authenticatedServer(serverOverrides), configs)
    }
  })
})
