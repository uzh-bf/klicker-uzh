import assert from 'node:assert/strict'
import test from 'node:test'
import { audienceCookieNames } from '../src/lib/authCookies.ts'
import {
  isProviderErrorCallback,
  parseAuthAction,
  resolveCallbackAudience,
  resolveInitiationAudience,
} from '../src/lib/dispatch.ts'
import { decode, encode } from '../src/lib/jwt.ts'

const SECRET = 'test-secret-material-for-klicker-auth'
const PROVIDER_ID = 'eduid'
const SECURE = true

const PARTICIPANT_STATE = audienceCookieNames('participant', SECURE).state
const LECTURER_STATE = audienceCookieNames('lecturer', SECURE).state

async function makeStateCookie(
  audienceCookieName: string,
  stateValue: string,
  opts: { provider?: string; maxAge?: number } = {}
): Promise<string> {
  return encode({
    token: {
      value: stateValue,
      provider: opts.provider ?? PROVIDER_ID,
    },
    secret: SECRET,
    salt: audienceCookieName,
    maxAge: opts.maxAge ?? 900,
  })
}

function decodeStateCookie(token: string, salt: string) {
  return decode({ token, secret: SECRET, salt })
}

test('parseAuthAction extracts action and provider from path segments', () => {
  assert.deepEqual(parseAuthAction(['signin', 'eduid']), {
    action: 'signin',
    providerId: 'eduid',
  })
  assert.deepEqual(parseAuthAction(['callback', 'eduid']), {
    action: 'callback',
    providerId: 'eduid',
  })
  assert.deepEqual(parseAuthAction(['session']), {
    action: 'session',
    providerId: undefined,
  })
  assert.deepEqual(parseAuthAction(undefined), {
    action: 'unknown',
    providerId: undefined,
  })
  assert.deepEqual(parseAuthAction(['bogus']), {
    action: 'unknown',
    providerId: undefined,
  })
})

test('initiation audience follows the explicit participant parameter', () => {
  assert.equal(
    resolveInitiationAudience({
      action: 'signin',
      providerId: 'eduid',
      query: { participant: 'true' },
    }),
    'participant'
  )
  assert.equal(
    resolveInitiationAudience({
      action: 'signin',
      providerId: 'eduid',
      query: {},
    }),
    'lecturer'
  )
  assert.equal(
    resolveInitiationAudience({
      action: 'signout',
      providerId: undefined,
      query: { participant: 'true' },
    }),
    'participant'
  )
  assert.equal(
    resolveInitiationAudience({
      action: 'signout',
      providerId: undefined,
      query: {},
    }),
    'lecturer'
  )
})

test('delegated credentials sign-in is a fixed lecturer route', () => {
  assert.equal(
    resolveInitiationAudience({
      action: 'signin',
      providerId: 'credentials',
      query: {},
    }),
    'lecturer'
  )
  // Contradictory audience/target input: reject instead of guessing.
  assert.equal(
    resolveInitiationAudience({
      action: 'signin',
      providerId: 'credentials',
      query: { participant: 'true' },
    }),
    null
  )
})

test('generic actions keep the lecturer configuration', () => {
  for (const action of ['session', 'csrf', 'providers', 'error'] as const) {
    assert.equal(
      resolveInitiationAudience({ action, query: { participant: 'true' } }),
      'lecturer'
    )
  }
})

test('callback with a matching participant state cookie resolves participant', async () => {
  const state = 'state-participant-abc'
  const cookieValue = await makeStateCookie(PARTICIPANT_STATE, state)

  const result = await resolveCallbackAudience({
    query: { state },
    cookies: { [PARTICIPANT_STATE]: cookieValue },
    expectedProviderId: PROVIDER_ID,
    candidates: [
      { audience: 'participant', stateCookieName: PARTICIPANT_STATE },
      { audience: 'lecturer', stateCookieName: LECTURER_STATE },
    ],
    decodeStateCookie,
  })
  assert.deepEqual(result, { audience: 'participant' })
})

test('callback with a matching lecturer state cookie resolves lecturer', async () => {
  const state = 'state-lecturer-xyz'
  const cookieValue = await makeStateCookie(LECTURER_STATE, state)

  const result = await resolveCallbackAudience({
    query: { state },
    cookies: { [LECTURER_STATE]: cookieValue },
    expectedProviderId: PROVIDER_ID,
    candidates: [
      { audience: 'participant', stateCookieName: PARTICIPANT_STATE },
      { audience: 'lecturer', stateCookieName: LECTURER_STATE },
    ],
    decodeStateCookie,
  })
  assert.deepEqual(result, { audience: 'lecturer' })
})

test('an attempt issued for one audience cannot be resolved as the other', async () => {
  // The incident's core defect: with lost context the callback defaulted to
  // lecturer. Here a participant-issued state cookie is presented while the
  // participant cookie is missing entirely (expired/cleared): no candidate
  // may match and the result must be a safe failure, not a lecturer default.
  const state = 'state-participant-def'
  const participantCookie = await makeStateCookie(PARTICIPANT_STATE, state)

  const result = await resolveCallbackAudience({
    query: { state },
    cookies: { [PARTICIPANT_STATE]: participantCookie },
    expectedProviderId: PROVIDER_ID,
    candidates: [{ audience: 'lecturer', stateCookieName: LECTURER_STATE }],
    decodeStateCookie,
  })
  assert.deepEqual(result, { audience: null, reason: 'no_state_match' })
})

test('a participant state cookie fails under the lecturer cookie name', async () => {
  // Salt binding: a cookie issued under the participant salt is stored under
  // the lecturer cookie name (name confusion/copy) — decryption must fail.
  const state = 'state-salt-binding'
  const participantCookie = await makeStateCookie(PARTICIPANT_STATE, state)

  const result = await resolveCallbackAudience({
    query: { state },
    cookies: { [LECTURER_STATE]: participantCookie },
    expectedProviderId: PROVIDER_ID,
    candidates: [
      { audience: 'participant', stateCookieName: PARTICIPANT_STATE },
      { audience: 'lecturer', stateCookieName: LECTURER_STATE },
    ],
    decodeStateCookie,
  })
  assert.deepEqual(result, { audience: null, reason: 'no_state_match' })
})

test('overlapping attempts keep their own state and destination', async () => {
  // Both audiences started concurrently: each callback resolves only its
  // own attempt even though both cookies coexist in the browser.
  const participantState = 'state-overlap-participant'
  const lecturerState = 'state-overlap-lecturer'
  const cookies = {
    [PARTICIPANT_STATE]: await makeStateCookie(
      PARTICIPANT_STATE,
      participantState
    ),
    [LECTURER_STATE]: await makeStateCookie(LECTURER_STATE, lecturerState),
  }

  const candidates = [
    { audience: 'participant' as const, stateCookieName: PARTICIPANT_STATE },
    { audience: 'lecturer' as const, stateCookieName: LECTURER_STATE },
  ]

  const participantResult = await resolveCallbackAudience({
    query: { state: participantState },
    cookies,
    expectedProviderId: PROVIDER_ID,
    candidates,
    decodeStateCookie,
  })
  assert.deepEqual(participantResult, { audience: 'participant' })

  const lecturerResult = await resolveCallbackAudience({
    query: { state: lecturerState },
    cookies,
    expectedProviderId: PROVIDER_ID,
    candidates,
    decodeStateCookie,
  })
  assert.deepEqual(lecturerResult, { audience: 'lecturer' })
})

test('expired, tampered and foreign-provider state cookies match nothing', async () => {
  const state = 'state-invalid-cases'
  const expired = await makeStateCookie(PARTICIPANT_STATE, state, {
    maxAge: -120,
  })
  const wrongProvider = await makeStateCookie(PARTICIPANT_STATE, state, {
    provider: 'other-provider',
  })
  const tampered = `${await makeStateCookie(PARTICIPANT_STATE, state)}x`

  const candidates = [
    { audience: 'participant' as const, stateCookieName: PARTICIPANT_STATE },
    { audience: 'lecturer' as const, stateCookieName: LECTURER_STATE },
  ]

  for (const cookieValue of [expired, wrongProvider, tampered]) {
    const result = await resolveCallbackAudience({
      query: { state },
      cookies: { [PARTICIPANT_STATE]: cookieValue },
      expectedProviderId: PROVIDER_ID,
      candidates,
      decodeStateCookie,
    })
    assert.deepEqual(result, { audience: null, reason: 'no_state_match' })
  }
})

test('missing state and duplicate state parameters fail safely', async () => {
  const candidates = [
    { audience: 'participant' as const, stateCookieName: PARTICIPANT_STATE },
    { audience: 'lecturer' as const, stateCookieName: LECTURER_STATE },
  ]

  assert.deepEqual(
    await resolveCallbackAudience({
      query: {},
      cookies: {},
      expectedProviderId: PROVIDER_ID,
      candidates,
      decodeStateCookie,
    }),
    { audience: null, reason: 'invalid_state_param' }
  )

  assert.deepEqual(
    await resolveCallbackAudience({
      query: { state: ['a', 'b'] },
      cookies: {},
      expectedProviderId: PROVIDER_ID,
      candidates,
      decodeStateCookie,
    }),
    { audience: null, reason: 'duplicate_state' }
  )

  assert.deepEqual(
    await resolveCallbackAudience({
      query: { state: 'x'.repeat(600) },
      cookies: {},
      expectedProviderId: PROVIDER_ID,
      candidates,
      decodeStateCookie,
    }),
    { audience: null, reason: 'invalid_state_param' }
  )
})

test('a state value matching both audience cookies is ambiguous and rejected', async () => {
  // A duplicated state value across both cookie namespaces must never
  // resolve to a default audience.
  const state = 'state-ambiguous'
  const cookies = {
    [PARTICIPANT_STATE]: await makeStateCookie(PARTICIPANT_STATE, state),
    [LECTURER_STATE]: await makeStateCookie(LECTURER_STATE, state),
  }

  const result = await resolveCallbackAudience({
    query: { state },
    cookies,
    expectedProviderId: PROVIDER_ID,
    candidates: [
      { audience: 'participant', stateCookieName: PARTICIPANT_STATE },
      { audience: 'lecturer', stateCookieName: LECTURER_STATE },
    ],
    decodeStateCookie,
  })
  assert.deepEqual(result, { audience: null, reason: 'ambiguous_state_match' })
})

test('provider error callbacks are detected for controlled failure', () => {
  assert.equal(
    isProviderErrorCallback({ error: 'access_denied', state: 'x' }),
    true
  )
  assert.equal(isProviderErrorCallback({ state: 'x' }), false)
  assert.equal(isProviderErrorCallback({ error: '' }), true)
  assert.equal(isProviderErrorCallback({ error: ['a', 'b'] }), true)
})
