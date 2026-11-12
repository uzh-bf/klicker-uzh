import { SignJWT } from 'jose'
import { NextRequest } from 'next/server'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  chatbotFindUnique: vi.fn(),
  participantFindUnique: vi.fn(),
}))

vi.mock('@klicker-uzh/prisma', () => ({
  prisma: {
    chatbot: { findUnique: mocks.chatbotFindUnique },
    participant: { findUnique: mocks.participantFindUnique },
    participation: { findUnique: vi.fn() },
  },
}))

import { POST as manageChatPost } from '../src/app/api/manage/chat/route'
import {
  getChatbotOr404,
  getParticipantId,
  withChatbotAuth,
} from '../src/lib/server/apiGuards'
import { proxy } from '../src/proxy'

const SIGNING_KEY = 'assessment-test-signing-key'
const AUTH_ISSUER = 'https://auth.test'
const API_ISSUER = 'https://api.test'
const CHATBOT_ID = '8f9c2e1d-4b7a-4c3e-9f5d-1a2b3c4d5e6f'
const ASSESSMENT_COOKIE = 'next-auth.participant-session-token'

async function sign({
  issuer,
  role = 'PARTICIPANT',
  expiresIn = '1h',
  signingKey = SIGNING_KEY,
}: {
  issuer: string
  role?: string
  expiresIn?: string
  signingKey?: string
}) {
  return new SignJWT({ role })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject('participant-1')
    .setIssuer(issuer)
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(new TextEncoder().encode(signingKey))
}

function request(path: string, cookies: Record<string, string> = {}) {
  return new NextRequest(new URL(path, 'https://assessment-chat.test'), {
    headers: {
      cookie: Object.entries(cookies)
        .map(([name, value]) => `${name}=${value}`)
        .join('; '),
    },
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubEnv('APP_SECRET', SIGNING_KEY)
  vi.stubEnv('APP_ORIGIN_AUTH', AUTH_ISSUER)
  vi.stubEnv('APP_ORIGIN_API', API_ISSUER)
  mocks.participantFindUnique.mockResolvedValue({
    isActive: true,
    accounts: [{ type: 'oidc' }],
  })
})

afterEach(() => vi.unstubAllEnvs())

describe('assessment mode identity resolution', () => {
  beforeEach(() => vi.stubEnv('CHAT_ASSESSMENT_MODE', 'true'))

  test('accepts the assessment session cookie', async () => {
    const token = await sign({ issuer: AUTH_ISSUER })
    const result = await getParticipantId(
      request('/api', { [ASSESSMENT_COOKIE]: token })
    )
    expect(result).toEqual({
      participantId: 'participant-1',
      authMode: 'account',
    })
  })

  test.each([
    ['wrong issuer', { issuer: API_ISSUER }],
    ['wrong role', { issuer: AUTH_ISSUER, role: 'LECTURER' }],
    ['expired', { issuer: AUTH_ISSUER, expiresIn: '-1h' }],
    [
      'wrong signing key',
      { issuer: AUTH_ISSUER, signingKey: 'another-signing-key' },
    ],
  ])('refuses a session with %s', async (_label, claims) => {
    const token = await sign(claims)
    const result = await getParticipantId(
      request('/api', { [ASSESSMENT_COOKIE]: token })
    )
    expect(result).toHaveProperty('response')
  })

  test('ignores the regular participant cookie', async () => {
    const token = await sign({ issuer: API_ISSUER })
    const result = await getParticipantId(
      request('/api', { participant_token: token })
    )
    expect(result).toHaveProperty('response')
  })

  test('ignores guest and embed cookies and bearer tokens', async () => {
    const result = await getParticipantId(
      new NextRequest(new URL('/api', 'https://assessment-chat.test'), {
        headers: {
          cookie: 'chat_participant_token=x; chat_pwa_embed_token=y',
          authorization: 'Bearer z',
        },
      })
    )
    expect(result).toHaveProperty('response')
  })

  test('regular mode still reads participant_token with the API issuer', async () => {
    vi.stubEnv('CHAT_ASSESSMENT_MODE', 'false')
    const token = await sign({ issuer: API_ISSUER })
    const regular = await getParticipantId(
      request('/api', { participant_token: token })
    )
    expect(regular).toEqual({
      participantId: 'participant-1',
      authMode: 'account',
    })

    const assessmentToken = await sign({ issuer: AUTH_ISSUER })
    const refused = await getParticipantId(
      request('/api', { [ASSESSMENT_COOKIE]: assessmentToken })
    )
    expect(refused).toHaveProperty('response')
  })

  test('withChatbotAuth refuses a regular session', async () => {
    const token = await sign({ issuer: API_ISSUER })
    const result = await withChatbotAuth(
      request('/api', { participant_token: token }),
      CHATBOT_ID
    )
    expect(result).toHaveProperty('response')
  })
})

describe('getChatbotOr404 assessment gating', () => {
  test('requires an assessment-enabled course in assessment mode', async () => {
    vi.stubEnv('CHAT_ASSESSMENT_MODE', 'true')
    mocks.chatbotFindUnique.mockResolvedValue(null)
    const result = await getChatbotOr404(CHATBOT_ID, { id: true })
    expect(result).toHaveProperty('response')
    expect(mocks.chatbotFindUnique.mock.calls[0][0].where.course).toEqual({
      deletionRequestedAt: null,
      isAssessmentEnabled: true,
    })
  })

  test('does not filter on assessment in regular mode', async () => {
    mocks.chatbotFindUnique.mockResolvedValue(null)
    await getChatbotOr404(CHATBOT_ID, { id: true })
    expect(mocks.chatbotFindUnique.mock.calls[0][0].where.course).toEqual({
      deletionRequestedAt: null,
    })
  })
})

describe('assessment mode entry points', () => {
  const blocked = [
    '/auth/lti',
    '/auth/elearning',
    '/auth/pwa-embed',
    '/manage',
    '/manage/anything',
    '/preview/' + CHATBOT_ID,
    '/api/manage/capabilities',
    '/api/manage/chatbots/x/preview/chat',
  ]

  test.each(
    blocked
  )('proxy returns 404 for %s in assessment mode', async (path) => {
    vi.stubEnv('CHAT_ASSESSMENT_MODE', 'true')
    const response = await proxy(request(path))
    expect(response.status).toBe(404)
  })

  test('proxy does not block those paths in regular mode', async () => {
    const response = await proxy(request('/auth/lti'))
    expect(response.status).not.toBe(404)
  })

  test('proxy redirects a chatbot page without a valid session to noLogin', async () => {
    vi.stubEnv('CHAT_ASSESSMENT_MODE', 'true')
    const regular = await sign({ issuer: API_ISSUER })
    const response = await proxy(
      request('/' + CHATBOT_ID, { participant_token: regular })
    )
    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toContain('/noLogin')
  })

  test('proxy lets a chatbot page through with the assessment session', async () => {
    vi.stubEnv('CHAT_ASSESSMENT_MODE', 'true')
    const token = await sign({ issuer: AUTH_ISSUER })
    const response = await proxy(
      request('/' + CHATBOT_ID, { [ASSESSMENT_COOKIE]: token })
    )
    expect(response.status).toBe(200)
  })

  test('the manage chat handler returns 404 in assessment mode', async () => {
    vi.stubEnv('CHAT_ASSESSMENT_MODE', 'true')
    const response = await manageChatPost(request('/api/manage/chat'))
    expect(response.status).toBe(404)
  })
})
