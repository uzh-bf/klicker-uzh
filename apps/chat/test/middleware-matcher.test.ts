import { config, proxy } from '@/src/proxy'
import { NextRequest } from 'next/server'
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
    expect(
      unstable_doesMiddlewareMatch({
        config,
        url: '/preview/chatbot-id',
      })
    ).toBe(true)
  })

  test('lets owner-preview pages reach their Manage-session guard without participant auth', async () => {
    const response = await proxy(
      new NextRequest('https://chat.test/preview/chatbot-id')
    )

    expect(response.headers.get('x-middleware-next')).toBe('1')
  })
})
