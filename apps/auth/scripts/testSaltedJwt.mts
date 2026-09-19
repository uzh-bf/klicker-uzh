import assert from 'node:assert/strict'
import test from 'node:test'
import { decode, encode } from '../src/lib/jwt.ts'

// Library contract test for the installed next-auth version.
//
// next-auth core/lib/oauth/checks.js signs every temporary OAuth cookie with
// jwt.encode({ ...options.jwt, token: { value, provider }, salt: cookieName })
// and verifies it with jwt.decode({ ..., salt: cookieName }). This test pins
// the properties we depend on for strict callback dispatch:
//   1. salt-bearing calls produce a salt-bound A256GCM JWE (library default)
//   2. the payload round-trips { value, provider }
//   3. a cookie encrypted under one salt is undecryptable under another
//   4. expired cookies fail verification
//   5. salt-free calls keep the HS256 session contract (signJWT/verifyJWT
//      with the APP_ORIGIN_AUTH issuer) the backend depends on

process.env.APP_ORIGIN_AUTH = 'https://auth.klicker.uzh.ch'

const SECRET = 'test-secret-material-for-klicker-auth'

const PARTICIPANT_STATE_COOKIE = '__Secure-next-auth.participant.state'
const LECTURER_STATE_COOKIE = '__Secure-next-auth.lecturer.state'

test('salt-bearing encode produces a JWE with the payload { value, provider }', async () => {
  const token = await encode({
    token: { value: 'state-value-123', provider: 'eduid' },
    secret: SECRET,
    salt: PARTICIPANT_STATE_COOKIE,
    maxAge: 900,
  })

  // JWE compact serialization has five segments; a plain JWT has three.
  assert.equal(token.split('.').length, 5)

  const payload = await decode({
    token,
    secret: SECRET,
    salt: PARTICIPANT_STATE_COOKIE,
  })
  assert.ok(payload)
  assert.equal(payload.value, 'state-value-123')
  assert.equal(payload.provider, 'eduid')
})

test('a state cookie is undecryptable under a different audience salt', async () => {
  const token = await encode({
    token: { value: 'state-value-123', provider: 'eduid' },
    secret: SECRET,
    salt: PARTICIPANT_STATE_COOKIE,
    maxAge: 900,
  })

  // The lecturer configuration decodes with its own cookie name as salt.
  // The HKDF key derivation must make this fail rather than return a payload.
  await assert.rejects(
    decode({ token, secret: SECRET, salt: LECTURER_STATE_COOKIE })
  )
})

test('a state cookie is undecryptable under a different secret', async () => {
  const token = await encode({
    token: { value: 'state-value-123', provider: 'eduid' },
    secret: SECRET,
    salt: PARTICIPANT_STATE_COOKIE,
    maxAge: 900,
  })

  await assert.rejects(
    decode({ token, secret: 'other-secret', salt: PARTICIPANT_STATE_COOKIE })
  )
})

test('an expired state cookie fails verification', async () => {
  const token = await encode({
    token: { value: 'state-value-123', provider: 'eduid' },
    secret: SECRET,
    salt: PARTICIPANT_STATE_COOKIE,
    // Beyond the decoder's 15s clock tolerance.
    maxAge: -120,
  })

  await assert.rejects(
    decode({ token, secret: SECRET, salt: PARTICIPANT_STATE_COOKIE })
  )
})

test('salt-free encode keeps the HS256 session contract with issuer', async () => {
  const token = await encode({
    token: { sub: 'participant-1', role: 'PARTICIPANT' },
    secret: SECRET,
    maxAge: 900,
  })

  assert.equal(token.split('.').length, 3)

  const payload = await decode({ token, secret: SECRET })
  assert.ok(payload)
  assert.equal(payload.sub, 'participant-1')
  assert.equal(payload.role, 'PARTICIPANT')
  assert.equal(payload.iss, 'https://auth.klicker.uzh.ch')

  // Wrong issuer must fail, mirroring the backend's verification.
  process.env.APP_ORIGIN_AUTH = 'https://other.example.com'
  await assert.rejects(decode({ token, secret: SECRET }))
  process.env.APP_ORIGIN_AUTH = 'https://auth.klicker.uzh.ch'
})
