import { NextRequest } from 'next/server'
import { describe, expect, test } from 'vitest'
import { rejectCrossSiteWrite } from '@/src/lib/server/sameOriginWrite'
import { proxy } from '@/src/proxy'

const CHAT_URL = 'https://chat.test/api/chatbots/chatbot-1/disclaimer'

function request(method: string, headers: Record<string, string> = {}) {
  return new NextRequest(CHAT_URL, {
    method,
    headers: { host: 'chat.test', ...headers },
  })
}

describe('rejectCrossSiteWrite', () => {
  test('allows a write whose Origin matches the request host', () => {
    expect(
      rejectCrossSiteWrite(request('POST', { origin: 'https://chat.test' }))
    ).toBeNull()
  })

  test('uses the forwarded host behind a reverse proxy', () => {
    expect(
      rejectCrossSiteWrite(
        request('DELETE', {
          host: 'localhost:3004',
          'x-forwarded-host': 'chat.klicker.ws-1.localhost',
          origin: 'https://chat.klicker.ws-1.localhost',
        })
      )
    ).toBeNull()
  })

  test.each([
    ['another site', 'https://evil.example'],
    ['a sibling Klicker app', 'https://pwa.test'],
    ['an opaque origin', 'null'],
  ])('rejects a write whose Origin is %s', async (_label, origin) => {
    const response = rejectCrossSiteWrite(request('PUT', { origin }))
    expect(response?.status).toBe(403)
  })

  test('falls back to Sec-Fetch-Site when Origin is missing', () => {
    expect(
      rejectCrossSiteWrite(
        request('PATCH', { 'sec-fetch-site': 'same-origin' })
      )
    ).toBeNull()
    expect(
      rejectCrossSiteWrite(request('PATCH', { 'sec-fetch-site': 'cross-site' }))
        ?.status
    ).toBe(403)
    expect(
      rejectCrossSiteWrite(request('PATCH', { 'sec-fetch-site': 'same-site' }))
        ?.status
    ).toBe(403)
  })

  test('allows a write without Origin or Sec-Fetch-Site from non-browser clients', () => {
    expect(rejectCrossSiteWrite(request('POST'))).toBeNull()
  })

  test('leaves safe methods untouched', () => {
    expect(
      rejectCrossSiteWrite(request('GET', { origin: 'https://evil.example' }))
    ).toBeNull()
  })
})

describe('proxy API write guard', () => {
  test('rejects a cross-site API write before it reaches the route', async () => {
    const response = await proxy(
      request('POST', { origin: 'https://evil.example' })
    )
    expect(response.status).toBe(403)
  })

  test('passes a same-origin API write through to the route', async () => {
    const response = await proxy(
      request('POST', { origin: 'https://chat.test' })
    )
    expect(response.headers.get('x-middleware-next')).toBe('1')
  })
})
