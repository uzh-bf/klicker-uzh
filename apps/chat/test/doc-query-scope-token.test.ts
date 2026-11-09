import { exportPKCS8, generateKeyPair, jwtVerify, type KeyLike } from 'jose'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import {
  createDocQueryScopedFetch,
  DocQueryScopeTokenError,
  signDocQueryScopeToken,
} from '../src/lib/server/docQueryScopeToken'
import { DOC_QUERY_SCOPE_TOKEN_HEADER } from '../src/services/mcpScope'

const TEST_ISSUER = 'https://chat.klicker.test'
const TEST_AUDIENCE = 'klicker-doc-query-test'
const TEST_KID = 'test-key-2026-08'
const TEST_KB_ID = '7016810d-31e9-4b39-9529-cd46feb2fb63'
const TEST_KB_ID_2 = '8016810d-31e9-4b39-9529-cd46feb2fb63'
const TEST_CHATBOT_ID = '8f9c2e1d-4b7a-4c3e-9f5d-1a2b3c4d5e6f'
const TEST_SESSION_ID = 'thread-4ca8d6a4'
const TEST_JTI = '9b3cc7c6-3a11-4f6b-93d0-4b3678cf89fc'

let publicKey: KeyLike

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
  vi.unstubAllGlobals()
})

describe('signDocQueryScopeToken', () => {
  test('mints a five-minute ES256 scope token with the reviewed claims', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-31T12:00:00.000Z'))

    const token = await signDocQueryScopeToken({
      kbIds: [TEST_KB_ID],
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
    expect(Object.keys(payload).sort()).toEqual(
      ['aud', 'chatbot_id', 'exp', 'iat', 'iss', 'jti', 'kb_id', 'sub'].sort()
    )
  })

  test('emits multiple knowledge-base IDs as an array claim', async () => {
    const token = await signDocQueryScopeToken({
      kbIds: [TEST_KB_ID, TEST_KB_ID_2],
      chatbotId: TEST_CHATBOT_ID,
      sessionId: TEST_SESSION_ID,
      jti: TEST_JTI,
    })
    const { payload } = await jwtVerify(token, publicKey, {
      algorithms: ['ES256'],
      issuer: TEST_ISSUER,
      audience: TEST_AUDIENCE,
    })

    expect(payload.kb_id).toEqual([TEST_KB_ID, TEST_KB_ID_2])
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
        kbIds: [TEST_KB_ID],
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
        kbIds: [TEST_KB_ID],
        chatbotId: TEST_CHATBOT_ID,
        sessionId: TEST_SESSION_ID,
        jti: TEST_JTI,
      })
    ).rejects.toThrow('Scope token signing failed')
  })
})

describe('createDocQueryScopedFetch', () => {
  const TARGET = new URL('https://doc-query.example.test/mcp/klicker/kb')
  let fetchSpy: ReturnType<typeof vi.fn>

  beforeEach(() => {
    fetchSpy = vi.fn(async () => new Response('{}', { status: 200 }))
    vi.stubGlobal('fetch', fetchSpy)
  })

  function createFetch(): ReturnType<typeof createDocQueryScopedFetch> {
    return createDocQueryScopedFetch({
      target: TARGET,
      kbIds: [TEST_KB_ID],
      chatbotId: TEST_CHATBOT_ID,
      sessionId: TEST_SESSION_ID,
    })
  }

  test('mints a fresh token per request and strips stale credentials', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-08-31T12:00:00.000Z'))
    const scopedFetch = createFetch()
    const controller = new AbortController()

    const response = await scopedFetch(TARGET.href, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json, text/event-stream',
        Authorization: 'Bearer expired-shared-bearer',
        [DOC_QUERY_SCOPE_TOKEN_HEADER]: 'Bearer stale-scope-token',
      },
      body: '{"jsonrpc":"2.0"}',
      redirect: 'manual',
      signal: controller.signal,
    })

    expect(response.status).toBe(200)
    expect(fetchSpy).toHaveBeenCalledTimes(1)
    const [requestUrl, init] = fetchSpy.mock.calls[0]
    expect(new URL(requestUrl as URL).href).toBe(TARGET.href)
    expect(init.method).toBe('POST')
    expect(init.body).toBe('{"jsonrpc":"2.0"}')
    expect(init.signal).toBe(controller.signal)
    expect(init.redirect).toBe('error')

    const headers = new Headers(init.headers as HeadersInit)
    expect(headers.get('authorization')).toBeNull()
    expect(headers.get('accept')).toBe('application/json, text/event-stream')

    const firstToken = headers
      .get(DOC_QUERY_SCOPE_TOKEN_HEADER)
      ?.replace('Bearer ', '')
    const { payload } = await jwtVerify(firstToken ?? '', publicKey, {
      algorithms: ['ES256'],
      issuer: TEST_ISSUER,
      audience: TEST_AUDIENCE,
    })
    expect(payload).toMatchObject({
      sub: TEST_SESSION_ID,
      kb_id: TEST_KB_ID,
      chatbot_id: TEST_CHATBOT_ID,
    })
    expect(payload.exp! - payload.iat!).toBe(300)

    await scopedFetch(TARGET, { method: 'GET' })
    const secondToken = new Headers(
      fetchSpy.mock.calls[1][1].headers as HeadersInit
    ).get(DOC_QUERY_SCOPE_TOKEN_HEADER)
    expect(secondToken).toBeTruthy()
    expect(secondToken).not.toBe(`Bearer ${firstToken}`)
  })

  test('rejects another destination before signing or fetching', async () => {
    // Signing material stays absent so a wrong ordering surfaces as the
    // configuration error instead of the target mismatch.
    delete process.env.DOC_QUERY_SCOPE_PRIVATE_KEY
    const scopedFetch = createFetch()

    await expect(
      scopedFetch('https://other.example.test/mcp/klicker/kb', {
        method: 'POST',
      })
    ).rejects.toThrow('Scope token target mismatch')
    await expect(
      scopedFetch(new URL('https://doc-query.example.test/mcp/klicker/kb/'), {
        method: 'POST',
      })
    ).rejects.toThrow('Scope token target mismatch')

    expect(fetchSpy).not.toHaveBeenCalled()
  })

  test('blocks the network call when signing fails', async () => {
    vi.stubEnv('DOC_QUERY_SCOPE_PRIVATE_KEY', 'not-a-private-key')
    const scopedFetch = createFetch()

    await expect(
      scopedFetch(TARGET, { method: 'POST' })
    ).rejects.toBeInstanceOf(DocQueryScopeTokenError)

    expect(fetchSpy).not.toHaveBeenCalled()
  })
})
