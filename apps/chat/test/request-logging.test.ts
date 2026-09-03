import { createLogger } from '@klicker-uzh/logging/node'
import { describe, expect, test } from 'vitest'
import { withRouteLogging } from '../src/lib/server/requestLogging'

function captureLogger(records: Record<string, unknown>[]) {
  return createLogger(
    { service: 'chat', level: 'info', pretty: false },
    {
      write(line: string) {
        records.push(JSON.parse(line) as Record<string, unknown>)
      },
    }
  )
}

describe('chat route logging', () => {
  test('records a fixed route and echoes a validated request ID', async () => {
    const records: Record<string, unknown>[] = []
    const request = new Request(
      'https://chat.example/api/chatbots/secret-id/chat?prompt=private-query',
      {
        method: 'POST',
        headers: {
          authorization: 'Bearer fake-chat-token-logging-canary-20260805',
          'content-type': 'application/json',
          'x-request-id': 'chat-request-123',
        },
        body: JSON.stringify({ messages: ['private-message-canary'] }),
      }
    )

    const response = await withRouteLogging(
      request,
      '/api/chatbots/:chatbotId/chat',
      async () => new Response('private-model-output-canary', { status: 201 }),
      captureLogger(records)
    )

    expect(response.status).toBe(201)
    expect(response.headers.get('x-request-id')).toBe('chat-request-123')
    expect(records).toHaveLength(1)
    expect(records[0]).toMatchObject({
      level: 'info',
      service: 'chat',
      event: 'http.request.completed',
      requestId: 'chat-request-123',
      outcome: 'success',
      http: {
        method: 'POST',
        route: '/api/chatbots/:chatbotId/chat',
        statusCode: 201,
      },
    })
    const output = JSON.stringify(records)
    expect(output).not.toContain('secret-id')
    expect(output).not.toContain('private-query')
    expect(output).not.toContain('fake-chat-token-logging-canary-20260805')
    expect(output).not.toContain('private-message-canary')
    expect(output).not.toContain('private-model-output-canary')
  })

  test.each([
    { status: 400, level: 'info', outcome: 'rejected' },
    { status: 500, level: 'error', outcome: 'failure' },
  ])('uses $level for a $status response', async ({
    status,
    level,
    outcome,
  }) => {
    const records: Record<string, unknown>[] = []
    await withRouteLogging(
      new Request('https://chat.example/api/test'),
      '/api/test',
      async () => new Response(null, { status }),
      captureLogger(records)
    )

    expect(records).toHaveLength(1)
    expect(records[0]).toMatchObject({ level, outcome })
  })

  test('records a safe failure once and preserves thrown errors', async () => {
    const records: Record<string, unknown>[] = []
    const failure = new Error('raw-upstream-error-canary')

    await expect(
      withRouteLogging(
        new Request('https://chat.example/api/test'),
        '/api/test',
        async () => {
          throw failure
        },
        captureLogger(records)
      )
    ).rejects.toBe(failure)

    expect(records).toHaveLength(1)
    expect(records[0]).toMatchObject({
      level: 'error',
      event: 'http.request.completed',
      outcome: 'failure',
    })
    expect(JSON.stringify(records)).not.toContain('raw-upstream-error-canary')
  })

  test('suppresses health completion records', async () => {
    const records: Record<string, unknown>[] = []
    const response = await withRouteLogging(
      new Request('https://chat.example/api/health'),
      '/api/health',
      async () => new Response(null, { status: 200 }),
      captureLogger(records)
    )

    expect(response.headers.get('x-request-id')).toBeTruthy()
    expect(records).toEqual([])
  })
})
