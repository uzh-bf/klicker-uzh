import { describe, expect, test } from 'vitest'
import { isSameOriginRedirect } from '../src/lib/redirect'

const authUrl = 'https://auth.klicker.uzh.ch'

describe('isSameOriginRedirect', () => {
  test('accepts an absolute callback on the auth origin', () => {
    expect(
      isSameOriginRedirect(
        `${authUrl}/discourse_handoff?sso=probe&sig=probe`,
        authUrl
      )
    ).toBe(true)
  })

  test('rejects relative, external, and malformed callback URLs', () => {
    expect(isSameOriginRedirect('/discourse_handoff', authUrl)).toBe(false)
    expect(
      isSameOriginRedirect('https://manage.klicker.uzh.ch/', authUrl)
    ).toBe(false)
    expect(isSameOriginRedirect('not a URL', authUrl)).toBe(false)
  })
})
