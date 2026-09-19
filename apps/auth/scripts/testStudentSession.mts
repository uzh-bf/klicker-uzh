import assert from 'node:assert/strict'
import test from 'node:test'
import { PARTICIPANT_COOKIE_NAME } from '../src/lib/constants.ts'
import { encode as jwtEncode } from '../src/lib/jwt.ts'
import {
  installAuthTestModuleHooks,
  invokeApiHandler,
  prismaCalls,
  prismaOverrides,
  resetAuthTestState,
} from './lib/authTestHarness.mts'

// Session lookup journeys for the assessment login UI.
//
// The endpoint has to separate "this credential is not a participant session"
// from "the session status could not be established": reporting a database
// outage as `participant: null` would show a signed-in student as signed out and
// send them through authentication again. The student page relies on the 503 to
// offer a retry instead (see src/pages/student.tsx).

const APP_SECRET = 'test-secret-material-for-klicker-auth'
const AUTH_URL = 'https://auth.klicker.uzh.ch'
const PARTICIPANT_ID = 'participant-test-1'
const PARTICIPANT_EMAIL = 'participant@example.edu'

process.env.APP_SECRET = APP_SECRET
process.env.APP_ORIGIN_AUTH = AUTH_URL

installAuthTestModuleHooks()
const studentSession = (await import('../src/pages/api/student-session.ts'))
  .default

test.beforeEach(() => {
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

test('reports no session without a participant session cookie', async () => {
  const result = await invoke()

  assert.equal(result.statusCode, 200)
  assert.deepEqual(result.jsonBody, { participant: null })
  assert.equal(result.headers['cache-control'], 'no-store')
  assert.deepEqual(prismaCalls, [], 'no lookup runs without a token')
})

test('reports the participant principal of a valid session token', async () => {
  prismaOverrides['participant.findUnique'] = async () => ({
    id: PARTICIPANT_ID,
    email: PARTICIPANT_EMAIL,
  })

  const result = await invoke({
    [PARTICIPANT_COOKIE_NAME]: await participantToken(),
  })

  assert.equal(result.statusCode, 200)
  assert.deepEqual(result.jsonBody, {
    participant: { id: PARTICIPANT_ID, email: PARTICIPANT_EMAIL },
  })
  assert.equal(result.headers['cache-control'], 'no-store')
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

  assert.equal(result.statusCode, 503)
  assert.deepEqual(result.jsonBody, {
    error: 'session_lookup_unavailable',
  })
  assert.equal(result.headers['cache-control'], 'no-store')
  assert.equal(result.headers['retry-after'], '5')

  const lookup = result.telemetry.find(
    (event) => event.event === 'auth.student_session_lookup'
  )
  assert.equal(lookup?.audience, 'participant')
  assert.equal(lookup?.outcome, 'infrastructure_error')
  assert.equal(lookup?.errorCategory, 'P1001')
})

test('reports no session for an expired token', async () => {
  const expired = await participantToken({
    exp: Math.floor(Date.now() / 1000) - 60,
  })

  const result = await invoke({ [PARTICIPANT_COOKIE_NAME]: expired })

  assert.equal(result.statusCode, 200)
  assert.deepEqual(result.jsonBody, { participant: null })
  assert.deepEqual(prismaCalls, [], 'an invalid token never reaches the lookup')
})

test('reports no session when the participant no longer exists', async () => {
  prismaOverrides['participant.findUnique'] = async () => null

  const result = await invoke({
    [PARTICIPANT_COOKIE_NAME]: await participantToken(),
  })

  assert.equal(result.statusCode, 200)
  assert.deepEqual(result.jsonBody, { participant: null })
  assert.equal(
    result.telemetry.some(
      (event) => event.event === 'auth.student_session_lookup'
    ),
    false,
    'an established absence is not an infrastructure error'
  )
})

test('reports no session for a token that is not a participant session', async () => {
  const managerToken = await jwtEncode({
    token: { sub: 'user-1', role: 'ADMIN', scope: 'ACCOUNT_OWNER' },
    secret: APP_SECRET,
  })

  const result = await invoke({ [PARTICIPANT_COOKIE_NAME]: managerToken })

  assert.equal(result.statusCode, 200)
  assert.deepEqual(result.jsonBody, { participant: null })
  assert.deepEqual(prismaCalls, [], 'a manager token is not a lookup key')
})
