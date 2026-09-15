import assert from 'node:assert/strict'
import test from 'node:test'
import {
  audienceCookieNames,
  audienceCookieOptions,
  cookieNamePrefix,
  resolveSecureCookies,
} from '../src/lib/authCookies.ts'

test('secure derivation follows the next-auth URL convention', () => {
  assert.equal(resolveSecureCookies('https://auth.klicker.uzh.ch'), true)
  assert.equal(resolveSecureCookies('http://localhost:3010'), false)
  assert.equal(resolveSecureCookies(undefined), false)
  // Explicit override wins over the URL.
  assert.equal(
    resolveSecureCookies('https://auth.klicker.uzh.ch', 'false'),
    false
  )
  assert.equal(resolveSecureCookies('http://localhost:3010', 'true'), true)
})

test('cookie name prefix matches next-auth secure cookie convention', () => {
  assert.equal(cookieNamePrefix(true), '__Secure-')
  assert.equal(cookieNamePrefix(false), '')
})

test('audiences get fully disjoint temporary cookie names', () => {
  const participant = audienceCookieNames('participant', true)
  const lecturer = audienceCookieNames('lecturer', true)

  const participantValues = Object.values(participant)
  const lecturerValues = Object.values(lecturer)
  for (const name of participantValues) {
    assert.ok(!lecturerValues.includes(name), `overlap on ${name}`)
    assert.ok(name.startsWith('__Secure-next-auth.participant.'))
  }
  for (const name of lecturerValues) {
    assert.ok(name.startsWith('__Secure-next-auth.lecturer.'))
  }

  const insecure = audienceCookieNames('participant', false)
  assert.ok(insecure.state.startsWith('next-auth.participant.'))
})

test('temporary cookie options are bounded and HttpOnly', () => {
  const options = audienceCookieOptions('participant', true)

  for (const spec of [
    options.state,
    options.pkceCodeVerifier,
    options.nonce,
    options.callbackUrl,
  ]) {
    assert.equal(spec.options.httpOnly, true)
    assert.equal(spec.options.sameSite, 'lax')
    assert.equal(spec.options.path, '/')
    assert.equal(spec.options.secure, true)
  }

  // State and PKCE lifetimes start at OAuth initiation and are bounded.
  assert.equal(options.state.options.maxAge, 60 * 15)
  assert.equal(options.pkceCodeVerifier.options.maxAge, 60 * 15)
})

test('the csrfToken namespace is not overridden (shared by design)', () => {
  const options = audienceCookieOptions('participant', true)
  assert.equal('csrfToken' in options, false)
  const lecturer = audienceCookieOptions('lecturer', true)
  assert.equal('csrfToken' in lecturer, false)
  assert.equal('sessionToken' in options, false)
})
