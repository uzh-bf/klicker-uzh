import { createLogger } from '@klicker-uzh/logging/node'
import type { Request, Response } from 'express'
import { EventEmitter } from 'node:events'
import { describe, expect, it, vi } from 'vitest'
import { backendServiceName } from '../src/logger.js'
import { requestLoggingMiddleware } from '../src/requestLogging.js'

function harness(path = '/api/graphql') {
  const records: Record<string, unknown>[] = []
  const headers = new Map<string, string>()
  const root = createLogger(
    { service: 'backend-test', environment: 'production' },
    {
      write(line) {
        records.push(JSON.parse(line) as Record<string, unknown>)
      },
    }
  )
  const req = {
    method: 'POST',
    path,
    originalUrl: `${path}?token=private`,
    headers: {
      'x-request-id': 'request-1',
      authorization: 'Bearer fake-secret-canary',
    },
    body: { variables: { answer: 'private' } },
    cookies: { session: 'private' },
    locals: { user: { sub: 'existing-user' } },
  } as unknown as Request
  const emitter = new EventEmitter()
  const res = Object.assign(emitter, {
    statusCode: 200,
    setHeader(name: string, value: string) {
      headers.set(name.toLowerCase(), value)
      return this
    },
  }) as unknown as Response

  return { headers, records, req, res, root }
}

describe('requestLoggingMiddleware', () => {
  it('binds safe request context and records GraphQL completion once', () => {
    const test = harness()
    const next = vi.fn()

    requestLoggingMiddleware(test.root)(test.req, test.res, next)
    ;(test.res as unknown as EventEmitter).emit('finish')
    ;(test.res as unknown as EventEmitter).emit('finish')

    expect(next).toHaveBeenCalledOnce()
    expect(test.req.locals.user).toEqual({ sub: 'existing-user' })
    expect(test.req.locals.requestContext).toMatchObject({
      requestId: 'request-1',
      correlationId: 'request-1',
    })
    expect(test.headers.get('x-request-id')).toBe('request-1')
    expect(test.records).toHaveLength(1)
    expect(test.records[0]).toMatchObject({
      event: 'http.request.completed',
      http: { route: '/api/graphql', statusCode: 200 },
    })
    const line = JSON.stringify(test.records[0])
    expect(line).not.toContain('fake-secret-canary')
    expect(line).not.toContain('token=private')
    expect(line).not.toContain('private')
  })

  it('suppresses health completion records', () => {
    const test = harness('/healthz')
    requestLoggingMiddleware(test.root)(test.req, test.res, vi.fn())
    ;(test.res as unknown as EventEmitter).emit('finish')
    expect(test.records).toEqual([])
  })
})

describe('backendServiceName', () => {
  it('selects distinct standard and assessment services', () => {
    expect(backendServiceName(false)).toBe('backend-graphql')
    expect(backendServiceName(true)).toBe('backend-assessment')
  })
})
