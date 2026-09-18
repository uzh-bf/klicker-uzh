import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import test from 'node:test'
import { audienceCookieNames } from '../src/lib/authCookies.ts'
import {
  MANAGER_COOKIE_NAME,
  PARTICIPANT_COOKIE_NAME,
} from '../src/lib/constants.ts'
import { decode as jwtDecode, encode as jwtEncode } from '../src/lib/jwt.ts'
import {
  type FakeIdentityProvider,
  helperCalls,
  installAuthTestModuleHooks,
  invokeAuthHandler,
  prismaCalls,
  resetAuthTestState,
  startFakeIdentityProvider,
  testHelpers,
} from './lib/authTestHarness.mts'

// Participant callback journeys against the real NextAuth handler.
//
// Both journeys cover a gap that only the library shows: a failure inside
// next-auth is answered with a returned redirect to its generic error and
// sign-in endpoints (which a catch around the handler never sees), and a
// successful callback takes its destination from the callback-URL cookie before
// the application redirect callback runs. The first journey therefore follows a
// participant whose token exchange fails into the recovery page and back into
// participant authentication; the second one completes a participant callback
// with and without a stored destination.

const APP_SECRET = 'test-secret-material-for-klicker-auth'
const AUTH_URL = 'https://auth.klicker.uzh.ch'
const ASSESSMENT_URL = 'https://assessment.klicker.uzh.ch'
const ASSESSMENT_DEEP_LINK = `${ASSESSMENT_URL}/de/course/1`
// An origin-only fallback passes through the redirect callback, which
// normalizes it to the root path of the assessment app.
const ASSESSMENT_ROOT = `${ASSESSMENT_URL}/`
const CLIENT_ID = 'klicker-auth-test-client'
const PROVIDER_ID = 'eduid'
const PARTICIPANT_ID = 'participant-test-1'
const SECURE = true

process.env.APP_SECRET = APP_SECRET
process.env.APP_ORIGIN_AUTH = AUTH_URL
process.env.NEXTAUTH_URL = AUTH_URL
process.env.NEXT_PUBLIC_EDUID_ID = PROVIDER_ID
process.env.NEXT_PUBLIC_ASSESSMENT_URL = ASSESSMENT_URL
process.env.AUTH_STUDENT_ALLOWED_HOSTS = 'assessment.klicker.uzh.ch'
process.env.AUTH_LECTURER_ALLOWED_HOSTS = 'manage.klicker.uzh.ch'
process.env.EDUID_CLIENT_ID = CLIENT_ID
process.env.EDUID_CLIENT_SECRET = 'test-client-secret'

const participantCookies = audienceCookieNames('participant', SECURE)
const lecturerCookies = audienceCookieNames('lecturer', SECURE)
const CSRF_COOKIE_NAME = '__Host-next-auth.csrf-token'

let identityProvider: FakeIdentityProvider

test.before(async () => {
  identityProvider = await startFakeIdentityProvider({ clientId: CLIENT_ID })
  // The provider configuration is built per request, but the harness hooks must
  // be in place before the handler module is imported for the first time.
  process.env.EDUID_WELL_KNOWN = identityProvider.wellKnownUrl
  installAuthTestModuleHooks()
})

test.after(async () => {
  await identityProvider.close()
})

test.beforeEach(() => {
  resetAuthTestState()
  identityProvider.clearTokenRequests()
  identityProvider.setTokenOutcome('invalid_grant')
})

// Temporary OAuth cookies are salted JWEs whose salt is the audience-namespaced
// cookie name (that is what binds a state value to one audience).
function temporaryCookie(name: string, value: string): Promise<string> {
  return jwtEncode({
    token: { value, provider: PROVIDER_ID },
    secret: APP_SECRET,
    salt: name,
    maxAge: 900,
  })
}

function csrfTokenPair(): { token: string; cookie: string } {
  const token = crypto.randomBytes(16).toString('hex')
  const hash = crypto
    .createHash('sha256')
    .update(`${token}${APP_SECRET}`)
    .digest('hex')
  return { token, cookie: `${token}|${hash}` }
}

async function participantCallbackCookies(
  state: string,
  options: { pkceSalt?: string; storedTarget?: string } = {}
): Promise<Record<string, string>> {
  return {
    [participantCookies.state]: await temporaryCookie(
      participantCookies.state,
      state
    ),
    [participantCookies.pkceCodeVerifier]: await temporaryCookie(
      options.pkceSalt ?? participantCookies.pkceCodeVerifier,
      'test-pkce-code-verifier-value'
    ),
    ...(options.storedTarget
      ? { [participantCookies.callbackUrl]: options.storedTarget }
      : {}),
  }
}

function callbackQuery(state: string) {
  return {
    nextauth: ['callback', PROVIDER_ID],
    state,
    code: 'test-authorization-code',
  }
}

function eventNames(result: { telemetry: Record<string, unknown>[] }) {
  return result.telemetry.map((event) => event.event)
}

test('a failing token exchange recovers into the participant restart page', async () => {
  const state = 'state-token-exchange-failure'
  const result = await invokeAuthHandler({
    query: callbackQuery(state),
    cookies: await participantCallbackCookies(state),
    headers: { host: 'auth.klicker.uzh.ch' },
  })

  // The real exchange ran and failed, so next-auth answered with its own
  // redirect instead of throwing.
  assert.equal(identityProvider.tokenRequests.length, 1)
  assert.equal(result.statusCode, 302)
  assert.equal(
    result.location,
    '/restart?audience=participant&error=OAuthCallback'
  )
  assert.ok(
    !result.location?.includes('/signin') &&
      !result.location?.includes('/error'),
    'recovery must not enter the generic sign-in journey'
  )

  // The verified audience is carried into the recovery and into telemetry.
  assert.ok(eventNames(result).includes('auth.callback_context'))
  assert.equal(
    result.telemetry.find((event) => event.event === 'auth.callback_context')
      ?.audience,
    'participant'
  )
  const recovery = result.telemetry.find(
    (event) => event.event === 'auth.failure_recovery'
  )
  assert.equal(recovery?.audience, 'participant')
  assert.equal(recovery?.outcome, 'participant_restart')
  assert.equal(recovery?.errorCategory, 'OAuthCallback')

  // No account handling and no session of either audience.
  assert.deepEqual(helperCalls, [])
  assert.deepEqual(prismaCalls, [])
  assert.equal(result.sessionCookies[PARTICIPANT_COOKIE_NAME], undefined)
  assert.equal(result.sessionCookies[MANAGER_COOKIE_NAME], undefined)
})

test('an invalid PKCE cookie recovers into the participant restart page', async () => {
  const state = 'state-invalid-pkce'
  const result = await invokeAuthHandler({
    query: callbackQuery(state),
    cookies: await participantCallbackCookies(state, {
      // A PKCE verifier issued for the lecturer audience cannot be decrypted
      // under the participant cookie name.
      pkceSalt: lecturerCookies.pkceCodeVerifier,
    }),
    headers: { host: 'auth.klicker.uzh.ch' },
  })

  assert.equal(
    identityProvider.tokenRequests.length,
    0,
    'the exchange must not be attempted without valid PKCE material'
  )
  assert.equal(result.statusCode, 302)
  assert.equal(
    result.location,
    '/restart?audience=participant&error=OAuthCallback'
  )
  assert.deepEqual(helperCalls, [])
  assert.equal(result.sessionCookies[MANAGER_COOKIE_NAME], undefined)
})

test('the recovered retry continues as participant authentication', async () => {
  const { token, cookie } = csrfTokenPair()
  const result = await invokeAuthHandler({
    method: 'POST',
    query: { nextauth: ['signin', PROVIDER_ID], participant: 'true' },
    cookies: { [CSRF_COOKIE_NAME]: cookie },
    headers: { host: 'auth.klicker.uzh.ch' },
    body: { csrfToken: token, callbackUrl: ASSESSMENT_URL },
  })

  // The retry starts a real authorization request against the provider and
  // stores participant-namespaced transaction cookies.
  assert.equal(result.statusCode, 302)
  assert.ok(
    result.location?.startsWith(`${identityProvider.issuer}/authorize?`),
    `expected an authorization request, received ${result.location}`
  )
  assert.ok(result.sessionCookies[participantCookies.state])
  assert.ok(result.sessionCookies[participantCookies.pkceCodeVerifier])
  assert.equal(result.sessionCookies[lecturerCookies.state], undefined)
  assert.equal(
    result.sessionCookies[lecturerCookies.pkceCodeVerifier],
    undefined
  )
  assert.equal(result.sessionCookies[MANAGER_COOKIE_NAME], undefined)
})

async function runSuccessfulParticipantCallback(options: {
  state: string
  storedTarget?: string
}) {
  identityProvider.setTokenOutcome('success')
  testHelpers.createOrLinkParticipant = async () => ({ id: PARTICIPANT_ID })

  return invokeAuthHandler({
    query: callbackQuery(options.state),
    cookies: await participantCallbackCookies(options.state, {
      storedTarget: options.storedTarget,
    }),
    headers: { host: 'auth.klicker.uzh.ch' },
  })
}

async function assertParticipantPrincipal(result: {
  sessionCookies: Record<string, string>
}) {
  const sessionToken = result.sessionCookies[PARTICIPANT_COOKIE_NAME]
  assert.ok(sessionToken, 'the participant session cookie must be issued')
  const decoded = await jwtDecode({ token: sessionToken, secret: APP_SECRET })
  assert.equal(decoded?.role, 'PARTICIPANT')
  assert.equal(decoded?.sub, PARTICIPANT_ID)
  assert.equal(
    result.sessionCookies[MANAGER_COOKIE_NAME],
    undefined,
    'no manager session may be issued for a participant callback'
  )
}

test('a participant callback without a stored destination returns to the assessment root', async () => {
  const result = await runSuccessfulParticipantCallback({
    state: 'state-missing-destination',
  })

  assert.equal(result.statusCode, 302)
  assert.equal(result.location, ASSESSMENT_ROOT)
  await assertParticipantPrincipal(result)

  const destination = result.telemetry.find(
    (event) => event.event === 'auth.callback_destination'
  )
  assert.equal(destination?.audience, 'participant')
  assert.equal(destination?.outcome, 'default')
  assert.equal(destination?.errorCategory, 'missing')
})

test('a stored deep link is preserved as the participant destination', async () => {
  const result = await runSuccessfulParticipantCallback({
    state: 'state-stored-deep-link',
    storedTarget: ASSESSMENT_DEEP_LINK,
  })

  assert.equal(result.location, ASSESSMENT_DEEP_LINK)
  await assertParticipantPrincipal(result)

  const destination = result.telemetry.find(
    (event) => event.event === 'auth.callback_destination'
  )
  assert.equal(destination?.outcome, 'stored')
})

test('an invalid stored destination falls back to the assessment root', async () => {
  const result = await runSuccessfulParticipantCallback({
    state: 'state-invalid-destination',
    // The lecturer-facing management app is not a participant destination.
    storedTarget: 'https://manage.klicker.uzh.ch/',
  })

  assert.equal(result.statusCode, 302)
  assert.equal(result.location, ASSESSMENT_ROOT)
  await assertParticipantPrincipal(result)
})

test('the auth homepage is not accepted as a participant destination', async () => {
  const result = await runSuccessfulParticipantCallback({
    state: 'state-auth-root-destination',
    storedTarget: `${AUTH_URL}/`,
  })

  assert.equal(result.statusCode, 302)
  assert.equal(result.location, ASSESSMENT_ROOT)
  await assertParticipantPrincipal(result)
})
