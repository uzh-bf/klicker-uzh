import { randomBytes } from 'node:crypto'
import { afterAll, describe, expect, test, vi } from 'vitest'
import { decode, encode } from '../src/lib/jwt'

// Library contract test for the installed next-auth version.
//
// next-auth core/lib/oauth/checks.js signs every temporary OAuth cookie with
// jwt.encode({ ...options.jwt, token: { value, provider }, salt: cookieName })
// and verifies it with jwt.decode({ ..., salt: cookieName }). This test pins the
// properties we depend on for strict callback dispatch:
//   1. salt-bearing calls produce a salt-bound A256GCM JWE (library default)
//   2. the payload round-trips { value, provider }
//   3. a cookie encrypted under one salt is undecryptable under another
//   4. expired cookies fail verification
//   5. salt-free calls keep the HS256 session contract (signJWT/verifyJWT with
//      the APP_ORIGIN_AUTH issuer) the backend depends on

const AUTH_URL = 'https://auth.klicker.uzh.ch'
const SECRET = randomBytes(32).toString('hex')

const PARTICIPANT_STATE_COOKIE = '__Secure-next-auth.participant.state'
const LECTURER_STATE_COOKIE = '__Secure-next-auth.lecturer.state'

// jwt.encode/decode read the issuer from the environment on every call, so the
// variable is stubbed for the whole file and restored afterwards.
vi.stubEnv('APP_ORIGIN_AUTH', AUTH_URL)

afterAll(() => {
  vi.unstubAllEnvs()
})

describe('next-auth JWT contracts', () => {
  test('salt-bearing encode produces a JWE with the payload { value, provider }', async () => {
    const token = await encode({
      token: { value: 'state-value-123', provider: 'eduid' },
      secret: SECRET,
      salt: PARTICIPANT_STATE_COOKIE,
      maxAge: 900,
    })

    // JWE compact serialization has five segments; a plain JWT has three.
    expect(token.split('.').length).toBe(5)

    const payload = await decode({
      token,
      secret: SECRET,
      salt: PARTICIPANT_STATE_COOKIE,
    })
    expect(payload).toBeTruthy()
    expect(payload?.value).toBe('state-value-123')
    expect(payload?.provider).toBe('eduid')
  })

  test('a state cookie is undecryptable under a different audience salt', async () => {
    const token = await encode({
      token: { value: 'state-value-123', provider: 'eduid' },
      secret: SECRET,
      salt: PARTICIPANT_STATE_COOKIE,
      maxAge: 900,
    })

    // The lecturer configuration decodes with its own cookie name as salt. The
    // HKDF key derivation must make this fail rather than return a payload.
    await expect(
      decode({ token, secret: SECRET, salt: LECTURER_STATE_COOKIE })
    ).rejects.toThrow()
  })

  test('a state cookie is undecryptable under a different secret', async () => {
    const token = await encode({
      token: { value: 'state-value-123', provider: 'eduid' },
      secret: SECRET,
      salt: PARTICIPANT_STATE_COOKIE,
      maxAge: 900,
    })

    await expect(
      decode({ token, secret: 'other-secret', salt: PARTICIPANT_STATE_COOKIE })
    ).rejects.toThrow()
  })

  test('an expired state cookie fails verification', async () => {
    const token = await encode({
      token: { value: 'state-value-123', provider: 'eduid' },
      secret: SECRET,
      salt: PARTICIPANT_STATE_COOKIE,
      // Beyond the decoder's 15s clock tolerance.
      maxAge: -120,
    })

    await expect(
      decode({ token, secret: SECRET, salt: PARTICIPANT_STATE_COOKIE })
    ).rejects.toThrow()
  })

  test('salt-free encode keeps the HS256 session contract with issuer', async () => {
    const token = await encode({
      token: { sub: 'participant-1', role: 'PARTICIPANT' },
      secret: SECRET,
      maxAge: 900,
    })

    expect(token.split('.').length).toBe(3)

    const payload = await decode({ token, secret: SECRET })
    expect(payload).toBeTruthy()
    expect(payload?.sub).toBe('participant-1')
    expect(payload?.role).toBe('PARTICIPANT')
    expect(payload?.iss).toBe(AUTH_URL)

    // Wrong issuer must fail, mirroring the backend's verification. The shared
    // verifier reports that rejection through console.error, so its output is
    // silenced for exactly this expected failure.
    vi.stubEnv('APP_ORIGIN_AUTH', 'https://other.example.com')
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      await expect(decode({ token, secret: SECRET })).rejects.toThrow()
    } finally {
      errorSpy.mockRestore()
    }
    vi.stubEnv('APP_ORIGIN_AUTH', AUTH_URL)
  })
})
