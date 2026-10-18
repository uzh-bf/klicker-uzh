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
  const req: {
    headers: Record<string, unknown>
    cookies: Record<string, string>
    locals?: { user: { sub?: string; role?: string } | null }
  } = { headers, cookies }
  const responses: { statusCode?: number; body?: unknown } = {}
  const res = {
    status(statusCode: number) {
      responses.statusCode = statusCode
      return this
    },
    json(body: unknown) {
      responses.body = body
      return this
    },
  }
  let nextCalled = false

  await jwtMiddleware(req, res, () => {
    nextCalled = true
  })

  return {
    user: req.locals?.user,
    locals: req.locals,
    nextCalled,
    statusCode: responses.statusCode,
    body: responses.body,
  }
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

  it('never authenticates a request that omits or forges the selected credential', async (t) => {
    t.mock.method(console, 'error', () => {})
    t.mock.method(console, 'log', () => {})
    for (const origin of [
      undefined,
      PWA_ORIGIN,
      'https://manage.klicker.localhost',
    ]) {
      for (const token of [undefined, 'forged.invalid.signature']) {
        const result = await runMiddleware({
          headers: {
            origin,
            authorization: token ? `Bearer ${token}` : undefined,
          },
          cookies: token
            ? {
                participant_token: token,
                'next-auth.session-token': token,
              }
            : {},
        })
        assert.equal(result.user, null)
        assert.equal(result.nextCalled, true)
      }
    }
  })

  describe('regular PWA origin', () => {
    it('keeps the participant cookie ahead of any authorization header', async () => {
      const validBearer = await signParticipantToken({
        sub: 'bearer-user',
        exp: futureExpiry(),
      })
      const foreignBearer = await signParticipantToken({
        sub: 'bearer-user',
        exp: futureExpiry(),
        secret: FOREIGN_SECRET,
      })
      const expiredBearer = await signParticipantToken({
        sub: 'bearer-user',
        exp: expiredExpiry(),
      })

      for (const authorization of [
        `Bearer ${validBearer}`,
        `Bearer ${foreignBearer}`,
        `Bearer ${expiredBearer}`,
        'Bearer not-a-jwt',
        'Bearer',
        'Basic YWJj',
        '',
        [`Bearer ${validBearer}`],
      ] as unknown[]) {
        const { user, nextCalled } = await runMiddleware({
          headers: { origin: PWA_ORIGIN, authorization },
          cookies: { participant_token: validCookieToken },
        })

        assert.equal(nextCalled, true)
        assert.equal(user?.sub, 'cookie-user')
      }
    })

    it('accepts only a plain participant bearer when no cookie is present', async () => {
      const participant = await signParticipantToken({
        sub: 'frame-user',
        exp: futureExpiry(),
      })
      const { user, nextCalled } = await runMiddleware({
        headers: { origin: PWA_ORIGIN, authorization: `Bearer ${participant}` },
      })
      assert.equal(nextCalled, true)
      assert.equal(user?.sub, 'frame-user')

      for (const claims of [
        { role: 'USER' },
        { role: 'TEMPORARY_PARTICIPANT' },
        { scope: 'EDUID' },
      ]) {
        const other = await signParticipantToken({
          sub: 'other-user',
          exp: futureExpiry(),
          ...claims,
        })
        const result = await runMiddleware({
          headers: { origin: PWA_ORIGIN, authorization: `Bearer ${other}` },
        })
        assert.equal(result.user, null)
      }
    })

    it('does not fall back to a bearer when the participant cookie is unusable', async () => {
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
      assert.equal(user, null)
    })

    it('uses the temporary participant cookie only without a regular cookie', async () => {
      const temporaryToken = await signParticipantToken({
        sub: 'temporary-user',
        role: 'TEMPORARY_PARTICIPANT',
        exp: futureExpiry(),
      })

      const preferred = await runMiddleware({
        headers: { origin: PWA_ORIGIN },
        cookies: {
          participant_token: validCookieToken,
          temporary_participant_token: temporaryToken,
        },
      })
      assert.equal(preferred.user?.sub, 'cookie-user')

      const temporary = await runMiddleware({
        headers: { origin: PWA_ORIGIN },
        cookies: { temporary_participant_token: temporaryToken },
      })
      assert.equal(temporary.user?.sub, 'temporary-user')
      assert.equal(temporary.user?.role, 'TEMPORARY_PARTICIPANT')
    })

    it('rejects a revision mismatch with HTTP 409 before next', async () => {
      const mismatched = await runMiddleware({
        headers: { origin: PWA_ORIGIN, 'x-participant-session': 'rev-other' },
        cookies: {
          participant_token: validCookieToken,
          participant_session: 'rev-1',
        },
      })

      assert.equal(mismatched.statusCode, 409)
      assert.deepEqual(mismatched.body, {
        error: 'participant_session_changed',
      })
      assert.equal(mismatched.nextCalled, false)
      assert.equal(mismatched.locals, undefined)

      const missingCookieRevision = await runMiddleware({
        headers: { origin: PWA_ORIGIN, 'x-participant-session': 'rev-1' },
        cookies: { participant_token: validCookieToken },
      })

      assert.equal(missingCookieRevision.statusCode, 409)
      assert.equal(missingCookieRevision.nextCalled, false)
    })

    it('accepts a matching revision or the none marker', async () => {
      const matching = await runMiddleware({
        headers: { origin: PWA_ORIGIN, 'x-participant-session': 'rev-1' },
        cookies: {
          participant_token: validCookieToken,
          participant_session: 'rev-1',
        },
      })

      assert.equal(matching.statusCode, undefined)
      assert.equal(matching.nextCalled, true)
      assert.equal(matching.user?.sub, 'cookie-user')

      const anonymous = await runMiddleware({
        headers: { origin: PWA_ORIGIN, 'x-participant-session': 'none' },
      })

      assert.equal(anonymous.statusCode, undefined)
      assert.equal(anonymous.nextCalled, true)
      assert.equal(anonymous.user, null)
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

    it('falls back to a bearer in assessment mode when the assessment cookie is absent', async () => {
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
      })

      assert.equal(user?.sub, 'bearer-user')
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
