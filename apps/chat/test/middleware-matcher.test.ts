import { config } from '@/src/middleware'
import { unstable_doesMiddlewareMatch } from 'next/experimental/testing/server'
import { describe, expect, test } from 'vitest'

describe('middleware matcher', () => {
  test('bypasses middleware body buffering only for the bounded Manage chat route', () => {
    expect(
      unstable_doesMiddlewareMatch({
        config,
        url: '/api/manage/chat',
      })
    ).toBe(false)
    expect(
      unstable_doesMiddlewareMatch({
        config,
        url: '/api/manage/proposals/confirm',
      })
    ).toBe(true)
    expect(
      unstable_doesMiddlewareMatch({
        config,
        url: '/manage',
      })
    ).toBe(true)
  })
})
