import assert from 'node:assert/strict'
import test from 'node:test'
import {
  hostFromUrl,
  validateRedirectTarget,
} from '../src/lib/redirectTarget.ts'

const STUDENT_HOSTS = ['assessment.klicker.uzh.ch', 'localhost:3001']

test('accepts absolute targets on allowed hosts and preserves deep links', () => {
  const result = validateRedirectTarget(
    'https://assessment.klicker.uzh.ch/course/123?quiz=abc',
    STUDENT_HOSTS,
    { secure: true }
  )
  assert.equal(result.ok, true)
  assert.equal(
    result.url,
    'https://assessment.klicker.uzh.ch/course/123?quiz=abc'
  )
})

test('rejects missing, oversized and malformed targets', () => {
  assert.deepEqual(
    validateRedirectTarget(null, STUDENT_HOSTS, { secure: true }),
    {
      ok: false,
      reason: 'missing',
    }
  )
  assert.deepEqual(
    validateRedirectTarget('not a URL', STUDENT_HOSTS, { secure: true }),
    {
      ok: false,
      reason: 'malformed',
    }
  )
  assert.deepEqual(
    validateRedirectTarget(
      `https://assessment.klicker.uzh.ch/${'a'.repeat(3000)}`,
      STUDENT_HOSTS,
      {
        secure: true,
      }
    ),
    { ok: false, reason: 'oversized' }
  )
})

test('rejects URL credentials and non-http(s) schemes', () => {
  assert.deepEqual(
    validateRedirectTarget(
      'https://user:pass@assessment.klicker.uzh.ch/',
      STUDENT_HOSTS,
      { secure: true }
    ),
    { ok: false, reason: 'credentials' }
  )
  assert.deepEqual(
    validateRedirectTarget('javascript:alert(1)', STUDENT_HOSTS, {
      secure: true,
    }),
    { ok: false, reason: 'scheme' }
  )
  assert.deepEqual(
    validateRedirectTarget('data:text/html,hello', STUDENT_HOSTS, {
      secure: true,
    }),
    { ok: false, reason: 'scheme' }
  )
})

test('rejects non-HTTPS targets in production', () => {
  assert.deepEqual(
    validateRedirectTarget('http://assessment.klicker.uzh.ch/', STUDENT_HOSTS, {
      secure: true,
    }),
    { ok: false, reason: 'insecure' }
  )
  // Development (secure: false) keeps the existing localhost behavior.
  const dev = validateRedirectTarget(
    'http://localhost:3001/assessment',
    STUDENT_HOSTS,
    {
      secure: false,
    }
  )
  assert.equal(dev.ok, true)
})

test('rejects disallowed hosts and subdomain spoofing outside the suffix', () => {
  assert.deepEqual(
    validateRedirectTarget('https://manage.klicker.uzh.ch/', STUDENT_HOSTS, {
      secure: true,
    }),
    { ok: false, reason: 'host' }
  )
  assert.deepEqual(
    validateRedirectTarget(
      'https://assessment.klicker.uzh.ch.evil.example/',
      STUDENT_HOSTS,
      { secure: true }
    ),
    { ok: false, reason: 'host' }
  )
})

test('hostFromUrl reduces destinations to their host', () => {
  assert.equal(
    hostFromUrl('https://assessment.klicker.uzh.ch/path?q=1'),
    'assessment.klicker.uzh.ch'
  )
  assert.equal(hostFromUrl('not a URL'), null)
  assert.equal(hostFromUrl(null), null)
})
