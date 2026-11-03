import crypto from 'node:crypto'
import axios from 'axios'
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from 'vitest'
import { audienceCookieNames } from '../src/lib/authCookies'
import {
  MANAGER_COOKIE_NAME,
  PARTICIPANT_COOKIE_NAME,
} from '../src/lib/constants'
import { decode as jwtDecode, encode as jwtEncode } from '../src/lib/jwt'
import {
  type FakeIdentityProvider,
  helperCalls,
  invokeAuthHandler,
  loadAuthHandler,
  prismaCalls,
  prismaOverrides,
  resetAuthTestState,
  startFakeIdentityProvider,
  testHelpers,
  testPrisma,
} from './helpers/auth'

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

// Only the Prisma client is replaced, plus the two account-handling helpers
// below; next-auth, the JWT implementation and the local provider stay real.
vi.mock('@klicker-uzh/prisma', async () => {
  const { testPrisma } = await import('./helpers/auth')
  return { prisma: testPrisma, default: testPrisma }
})

// The account handlers are the only helpers replaced; every other helper keeps
// its implementation, including the host lists the redirect validation reads.
vi.mock('@/lib/helpers', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/lib/helpers')>()
  const { testHelpers: recordingHelpers } = await import('./helpers/auth')
  return {
    ...actual,
    createOrLinkParticipant: (...args: unknown[]) =>
      recordingHelpers.createOrLinkParticipant(...args),
    createUserAffiliations: (...args: unknown[]) =>
      recordingHelpers.createUserAffiliations(...args),
  }
})

const APP_SECRET = 'test-secret-material-for-klicker-auth'
const AUTH_URL = 'https://auth.klicker.uzh.ch'
const ASSESSMENT_URL = 'https://assessment.klicker.uzh.ch'
const ASSESSMENT_DEEP_LINK = `${ASSESSMENT_URL}/de/course/1`
// An origin-only fallback passes through the redirect callback, which normalizes
// it to the root path of the assessment app.
const ASSESSMENT_ROOT = `${ASSESSMENT_URL}/`
const CLIENT_ID = 'klicker-auth-test-client'
const PROVIDER_ID = 'eduid'
const PARTICIPANT_ID = 'participant-test-1'
const SECURE = true

// The route handler validates APP_ORIGIN_AUTH while the module loads and builds
// the provider configuration per request from the remaining values, so all of
// them are stubbed for the file and restored afterwards. EDUID_WELL_KNOWN is
// added once the local provider is listening (see beforeAll).
vi.stubEnv('APP_SECRET', APP_SECRET)
vi.stubEnv('APP_ORIGIN_AUTH', AUTH_URL)
vi.stubEnv('NEXTAUTH_URL', AUTH_URL)
vi.stubEnv('NEXT_PUBLIC_EDUID_ID', PROVIDER_ID)
vi.stubEnv('NEXT_PUBLIC_ASSESSMENT_URL', ASSESSMENT_URL)
vi.stubEnv('AUTH_STUDENT_ALLOWED_HOSTS', 'assessment.klicker.uzh.ch')
vi.stubEnv('AUTH_LECTURER_ALLOWED_HOSTS', 'manage.klicker.uzh.ch')
vi.stubEnv('EDUID_CLIENT_ID', CLIENT_ID)
vi.stubEnv('EDUID_CLIENT_SECRET', 'test-client-secret')

const participantCookies = audienceCookieNames('participant', SECURE)
const lecturerCookies = audienceCookieNames('lecturer', SECURE)
const CSRF_COOKIE_NAME = '__Host-next-auth.csrf-token'

let identityProvider: FakeIdentityProvider

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
  if (!sessionToken) {
    throw new Error('the participant session cookie must be issued')
  }
  const decoded = await jwtDecode({ token: sessionToken, secret: APP_SECRET })
  expect(decoded?.role).toBe('PARTICIPANT')
  expect(decoded?.sub).toBe(PARTICIPANT_ID)
  // next-auth must pass the session maxAge to the custom encode, so the
  // issued token expires with the session
  expect(Number(decoded?.exp)).toBeGreaterThan(Date.now() / 1000)
  expect(
    result.sessionCookies[MANAGER_COOKIE_NAME],
    'no manager session may be issued for a participant callback'
  ).toBeUndefined()
}

// Provider errors: the identity provider answers with an error parameter
// instead of an authorization code, and the error response still echoes the
// state of the initiation. The verified state cookie therefore decides the
// recovery: a verified participant keeps the participant restart page with the
// bounded error code, while lecturer and unverified attempts stay on the neutral
// restart page. The raw provider-supplied error must reach neither the response
// nor telemetry.
type ProviderErrorCase = {
  name: string
  error: string | string[]
  stateContext: 'participant' | 'lecturer'
  stateParam: 'match' | 'mismatch' | 'missing' | 'duplicate'
  expectedLocation: string
  expectedAudience: 'participant' | 'lecturer' | null
}

const PROVIDER_ERROR_STATE = 'state-provider-error'

const providerErrorCases: ProviderErrorCase[] = [
  {
    name: 'a duplicated provider error retains participant recovery without forwarding its values',
    error: ['access_denied', 'provider diagnostic'],
    stateContext: 'participant',
    stateParam: 'match',
    expectedLocation: '/restart?audience=participant',
    expectedAudience: 'participant',
  },
  {
    name: 'a verified participant provider error is recovered with its error code',
    error: 'access_denied',
    stateContext: 'participant',
    stateParam: 'match',
    expectedLocation: '/restart?audience=participant&error=access_denied',
    expectedAudience: 'participant',
  },
  {
    name: 'a provider outage is recovered for a verified participant',
    error: 'temporarily_unavailable',
    stateContext: 'participant',
    stateParam: 'match',
    expectedLocation:
      '/restart?audience=participant&error=temporarily_unavailable',
    expectedAudience: 'participant',
  },
  {
    name: 'an unbounded provider error is dropped from participant recovery',
    error: 'access denied: user@example.edu',
    stateContext: 'participant',
    stateParam: 'match',
    expectedLocation: '/restart?audience=participant',
    expectedAudience: 'participant',
  },
  {
    name: 'a verified lecturer provider error stays on the neutral restart page',
    error: 'access_denied',
    stateContext: 'lecturer',
    stateParam: 'match',
    expectedLocation: '/restart',
    expectedAudience: 'lecturer',
  },
  {
    name: 'a mismatched state parameter stays neutral on a provider error',
    error: 'access_denied',
    stateContext: 'participant',
    stateParam: 'mismatch',
    expectedLocation: '/restart',
    expectedAudience: null,
  },
  {
    name: 'a missing state parameter stays neutral on a provider error',
    error: 'access_denied',
    stateContext: 'participant',
    stateParam: 'missing',
    expectedLocation: '/restart',
    expectedAudience: null,
  },
  {
    name: 'a duplicated state parameter stays neutral on a provider error',
    error: 'access_denied',
    stateContext: 'participant',
    stateParam: 'duplicate',
    expectedLocation: '/restart',
    expectedAudience: null,
  },
]

describe('participant callback journeys against the real NextAuth handler', () => {
  beforeAll(async () => {
    identityProvider = await startFakeIdentityProvider({ clientId: CLIENT_ID })
    vi.stubEnv('EDUID_WELL_KNOWN', identityProvider.wellKnownUrl)
    // The provider configuration is built per request, but the handler module
    // has to load with the environment above first.
    await loadAuthHandler()
  })

  afterAll(async () => {
    await identityProvider.close()
    vi.unstubAllEnvs()
  })

  beforeEach(() => {
    resetAuthTestState()
    identityProvider.clearTokenRequests()
    identityProvider.setTokenOutcome('invalid_grant')
  })

  test('a failing token exchange recovers into the participant restart page', async () => {
    const state = 'state-token-exchange-failure'
    const result = await invokeAuthHandler({
      query: callbackQuery(state),
      cookies: await participantCallbackCookies(state),
      headers: { host: 'auth.klicker.uzh.ch' },
    })

    // The real exchange ran and failed, so next-auth answered with its own
    // redirect instead of throwing.
    expect(identityProvider.tokenRequests).toHaveLength(1)
    expect(result.statusCode).toBe(302)
    expect(result.location).toBe(
      '/restart?audience=participant&error=OAuthCallback'
    )
    expect(
      !result.location?.includes('/signin') &&
        !result.location?.includes('/error'),
      'recovery must not enter the generic sign-in journey'
    ).toBe(true)

    // The verified audience is carried into the recovery and into telemetry.
    expect(eventNames(result)).toContain('auth.callback_context')
    expect(
      result.telemetry.find((event) => event.event === 'auth.callback_context')
        ?.audience
    ).toBe('participant')
    const recovery = result.telemetry.find(
      (event) => event.event === 'auth.failure_recovery'
    )
    expect(recovery?.audience).toBe('participant')
    expect(recovery?.outcome).toBe('participant_restart')
    expect(recovery?.errorCategory).toBe('OAuthCallback')

    // No account handling and no session of either audience.
    expect(helperCalls).toEqual([])
    expect(prismaCalls).toEqual([])
    expect(result.sessionCookies[PARTICIPANT_COOKIE_NAME]).toBeUndefined()
    expect(result.sessionCookies[MANAGER_COOKIE_NAME]).toBeUndefined()
  })

  test('NextAuth failures omit secret sentinels and request-controlled log fields', async () => {
    const markers = {
      requestId: 'auth-log-request-id-secret',
      path: 'auth-log-path-secret',
      cookie: 'auth-log-cookie-secret',
      code: 'auth-log-code-secret',
      provider: 'auth-log-provider-secret',
      referer: 'auth-log-referer-secret',
    }
    const state = 'state-auth-log-failure'
    const cookies = await participantCallbackCookies(state)
    cookies[participantCookies.pkceCodeVerifier] = markers.cookie

    const unhandledConsole: string[] = []
    const captureUnhandled = (...args: unknown[]) => {
      unhandledConsole.push(args.map(String).join(' '))
    }
    const infoSpy = vi
      .spyOn(console, 'info')
      .mockImplementation(captureUnhandled)
    const debugSpy = vi
      .spyOn(console, 'debug')
      .mockImplementation(captureUnhandled)

    let failedCallback:
      | Awaited<ReturnType<typeof invokeAuthHandler>>
      | undefined
    let providerProbe: Awaited<ReturnType<typeof invokeAuthHandler>> | undefined
    try {
      failedCallback = await invokeAuthHandler({
        query: { ...callbackQuery(state), code: markers.code },
        cookies,
        url: `/api/auth/callback/${markers.path}?token=${markers.path}`,
        headers: {
          host: 'auth.klicker.uzh.ch',
          'x-request-id': markers.requestId,
          referer: `${AUTH_URL}/${markers.referer}`,
        },
      })
      providerProbe = await invokeAuthHandler({
        query: { nextauth: ['csrf', markers.provider] },
        url: `/api/auth/${markers.path}?provider=${markers.provider}`,
        headers: {
          host: 'auth.klicker.uzh.ch',
          'x-request-id': markers.requestId,
        },
      })
    } finally {
      infoSpy.mockRestore()
      debugSpy.mockRestore()
    }

    expect(failedCallback?.location).toBe(
      '/restart?audience=participant&error=OAuthCallback'
    )
    const libraryError = failedCallback?.telemetry.find(
      (event) => event.event === 'auth.nextauth_error'
    )
    expect(libraryError?.outcome).toBe('library_error')
    expect(libraryError?.errorCategory).toBe('oauth_callback')

    const request = failedCallback?.telemetry.find(
      (event) => event.event === 'auth.request'
    )
    expect(request?.requestId).toMatch(/^na-[a-f0-9]{12}$/)
    expect(request?.route).toBe('/api/auth/[...nextauth]')
    expect(request).not.toHaveProperty('path')

    const providerRequest = providerProbe?.telemetry.find(
      (event) => event.event === 'auth.request'
    )
    expect(providerRequest?.providerId).toBe('other')
    expect(providerRequest?.route).toBe('/api/auth/[...nextauth]')

    const output = JSON.stringify({
      failedCallback,
      providerProbe,
      unhandledConsole,
    })
    for (const marker of Object.values(markers)) {
      expect(output).not.toContain(marker)
    }
  })

  test('participant account-link failures omit helper error messages', async () => {
    const marker = 'auth-log-participant-link-error-secret'
    identityProvider.setTokenOutcome('success')
    testHelpers.createOrLinkParticipant = async () => {
      throw new Error(marker)
    }
    const state = 'state-account-link-log-failure'
    const result = await invokeAuthHandler({
      query: callbackQuery(state),
      cookies: await participantCallbackCookies(state),
      url: '/api/auth/callback/eduid',
      headers: { host: 'auth.klicker.uzh.ch' },
    })

    const failure = result.telemetry.find(
      (event) =>
        event.event === 'auth.account_handling' &&
        event.outcome === 'participant_link_failed'
    )
    expect(failure?.errorCategory).toBe('database')
    expect(result.sessionCookies[PARTICIPANT_COOKIE_NAME]).toBeUndefined()
    expect(JSON.stringify(result)).not.toContain(marker)
  })

  test('real invitation helper failures log bounded outcomes without payload data', async () => {
    const markers = {
      email: 'auth-log-email-secret@example.invalid',
      database: 'auth-log-database-error-secret',
      notification: 'auth-log-notification-error-secret',
    }
    const actualHelpers =
      await vi.importActual<typeof import('../src/lib/helpers')>(
        '../src/lib/helpers'
      )
    const output: string[] = []
    const capture = (...args: unknown[]) => {
      output.push(args.map(String).join(' '))
    }
    const spies = [
      vi.spyOn(console, 'log').mockImplementation(capture),
      vi.spyOn(console, 'error').mockImplementation(capture),
      vi.spyOn(console, 'warn').mockImplementation(capture),
      vi.spyOn(console, 'info').mockImplementation(capture),
      vi.spyOn(console, 'debug').mockImplementation(capture),
    ]
    const axiosPost = vi
      .spyOn(axios, 'post')
      .mockRejectedValue(new Error(markers.notification))
    const teamsWebhook = process.env.TEAMS_WEBHOOK_URL
    vi.stubEnv('TEAMS_WEBHOOK_URL', 'https://example.invalid/webhook')
    prismaOverrides['participantInvitation.findMany'] = async () => {
      throw new Error(markers.database)
    }

    try {
      const failed = await actualHelpers.autoAcceptInvitations(
        testPrisma as never,
        {
          profileEmails: [],
          affiliationEmails: [markers.email],
          allEmails: [markers.email],
        },
        'synthetic-participant'
      )
      expect(failed).toBe(0)

      prismaOverrides['participantInvitation.findMany'] = async () => []
      const empty = await actualHelpers.autoAcceptInvitations(
        testPrisma as never,
        {
          profileEmails: [],
          affiliationEmails: [markers.email],
          allEmails: [markers.email],
        },
        'synthetic-participant'
      )
      expect(empty).toBe(0)
      expect(axiosPost).not.toHaveBeenCalled()

      prismaOverrides['participantInvitation.findMany'] = async () => [
        { id: 'synthetic-invitation', courseId: 'synthetic-course' },
      ]
      prismaOverrides['participation.upsert'] = async () => ({})
      prismaOverrides['participantInvitation.update'] = async () => ({})

      const accepted = await actualHelpers.autoAcceptInvitations(
        testPrisma as never,
        {
          profileEmails: [],
          affiliationEmails: [markers.email],
          allEmails: [markers.email],
        },
        'synthetic-participant'
      )
      expect(accepted).toBe(1)
      expect(axiosPost).toHaveBeenCalledTimes(1)
    } finally {
      axiosPost.mockRestore()
      for (const spy of spies) spy.mockRestore()
      vi.stubEnv('TEAMS_WEBHOOK_URL', teamsWebhook)
    }

    const emitted = output.flatMap((line) => {
      try {
        return [JSON.parse(line) as Record<string, unknown>]
      } catch {
        return []
      }
    })
    const serialized = JSON.stringify(output)
    for (const marker of Object.values(markers)) {
      expect(serialized).not.toContain(marker)
    }
    expect(
      emitted.some(
        (event) =>
          event.event === 'auth.helper.invitation' &&
          event.outcome === 'invitation_processing_failed' &&
          event.errorCategory === 'database'
      )
    ).toBe(true)
    expect(
      emitted.some(
        (event) =>
          event.event === 'auth.helper.invitation' &&
          event.outcome === 'pending_invitations_found'
      )
    ).toBe(true)
    expect(
      emitted.some(
        (event) =>
          event.event === 'auth.helper.invitation' &&
          event.outcome === 'no_pending_invitations'
      )
    ).toBe(true)
    expect(
      emitted.some(
        (event) =>
          event.event === 'auth.helper.notification' &&
          event.outcome === 'notification_failed' &&
          event.errorCategory === 'notification'
      )
    ).toBe(true)
    expect(
      emitted.every((event) =>
        /^na-[a-f0-9]{12}$/.test(String(event.requestId))
      )
    ).toBe(true)
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

    expect(
      identityProvider.tokenRequests,
      'the exchange must not be attempted without valid PKCE material'
    ).toHaveLength(0)
    expect(result.statusCode).toBe(302)
    expect(result.location).toBe(
      '/restart?audience=participant&error=OAuthCallback'
    )
    expect(helperCalls).toEqual([])
    expect(result.sessionCookies[MANAGER_COOKIE_NAME]).toBeUndefined()
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
    expect(result.statusCode).toBe(302)
    expect(
      result.location?.startsWith(`${identityProvider.issuer}/authorize?`),
      `expected an authorization request, received ${result.location}`
    ).toBe(true)
    expect(result.sessionCookies[participantCookies.state]).toBeTruthy()
    expect(
      result.sessionCookies[participantCookies.pkceCodeVerifier]
    ).toBeTruthy()
    expect(result.sessionCookies[lecturerCookies.state]).toBeUndefined()
    expect(
      result.sessionCookies[lecturerCookies.pkceCodeVerifier]
    ).toBeUndefined()
    expect(result.sessionCookies[MANAGER_COOKIE_NAME]).toBeUndefined()
  })

  test('a participant callback without a stored destination returns to the assessment root', async () => {
    const result = await runSuccessfulParticipantCallback({
      state: 'state-missing-destination',
    })

    expect(result.statusCode).toBe(302)
    expect(result.location).toBe(ASSESSMENT_ROOT)
    await assertParticipantPrincipal(result)

    const destination = result.telemetry.find(
      (event) => event.event === 'auth.callback_destination'
    )
    expect(destination?.audience).toBe('participant')
    expect(destination?.outcome).toBe('default')
    expect(destination?.errorCategory).toBe('missing')
  })

  test('a stored deep link is preserved as the participant destination', async () => {
    const result = await runSuccessfulParticipantCallback({
      state: 'state-stored-deep-link',
      storedTarget: ASSESSMENT_DEEP_LINK,
    })

    expect(result.location).toBe(ASSESSMENT_DEEP_LINK)
    await assertParticipantPrincipal(result)

    const destination = result.telemetry.find(
      (event) => event.event === 'auth.callback_destination'
    )
    expect(destination?.outcome).toBe('stored')
  })

  test('an invalid stored destination falls back to the assessment root', async () => {
    const result = await runSuccessfulParticipantCallback({
      state: 'state-invalid-destination',
      // The lecturer-facing management app is not a participant destination.
      storedTarget: 'https://manage.klicker.uzh.ch/',
    })

    expect(result.statusCode).toBe(302)
    expect(result.location).toBe(ASSESSMENT_ROOT)
    await assertParticipantPrincipal(result)
  })

  test('the auth homepage is not accepted as a participant destination', async () => {
    const result = await runSuccessfulParticipantCallback({
      state: 'state-auth-root-destination',
      storedTarget: `${AUTH_URL}/`,
    })

    expect(result.statusCode).toBe(302)
    expect(result.location).toBe(ASSESSMENT_ROOT)
    await assertParticipantPrincipal(result)
  })

  for (const providerError of providerErrorCases) {
    test(providerError.name, async () => {
      const stateCookies =
        providerError.stateContext === 'lecturer'
          ? {
              [lecturerCookies.state]: await temporaryCookie(
                lecturerCookies.state,
                PROVIDER_ERROR_STATE
              ),
            }
          : await participantCallbackCookies(PROVIDER_ERROR_STATE)

      const stateParam =
        providerError.stateParam === 'missing'
          ? undefined
          : providerError.stateParam === 'mismatch'
            ? 'state-provider-error-unrelated'
            : providerError.stateParam === 'duplicate'
              ? [PROVIDER_ERROR_STATE, PROVIDER_ERROR_STATE]
              : PROVIDER_ERROR_STATE

      const result = await invokeAuthHandler({
        query: {
          nextauth: ['callback', PROVIDER_ID],
          ...(stateParam === undefined ? {} : { state: stateParam }),
          error: providerError.error,
        },
        cookies: stateCookies,
        headers: { host: 'auth.klicker.uzh.ch' },
      })

      expect(result.statusCode).toBe(302)
      expect(result.location).toBe(providerError.expectedLocation)

      // Whatever the state resolved to, a provider error never exchanges a
      // code, handles an account or issues a session.
      expect(identityProvider.tokenRequests).toHaveLength(0)
      expect(helperCalls).toEqual([])
      expect(prismaCalls).toEqual([])
      expect(result.sessionCookies[PARTICIPANT_COOKIE_NAME]).toBeUndefined()
      expect(result.sessionCookies[MANAGER_COOKIE_NAME]).toBeUndefined()

      // The verified audience is recorded, while the raw provider error is
      // written to neither the response nor telemetry.
      const rejected = result.telemetry.find(
        (event) => event.event === 'auth.callback_rejected'
      )
      expect(rejected?.outcome).toBe('provider_error')
      expect(rejected?.audience).toBe(providerError.expectedAudience)
      expect(
        !JSON.stringify(result.telemetry).includes(String(providerError.error)),
        'telemetry must not carry the provider-supplied error'
      ).toBe(true)
    })
  }
})
