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
