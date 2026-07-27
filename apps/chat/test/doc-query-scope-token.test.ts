import { exportPKCS8, generateKeyPair, jwtVerify, type KeyLike } from 'jose'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import {
  DocQueryScopeTokenError,
  signDocQueryScopeToken,
} from '../src/lib/server/docQueryScopeToken'

const TEST_ISSUER = 'https://chat.klicker.test'
const TEST_AUDIENCE = 'klicker-doc-query-test'
const TEST_KID = 'test-key-2026-07'
const TEST_KB_ID = '7016810d-31e9-4b39-9529-cd46feb2fb63'
const TEST_CHATBOT_ID = '8f9c2e1d-4b7a-4c3e-9f5d-1a2b3c4d5e6f'
const TEST_SESSION_ID = 'opaque-session-4ca8d6a4'
const TEST_JTI = '9b3cc7c6-3a11-4f6b-93d0-4b3678cf89fc'

let publicKey: KeyLike

describe('signDocQueryScopeToken', () => {
  beforeEach(async () => {
    const keyPair = await generateKeyPair('ES256')
    publicKey = keyPair.publicKey
    vi.stubEnv(
      'DOC_QUERY_SCOPE_PRIVATE_KEY',
      await exportPKCS8(keyPair.privateKey)
    )
    vi.stubEnv('DOC_QUERY_SCOPE_KID', TEST_KID)
    vi.stubEnv('DOC_QUERY_SCOPE_ISSUER', TEST_ISSUER)
    vi.stubEnv('DOC_QUERY_SCOPE_AUDIENCE', TEST_AUDIENCE)
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllEnvs()
  })

  test('mints the five-minute ES256 scope contract', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-27T12:00:00.000Z'))

    const token = await signDocQueryScopeToken({
      kbId: TEST_KB_ID,
      chatbotId: TEST_CHATBOT_ID,
      sessionId: TEST_SESSION_ID,
      jti: TEST_JTI,
    })
    const { payload, protectedHeader } = await jwtVerify(token, publicKey, {
      algorithms: ['ES256'],
      issuer: TEST_ISSUER,
      audience: TEST_AUDIENCE,
    })

    expect(protectedHeader).toMatchObject({
      alg: 'ES256',
      typ: 'JWT',
      kid: TEST_KID,
    })
    expect(payload).toMatchObject({
      iss: TEST_ISSUER,
      aud: TEST_AUDIENCE,
      sub: TEST_SESSION_ID,
      jti: TEST_JTI,
      kb_id: TEST_KB_ID,
      chatbot_id: TEST_CHATBOT_ID,
    })
    expect(payload.exp! - payload.iat!).toBe(300)
  })

  test.each([
    'DOC_QUERY_SCOPE_PRIVATE_KEY',
    'DOC_QUERY_SCOPE_KID',
    'DOC_QUERY_SCOPE_ISSUER',
    'DOC_QUERY_SCOPE_AUDIENCE',
  ])('fails closed when %s is missing', async (name) => {
    delete process.env[name]

    await expect(
      signDocQueryScopeToken({
        kbId: TEST_KB_ID,
        chatbotId: TEST_CHATBOT_ID,
        sessionId: TEST_SESSION_ID,
        jti: TEST_JTI,
      })
    ).rejects.toBeInstanceOf(DocQueryScopeTokenError)
  })

  test('fails closed without exposing invalid private-key material', async () => {
    vi.stubEnv('DOC_QUERY_SCOPE_PRIVATE_KEY', 'not-a-private-key')

    await expect(
      signDocQueryScopeToken({
        kbId: TEST_KB_ID,
        chatbotId: TEST_CHATBOT_ID,
        sessionId: TEST_SESSION_ID,
        jti: TEST_JTI,
      })
    ).rejects.toThrow('Scope token signing failed')
  })
})
