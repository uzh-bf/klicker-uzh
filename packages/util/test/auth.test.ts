import { describe, expect, it } from 'vitest'
import {
  LTI_PROBE_COOKIE_NAME,
  cookieSecurityOptions,
  cookiesAvailableViaLtiProbe,
  deriveCookieDomainFromURL,
  extractBearerToken,
  extractProviderFromAffiliationId,
  generateRandomString,
  parseCookiesHeader,
  parseCsvHosts,
  reduceCatalyst,
} from '../src/auth.js'

describe('Auth helpers', () => {
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
      expect(
        cookiesAvailableViaLtiProbe({ [LTI_PROBE_COOKIE_NAME]: '1' })
      ).toBe(true)
      expect(cookiesAvailableViaLtiProbe({ other: '1' })).toBe(false)
      expect(
        cookiesAvailableViaLtiProbe({ [LTI_PROBE_COOKIE_NAME]: undefined })
      ).toBe(false)
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
