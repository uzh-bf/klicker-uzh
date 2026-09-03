import { createLogger } from '@klicker-uzh/logging/node'
import type { Request, Response } from 'express'
import { describe, expect, test } from 'vitest'
import { createRequestLoggingMiddleware } from '../src/requestLogging.js'

function captureLogger(records: Record<string, unknown>[]) {
  return createLogger(
    { service: 'olat-api', level: 'info', pretty: false },
    {
      write(line: string) {
        records.push(JSON.parse(line) as Record<string, unknown>)
      },
    }
  )
}

function requestLifecycle({
  path,
  headers = {},
}: {
  path: string
  headers?: Record<string, string>
}) {
  const responseHeaders = new Map<string, string>()
  let finish: (() => void) | undefined
  const req = {
    path,
    method: 'POST',
    headers,
  } as unknown as Request
  const res = {
    locals: {},
    statusCode: 200,
    setHeader(name: string, value: string) {
      responseHeaders.set(name, value)
    },
    on(event: string, listener: () => void) {
      if (event === 'finish') finish = listener
      return this
    },
  } as unknown as Response

  return { req, res, responseHeaders, finish: () => finish?.() }
}

describe('OLAT request logging', () => {
  test('uses a fixed route template without logging the API key', async () => {
    const records: Record<string, unknown>[] = []
    const middleware = createRequestLoggingMiddleware(captureLogger(records))
    const lifecycle = requestLifecycle({
      path: '/api/configuration/courses',
      headers: {
        'x-request-id': 'olat-request-123',
        'x-api-key': 'fake-olat-key-logging-canary-20260805',
      },
    })
    let continued = false

    middleware(lifecycle.req, lifecycle.res, () => {
      continued = true
    })
    lifecycle.finish()

    expect(continued).toBe(true)
    expect(lifecycle.responseHeaders.get('x-request-id')).toBe(
      'olat-request-123'
    )
    expect(records).toHaveLength(1)
    expect(records[0]?.event).toBe('http.request.completed')
    expect(records[0]?.requestId).toBe('olat-request-123')
    expect((records[0]?.http as { route?: string } | undefined)?.route).toBe(
      '/api/configuration/courses'
    )
    expect(JSON.stringify(records)).not.toContain(
      'fake-olat-key-logging-canary-20260805'
    )
  })

  test('records server failures at error level', () => {
    const records: Record<string, unknown>[] = []
    const middleware = createRequestLoggingMiddleware(captureLogger(records))
    const lifecycle = requestLifecycle({ path: '/openapi.yaml' })

    middleware(lifecycle.req, lifecycle.res, () => {
      lifecycle.res.statusCode = 500
    })
    lifecycle.finish()

    expect(records).toHaveLength(1)
    expect(records[0]?.level).toBe('error')
    expect(records[0]?.event).toBe('http.request.completed')
    expect(records[0]?.outcome).toBe('failure')
  })

  test('suppresses health-check requests', async () => {
    const records: Record<string, unknown>[] = []
    const middleware = createRequestLoggingMiddleware(captureLogger(records))
    const lifecycle = requestLifecycle({ path: '/health' })
    let continued = false

    middleware(lifecycle.req, lifecycle.res, () => {
      continued = true
    })
    lifecycle.finish()

    expect(continued).toBe(true)
    expect(records).toEqual([])
  })
})
