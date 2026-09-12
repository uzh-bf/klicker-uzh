import { prisma } from '@klicker-uzh/prisma'
import { ChatbotStatus } from '@klicker-uzh/prisma/client'
import { exportPKCS8, generateKeyPair, jwtVerify, type KeyLike } from 'jose'
import { NextRequest } from 'next/server'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import {
  DOC_QUERY_SCOPE_TOKEN_TTL_SECONDS,
  signDocQueryScopeToken,
} from '../src/lib/server/docQueryScopeToken'
import { POST } from '../src/app/api/partners/doc-query-scope/route'

const mocks = vi.hoisted(() => ({
  grantFindUnique: vi.fn(),
  grantUpdate: vi.fn(),
  chatbotFindUnique: vi.fn(),
}))

vi.mock('@klicker-uzh/prisma', () => ({
  prisma: {
    partnerChatbotGrant: {
      findUnique: mocks.grantFindUnique,
      update: mocks.grantUpdate,
    },
    chatbot: {
      findUnique: mocks.chatbotFindUnique,
    },
  },
}))

const TEST_ISSUER = 'https://chat.klicker.test'
const TEST_AUDIENCE = 'klicker-doc-query-test'
const TEST_KID = 'test-key-2026-08'
const TEST_KB_ID = '7016810d-31e9-4b39-9529-cd46feb2fb63'
const TEST_CHATBOT_ID = '8f9c2e1d-4b7a-4c3e-9f5d-1a2b3c4d5e6f'
const TEST_COURSE_ID = '22222222-3333-4444-5555-666666666666'
// Synthetic partner auth value used only inside this test suite.
const PARTNER_FIXTURE = 'askuzh-partner-fixture-1'

let publicKey: KeyLike

function partnerRequest(body: Record<string, unknown>, key?: string) {
  return new NextRequest('http://localhost/api/partners/doc-query-scope', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(key ? { 'x-api-key': key } : {}),
    },
    body: JSON.stringify(body),
  })
}

function publishedChatbotFixture(
  overrides: Partial<Record<string, unknown>> = {}
) {
  return {
    id: TEST_CHATBOT_ID,
    name: 'IuW Finance',
    courseId: TEST_COURSE_ID,
    status: ChatbotStatus.PUBLISHED,
    owner: { aiFeaturesEnabled: true },
    mcpConfigurations: [
      {
        chatMode: 'default',
        parameters: {
          kb_id: TEST_KB_ID,
          required: true,
          toolAlias: 'doc_query',
        },
        mcpServer: { id: 'kb-server-1', name: 'KB' },
      },
    ],
    ...overrides,
  }
}

function stubGrantFixture(revokedAt: Date | null = null) {
  mocks.grantFindUnique.mockResolvedValue({ revokedAt })
  mocks.grantUpdate.mockResolvedValue({ id: 'grant-1' })
}

describe('partner doc-query scope issuance', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    const keyPair = await generateKeyPair('ES256')
    publicKey = keyPair.publicKey
    vi.stubEnv(
      'DOC_QUERY_SCOPE_PRIVATE_KEY',
      await exportPKCS8(keyPair.privateKey)
    )
    vi.stubEnv('DOC_QUERY_SCOPE_KID', TEST_KID)
    vi.stubEnv('DOC_QUERY_SCOPE_ISSUER', TEST_ISSUER)
    vi.stubEnv('DOC_QUERY_SCOPE_AUDIENCE', TEST_AUDIENCE)
    vi.stubEnv(
      'PARTNER_DOC_QUERY_KEYS',
      JSON.stringify({ askuzh: PARTNER_FIXTURE })
    )
    vi.stubEnv('NEXT_PUBLIC_PWA_URL', 'https://pwa.klicker.test')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  test('signs partner claims that participant tokens omit', async () => {
    const partnerToken = await signDocQueryScopeToken({
      kbIds: [TEST_KB_ID],
      chatbotId: TEST_CHATBOT_ID,
      sessionId: 'partner:askuzh',
      jti: 'jti-1',
      partnerId: 'askuzh',
      chatbotName: 'IuW Finance',
      chatbotUrl: 'https://pwa.klicker.test/chat',
    })
    const studentToken = await signDocQueryScopeToken({
      kbIds: [TEST_KB_ID],
      chatbotId: TEST_CHATBOT_ID,
      sessionId: 'thread-1',
      jti: 'jti-2',
    })

    const partner = (
      await jwtVerify(partnerToken, publicKey, {
        algorithms: ['ES256'],
        issuer: TEST_ISSUER,
        audience: TEST_AUDIENCE,
      })
    ).payload
    const student = (
      await jwtVerify(studentToken, publicKey, {
        algorithms: ['ES256'],
        issuer: TEST_ISSUER,
        audience: TEST_AUDIENCE,
      })
    ).payload

    expect(partner.partner).toBe('askuzh')
    expect(partner.chatbot_name).toBe('IuW Finance')
    expect(partner.chatbot_url).toBe('https://pwa.klicker.test/chat')
    expect(student.partner).toBeUndefined()
    expect(student.chatbot_name).toBeUndefined()
    expect(student.chatbot_url).toBeUndefined()
  })

  test('issues a scope token derived from the granted chatbot only', async () => {
    stubGrantFixture()
    mocks.chatbotFindUnique.mockResolvedValue(publishedChatbotFixture())

    const response = await POST(
      partnerRequest({ chatbotId: TEST_CHATBOT_ID }, PARTNER_FIXTURE)
    )
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.expiresIn).toBe(DOC_QUERY_SCOPE_TOKEN_TTL_SECONDS)

    const { payload } = await jwtVerify(body.token, publicKey, {
      algorithms: ['ES256'],
      issuer: TEST_ISSUER,
      audience: TEST_AUDIENCE,
    })
    expect(payload.partner).toBe('askuzh')
    expect(payload.chatbot_id).toBe(TEST_CHATBOT_ID)
    expect(payload.kb_id).toBe(TEST_KB_ID)
    expect(payload.sub).toBe('partner:askuzh')
    expect(payload.chatbot_name).toBe('IuW Finance')
    expect(payload.chatbot_url).toBe(
      `https://pwa.klicker.test/course/${TEST_COURSE_ID}/chatbot/${TEST_CHATBOT_ID}/chat`
    )
    expect(mocks.grantUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          partnerId_chatbotId: {
            partnerId: 'askuzh',
            chatbotId: TEST_CHATBOT_ID,
          },
        },
      })
    )
  })

  test('ignores caller-supplied knowledge-base ids', async () => {
    stubGrantFixture()
    mocks.chatbotFindUnique.mockResolvedValue(publishedChatbotFixture())

    const response = await POST(
      partnerRequest(
        {
          chatbotId: TEST_CHATBOT_ID,
          kbIds: ['99999999-3333-4444-5555-666666666666'],
        },
        PARTNER_FIXTURE
      )
    )
    const body = await response.json()
    const { payload } = await jwtVerify(body.token, publicKey, {
      algorithms: ['ES256'],
      issuer: TEST_ISSUER,
      audience: TEST_AUDIENCE,
    })
    expect(payload.kb_id).toBe(TEST_KB_ID)
  })

  test('rejects missing and unknown partner keys', async () => {
    const missing = await POST(partnerRequest({ chatbotId: TEST_CHATBOT_ID }))
    expect(missing.status).toBe(401)

    const wrong = await POST(
      partnerRequest({ chatbotId: TEST_CHATBOT_ID }, 'wrong-key')
    )
    expect(wrong.status).toBe(401)
    expect(mocks.grantFindUnique).not.toHaveBeenCalled()
  })

  test('denies issuance without an active grant', async () => {
    mocks.grantFindUnique.mockResolvedValue(null)
    const response = await POST(
      partnerRequest({ chatbotId: TEST_CHATBOT_ID }, PARTNER_FIXTURE)
    )
    expect(response.status).toBe(404)
    expect(mocks.chatbotFindUnique).not.toHaveBeenCalled()
  })

  test('denies revoked grants even while the chatbot stays published', async () => {
    stubGrantFixture(new Date('2026-09-01T00:00:00.000Z'))
    mocks.chatbotFindUnique.mockResolvedValue(publishedChatbotFixture())
    const response = await POST(
      partnerRequest({ chatbotId: TEST_CHATBOT_ID }, PARTNER_FIXTURE)
    )
    expect(response.status).toBe(403)
    expect((await response.json()).code).toBe('PARTNER_ACCESS_REVOKED')
  })

  test('denies unpublished chatbots', async () => {
    stubGrantFixture()
    mocks.chatbotFindUnique.mockResolvedValue(
      publishedChatbotFixture({ status: ChatbotStatus.DRAFT })
    )
    const response = await POST(
      partnerRequest({ chatbotId: TEST_CHATBOT_ID }, PARTNER_FIXTURE)
    )
    expect(response.status).toBe(404)
  })

  test('denies chatbots whose owner lacks AI features', async () => {
    stubGrantFixture()
    mocks.chatbotFindUnique.mockResolvedValue(
      publishedChatbotFixture({
        owner: { aiFeaturesEnabled: false },
      })
    )
    const response = await POST(
      partnerRequest({ chatbotId: TEST_CHATBOT_ID }, PARTNER_FIXTURE)
    )
    expect(response.status).toBe(403)
    expect((await response.json()).code).toBe('AI_FEATURES_DISABLED')
  })

  test('reports scope unavailability without a scoped KB binding', async () => {
    stubGrantFixture()
    mocks.chatbotFindUnique.mockResolvedValue(
      publishedChatbotFixture({ mcpConfigurations: [] })
    )
    const response = await POST(
      partnerRequest({ chatbotId: TEST_CHATBOT_ID }, PARTNER_FIXTURE)
    )
    expect(response.status).toBe(409)
    expect((await response.json()).code).toBe('SCOPE_UNAVAILABLE')
  })
})
