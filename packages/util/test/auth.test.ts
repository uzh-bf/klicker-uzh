import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  COOKIE_NAMES,
  cookieName,
  cookieSecurityOptions,
  cookiesAvailableViaLtiProbe,
  deriveCookieDomainFromURL,
  extractBearerToken,
  extractProviderFromAffiliationId,
  generateRandomString,
  liveQuizPinCookieName,
  parseCookiesHeader,
  parseCsvHosts,
  reduceCatalyst,
} from '../src/auth.js'

describe('Auth helpers', () => {
  afterEach(() => vi.unstubAllEnvs())

  describe('cookieName', () => {
    it('keeps the central raw cookie-name contract', () => {
      expect(COOKIE_NAMES.NEXT_AUTH_MANAGER_SESSION).toBe(
        'next-auth.session-token'
      )
      expect(COOKIE_NAMES.NEXT_AUTH_PARTICIPANT_SESSION).toBe(
        'next-auth.participant-session-token'
      )
      expect(COOKIE_NAMES.NEXT_AUTH_CSRF_TOKEN).toBe('next-auth.csrf-token')
      expect(COOKIE_NAMES.NEXT_AUTH_AUDIENCE).toEqual({
        participant: 'next-auth.participant',
        lecturer: 'next-auth.lecturer',
      })
      expect(COOKIE_NAMES.PWA_CHAT_EMBED_SESSION).toBe('chat_pwa_embed_token')
    })

    it('preserves exact legacy names when the namespace is empty', () => {
      expect(cookieName(COOKIE_NAMES.PARTICIPANT_TOKEN, '')).toBe(
        COOKIE_NAMES.PARTICIPANT_TOKEN
      )
      expect(cookieName('__Host-next-auth.csrf-token', '')).toBe(
        '__Host-next-auth.csrf-token'
      )
    })

    it('keeps namespaces disjoint and preserves browser prefixes', () => {
      for (const name of [
        COOKIE_NAMES.PARTICIPANT_TOKEN,
        '__Secure-next-auth.state',
        '__Host-next-auth.csrf-token',
      ]) {
        const first = cookieName(name, 'runtime-a')
        const second = cookieName(name, 'runtime-b')
        expect(first).not.toBe(second)
        expect(first).toContain('klicker-runtime-a.')
        for (const prefix of ['__Secure-', '__Host-']) {
          expect(first.startsWith(prefix)).toBe(name.startsWith(prefix))
        }
      }
    })

    it('rejects invalid IDs before emitting a cookie name', () => {
      for (const id of [
        'Uppercase',
        '../branch',
        '-branch',
        'branch-',
        'a'.repeat(33),
        'a; Domain=example.com',
      ]) {
        expect(() => cookieName(COOKIE_NAMES.PARTICIPANT_TOKEN, id)).toThrow(
          'KLICKER_COOKIE_NAMESPACE must be a lowercase ID of 1-32 characters'
        )
      }
    })

    it('resolves the runtime namespace lazily', () => {
      vi.stubEnv('KLICKER_COOKIE_NAMESPACE', 'runtime-a')
      expect(cookieName(COOKIE_NAMES.PARTICIPANT_TOKEN)).toBe(
        'klicker-runtime-a.participant_token'
      )
      expect(liveQuizPinCookieName('quiz-id')).toBe(
        'klicker-runtime-a.live-quiz-pin-quiz-id'
      )
    })

    it('rejects a nonempty legacy preview ID at name resolution', () => {
      vi.stubEnv('NEXT_PUBLIC_PREVIEW_ID', 'preview-a')
      expect(() =>
        cookieName(COOKIE_NAMES.PARTICIPANT_TOKEN, 'runtime-a')
      ).toThrow(
        'NEXT_PUBLIC_PREVIEW_ID is no longer supported; ' +
          'use KLICKER_COOKIE_NAMESPACE'
      )
    })
  })

  describe('parseCookiesHeader', () => {
    it('parses and decodes cookie header pairs', () => {
      const header = 'a=1; b=hello%20world; c=with=equals; d=;  e=%'
      const cookies = parseCookiesHeader(header)
      expect(cookies['a']).toBe('1')
      expect(cookies['b']).toBe('hello world')
      // value with equals is preserved after first '='
      expect(cookies['c']).toBe('with=equals')
      // empty value
      expect(cookies['d']).toBe('')
      // invalid encoding falls back to raw
      expect(cookies['e']).toBe('%')
    })
  })

  describe('parseCsvHosts', () => {
    it('splits, trims and filters empty values', () => {
      expect(parseCsvHosts('  a.com, b.com , , c.com ')).toEqual([
        'a.com',
        'b.com',
        'c.com',
      ])
      expect(parseCsvHosts(undefined)).toEqual([])
      expect(parseCsvHosts(null as unknown as string)).toEqual([])
      expect(parseCsvHosts('')).toEqual([])
    })
  })

  describe('extractProviderFromAffiliationId', () => {
    it('extracts first domain label as provider', () => {
      expect(extractProviderFromAffiliationId('user@df.uzh.ch')).toBe('df')
      expect(extractProviderFromAffiliationId('user@ifi.uzh.ch')).toBe('ifi')
      expect(extractProviderFromAffiliationId('user@uzh.ch')).toBe('uzh')
    })

    it('returns null for malformed inputs', () => {
      expect(extractProviderFromAffiliationId('invalid')).toBeNull()
      expect(extractProviderFromAffiliationId('')).toBeNull()
    })
  })

  describe('reduceCatalyst', () => {
    it('returns true for uzh/usz domains', () => {
      expect(reduceCatalyst(false, 'user@df.uzh.ch')).toBe(true)
      expect(reduceCatalyst(false, 'user@usz.ch')).toBe(true)
    })

    it('propagates accumulator for non-matching domains', () => {
      expect(reduceCatalyst(false, 'user@example.com')).toBe(false)
      expect(reduceCatalyst(true, 'user@example.com')).toBe(true)
    })
  })

  describe('generateRandomString', () => {
    it('generates correct length and charset', () => {
      const s = generateRandomString(16)
      expect(s).toHaveLength(16)
      expect(/^[A-Za-z0-9]+$/.test(s)).toBe(true)
    })

    it('likely produces unique values', () => {
      const a = generateRandomString(12)
      const b = generateRandomString(12)
      expect(a).not.toBe(b)
    })
  })

  describe('deriveCookieDomainFromURL', () => {
    it('derives domain for multi-label hosts', () => {
      expect(deriveCookieDomainFromURL('https://auth.klicker.uzh.ch')).toBe(
        'klicker.uzh.ch'
      )
      expect(deriveCookieDomainFromURL('https://auth.example.co.uk')).toBe(
        'example.co.uk'
      )
    })

    it('returns undefined for localhost, IPs, or shallow hosts', () => {
      expect(deriveCookieDomainFromURL('http://localhost:3000')).toBeUndefined()
      expect(deriveCookieDomainFromURL('http://127.0.0.1')).toBeUndefined()
      expect(deriveCookieDomainFromURL('https://example.com')).toBeUndefined()
    })
  })

  describe('extractBearerToken', () => {
    it('extracts bearer tokens case-insensitively and trims whitespace', () => {
      expect(extractBearerToken('Bearer abc.def')).toBe('abc.def')
      expect(extractBearerToken('  bearer   token-value  ')).toBe('token-value')
    })

    it('returns null for empty or non-bearer authorization headers', () => {
      expect(extractBearerToken(null)).toBeNull()
      expect(extractBearerToken('')).toBeNull()
      expect(extractBearerToken('Basic abc')).toBeNull()
      expect(extractBearerToken('Bearer')).toBeNull()
    })
  })

  describe('cookiesAvailableViaLtiProbe', () => {
    it('detects the shared LTI probe cookie', () => {
      vi.stubEnv('KLICKER_COOKIE_NAMESPACE', 'runtime-a')
      const probeName = cookieName(COOKIE_NAMES.LTI_TOKEN)
      expect(cookiesAvailableViaLtiProbe({ [probeName]: '1' })).toBe(true)
      expect(cookiesAvailableViaLtiProbe({ other: '1' })).toBe(false)
      expect(cookiesAvailableViaLtiProbe({ [probeName]: undefined })).toBe(
        false
      )
    })
  })

  describe('cookieSecurityOptions', () => {
    it('returns iframe-safe cookie options in production', () => {
      expect(cookieSecurityOptions({ isProduction: true })).toEqual({
        secure: true,
        sameSite: 'none',
        partitioned: true,
      })
    })

    it('returns local-development cookie options outside production', () => {
      expect(cookieSecurityOptions({ isProduction: false })).toEqual({
        secure: false,
        sameSite: 'lax',
        partitioned: false,
      })
    })
  })
})
