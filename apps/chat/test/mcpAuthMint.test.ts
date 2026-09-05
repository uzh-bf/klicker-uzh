import { verifyJWT } from '@klicker-uzh/util'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import {
  LECTURER_MCP_SCOPE_FULL,
  STUDENT_MCP_SCOPE_FULL,
  LECTURER_MCP_SCOPE_READ_ONLY,
  McpAuthMintError,
  __resetLecturerMcpJwtCacheForTests,
  __resetParticipantMcpJwtCacheForTests,
  mintLecturerMcpJwt,
  mintParticipantMcpJwt,
  resolveLecturerMcpScope,
} from '../src/lib/server/mcpAuthMint'

const TEST_SECRET = 'unit-test-app-secret-abcd'
const TEST_ISSUER = 'https://auth.klicker.test'

describe('mintParticipantMcpJwt', () => {
  beforeEach(() => {
    vi.stubEnv('APP_SECRET', TEST_SECRET)
    vi.stubEnv('APP_ORIGIN_AUTH', TEST_ISSUER)
    __resetLecturerMcpJwtCacheForTests()
    __resetParticipantMcpJwtCacheForTests()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    __resetLecturerMcpJwtCacheForTests()
    __resetParticipantMcpJwtCacheForTests()
  })

  test('minted token verifies with same secret + issuer and carries participant sub', async () => {
    const jwt = await mintParticipantMcpJwt('participant-a', 'account')

    const payload = await verifyJWT(jwt, TEST_SECRET, {
      issuer: TEST_ISSUER,
    })

    expect(payload.sub).toBe('participant-a')
    expect(payload.role).toBe('PARTICIPANT')
    expect(payload.iss).toBe(TEST_ISSUER)
    expect(typeof payload.exp).toBe('number')
    expect(payload.purpose).toBe('student-mcp')
    expect(payload.scope).toBe(STUDENT_MCP_SCOPE_FULL)
    expect(payload.actor).toBe('account')
  })

  // Without the purpose claim this token is indistinguishable from the
  // participant's own session token, which is signed for the same subject
  // with the same role.
  test('purpose claim separates the MCP token from a session token', async () => {
    const jwt = await mintParticipantMcpJwt('participant-a', 'account')

    const payload = await verifyJWT(jwt, TEST_SECRET, { issuer: TEST_ISSUER })

    expect(payload.purpose).toBe('student-mcp')
  })

  test('carries the LTI guest actor kind into the token', async () => {
    const jwt = await mintParticipantMcpJwt('participant-guest', 'anonymous')

    const payload = await verifyJWT(jwt, TEST_SECRET, { issuer: TEST_ISSUER })

    expect(payload.actor).toBe('anonymous')
  })

  test('cache is keyed per actor kind so a guest never reuses an account token', async () => {
    const account = await mintParticipantMcpJwt('participant-both', 'account')
    const guest = await mintParticipantMcpJwt('participant-both', 'anonymous')

    expect(guest).not.toBe(account)
  })

  test('prefers the dedicated student MCP signing secret', async () => {
    vi.stubEnv('MCP_STUDENT_JWT_SECRET', 'dedicated-student-secret')

    const jwt = await mintParticipantMcpJwt('participant-a', 'account')

    await expect(
      verifyJWT(jwt, TEST_SECRET, { issuer: TEST_ISSUER })
    ).rejects.toThrow()
    await expect(
      verifyJWT(jwt, 'dedicated-student-secret', { issuer: TEST_ISSUER })
    ).resolves.toMatchObject({ sub: 'participant-a' })
  })

  test('cache hit within TTL returns byte-identical JWT string', async () => {
    const first = await mintParticipantMcpJwt('participant-cache', 'account')
    const second = await mintParticipantMcpJwt('participant-cache', 'account')

    expect(second).toBe(first)
  })

  test('cache entry past TTL is re-minted', async () => {
    vi.useFakeTimers()
    try {
      const startMs = new Date('2026-04-20T12:00:00.000Z').getTime()
      vi.setSystemTime(startMs)
      const first = await mintParticipantMcpJwt('participant-expire', 'account')

      // Advance past the 4-minute cache TTL. This moves both the
      // cache clock (Date.now) and jose's iat source (new Date()).
      vi.setSystemTime(startMs + 5 * 60 * 1000)
      const second = await mintParticipantMcpJwt(
        'participant-expire',
        'account'
      )
      expect(second).not.toBe(first)
    } finally {
      vi.useRealTimers()
    }
  })

  test('cache is keyed per participant (no cross-participant leakage)', async () => {
    const a = await mintParticipantMcpJwt('participant-a', 'account')
    const b = await mintParticipantMcpJwt('participant-b', 'account')
    expect(a).not.toBe(b)

    // A re-read for A returns A's cached token, not B's most-recent one.
    const aAgain = await mintParticipantMcpJwt('participant-a', 'account')
    expect(aAgain).toBe(a)

    const payloadA = await verifyJWT(aAgain, TEST_SECRET, {
      issuer: TEST_ISSUER,
    })
    expect(payloadA.sub).toBe('participant-a')
  })

  test('missing APP_SECRET throws McpAuthMintError', async () => {
    delete process.env.APP_SECRET
    await expect(
      mintParticipantMcpJwt('participant-x', 'account')
    ).rejects.toBeInstanceOf(McpAuthMintError)
  })

  test('missing APP_ORIGIN_AUTH throws McpAuthMintError', async () => {
    delete process.env.APP_ORIGIN_AUTH
    await expect(
      mintParticipantMcpJwt('participant-x', 'account')
    ).rejects.toBeInstanceOf(McpAuthMintError)
  })
})

describe('mintLecturerMcpJwt', () => {
  beforeEach(() => {
    vi.stubEnv('APP_SECRET', TEST_SECRET)
    vi.stubEnv('APP_ORIGIN_AUTH', TEST_ISSUER)
    __resetLecturerMcpJwtCacheForTests()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    __resetLecturerMcpJwtCacheForTests()
  })

  test('minted token verifies and is scoped to lecturer MCP for a full-access session', async () => {
    const jwt = await mintLecturerMcpJwt('lecturer-a', 'ACCOUNT_OWNER')

    const payload = await verifyJWT(jwt, TEST_SECRET, {
      issuer: TEST_ISSUER,
    })

    expect(payload.sub).toBe('lecturer-a')
    expect(payload.role).toBe('USER')
    expect(payload.purpose).toBe('lecturer-mcp')
    expect(payload.scope).toBe('manage:read manage:draft')
    expect(payload.iss).toBe(TEST_ISSUER)
    expect(typeof payload.exp).toBe('number')
  })

  test('uses a dedicated lecturer MCP secret when configured', async () => {
    const lecturerSecret = 'dedicated-lecturer-secret'
    vi.stubEnv('MCP_LECTURER_JWT_SECRET', lecturerSecret)

    const jwt = await mintLecturerMcpJwt('lecturer-secret', 'ACCOUNT_OWNER')
    const payload = await verifyJWT(jwt, lecturerSecret, {
      issuer: TEST_ISSUER,
    })

    expect(payload.sub).toBe('lecturer-secret')
  })

  test('cache is keyed per lecturer (no cross-lecturer leakage)', async () => {
    const a = await mintLecturerMcpJwt('lecturer-a', 'ACCOUNT_OWNER')
    const b = await mintLecturerMcpJwt('lecturer-b', 'ACCOUNT_OWNER')
    expect(a).not.toBe(b)

    const aAgain = await mintLecturerMcpJwt('lecturer-a', 'ACCOUNT_OWNER')
    expect(aAgain).toBe(a)
  })

  test('cache is keyed per effective MCP scope (same user, different session scopes)', async () => {
    const fullAccess = await mintLecturerMcpJwt(
      'lecturer-multi',
      'ACCOUNT_OWNER'
    )
    const readOnly = await mintLecturerMcpJwt('lecturer-multi', 'READ_ONLY')
    expect(fullAccess).not.toBe(readOnly)

    const fullAccessPayload = await verifyJWT(fullAccess, TEST_SECRET, {
      issuer: TEST_ISSUER,
    })
    const readOnlyPayload = await verifyJWT(readOnly, TEST_SECRET, {
      issuer: TEST_ISSUER,
    })
    expect(fullAccessPayload.scope).toBe(LECTURER_MCP_SCOPE_FULL)
    expect(readOnlyPayload.scope).toBe(LECTURER_MCP_SCOPE_READ_ONLY)

    // Re-minting each scope for the same user still hits its own cache slot.
    const fullAccessAgain = await mintLecturerMcpJwt(
      'lecturer-multi',
      'ACCOUNT_OWNER'
    )
    expect(fullAccessAgain).toBe(fullAccess)
  })

  test('missing issuer throws McpAuthMintError', async () => {
    delete process.env.APP_ORIGIN_AUTH
    await expect(
      mintLecturerMcpJwt('lecturer-x', 'ACCOUNT_OWNER')
    ).rejects.toBeInstanceOf(McpAuthMintError)
  })

  test('OTP session scope is rejected outright', async () => {
    await expect(
      mintLecturerMcpJwt('lecturer-otp', 'OTP')
    ).rejects.toBeInstanceOf(McpAuthMintError)
  })
})

describe('resolveLecturerMcpScope', () => {
  test.each([
    ['ACCOUNT_OWNER', LECTURER_MCP_SCOPE_FULL],
    ['FULL_ACCESS', LECTURER_MCP_SCOPE_FULL],
    ['SESSION_EXEC', LECTURER_MCP_SCOPE_READ_ONLY],
    ['READ_ONLY', LECTURER_MCP_SCOPE_READ_ONLY],
    ['ACTIVATION', LECTURER_MCP_SCOPE_READ_ONLY],
    ['EDUID', LECTURER_MCP_SCOPE_READ_ONLY],
    ['SOME_FUTURE_SCOPE', LECTURER_MCP_SCOPE_READ_ONLY],
    [undefined, LECTURER_MCP_SCOPE_READ_ONLY],
  ])('maps session scope %s to %s', (sessionScope, expected) => {
    expect(resolveLecturerMcpScope(sessionScope)).toBe(expected)
  })
})
