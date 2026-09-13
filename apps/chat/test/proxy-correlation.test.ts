import { resolveRequestContext } from '@klicker-uzh/logging/request'
import { NextRequest } from 'next/server'
import { afterEach, describe, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({
  participantFindUnique: vi.fn(),
}))

vi.mock('@klicker-uzh/prisma', () => ({
  prisma: {
    participant: {
      findUnique: (...args: unknown[]) => mocks.participantFindUnique(...args),
    },
  },
}))
import { signChatGuestToken } from '@/src/lib/server/ltiGuest'
import { proxy as authProxy } from '../../auth/src/proxy'
import { proxy as chatProxy } from '../src/proxy'

afterEach(() => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

mocks.participantFindUnique.mockResolvedValue({
  isActive: true,
  accounts: [{ type: 'credentials' }],
})

const headerCases: Record<string, string>[] = [
  {},
  { 'x-request-id': 'invalid id', 'x-correlation-id': 'invalid id' },
  { 'x-request-id': 'request-1', 'x-correlation-id': 'correlation-1' },
]

describe.each([
  ['Auth', authProxy, 'https://auth.test/api/auth/session'],
  ['Chat', chatProxy, 'https://chat.test/api/chatbots/synthetic/credits'],
] as const)('%s proxy diagnostic propagation', (_name, proxy, url) => {
  it('echoes validated diagnostic IDs on every response', async (ctx) => {
    for (const headers of headerCases) {
      const requestHeaders = new Headers(headers)
      requestHeaders.set('cookie', 'synthetic_cookie=preserved')
      const response = await proxy(
        new NextRequest(url, { headers: requestHeaders })
      )
      const requestId = response.headers.get('x-request-id')
      const correlationId = response.headers.get('x-correlation-id')
      expect(requestId).toMatch(/^[A-Za-z0-9._-]{1,128}$/)
      expect(correlationId).toMatch(/^[A-Za-z0-9._-]{1,128}$/)
    }
  })
})

describe('Auth proxy forwards the response IDs to the Node handler', () => {
  it.each(
    headerCases
  )('forwards %j to the forwarded request headers', async (headers) => {
    const requestHeaders = new Headers(headers)
    const response = await authProxy(
      new NextRequest('https://auth.test/api/auth/session', {
        headers: requestHeaders,
      })
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
    expect(nodeContext.requestId).toBe(response.headers.get('x-request-id'))
    expect(nodeContext.correlationId).toBe(
      response.headers.get('x-correlation-id')
    )
  })
})

describe('Chat proxy forwards the response IDs to the Node handler', () => {
  // The chat proxy redirects unauthenticated requests (no forwarded Node
  // handler), so the pass-through is exercised with an authenticated LTI
  // guest token via the `_t` handoff.
  it.each([
    ['invalid ids', 'bad id', 'bad/corr'],
    ['valid ids', 'request-1', 'correlation-1'],
  ])('forwards %s to the pass-through request headers', async (_n, req, corr) => {
    vi.stubEnv('APP_SECRET', 'proxy-correlation-secret')
    const guestToken = await signChatGuestToken('participant-1')
    const requestHeaders = new Headers({
      cookie: 'synthetic_cookie=preserved',
      'x-request-id': req,
      'x-correlation-id': corr,
    })
    const url = 'https://chat.test/chatbots/synthetic/credits?_t=' + guestToken
    const response = await chatProxy(
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
    expect(nodeContext.requestId).toMatch(/^[A-Za-z0-9._-]{1,128}$/)
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
  expect(response.headers.get('x-request-id')).toBe(
    response.headers.get('x-middleware-request-x-request-id')
  )
  expect(response.headers.get('x-middleware-request-x-request-id')).toBe(
    response.headers.get('x-request-id')
  )
})
