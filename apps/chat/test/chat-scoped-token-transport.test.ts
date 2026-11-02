import { authenticateParticipant } from '@klicker-uzh/chat-api/auth'
import { signJWT } from '@klicker-uzh/util'
import { NextRequest } from 'next/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  chatbotFindUnique: vi.fn(),
  participationFindUnique: vi.fn(),
  participantFindUnique: vi.fn(),
}))

vi.mock('@klicker-uzh/prisma', () => ({
  prisma: {
    chatbot: { findUnique: mocks.chatbotFindUnique },
    participation: { findUnique: mocks.participationFindUnique },
    participant: { findUnique: mocks.participantFindUnique },
  },
}))

import {
  PWA_CHAT_EMBED_QUERY_KEY,
  PWA_CHAT_EMBED_SESSION_COOKIE,
} from '../src/lib/pwaEmbedAuth'
import {
  authorizeIdentityForChatbot,
  resolveParticipantIdentity,
  withChatbotAuth,
} from '../src/lib/server/apiGuards'
import { signChatGuestToken } from '../src/lib/server/ltiGuest'
import { signPwaEmbedSessionToken } from '../src/lib/server/pwaEmbed'
import { proxy } from '../src/proxy'

const CHATBOT_ID = '8f9c2e1d-4b7a-4c3e-9f5d-1a2b3c4d5e6f'
const OTHER_CHATBOT_ID = '9a1b2c3d-4e5f-4a6b-8c7d-8e9f0a1b2c3d'
const COURSE_A = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d'
const COURSE_B = 'b1c2d3e4-f5a6-4b7c-9d8e-1f2a3b4c5d6e'

// The reserved header the server render reads. A client may send it, but it is
// only ever a transport for a signature the render verifies again.
const SCOPED_HEADER = 'x-chat-scoped-token'
const REWRITTEN_SCOPED_HEADER = 'x-middleware-request-x-chat-scoped-token'

function chatbotUrl(query: string, chatbotId = CHATBOT_ID) {
  return new URL('/' + chatbotId + query, 'https://chat.test')
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.participantFindUnique.mockResolvedValue({
    isActive: true,
    accounts: [],
  })
  vi.stubEnv('APP_SECRET', 'test-app-secret')
  vi.stubEnv('APP_CHAT_GUEST_SECRET', 'test-guest-secret')
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('proxy scoped-token handoff', () => {
  it('replaces a spoofed reserved header with the verified _t query token', async () => {
    const guestToken = await signChatGuestToken('guest-participant')
    const request = new NextRequest(chatbotUrl('?_t=' + guestToken), {
      headers: { [SCOPED_HEADER]: 'forged-identity-value' },
    })

    const response = await proxy(request)

    expect(response.headers.get('x-middleware-next')).toBe('1')
    expect(response.headers.get(REWRITTEN_SCOPED_HEADER)).toBe(guestToken)
    expect(response.headers.get(REWRITTEN_SCOPED_HEADER)).not.toBe(
      'forged-identity-value'
    )
    expect(response.headers.get('x-middleware-override-headers')).toContain(
      SCOPED_HEADER
    )
  })

  it('replaces a spoofed reserved header with the verified _pe query token', async () => {
    const scopeToken = await signPwaEmbedSessionToken({
      participantId: 'participant-1',
      chatbotId: CHATBOT_ID,
      courseId: COURSE_A,
    })
    const request = new NextRequest(
      chatbotUrl('?' + PWA_CHAT_EMBED_QUERY_KEY + '=' + scopeToken),
      { headers: { [SCOPED_HEADER]: 'forged-identity-value' } }
    )

    const response = await proxy(request)

    expect(response.headers.get('x-middleware-next')).toBe('1')
    expect(response.headers.get(REWRITTEN_SCOPED_HEADER)).toBe(scopeToken)
    expect(response.headers.get(REWRITTEN_SCOPED_HEADER)).not.toBe(
      'forged-identity-value'
    )
  })

  it('clears a spoofed reserved header when the cookie transport is used', async () => {
    const guestToken = await signChatGuestToken('guest-participant')
    const request = new NextRequest(chatbotUrl(''), {
      headers: {
        cookie: 'chat_participant_token=' + guestToken,
        [SCOPED_HEADER]: 'forged-identity-value',
      },
    })

    const response = await proxy(request)

    expect(response.headers.get('x-middleware-next')).toBe('1')
    expect(response.headers.get(REWRITTEN_SCOPED_HEADER) ?? '').toBe('')
  })

  it('clears a spoofed reserved header on the account-session path', async () => {
    const accountToken = await signJWT(
      { sub: 'account-1' },
      'test-app-secret',
      { expiresIn: '1h' }
    )
    const request = new NextRequest(chatbotUrl(''), {
      headers: {
        cookie: 'participant_token=' + accountToken,
        [SCOPED_HEADER]: 'forged-identity-value',
      },
    })

    const response = await proxy(request)

    expect(response.headers.get('x-middleware-next')).toBe('1')
    expect(response.headers.get(REWRITTEN_SCOPED_HEADER) ?? '').toBe('')
  })

  it('never lets the reserved header alone authorize a request', async () => {
    const request = new NextRequest(chatbotUrl(''), {
      headers: { [SCOPED_HEADER]: 'forged-identity-value' },
    })

    const response = await proxy(request)

    expect(response.headers.get('x-middleware-next')).toBeNull()
    expect(response.headers.get('location')).toContain('/noLogin')
  })
})

describe('stale transport fallback', () => {
  it('uses a valid _t handoff when a stale guest cookie is also present', async () => {
    const guestToken = await signChatGuestToken('guest-participant')
    const request = new NextRequest(chatbotUrl('?_t=' + guestToken), {
      headers: {
        cookie: 'chat_participant_token=stale-invalid-cookie',
      },
    })

    const response = await proxy(request)

    expect(response.headers.get('x-middleware-next')).toBe('1')
    expect(response.headers.get(REWRITTEN_SCOPED_HEADER)).toBe(guestToken)
  })

  it('uses a valid _pe handoff when a stale scoped cookie is also present', async () => {
    const scopeToken = await signPwaEmbedSessionToken({
      participantId: 'participant-1',
      chatbotId: CHATBOT_ID,
      courseId: COURSE_A,
    })
    const request = new NextRequest(
      chatbotUrl('?' + PWA_CHAT_EMBED_QUERY_KEY + '=' + scopeToken),
      { headers: { cookie: PWA_CHAT_EMBED_SESSION_COOKIE + '=stale-invalid' } }
    )

    const response = await proxy(request)

    expect(response.headers.get('x-middleware-next')).toBe('1')
    expect(response.headers.get(REWRITTEN_SCOPED_HEADER)).toBe(scopeToken)
  })

  it('still refuses a request whose transports are all invalid', async () => {
    const request = new NextRequest(chatbotUrl('?_t=not-a-token'), {
      headers: { cookie: 'chat_participant_token=also-invalid' },
    })

    const response = await proxy(request)

    expect(response.headers.get('location')).toContain('/noLogin')
  })
})

describe('scoped token transport identity', () => {
  it('resolves a real guest cookie token to an anonymous identity', async () => {
    const guestToken = await signChatGuestToken('guest-participant')

    const identity = await resolveParticipantIdentity({
      chatGuestToken: guestToken,
    })

    expect(identity).toMatchObject({
      participantId: 'guest-participant',
      authMode: 'anonymous',
    })
  })

  it('resolves the proxy-forwarded scoped guest token', async () => {
    const guestToken = await signChatGuestToken('guest-participant')

    const identity = await resolveParticipantIdentity({
      scopedFallbackToken: guestToken,
    })

    expect(identity).toMatchObject({
      participantId: 'guest-participant',
      authMode: 'anonymous',
    })
  })

  it('rejects a forged reserved header value as an identity', async () => {
    const identity = await resolveParticipantIdentity({
      scopedFallbackToken: JSON.stringify({
        participantId: 'attacker',
        authMode: 'account',
      }),
    })

    expect(identity).not.toHaveProperty('participantId')
    if ('response' in identity) {
      expect(identity.response.status).toBe(401)
    }
  })

  it('does not accept a raw account session token from the scoped header', async () => {
    const accountToken = await signJWT(
      { sub: 'account-1', scope: 'participant' },
      'test-app-secret',
      { expiresIn: '1h' }
    )

    const identity = await resolveParticipantIdentity({
      scopedFallbackToken: accountToken,
    })

    expect(identity).not.toHaveProperty('participantId')
    if ('response' in identity) {
      expect(identity.response.status).toBe(401)
    }
  })

  it('rejects guest-scoped tokens signed with the wrong secret', async () => {
    const forgedToken = await signJWT(
      { sub: 'ghost-participant', scope: 'CHAT_GUEST' },
      'wrong-secret',
      { expiresIn: '1h' }
    )
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined)

    const cookieIdentity = await resolveParticipantIdentity({
      chatGuestToken: forgedToken,
    })
    const headerIdentity = await resolveParticipantIdentity({
      scopedFallbackToken: forgedToken,
    })

    for (const identity of [cookieIdentity, headerIdentity]) {
      expect(identity).not.toHaveProperty('participantId')
      if ('response' in identity) {
        expect(identity.response.status).toBe(401)
      }
    }
    consoleError.mockRestore()
  })
})

describe('identity-to-chatbot scoped authorization', () => {
  it('authorizes a scoped token bound to this chatbot and course', async () => {
    const scopeToken = await signPwaEmbedSessionToken({
      participantId: 'participant-1',
      chatbotId: CHATBOT_ID,
      courseId: COURSE_A,
    })
    mocks.chatbotFindUnique.mockResolvedValue({
      courseId: COURSE_A,
      status: 'PUBLISHED',
    })
    mocks.participationFindUnique.mockResolvedValue({ id: 'participation-1' })

    const identity = await resolveParticipantIdentity({
      scopedFallbackToken: scopeToken,
    })
    if ('response' in identity) throw new Error('identity should resolve')

    const authorization = await authorizeIdentityForChatbot(
      identity,
      CHATBOT_ID
    )

    expect(authorization).toMatchObject({
      participantId: 'participant-1',
      authMode: 'account',
      chatbot: { courseId: COURSE_A },
    })
  })

  it('authorizes a guest cookie transport with course participation', async () => {
    const guestToken = await signChatGuestToken('guest-participant')
    mocks.chatbotFindUnique.mockResolvedValue({
      courseId: COURSE_A,
      status: 'PUBLISHED',
    })
    mocks.participationFindUnique.mockResolvedValue({ id: 'participation-1' })

    const identity = await resolveParticipantIdentity({
      chatGuestToken: guestToken,
    })
    if ('response' in identity) throw new Error('identity should resolve')

    const authorization = await authorizeIdentityForChatbot(
      identity,
      CHATBOT_ID
    )

    expect(authorization).toMatchObject({
      participantId: 'guest-participant',
      authMode: 'anonymous',
      chatbot: { courseId: COURSE_A },
    })
  })

  it('denies a guest transport when the chatbot is not published', async () => {
    const guestToken = await signChatGuestToken('guest-participant')
    mocks.chatbotFindUnique.mockResolvedValue({
      courseId: COURSE_A,
      status: 'DRAFT',
    })

    const identity = await resolveParticipantIdentity({
      scopedFallbackToken: guestToken,
    })
    if ('response' in identity) throw new Error('identity should resolve')

    const authorization = await authorizeIdentityForChatbot(
      identity,
      CHATBOT_ID
    )

    expect('response' in authorization).toBe(true)
    if ('response' in authorization) {
      expect(authorization.response.status).toBe(404)
    }
    expect(mocks.participationFindUnique).not.toHaveBeenCalled()
  })

  it('denies a scoped token bound to a different course even in the header', async () => {
    const scopeToken = await signPwaEmbedSessionToken({
      participantId: 'participant-1',
      chatbotId: CHATBOT_ID,
      courseId: COURSE_B,
    })
    mocks.chatbotFindUnique.mockResolvedValue({
      courseId: COURSE_A,
      status: 'PUBLISHED',
    })
    mocks.participationFindUnique.mockResolvedValue({ id: 'participation-1' })

    const identity = await resolveParticipantIdentity({
      scopedFallbackToken: scopeToken,
    })
    if ('response' in identity) throw new Error('identity should resolve')

    const authorization = await authorizeIdentityForChatbot(
      identity,
      CHATBOT_ID
    )

    expect('response' in authorization).toBe(true)
    if ('response' in authorization) {
      expect(authorization.response.status).toBe(403)
    }
  })

  it('denies a scoped token bound to a different chatbot', async () => {
    const scopeToken = await signPwaEmbedSessionToken({
      participantId: 'participant-1',
      chatbotId: OTHER_CHATBOT_ID,
      courseId: COURSE_A,
    })
    mocks.chatbotFindUnique.mockResolvedValue({
      courseId: COURSE_A,
      status: 'PUBLISHED',
    })

    const identity = await resolveParticipantIdentity({
      scopedFallbackToken: scopeToken,
    })
    if ('response' in identity) throw new Error('identity should resolve')

    const authorization = await authorizeIdentityForChatbot(
      identity,
      CHATBOT_ID
    )

    expect('response' in authorization).toBe(true)
    if ('response' in authorization) {
      expect(authorization.response.status).toBe(403)
    }
  })

  it('denies a guest identity without course participation', async () => {
    const guestToken = await signChatGuestToken('guest-participant')
    mocks.chatbotFindUnique.mockResolvedValue({
      courseId: COURSE_A,
      status: 'PUBLISHED',
    })
    mocks.participationFindUnique.mockResolvedValue(null)

    const identity = await resolveParticipantIdentity({
      scopedFallbackToken: guestToken,
    })
    if ('response' in identity) throw new Error('identity should resolve')

    const authorization = await authorizeIdentityForChatbot(
      identity,
      CHATBOT_ID
    )

    expect('response' in authorization).toBe(true)
    if ('response' in authorization) {
      expect(authorization.response.status).toBe(403)
    }
  })
})

describe('scoped account fallback liveness', () => {
  it.each([
    null,
    { isActive: false, accounts: [] },
  ])('rejects a valid scoped token when its account is unavailable: %j', async (participant) => {
    mocks.participantFindUnique.mockResolvedValue(participant)
    const token = await signPwaEmbedSessionToken({
      participantId: 'participant-1',
      chatbotId: CHATBOT_ID,
      courseId: COURSE_A,
    })
    const identity = await resolveParticipantIdentity({
      scopedFallbackToken: token,
    })
    expect(identity).not.toHaveProperty('participantId')
    if ('response' in identity) expect(identity.response.status).toBe(401)
  })
})

describe('stale embed session account fallback', () => {
  const API_ISSUER = 'https://api.test'

  async function accountToken(sub: string) {
    return signJWT({ sub, role: 'PARTICIPANT' }, 'test-app-secret', {
      expiresIn: '1h',
      issuer: API_ISSUER,
    })
  }

  async function otherBotEmbedToken() {
    return signPwaEmbedSessionToken({
      participantId: 'participant-1',
      chatbotId: OTHER_CHATBOT_ID,
      courseId: COURSE_A,
    })
  }

  it('prefers the account session when the embed cookie targets another chatbot', async () => {
    vi.stubEnv('APP_ORIGIN_API', API_ISSUER)

    const identity = await resolveParticipantIdentity(
      {
        pwaEmbedToken: await otherBotEmbedToken(),
        participantToken: await accountToken('account-1'),
      },
      { targetChatbotId: CHATBOT_ID }
    )

    expect(identity).toMatchObject({
      participantId: 'account-1',
      authMode: 'account',
    })
    expect(identity).not.toHaveProperty('pwaEmbedScope')
  })

  it('keeps the embed identity when no account session resolves', async () => {
    const identity = await resolveParticipantIdentity(
      { pwaEmbedToken: await otherBotEmbedToken() },
      { targetChatbotId: CHATBOT_ID }
    )

    expect(identity).toMatchObject({
      participantId: 'participant-1',
      pwaEmbedScope: { chatbotId: OTHER_CHATBOT_ID, courseId: COURSE_A },
    })
  })

  it('keeps a matching embed session ahead of the account session', async () => {
    vi.stubEnv('APP_ORIGIN_API', API_ISSUER)
    const embedToken = await signPwaEmbedSessionToken({
      participantId: 'participant-1',
      chatbotId: CHATBOT_ID,
      courseId: COURSE_A,
    })

    const identity = await resolveParticipantIdentity(
      {
        pwaEmbedToken: embedToken,
        participantToken: await accountToken('account-1'),
      },
      { targetChatbotId: CHATBOT_ID }
    )

    expect(identity).toMatchObject({
      participantId: 'participant-1',
      pwaEmbedScope: { chatbotId: CHATBOT_ID, courseId: COURSE_A },
    })
  })

  it('applies the same fallback to the scoped header transport', async () => {
    vi.stubEnv('APP_ORIGIN_API', API_ISSUER)

    const identity = await resolveParticipantIdentity(
      {
        scopedFallbackToken: await otherBotEmbedToken(),
        participantToken: await accountToken('account-1'),
      },
      { targetChatbotId: CHATBOT_ID }
    )

    expect(identity).toMatchObject({
      participantId: 'account-1',
      authMode: 'account',
    })
    expect(identity).not.toHaveProperty('pwaEmbedScope')
  })

  it('leaves guest precedence untouched next to a stale embed cookie', async () => {
    const guestToken = await signChatGuestToken('guest-participant')

    const identity = await resolveParticipantIdentity(
      {
        chatGuestToken: guestToken,
        pwaEmbedToken: await otherBotEmbedToken(),
      },
      { targetChatbotId: CHATBOT_ID }
    )

    expect(identity).toMatchObject({
      participantId: 'guest-participant',
      authMode: 'anonymous',
    })
  })

  it('falls back inside withChatbotAuth so every chatbot route benefits', async () => {
    vi.stubEnv('APP_ORIGIN_API', API_ISSUER)
    mocks.chatbotFindUnique.mockResolvedValue({
      courseId: COURSE_A,
      status: 'PUBLISHED',
    })
    mocks.participationFindUnique.mockResolvedValue({
      id: 'participation-1',
    })

    const request = new NextRequest(chatbotUrl(''), {
      headers: {
        cookie: `${PWA_CHAT_EMBED_SESSION_COOKIE}=${await otherBotEmbedToken()}; participant_token=${await accountToken('account-1')}`,
      },
    })

    const authorization = await withChatbotAuth(request, CHATBOT_ID)

    expect(authorization).toMatchObject({
      participantId: 'account-1',
      authMode: 'account',
      chatbot: { courseId: COURSE_A },
    })
  })
})

describe('standalone API shared identity policy', () => {
  beforeEach(() => {
    vi.stubEnv('APP_ORIGIN_API', 'https://api.test')
    mocks.chatbotFindUnique.mockImplementation(async () => ({
      courseId: COURSE_A,
      status: 'PUBLISHED',
    }))
    mocks.participationFindUnique.mockResolvedValue({ id: 'participation-1' })
  })

  it.each([
    { role: 'LECTURER', issuer: 'https://api.test', expiresIn: '1h' },
    { role: 'PARTICIPANT', issuer: 'https://other.test', expiresIn: '1h' },
    { role: 'PARTICIPANT', issuer: 'https://api.test', expiresIn: '-1s' },
    { role: 'PARTICIPANT', issuer: 'https://api.test' },
  ])('rejects an invalid account-token claim set: %j', async ({
    role,
    issuer,
    expiresIn,
  }) => {
    const token = await signJWT(
      { sub: 'participant-1', role },
      'test-app-secret',
      { issuer, ...(expiresIn ? { expiresIn } : {}) }
    )
    const result = await authenticateParticipant(
      { participantToken: token },
      CHATBOT_ID
    )
    expect(result).toMatchObject({ status: 401 })
    expect(mocks.chatbotFindUnique).not.toHaveBeenCalled()
  })

  it.each([
    null,
    { isActive: false, accounts: [] },
    { isActive: true, accounts: [{ type: 'lti_guest' }] },
  ])('requires an active account persona: %j', async (participant) => {
    mocks.participantFindUnique.mockResolvedValue(participant)
    const token = await signJWT(
      { sub: 'participant-1', role: 'PARTICIPANT' },
      'test-app-secret',
      { issuer: 'https://api.test', expiresIn: '1h' }
    )
    const result = await authenticateParticipant(
      { participantToken: token },
      CHATBOT_ID
    )
    expect(result).toMatchObject({ status: 401 })
    expect(mocks.chatbotFindUnique).not.toHaveBeenCalled()
  })

  it('preserves guest precedence and signed learner binding', async () => {
    const guest = await signChatGuestToken(
      'guest-participant',
      'synthetic-binding'
    )
    const result = await authenticateParticipant(
      { chatGuestToken: guest, participantToken: 'invalid' },
      CHATBOT_ID
    )
    expect(result).toMatchObject({
      participantId: 'guest-participant',
      authMode: 'anonymous',
      learnerBinding: 'synthetic-binding',
      courseId: COURSE_A,
    })
  })

  it('accepts a scoped bearer but rejects a raw account bearer', async () => {
    const scopedFallbackToken = await signPwaEmbedSessionToken({
      participantId: 'participant-1',
      chatbotId: CHATBOT_ID,
      courseId: COURSE_A,
    })
    expect(
      await authenticateParticipant({ scopedFallbackToken }, CHATBOT_ID)
    ).toMatchObject({ participantId: 'participant-1', courseId: COURSE_A })
    const account = await signJWT(
      { sub: 'participant-1', role: 'PARTICIPANT' },
      'test-app-secret',
      { issuer: 'https://api.test', expiresIn: '1h' }
    )
    expect(
      await authenticateParticipant(
        { scopedFallbackToken: account },
        CHATBOT_ID
      )
    ).toMatchObject({ status: 401 })
  })

  it('preserves stale embed fallback while denying a foreign scope alone', async () => {
    const pwaEmbedToken = await signPwaEmbedSessionToken({
      participantId: 'participant-1',
      chatbotId: OTHER_CHATBOT_ID,
      courseId: COURSE_A,
    })
    expect(
      await authenticateParticipant({ pwaEmbedToken }, CHATBOT_ID)
    ).toMatchObject({ status: 403 })
    const participantToken = await signJWT(
      { sub: 'account-1', role: 'PARTICIPANT' },
      'test-app-secret',
      { issuer: 'https://api.test', expiresIn: '1h' }
    )
    expect(
      await authenticateParticipant(
        { pwaEmbedToken, participantToken },
        CHATBOT_ID
      )
    ).toMatchObject({ participantId: 'account-1', courseId: COURSE_A })
  })

  it('denies a mismatched course and missing participation', async () => {
    const pwaEmbedToken = await signPwaEmbedSessionToken({
      participantId: 'participant-1',
      chatbotId: CHATBOT_ID,
      courseId: COURSE_B,
    })
    expect(
      await authenticateParticipant({ pwaEmbedToken }, CHATBOT_ID)
    ).toMatchObject({ status: 403 })
    mocks.participationFindUnique.mockResolvedValue(null)
    expect(
      await authenticateParticipant(
        { chatGuestToken: await signChatGuestToken('guest-participant') },
        CHATBOT_ID
      )
    ).toMatchObject({ status: 403 })
  })
})
