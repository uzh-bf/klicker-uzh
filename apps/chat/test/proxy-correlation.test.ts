import { resolveRequestContext } from '@klicker-uzh/logging/request'
import { NextRequest } from 'next/server'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { proxy as authProxy } from '../../auth/src/proxy'
import { proxy as chatProxy } from '../src/proxy'

afterEach(() => vi.unstubAllEnvs())

const headerCases: Record<string, string>[] = [
  {},
  { 'x-request-id': 'invalid id', 'x-correlation-id': 'invalid id' },
  { 'x-request-id': 'request-1', 'x-correlation-id': 'correlation-1' },
]

describe.each([
  ['Auth', authProxy, 'https://auth.test/api/auth/session'],
  ['Chat', chatProxy, 'https://chat.test/api/chatbots/synthetic/credits'],
] as const)('%s proxy diagnostic propagation', (_name, proxy, url) => {
  it.each(
    headerCases
  )('forwards the response IDs to the Node handler', async (headers) => {
    const requestHeaders = new Headers(headers)
    requestHeaders.set('cookie', 'synthetic_cookie=preserved')
    const response = await proxy(
      new NextRequest(url, { headers: requestHeaders })
    )
    const overrides = response.headers.get('x-middleware-override-headers')
    const forwarded =
      overrides === null ? new Headers(requestHeaders) : new Headers()
    for (const key of (
      response.headers.get('x-middleware-override-headers') ?? ''
    ).split(',')) {
      const value = response.headers.get(`x-middleware-request-${key}`)
      if (value !== null) forwarded.set(key, value)
    }
    const nodeContext = resolveRequestContext({
      requestId: forwarded.get('x-request-id'),
      correlationId: forwarded.get('x-correlation-id'),
    })
    expect(response.headers.get('x-middleware-next')).toBe('1')
    expect(forwarded.get('cookie')).toBe('synthetic_cookie=preserved')
    expect(nodeContext.requestId).toBe(response.headers.get('x-request-id'))
    expect(nodeContext.correlationId).toBe(
      response.headers.get('x-correlation-id')
    )
    expect(nodeContext.correlationId).toMatch(/^[A-Za-z0-9._-]{1,128}$/)
  })
})

it('preserves Manage locale cookies and frame policy while forwarding IDs', async () => {
  vi.stubEnv('ALLOWED_FRAME_ANCESTORS', 'https://manage.test')
  const response = await chatProxy(
    new NextRequest('https://chat.test/manage?locale=de', {
      headers: { cookie: 'synthetic_cookie=preserved' },
    })
  )
  expect(response.headers.get('x-middleware-request-cookie')).toContain(
    'NEXT_LOCALE=de'
  )
  expect(response.headers.get('x-middleware-request-cookie')).toContain(
    'synthetic_cookie=preserved'
  )
  expect(response.cookies.get('NEXT_LOCALE')).toMatchObject({
    value: 'de',
    path: '/manage',
  })
  expect(response.headers.get('content-security-policy')).toBe(
    "frame-ancestors 'self' https://manage.test"
  )
  expect(response.headers.get('x-middleware-request-x-correlation-id')).toBe(
    response.headers.get('x-correlation-id')
  )
  expect(response.headers.get('x-middleware-request-x-request-id')).toBe(
    response.headers.get('x-request-id')
  )
})
