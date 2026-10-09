import assert from 'node:assert/strict'
import { after, afterEach, before, describe, it } from 'node:test'
import { signJWT } from '@klicker-uzh/util'
import jwtMiddleware from './jwtMiddleware.js'

const TEST_SECRET = 'synthetic-session-recovery-secret'
const FOREIGN_SECRET = 'synthetic-foreign-secret'

const PWA_ORIGIN = 'https://pwa.klicker.localhost'
const MANAGE_ORIGIN = 'https://manage.klicker.localhost'
const CONTROL_ORIGIN = 'https://control.klicker.localhost'
const ASSESSMENT_ORIGIN = 'https://assessment.klicker.localhost'

const MANAGED_ENV_KEYS = [
  'APP_SECRET',
  'APP_STUDENT_SUBDOMAIN',
  'APP_MANAGE_SUBDOMAIN',
  'APP_CONTROL_SUBDOMAIN',
  'APP_ASSESSMENT_SUBDOMAIN',
  'ASSESSMENT_MODE',
  'COOKIE_DOMAIN',
] as const

const savedEnv: Record<string, string | undefined> = {}

function currentTimeInSeconds() {
  return Math.floor(Date.now() / 1000)
}

function futureExpiry() {
  return currentTimeInSeconds() + 3600
}

function expiredExpiry() {
  return currentTimeInSeconds() - 3600
}

async function signParticipantToken({
  sub,
  role = 'PARTICIPANT',
  scope,
  exp,
  secret = TEST_SECRET,
}: {
  sub: string
  role?: string
  scope?: string
  exp?: number
  secret?: string
}) {
  return signJWT({ sub, role, scope, exp }, secret)
}

async function runMiddleware({
  headers = {},
  cookies = {},
}: {
  headers?: Record<string, unknown>
  cookies?: Record<string, string>
} = {}) {
  const req: any = { headers, cookies }
  let nextCalled = false

  await jwtMiddleware(req, {}, () => {
    nextCalled = true
  })

  return { user: req.locals?.user, nextCalled }
}

describe('jwtMiddleware', () => {
  let validCookieToken: string

  before(async () => {
    for (const key of MANAGED_ENV_KEYS) {
      savedEnv[key] = process.env[key]
    }

    process.env.APP_SECRET = TEST_SECRET
    process.env.APP_STUDENT_SUBDOMAIN = 'pwa'
    process.env.APP_MANAGE_SUBDOMAIN = 'manage'
    process.env.APP_CONTROL_SUBDOMAIN = 'control'
    process.env.APP_ASSESSMENT_SUBDOMAIN = 'assessment'
    process.env.COOKIE_DOMAIN = '.klicker.localhost'
    delete process.env.ASSESSMENT_MODE

    validCookieToken = await signParticipantToken({
      sub: 'cookie-user',
      exp: futureExpiry(),
    })
  })

  afterEach(() => {
    delete process.env.ASSESSMENT_MODE
  })

  after(() => {
    for (const key of MANAGED_ENV_KEYS) {
      const previousValue = savedEnv[key]

      if (previousValue === undefined) {
        delete process.env[key]
      } else {
        process.env[key] = previousValue
      }
    }
  })

  describe('regular PWA origin', () => {
    it('prefers a valid explicit bearer over an expired ambient cookie', async () => {
      const expiredCookieToken = await signParticipantToken({
        sub: 'cookie-user',
        exp: expiredExpiry(),
      })
      const bearerToken = await signParticipantToken({
        sub: 'bearer-user',
        exp: futureExpiry(),
      })

      const { user, nextCalled } = await runMiddleware({
        headers: {
          origin: PWA_ORIGIN,
          authorization: `Bearer ${bearerToken}`,
        },
        cookies: { participant_token: expiredCookieToken },
      })

      assert.equal(nextCalled, true)
      assert.equal(user?.sub, 'bearer-user')
    })

    it('prefers a valid explicit bearer over a conflicting valid ambient cookie', async () => {
      const bearerToken = await signParticipantToken({
        sub: 'bearer-user',
        exp: futureExpiry(),
      })

      const { user } = await runMiddleware({
        headers: {
          origin: PWA_ORIGIN,
          authorization: `Bearer ${bearerToken}`,
        },
        cookies: { participant_token: validCookieToken },
      })

      assert.equal(user?.sub, 'bearer-user')
    })

    it('accepts a verified temporary participant bearer', async () => {
      const bearerToken = await signParticipantToken({
        sub: 'temporary-user',
        role: 'TEMPORARY_PARTICIPANT',
        exp: futureExpiry(),
      })

      const { user } = await runMiddleware({
        headers: {
          origin: PWA_ORIGIN,
          authorization: `Bearer ${bearerToken}`,
        },
      })

      assert.equal(user?.sub, 'temporary-user')
      assert.equal(user?.role, 'TEMPORARY_PARTICIPANT')
    })

    it('fails closed for a bearer with an invalid signature without cookie fallback', async () => {
      const bearerToken = await signParticipantToken({
        sub: 'bearer-user',
        exp: futureExpiry(),
        secret: FOREIGN_SECRET,
      })

      const { user } = await runMiddleware({
        headers: {
          origin: PWA_ORIGIN,
          authorization: `Bearer ${bearerToken}`,
        },
        cookies: { participant_token: validCookieToken },
      })

      assert.equal(user, null)
    })

    it('fails closed for a malformed bearer credential without cookie fallback', async () => {
      const { user } = await runMiddleware({
        headers: {
          origin: PWA_ORIGIN,
          authorization: 'Bearer not-a-jwt',
        },
        cookies: { participant_token: validCookieToken },
      })

      assert.equal(user, null)
    })

    it('fails closed for a bearer scheme without a credential', async () => {
      const { user } = await runMiddleware({
        headers: {
          origin: PWA_ORIGIN,
          authorization: 'Bearer',
        },
        cookies: { participant_token: validCookieToken },
      })

      assert.equal(user, null)
    })

    it('fails closed for an expired bearer without cookie fallback', async () => {
      const bearerToken = await signParticipantToken({
        sub: 'bearer-user',
        exp: expiredExpiry(),
      })

      const { user } = await runMiddleware({
        headers: {
          origin: PWA_ORIGIN,
          authorization: `Bearer ${bearerToken}`,
        },
        cookies: { participant_token: validCookieToken },
      })

      assert.equal(user, null)
    })

    it('fails closed for a bearer without a subject', async () => {
      const bearerToken = await signParticipantToken({
        sub: '',
        exp: futureExpiry(),
      })

      const { user } = await runMiddleware({
        headers: {
          origin: PWA_ORIGIN,
          authorization: `Bearer ${bearerToken}`,
        },
        cookies: { participant_token: validCookieToken },
      })

      assert.equal(user, null)
    })

    it('fails closed for a bearer without an expiration', async () => {
      const bearerToken = await signParticipantToken({ sub: 'bearer-user' })

      const { user } = await runMiddleware({
        headers: {
          origin: PWA_ORIGIN,
          authorization: `Bearer ${bearerToken}`,
        },
        cookies: { participant_token: validCookieToken },
      })

      assert.equal(user, null)
    })

    it('fails closed for a bearer with a non-participant role', async () => {
      const bearerToken = await signParticipantToken({
        sub: 'bearer-user',
        role: 'ADMIN',
        exp: futureExpiry(),
      })

      const { user } = await runMiddleware({
        headers: {
          origin: PWA_ORIGIN,
          authorization: `Bearer ${bearerToken}`,
        },
        cookies: { participant_token: validCookieToken },
      })

      assert.equal(user, null)
    })

    it('fails closed for a scoped bearer without cookie fallback', async () => {
      const bearerToken = await signParticipantToken({
        sub: 'bearer-user',
        scope: 'chat:read',
        exp: futureExpiry(),
      })

      const { user } = await runMiddleware({
        headers: {
          origin: PWA_ORIGIN,
          authorization: `Bearer ${bearerToken}`,
        },
        cookies: { participant_token: validCookieToken },
      })

      assert.equal(user, null)
    })

    it('uses the participant cookie when the authorization header is absent', async () => {
      const { user } = await runMiddleware({
        headers: { origin: PWA_ORIGIN },
        cookies: { participant_token: validCookieToken },
      })

      assert.equal(user?.sub, 'cookie-user')
    })

    it('ignores participant cookies for a foreign origin containing the subdomain', async () => {
      const { user } = await runMiddleware({
        headers: { origin: 'https://pwa.attacker.example' },
        cookies: { participant_token: validCookieToken },
      })

      assert.equal(user, null)
    })

    it('ignores participant cookies when no cookie domain is configured', async () => {
      process.env.COOKIE_DOMAIN = ''
      try {
        const { user } = await runMiddleware({
          headers: { origin: PWA_ORIGIN },
          cookies: { participant_token: validCookieToken },
        })

        assert.equal(user, null)
      } finally {
        process.env.COOKIE_DOMAIN = '.klicker.localhost'
      }
    })

    it('treats an empty authorization header as absent for cookie-only requests', async () => {
      const { user } = await runMiddleware({
        headers: { origin: PWA_ORIGIN, authorization: '' },
        cookies: { participant_token: validCookieToken },
      })

      assert.equal(user?.sub, 'cookie-user')
    })

    it('fails closed for a non-bearer authorization header without cookie fallback', async () => {
      const { user } = await runMiddleware({
        headers: { origin: PWA_ORIGIN, authorization: 'Basic YWJj' },
        cookies: { participant_token: validCookieToken },
      })

      assert.equal(user, null)
    })

    it('fails closed for a non-string authorization header', async () => {
      const bearerToken = await signParticipantToken({
        sub: 'bearer-user',
        exp: futureExpiry(),
      })

      const { user } = await runMiddleware({
        headers: {
          origin: PWA_ORIGIN,
          authorization: [`Bearer ${bearerToken}`],
        },
        cookies: { participant_token: validCookieToken },
      })

      assert.equal(user, null)
    })

    it('fails closed for a bearer with a whitespace-only subject', async () => {
      const bearerToken = await signParticipantToken({
        sub: '   ',
        exp: futureExpiry(),
      })

      const { user } = await runMiddleware({
        headers: {
          origin: PWA_ORIGIN,
          authorization: `Bearer ${bearerToken}`,
        },
        cookies: { participant_token: validCookieToken },
      })

      assert.equal(user, null)
    })
  })

  describe('other audience branches', () => {
    it('keeps the assessment participant cookie ahead of a bearer in assessment mode', async () => {
      process.env.ASSESSMENT_MODE = 'true'
      const bearerToken = await signParticipantToken({
        sub: 'bearer-user',
        exp: futureExpiry(),
      })

      const { user } = await runMiddleware({
        headers: {
          origin: ASSESSMENT_ORIGIN,
          authorization: `Bearer ${bearerToken}`,
        },
        cookies: { 'next-auth.participant-session-token': validCookieToken },
      })

      assert.equal(user?.sub, 'cookie-user')
    })

    it('keeps the manage and control session cookie ahead of a bearer', async () => {
      const bearerToken = await signParticipantToken({
        sub: 'bearer-user',
        exp: futureExpiry(),
      })

      for (const origin of [MANAGE_ORIGIN, CONTROL_ORIGIN]) {
        const { user } = await runMiddleware({
          headers: {
            origin,
            authorization: `Bearer ${bearerToken}`,
          },
          cookies: { 'next-auth.session-token': validCookieToken },
        })

        assert.equal(user?.sub, 'cookie-user')
      }
    })

    it('keeps the authorization fallback when no Origin matches', async () => {
      const bearerToken = await signParticipantToken({
        sub: 'bearer-user',
        exp: futureExpiry(),
      })

      const { user } = await runMiddleware({
        headers: { authorization: `Bearer ${bearerToken}` },
      })

      assert.equal(user?.sub, 'bearer-user')
    })

    it('ignores participant cookies when no Origin matches', async () => {
      const { user } = await runMiddleware({
        cookies: { participant_token: validCookieToken },
      })

      assert.equal(user, null)
    })
  })
})
