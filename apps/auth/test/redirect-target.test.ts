import { describe, expect, test } from 'vitest'
import { hostFromUrl, validateRedirectTarget } from '../src/lib/redirectTarget'

const STUDENT_HOSTS = ['assessment.klicker.uzh.ch', 'localhost:3001']

describe('redirect target validation', () => {
  test('accepts absolute targets on allowed hosts and preserves deep links', () => {
    const result = validateRedirectTarget(
      'https://assessment.klicker.uzh.ch/course/123?quiz=abc',
      STUDENT_HOSTS,
      { secure: true }
    )
    expect(result.ok).toBe(true)
    expect(result.url).toBe(
      'https://assessment.klicker.uzh.ch/course/123?quiz=abc'
    )
  })

  test('rejects missing, oversized and malformed targets', () => {
    expect(
      validateRedirectTarget(null, STUDENT_HOSTS, { secure: true })
    ).toEqual({ ok: false, reason: 'missing' })
    expect(
      validateRedirectTarget('not a URL', STUDENT_HOSTS, { secure: true })
    ).toEqual({ ok: false, reason: 'malformed' })
    expect(
      validateRedirectTarget(
        `https://assessment.klicker.uzh.ch/${'a'.repeat(3000)}`,
        STUDENT_HOSTS,
        { secure: true }
      )
    ).toEqual({ ok: false, reason: 'oversized' })
  })

  test('rejects URL credentials and non-http(s) schemes', () => {
    expect(
      validateRedirectTarget(
        'https://user:pass@assessment.klicker.uzh.ch/',
        STUDENT_HOSTS,
        { secure: true }
      )
    ).toEqual({ ok: false, reason: 'credentials' })
    expect(
      validateRedirectTarget('javascript:alert(1)', STUDENT_HOSTS, {
        secure: true,
      })
    ).toEqual({ ok: false, reason: 'scheme' })
    expect(
      validateRedirectTarget('data:text/html,hello', STUDENT_HOSTS, {
        secure: true,
      })
    ).toEqual({ ok: false, reason: 'scheme' })
  })

  test('rejects non-HTTPS targets in production', () => {
    // A loopback host keeps this assertion on the scheme rule; whether the host
    // is allow-listed is covered by the host tests below.
    expect(
      validateRedirectTarget('http://localhost:3001/', STUDENT_HOSTS, {
        secure: true,
      })
    ).toEqual({ ok: false, reason: 'insecure' })
    // Development (secure: false) keeps the existing localhost behavior.
    const dev = validateRedirectTarget(
      'http://localhost:3001/assessment',
      STUDENT_HOSTS,
      { secure: false }
    )
    expect(dev.ok).toBe(true)
  })

  test('rejects disallowed hosts and subdomain spoofing outside the suffix', () => {
    expect(
      validateRedirectTarget('https://manage.klicker.uzh.ch/', STUDENT_HOSTS, {
        secure: true,
      })
    ).toEqual({ ok: false, reason: 'host' })
    expect(
      validateRedirectTarget(
        'https://assessment.klicker.uzh.ch.evil.example/',
        STUDENT_HOSTS,
        { secure: true }
      )
    ).toEqual({ ok: false, reason: 'host' })
  })

  test('hostFromUrl reduces destinations to their host', () => {
    expect(hostFromUrl('https://assessment.klicker.uzh.ch/path?q=1')).toBe(
      'assessment.klicker.uzh.ch'
    )
    expect(hostFromUrl('not a URL')).toBeNull()
    expect(hostFromUrl(null)).toBeNull()
  })
})
