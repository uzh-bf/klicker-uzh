import { EventEmitter } from 'node:events'
import type { AddressInfo } from 'node:net'
import { createLogger } from '@klicker-uzh/logging/node'
import express, { type Request, type Response } from 'express'
import { describe, expect, it, vi } from 'vitest'
import { backendServiceName } from '../src/logger.js'
import {
  requestLoggingMiddleware,
  setRequestLogRoute,
} from '../src/requestLogging.js'

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
    route: { path },
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
  it('records a GraphQL middleware mount without Express route metadata', async () => {
    const test = harness()
    const app = express()
    app.use(requestLoggingMiddleware(test.root))
    app.use('/api/graphql', setRequestLogRoute('/api/graphql'), (req, res) => {
      expect(req.route).toBeUndefined()
      res.json({ data: { __typename: 'Query' } })
    })
    const server = app.listen(0, '127.0.0.1')
    try {
      await new Promise<void>((resolve) => server.once('listening', resolve))
      const port = (server.address() as AddressInfo).port
      const response = await fetch(
        `http://127.0.0.1:${port}/api/graphql?token=private`,
        {
          method: 'POST',
          headers: { 'x-correlation-id': 'graphql-correlation' },
        }
      )
      expect(response.status).toBe(200)
      await response.json()
      expect(test.records).toHaveLength(1)
      expect(test.records[0]).toMatchObject({
        correlationId: 'graphql-correlation',
        http: { route: '/api/graphql', statusCode: 200 },
      })
      expect(JSON.stringify(test.records)).not.toContain('private')
    } finally {
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve()))
      )
    }
  })

  it.each([
    '/api/ingestion/resources/:resourceId/versions/:resourceVersion',
    '/api/webhooks/kb-ingestion',
  ])('records the matched KB route template %s', (route) => {
    const test = harness('/private-resource-id')
    requestLoggingMiddleware(test.root)(test.req, test.res, vi.fn())
    test.req.route = { path: route }
    ;(test.res as unknown as EventEmitter).emit('finish')
    expect(test.records[0]).toMatchObject({ http: { route } })
    expect(JSON.stringify(test.records)).not.toContain('private-resource-id')
  })

  it('uses a bounded fallback for unmatched paths', () => {
    const test = harness('/private-resource-id')
    requestLoggingMiddleware(test.root)(test.req, test.res, vi.fn())
    ;(test.res as unknown as EventEmitter).emit('finish')
    expect(test.records[0]).toMatchObject({ http: { route: '/unmatched' } })
  })

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

  it('records server failures at error level', () => {
    const test = harness()
    requestLoggingMiddleware(test.root)(test.req, test.res, vi.fn())
    ;(test.res as unknown as { statusCode: number }).statusCode = 500
    ;(test.res as unknown as EventEmitter).emit('finish')
    expect(test.records).toHaveLength(1)
    expect(test.records[0]).toMatchObject({
      level: 'error',
      event: 'http.request.completed',
      http: { route: '/api/graphql', statusCode: 500 },
    })
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
