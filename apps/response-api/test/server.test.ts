import type { AddressInfo } from 'node:net'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  createResponseServer,
  type ResponseServerDependencies,
  validateResponseServerConfig,
} from '../src/server.js'

const LIVE_QUIZ_ID = '11111111-1111-4111-8111-111111111111'
const PARTICIPANT_ID = '22222222-2222-4222-8222-222222222222'
const SUBMISSION_ID = '33333333-3333-4333-8333-333333333333'
const CORRELATION_TOKEN = 'correlation-token-sensitive'
const PARTICIPANT_TOKEN = 'participant-token-sensitive'
const RAW_ANSWER = 'answer-that-must-not-be-logged'

const servers: ReturnType<typeof createResponseServer>[] = []

afterEach(async () => {
  vi.restoreAllMocks()
  await Promise.all(
    servers
      .splice(0)
      .map(
        (server) =>
          new Promise<void>((resolve, reject) =>
            server.close((error) => (error ? reject(error) : resolve()))
          )
      )
  )
})

function dependencies(
  overrides: Partial<ResponseServerDependencies> = {}
): ResponseServerDependencies {
  return {
    assessmentMode: true,
    allowedOrigins: [],
    appSecret: 'test-secret',
    assessmentApiOrigin: 'https://assessment-api.example.org',
    authOrigin: 'https://auth.example.org',
    now: () => new Date('2026-08-12T12:00:00.000Z'),
    pushEvent: vi.fn().mockResolvedValue({ eventId: 'hatchet-event-1' }),
    verifyToken: vi.fn(async (token) => {
      if (token === CORRELATION_TOKEN) {
        return {
          sub: PARTICIPANT_ID,
          liveQuizId: LIVE_QUIZ_ID,
          instanceId: 7,
        }
      }
      if (token === PARTICIPANT_TOKEN) {
        return {
          sub: PARTICIPANT_ID,
          role: 'PARTICIPANT',
          scope: 'EDUID',
        }
      }
      throw new Error('invalid token')
    }),
    ...overrides,
  }
}

async function startServer(deps: ResponseServerDependencies) {
  const server = createResponseServer(deps)
  servers.push(server)
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const address = server.address() as AddressInfo
  return `http://127.0.0.1:${address.port}`
}

async function submit(baseUrl: string, submissionId = SUBMISSION_ID) {
  return fetch(`${baseUrl}/AddResponse`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      cookie: `next-auth.participant-session-token=${PARTICIPANT_TOKEN}`,
    },
    body: JSON.stringify({
      submissionId,
      correlationKey: CORRELATION_TOKEN,
      liveQuizId: LIVE_QUIZ_ID,
      instanceId: 7,
      response: { value: RAW_ANSWER },
    }),
  })
}

describe('assessment response receipt', () => {
  it('fails startup when required assessment configuration is missing', () => {
    expect(() =>
      validateResponseServerConfig(
        dependencies({
          allowedOrigins: [],
          appSecret: '',
          assessmentApiOrigin: undefined,
          authOrigin: undefined,
        })
      )
    ).toThrow(
      'Assessment response API configuration is incomplete: APP_SECRET, APP_ORIGIN_ASSESSMENT_API, APP_ORIGIN_AUTH, CORS_ALLOWED_ORIGINS'
    )
  })

  it('acknowledges only after Hatchet returns an event ID', async () => {
    const deps = dependencies()
    const baseUrl = await startServer(deps)

    const response = await submit(baseUrl)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toEqual({
      status: 'response_submitted',
      submissionId: SUBMISSION_ID,
      responseTimestamp: Date.parse('2026-08-12T12:00:00.000Z'),
      hatchetEventId: 'hatchet-event-1',
    })
    expect(deps.pushEvent).toHaveBeenCalledWith(
      'response-received:assessment',
      expect.objectContaining({
        submissionId: SUBMISSION_ID,
        correlationId: SUBMISSION_ID,
        participantId: PARTICIPANT_ID,
        receivedAt: '2026-08-12T12:00:00.000Z',
        transportAttemptedAt: '2026-08-12T12:00:00.000Z',
      }),
      { additionalMetadata: { submissionId: SUBMISSION_ID } }
    )
  })

  it('reuses the caller submission ID across a lost-response resend', async () => {
    const pushEvent = vi
      .fn()
      .mockResolvedValueOnce({ eventId: 'hatchet-event-1' })
      .mockResolvedValueOnce({ eventId: 'hatchet-event-2' })
    const deps = dependencies({ pushEvent })
    const baseUrl = await startServer(deps)

    const first = await submit(baseUrl)
    const second = await submit(baseUrl)

    expect(first.status).toBe(200)
    expect(second.status).toBe(200)
    expect(pushEvent).toHaveBeenCalledTimes(2)
    expect(pushEvent.mock.calls.map((call) => call[1])).toEqual([
      expect.objectContaining({ submissionId: SUBMISSION_ID }),
      expect.objectContaining({ submissionId: SUBMISSION_ID }),
    ])
    expect(await second.json()).toEqual(
      expect.objectContaining({
        submissionId: SUBMISSION_ID,
        hatchetEventId: 'hatchet-event-2',
      })
    )
  })

  it('returns a retryable 503 and does not report success on Hatchet failure', async () => {
    const errorLog = vi.spyOn(console, 'error').mockImplementation(() => {})
    const deps = dependencies({
      pushEvent: vi.fn().mockRejectedValue(new Error('transport details')),
    })
    const baseUrl = await startServer(deps)

    const response = await submit(baseUrl)
    const body = await response.json()

    expect(response.status).toBe(503)
    expect(body).toEqual({
      error: 'submission_transport_unavailable',
      submissionId: SUBMISSION_ID,
    })
    const serializedLogs = JSON.stringify(errorLog.mock.calls)
    expect(serializedLogs).not.toContain(RAW_ANSWER)
    expect(serializedLogs).not.toContain(CORRELATION_TOKEN)
    expect(serializedLogs).not.toContain(PARTICIPANT_TOKEN)
    expect(serializedLogs).not.toContain('transport details')
  })

  it('rejects invalid submission IDs before transport', async () => {
    const deps = dependencies()
    const baseUrl = await startServer(deps)

    const response = await submit(baseUrl, 'not-a-uuid')

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: 'invalid_submission_id' })
    expect(deps.pushEvent).not.toHaveBeenCalled()
  })

  it('rejects malformed assessment scope before token verification', async () => {
    const deps = dependencies()
    const baseUrl = await startServer(deps)
    const response = await fetch(`${baseUrl}/AddResponse`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        cookie: `next-auth.participant-session-token=${PARTICIPANT_TOKEN}`,
      },
      body: JSON.stringify({
        submissionId: SUBMISSION_ID,
        correlationKey: CORRELATION_TOKEN,
        liveQuizId: 'not-a-uuid',
        instanceId: '7',
        response: { value: RAW_ANSWER },
      }),
    })

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: 'missing_response' })
    expect(deps.verifyToken).not.toHaveBeenCalled()
    expect(deps.pushEvent).not.toHaveBeenCalled()
  })

  it('rejects a missing participant session before transport', async () => {
    const deps = dependencies()
    const baseUrl = await startServer(deps)
    const response = await fetch(`${baseUrl}/AddResponse`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        submissionId: SUBMISSION_ID,
        correlationKey: CORRELATION_TOKEN,
        liveQuizId: LIVE_QUIZ_ID,
        instanceId: 7,
        response: { value: RAW_ANSWER },
      }),
    })

    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({
      error: 'missing_invalid_assessment_cookie',
    })
    expect(deps.pushEvent).not.toHaveBeenCalled()
  })
})
