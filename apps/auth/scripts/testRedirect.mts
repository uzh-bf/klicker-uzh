import assert from 'node:assert/strict'
import test from 'node:test'
import { isSameOriginRedirect } from '../src/lib/redirect.ts'

const authUrl = 'https://auth.klicker.uzh.ch'

test('accepts an absolute callback on the auth origin', () => {
  assert.equal(
    isSameOriginRedirect(
      `${authUrl}/discourse_handoff?sso=probe&sig=probe`,
      authUrl
    ),
    true
  )
})

test('rejects relative, external, and malformed callback URLs', () => {
  assert.equal(isSameOriginRedirect('/discourse_handoff', authUrl), false)
  assert.equal(
    isSameOriginRedirect('https://manage.klicker.uzh.ch/', authUrl),
    false
  )
  assert.equal(isSameOriginRedirect('not a URL', authUrl), false)
})
