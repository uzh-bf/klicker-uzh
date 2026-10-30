import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import {
  audienceCookieNames,
  audienceCookieOptions,
  cookieNamePrefix,
  csrfCookieOptions,
  resolveSecureCookies,
} from '../src/lib/authCookies'

describe('audience cookie configuration', () => {
  beforeEach(() => vi.stubEnv('KLICKER_COOKIE_NAMESPACE', ''))
  afterEach(() => vi.unstubAllEnvs())

  test('runtime names remain separate across concurrent environments', () => {
    vi.stubEnv('KLICKER_COOKIE_NAMESPACE', 'runtime-a')
    const first = audienceCookieNames('participant', true)
    const csrf = csrfCookieOptions(true)
    vi.stubEnv('KLICKER_COOKIE_NAMESPACE', 'runtime-b')
    const second = audienceCookieNames('participant', true)
    for (const name of Object.values(first)) {
      expect(Object.values(second)).not.toContain(name)
      expect(name.startsWith('__Secure-')).toBe(true)
    }
    expect(first.state).toBe(
      '__Secure-klicker-runtime-a.next-auth.participant.state'
    )
    expect(csrf.csrfToken?.name).toBe(
      '__Host-klicker-runtime-a.next-auth.csrf-token'
    )
    expect(csrf.csrfToken?.options).toEqual({
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      secure: true,
    })
    vi.stubEnv('KLICKER_COOKIE_NAMESPACE', '')
    expect(csrfCookieOptions(true)).toEqual({})
  })
  test('secure derivation follows the next-auth URL convention', () => {
    expect(resolveSecureCookies('https://auth.klicker.uzh.ch')).toBe(true)
    expect(resolveSecureCookies('http://localhost:3010')).toBe(false)
    expect(resolveSecureCookies()).toBe(false)
    // Explicit override wins over the URL.
    expect(resolveSecureCookies('https://auth.klicker.uzh.ch', 'false')).toBe(
      false
    )
    expect(resolveSecureCookies('http://localhost:3010', 'true')).toBe(true)
  })

  test('cookie name prefix matches next-auth secure cookie convention', () => {
    expect(cookieNamePrefix(true)).toBe('__Secure-')
    expect(cookieNamePrefix(false)).toBe('')
  })

  test('audiences get fully disjoint temporary cookie names', () => {
    const participant = audienceCookieNames('participant', true)
    const lecturer = audienceCookieNames('lecturer', true)

    const participantValues = Object.values(participant)
    const lecturerValues = Object.values(lecturer)
    for (const name of participantValues) {
      expect(lecturerValues.includes(name), `overlap on ${name}`).toBe(false)
      expect(name.startsWith('__Secure-next-auth.participant.')).toBe(true)
    }
    for (const name of lecturerValues) {
      expect(name.startsWith('__Secure-next-auth.lecturer.')).toBe(true)
    }

    const insecure = audienceCookieNames('participant', false)
    expect(insecure.state.startsWith('next-auth.participant.')).toBe(true)
  })

  test('empty namespaces preserve the legacy audience and CSRF contract', () => {
    vi.stubEnv('KLICKER_COOKIE_NAMESPACE', '')

    expect(audienceCookieNames('participant', true)).toEqual({
      state: '__Secure-next-auth.participant.state',
      pkceCodeVerifier: '__Secure-next-auth.participant.pkce.code_verifier',
      nonce: '__Secure-next-auth.participant.nonce',
      callbackUrl: '__Secure-next-auth.participant.callback-url',
    })
    expect(audienceCookieNames('lecturer', false)).toEqual({
      state: 'next-auth.lecturer.state',
      pkceCodeVerifier: 'next-auth.lecturer.pkce.code_verifier',
      nonce: 'next-auth.lecturer.nonce',
      callbackUrl: 'next-auth.lecturer.callback-url',
    })
    expect(csrfCookieOptions(true)).toEqual({})
  })

  test('temporary cookie options are bounded and HttpOnly', () => {
    const options = audienceCookieOptions('participant', true)

    for (const spec of [
      options.state,
      options.pkceCodeVerifier,
      options.nonce,
      options.callbackUrl,
    ]) {
      expect(spec.options.httpOnly).toBe(true)
      expect(spec.options.sameSite).toBe('lax')
      expect(spec.options.path).toBe('/')
      expect(spec.options.secure).toBe(true)
    }

    // State and PKCE lifetimes start at OAuth initiation and are bounded.
    expect(options.state.options.maxAge).toBe(60 * 15)
    expect(options.pkceCodeVerifier.options.maxAge).toBe(60 * 15)
  })

  test('the csrfToken namespace is not overridden (shared by design)', () => {
    const options = audienceCookieOptions('participant', true)
    expect('csrfToken' in options).toBe(false)
    const lecturer = audienceCookieOptions('lecturer', true)
    expect('csrfToken' in lecturer).toBe(false)
    expect('sessionToken' in options).toBe(false)
  })
})
