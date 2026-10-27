import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const ENV_KEYS = [
  'APP_SECRET',
  'APP_CHAT_GUEST_SECRET',
  'CHAT_GUEST_SEED',
  'APP_ORIGIN_LTI',
  'NODE_ENV',
] as const

const originalEnv: Partial<
  Record<(typeof ENV_KEYS)[number], string | undefined>
> = {}

beforeAll(async () => {
  for (const k of ENV_KEYS) originalEnv[k] = process.env[k]
  process.env.APP_SECRET = 'test-app-secret'
  process.env.APP_CHAT_GUEST_SECRET = 'test-chat-guest-secret'
  process.env.CHAT_GUEST_SEED = 'test-chat-guest-seed'
  process.env.APP_ORIGIN_LTI = 'https://lti.test'
  ;(process.env as Record<string, string | undefined>).NODE_ENV = 'test'
})

afterAll(() => {
  for (const k of ENV_KEYS) {
    const env = process.env as Record<string, string | undefined>
    if (originalEnv[k] === undefined) {
      delete env[k]
    } else {
      env[k] = originalEnv[k]
    }
  }
})

describe('ltiGuest', () => {
  it('deriveGuestSsoId is deterministic for the same (sub, courseId)', async () => {
    const mod = await import('@/src/lib/server/ltiGuest')
    const a = mod.deriveGuestSsoId('lti-sub-1', 'course-A')
    const b = mod.deriveGuestSsoId('lti-sub-1', 'course-A')
    expect(a).toBe(b)
    expect(a.startsWith('chat-guest:')).toBe(true)
  })

  it('deriveGuestSsoId differs across courses for the same sub', async () => {
    const mod = await import('@/src/lib/server/ltiGuest')
    const a = mod.deriveGuestSsoId('lti-sub-1', 'course-A')
    const b = mod.deriveGuestSsoId('lti-sub-1', 'course-B')
    expect(a).not.toBe(b)
  })

  it('deriveGuestSsoId differs across subs for the same course', async () => {
    const mod = await import('@/src/lib/server/ltiGuest')
    const a = mod.deriveGuestSsoId('lti-sub-1', 'course-A')
    const b = mod.deriveGuestSsoId('lti-sub-2', 'course-A')
    expect(a).not.toBe(b)
  })

  it('GUEST_ACCOUNT_TYPE is the canonical "lti_guest" string', async () => {
    const mod = await import('@/src/lib/server/ltiGuest')
    expect(mod.GUEST_ACCOUNT_TYPE).toBe('lti_guest')
  })

  it('signChatGuestToken / verifyChatGuestToken round-trip', async () => {
    const mod = await import('@/src/lib/server/ltiGuest')
    const token = await mod.signChatGuestToken('participant-uuid')
    const payload = await mod.verifyChatGuestToken(token)
    expect(payload.sub).toBe('participant-uuid')
    expect(payload.scope).toBe('CHAT_GUEST')
  })

  it('verifyChatGuestToken rejects an APP_SECRET-signed token', async () => {
    const mod = await import('@/src/lib/server/ltiGuest')
    const { signJWT } = await import('@klicker-uzh/util')
    const tokenSignedWithAppSecret = await signJWT(
      { sub: 'participant-uuid', scope: 'CHAT_GUEST' },
      process.env.APP_SECRET as string,
      { algorithm: 'HS256', expiresIn: '14d' }
    )
    await expect(
      mod.verifyChatGuestToken(tokenSignedWithAppSecret)
    ).rejects.toBeDefined()
  })

  it('verifyLtiToken accepts a token signed by apps/lti (APP_SECRET, correct iss + scope)', async () => {
    const mod = await import('@/src/lib/server/ltiGuest')
    const { signJWT } = await import('@klicker-uzh/util')
    const ltiJwt = await signJWT(
      { sub: 'lti-sub-1', scope: 'LTI1.3', email: 'alice@example.org' },
      process.env.APP_SECRET as string,
      {
        algorithm: 'HS256',
        expiresIn: '5m',
        issuer: process.env.APP_ORIGIN_LTI,
      }
    )
    const payload = await mod.verifyLtiToken(ltiJwt)
    expect(payload.sub).toBe('lti-sub-1')
    expect(payload.scope).toBe('LTI1.3')
    expect(payload.email).toBe('alice@example.org')
  })

  it('verifyLtiToken rejects a token with the wrong issuer', async () => {
    const mod = await import('@/src/lib/server/ltiGuest')
    const { signJWT } = await import('@klicker-uzh/util')
    const ltiJwt = await signJWT(
      { sub: 'lti-sub-1', scope: 'LTI1.3' },
      process.env.APP_SECRET as string,
      {
        algorithm: 'HS256',
        expiresIn: '5m',
        issuer: 'https://wrong-origin.test',
      }
    )
    await expect(mod.verifyLtiToken(ltiJwt)).rejects.toBeDefined()
  })

  it('verifyLtiToken rejects a token with the wrong scope', async () => {
    const mod = await import('@/src/lib/server/ltiGuest')
    const { signJWT } = await import('@klicker-uzh/util')
    const ltiJwt = await signJWT(
      { sub: 'lti-sub-1', scope: 'NOT_LTI' },
      process.env.APP_SECRET as string,
      {
        algorithm: 'HS256',
        expiresIn: '5m',
        issuer: process.env.APP_ORIGIN_LTI,
      }
    )
    await expect(mod.verifyLtiToken(ltiJwt)).rejects.toBeDefined()
  })

  it('verifyLtiToken throws when APP_ORIGIN_LTI is unset', async () => {
    const env = process.env as Record<string, string | undefined>
    const savedOrigin = env.APP_ORIGIN_LTI
    delete env.APP_ORIGIN_LTI
    try {
      const mod = await import('@/src/lib/server/ltiGuest')
      const { signJWT } = await import('@klicker-uzh/util')
      const ltiJwt = await signJWT(
        { sub: 'lti-sub-1', scope: 'LTI1.3' },
        process.env.APP_SECRET as string,
        { algorithm: 'HS256', expiresIn: '5m' }
      )
      await expect(mod.verifyLtiToken(ltiJwt)).rejects.toThrow(
        /APP_ORIGIN_LTI is required/
      )
    } finally {
      if (savedOrigin === undefined) delete env.APP_ORIGIN_LTI
      else env.APP_ORIGIN_LTI = savedOrigin
    }
  })
})
