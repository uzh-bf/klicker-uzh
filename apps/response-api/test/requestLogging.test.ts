import { createLogger } from '@klicker-uzh/logging/node'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { EventEmitter } from 'node:events'
import { describe, expect, it } from 'vitest'
import { responseApiServiceName } from '../src/logger.js'
import { beginNodeRequest } from '../src/requestLogging.js'

function harness(headers: IncomingMessage['headers'] = {}) {
  const records: Record<string, unknown>[] = []
  const responseHeaders = new Map<string, string>()
  const root = createLogger(
    { service: 'response-api-test', environment: 'production' },
    {
      write(line) {
        records.push(JSON.parse(line) as Record<string, unknown>)
      },
    }
  )
  const req = {
    method: 'POST',
    headers,
    url: '/AddResponse?token=private',
  } as IncomingMessage
  const res = Object.assign(new EventEmitter(), {
    setHeader(name: string, value: string) {
      responseHeaders.set(name.toLowerCase(), value)
      return this
    },
  }) as unknown as ServerResponse

  return { records, responseHeaders, root, req, res }
}

describe('beginNodeRequest', () => {
  it('validates identifiers, echoes the request ID, and completes once', () => {
    const test = harness({
      'x-request-id': 'request-1',
      'x-correlation-id': 'correlation-1',
      authorization: 'fake-secret-canary',
      cookie: 'private=cookie',
    })
    const request = beginNodeRequest(
      test.req,
      test.res,
      test.root,
      '/AddResponse'
    )

    request.complete(202)
    request.complete(500)

    expect(request.context).toMatchObject({
      requestId: 'request-1',
      correlationId: 'correlation-1',
    })
    expect(test.responseHeaders.get('x-request-id')).toBe('request-1')
    expect(test.records).toHaveLength(1)
    expect(test.records[0]).toMatchObject({
      level: 'info',
      event: 'http.request.completed',
      http: {
        method: 'POST',
        route: '/AddResponse',
        statusCode: 202,
      },
    })
    const line = JSON.stringify(test.records[0])
    expect(line).not.toContain('fake-secret-canary')
    expect(line).not.toContain('private=cookie')
    expect(line).not.toContain('token=private')
  })

  it('replaces an invalid request ID and logs server failures at error', () => {
    const test = harness({ 'x-request-id': 'invalid request id' })
    const request = beginNodeRequest(
      test.req,
      test.res,
      test.root,
      '/AddResponse'
    )

    request.complete(503)

    expect(request.context.requestId).toMatch(/^[A-Za-z0-9._-]{1,128}$/)
    expect(request.context.correlationId).toBe(request.context.requestId)
    expect(test.records[0]).toMatchObject({ level: 'error' })
  })

  it.each([
    '/healthz',
    '/',
  ] as const)('suppresses completion logging for %s', (route) => {
    const test = harness()
    const request = beginNodeRequest(test.req, test.res, test.root, route)

    request.complete(200)

    expect(test.records).toEqual([])
  })
})

describe('responseApiServiceName', () => {
  it('selects distinct standard and assessment services', () => {
    expect(responseApiServiceName(false)).toBe('response-api')
    expect(responseApiServiceName(true)).toBe('response-api-assessment')
  })
})
