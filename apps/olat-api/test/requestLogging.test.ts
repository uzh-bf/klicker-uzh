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
  let finishListenerCount = 0
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
    once(event: string, listener: () => void) {
      if (event === 'finish') {
        finishListenerCount += 1
        // Model EventEmitter once semantics: the listener removes itself
        // after the first emission, so repeated finish events stay single.
        finish = () => {
          finish = undefined
          listener()
        }
      }
      return this
    },
  } as unknown as Response

  return {
    req,
    res,
    responseHeaders,
    finishListenerCount: () => finishListenerCount,
    finish: () => finish?.(),
  }
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

  test.each([
    [
      '/api/configuration/course/course-42/activityTypes',
      '/api/configuration/course/:courseID/activityTypes',
    ],
    [
      '/api/configuration/course/course-42/multipleChoice',
      '/api/configuration/course/:courseID/:activityTypeKey',
    ],
  ])('parameterizes %s as a bounded route template', (path, template) => {
    const records: Record<string, unknown>[] = []
    const middleware = createRequestLoggingMiddleware(captureLogger(records))
    const lifecycle = requestLifecycle({ path })

    middleware(lifecycle.req, lifecycle.res, () => {})
    lifecycle.finish()

    expect(records).toHaveLength(1)
    expect((records[0]?.http as { route?: string } | undefined)?.route).toBe(
      template
    )
  })

  test('bounds unmatched paths to the /unmatched route', () => {
    const records: Record<string, unknown>[] = []
    const middleware = createRequestLoggingMiddleware(captureLogger(records))
    const lifecycle = requestLifecycle({ path: '/api/unknown-endpoint' })

    middleware(lifecycle.req, lifecycle.res, () => {})
    lifecycle.finish()

    expect(records).toHaveLength(1)
    expect(records[0]?.event).toBe('http.request.completed')
    expect((records[0]?.http as { route?: string } | undefined)?.route).toBe(
      '/unmatched'
    )
  })

  test('registers the completion record exactly once per response', () => {
    const records: Record<string, unknown>[] = []
    const middleware = createRequestLoggingMiddleware(captureLogger(records))
    const lifecycle = requestLifecycle({ path: '/api/configuration/courses' })

    middleware(lifecycle.req, lifecycle.res, () => {})
    expect(lifecycle.finishListenerCount()).toBe(1)
    lifecycle.finish()
    lifecycle.finish()

    expect(records).toHaveLength(1)
  })

  test('skips the completion record when a failure record owns the response', () => {
    const records: Record<string, unknown>[] = []
    const middleware = createRequestLoggingMiddleware(captureLogger(records))
    const lifecycle = requestLifecycle({ path: '/openapi.yaml' })

    middleware(lifecycle.req, lifecycle.res, () => {
      lifecycle.res.statusCode = 500
      // Mirrors logRequestFailure claiming the HTTP record in src/index.ts.
      lifecycle.res.locals.logFailureRecorded = true
    })
    lifecycle.finish()

    expect(records).toEqual([])
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

  test('suppresses health-check records but still echoes the request id', () => {
    const records: Record<string, unknown>[] = []
    const middleware = createRequestLoggingMiddleware(captureLogger(records))
    const lifecycle = requestLifecycle({
      path: '/health',
      headers: { 'x-request-id': 'olat-health-1' },
    })
    let continued = false

    middleware(lifecycle.req, lifecycle.res, () => {
      continued = true
    })
    lifecycle.finish()

    expect(continued).toBe(true)
    expect(lifecycle.responseHeaders.get('x-request-id')).toBe('olat-health-1')
    expect(records).toEqual([])
  })
})
