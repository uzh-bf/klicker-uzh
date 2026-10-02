import { afterAll, beforeEach, describe, expect, test, vi } from 'vitest'
import { PARTICIPANT_COOKIE_NAME } from '../src/lib/constants'
import { encode as jwtEncode } from '../src/lib/jwt'
import studentSession from '../src/pages/api/student-session'
import {
  invokeApiHandler,
  prismaCalls,
  prismaOverrides,
  resetAuthTestState,
} from './helpers/auth'

// Session lookup journeys for the assessment login UI.
//
// The endpoint has to separate "this credential is not a participant session"
// from "the session status could not be established": reporting a database
// outage as `participant: null` would show a signed-in student as signed out and
// send them through authentication again. The student page relies on the 503 to
// offer a retry instead (see src/pages/student.tsx).

// Only the Prisma client is replaced; the endpoint and its helpers stay the real
// implementation.
vi.mock('@klicker-uzh/prisma', async () => {
  const { testPrisma } = await import('./helpers/auth')
  return { prisma: testPrisma, default: testPrisma }
})

const APP_SECRET = 'test-secret-material-for-klicker-auth'
const AUTH_URL = 'https://auth.klicker.uzh.ch'
const PARTICIPANT_ID = 'participant-test-1'
const PARTICIPANT_EMAIL = 'participant@example.edu'

// The endpoint reads both values per request; stub them for the file and restore
// them afterwards.
vi.stubEnv('APP_SECRET', APP_SECRET)
vi.stubEnv('APP_ORIGIN_AUTH', AUTH_URL)

afterAll(() => {
  vi.unstubAllEnvs()
})

beforeEach(() => {
  resetAuthTestState()
})

function participantToken(
  overrides: Record<string, unknown> = {}
): Promise<string> {
  return jwtEncode({
    token: {
      sub: PARTICIPANT_ID,
      role: 'PARTICIPANT',
      scope: 'EDUID',
      ...overrides,
    },
    secret: APP_SECRET,
  })
}

function invoke(cookies: Record<string, string> = {}) {
  return invokeApiHandler(studentSession, { method: 'GET', cookies })
}

describe('student session lookup', () => {
  test('reports no session without a participant session cookie', async () => {
    const result = await invoke()

    expect(result.statusCode).toBe(200)
    expect(result.jsonBody).toEqual({ participant: null })
    expect(result.headers['cache-control']).toBe('no-store')
    expect(prismaCalls, 'no lookup runs without a token').toEqual([])
  })

  test('reports the participant principal of a valid session token', async () => {
    prismaOverrides['participant.findUnique'] = async () => ({
      id: PARTICIPANT_ID,
      email: PARTICIPANT_EMAIL,
    })

    const result = await invoke({
      [PARTICIPANT_COOKIE_NAME]: await participantToken(),
    })

    expect(result.statusCode).toBe(200)
    expect(result.jsonBody).toEqual({
      participant: { id: PARTICIPANT_ID, email: PARTICIPANT_EMAIL },
    })
    expect(result.headers['cache-control']).toBe('no-store')
  })

  test('reports a service error when the participant lookup fails', async () => {
    prismaOverrides['participant.findUnique'] = async () => {
      throw Object.assign(new Error('cannot reach database server'), {
        code: 'P1001',
      })
    }

    const result = await invoke({
      [PARTICIPANT_COOKIE_NAME]: await participantToken(),
    })

    expect(result.statusCode).toBe(503)
    expect(result.jsonBody).toEqual({
      error: 'session_lookup_unavailable',
    })
    expect(result.headers['cache-control']).toBe('no-store')
    expect(result.headers['retry-after']).toBe('5')

    const lookup = result.telemetry.find(
      (event) => event.event === 'auth.student_session_lookup'
    )
    expect(lookup?.audience).toBe('participant')
    expect(lookup?.outcome).toBe('infrastructure_error')
    expect(lookup?.errorCategory).toBe('P1001')
  })

  test('reports no session for an expired token', async () => {
    const expired = await participantToken({
      exp: Math.floor(Date.now() / 1000) - 60,
    })

    const result = await invoke({ [PARTICIPANT_COOKIE_NAME]: expired })

    expect(result.statusCode).toBe(200)
    expect(result.jsonBody).toEqual({ participant: null })
    expect(prismaCalls, 'an invalid token never reaches the lookup').toEqual([])
  })

  test('reports no session when the participant no longer exists', async () => {
    prismaOverrides['participant.findUnique'] = async () => null

    const result = await invoke({
      [PARTICIPANT_COOKIE_NAME]: await participantToken(),
    })

    expect(result.statusCode).toBe(200)
    expect(result.jsonBody).toEqual({ participant: null })
    expect(
      result.telemetry.some(
        (event) => event.event === 'auth.student_session_lookup'
      ),
      'an established absence is not an infrastructure error'
    ).toBe(false)
  })

  test('reports no session for a token that is not a participant session', async () => {
    const managerToken = await jwtEncode({
      token: { sub: 'user-1', role: 'ADMIN', scope: 'ACCOUNT_OWNER' },
      secret: APP_SECRET,
    })

    const result = await invoke({ [PARTICIPANT_COOKIE_NAME]: managerToken })

    expect(result.statusCode).toBe(200)
    expect(result.jsonBody).toEqual({ participant: null })
    expect(prismaCalls, 'a manager token is not a lookup key').toEqual([])
  })
})
