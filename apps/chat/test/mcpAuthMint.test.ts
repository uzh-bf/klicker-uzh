import { verifyJWT } from '@klicker-uzh/util'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import {
  McpAuthMintError,
  __resetLecturerMcpJwtCacheForTests,
  __resetParticipantMcpJwtCacheForTests,
  mintLecturerMcpJwt,
  mintParticipantMcpJwt,
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
    const jwt = await mintParticipantMcpJwt('participant-a')

    const payload = await verifyJWT(jwt, TEST_SECRET, {
      issuer: TEST_ISSUER,
    })

    expect(payload.sub).toBe('participant-a')
    expect(payload.role).toBe('PARTICIPANT')
    expect(payload.iss).toBe(TEST_ISSUER)
    expect(typeof payload.exp).toBe('number')
  })

  test('cache hit within TTL returns byte-identical JWT string', async () => {
    const first = await mintParticipantMcpJwt('participant-cache')
    const second = await mintParticipantMcpJwt('participant-cache')

    expect(second).toBe(first)
  })

  test('cache entry past TTL is re-minted', async () => {
    vi.useFakeTimers()
    try {
      const startMs = new Date('2026-04-20T12:00:00.000Z').getTime()
      vi.setSystemTime(startMs)
      const first = await mintParticipantMcpJwt('participant-expire')

      // Advance past the 4-minute cache TTL. This moves both the
      // cache clock (Date.now) and jose's iat source (new Date()).
      vi.setSystemTime(startMs + 5 * 60 * 1000)
      const second = await mintParticipantMcpJwt('participant-expire')
      expect(second).not.toBe(first)
    } finally {
      vi.useRealTimers()
    }
  })

  test('cache is keyed per participant (no cross-participant leakage)', async () => {
    const a = await mintParticipantMcpJwt('participant-a')
    const b = await mintParticipantMcpJwt('participant-b')
    expect(a).not.toBe(b)

    // A re-read for A returns A's cached token, not B's most-recent one.
    const aAgain = await mintParticipantMcpJwt('participant-a')
    expect(aAgain).toBe(a)

    const payloadA = await verifyJWT(aAgain, TEST_SECRET, {
      issuer: TEST_ISSUER,
    })
    expect(payloadA.sub).toBe('participant-a')
  })

  test('missing APP_SECRET throws McpAuthMintError', async () => {
    delete process.env.APP_SECRET
    await expect(mintParticipantMcpJwt('participant-x')).rejects.toBeInstanceOf(
      McpAuthMintError
    )
  })

  test('missing APP_ORIGIN_AUTH throws McpAuthMintError', async () => {
    delete process.env.APP_ORIGIN_AUTH
    await expect(mintParticipantMcpJwt('participant-x')).rejects.toBeInstanceOf(
      McpAuthMintError
    )
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

  test('minted token verifies and is scoped to lecturer MCP', async () => {
    const jwt = await mintLecturerMcpJwt('lecturer-a')

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

    const jwt = await mintLecturerMcpJwt('lecturer-secret')
    const payload = await verifyJWT(jwt, lecturerSecret, {
      issuer: TEST_ISSUER,
    })

    expect(payload.sub).toBe('lecturer-secret')
  })

  test('cache is keyed per lecturer (no cross-lecturer leakage)', async () => {
    const a = await mintLecturerMcpJwt('lecturer-a')
    const b = await mintLecturerMcpJwt('lecturer-b')
    expect(a).not.toBe(b)

    const aAgain = await mintLecturerMcpJwt('lecturer-a')
    expect(aAgain).toBe(a)
  })

  test('missing issuer throws McpAuthMintError', async () => {
    delete process.env.APP_ORIGIN_AUTH
    await expect(mintLecturerMcpJwt('lecturer-x')).rejects.toBeInstanceOf(
      McpAuthMintError
    )
  })
})
