import { exportPKCS8, generateKeyPair, jwtVerify, type KeyLike } from 'jose'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import {
  createAuthHeaders,
  type MCPRequestContext,
  type MCPServerConfig,
} from '../src/services/mcpClients'
import {
  canLoadMCPServer,
  DOC_QUERY_TOOL_NAME,
  resolveMcpScopeSessionId,
} from '../src/services/mcpScope'

const TEST_ISSUER = 'https://chat.klicker.test'
const TEST_AUDIENCE = 'klicker-doc-query-test'
const TEST_KB_ID = '7016810d-31e9-4b39-9529-cd46feb2fb63'
const TEST_CHATBOT_ID = '8f9c2e1d-4b7a-4c3e-9f5d-1a2b3c4d5e6f'
const TEST_CONTEXT: MCPRequestContext = {
  chatbotId: TEST_CHATBOT_ID,
  participantId: 'participant-must-not-leave-klicker',
  authMode: 'account',
  kbId: TEST_KB_ID,
  sessionId: 'opaque-chat-session',
}
const SCOPE_SERVER: MCPServerConfig = {
  id: 'kb-server',
  name: 'KB',
  url: 'http://doc-query.test/mcp',
  authType: 'scope_token',
  passChatbotId: true,
}

let publicKey: KeyLike

describe('doc-query MCP scope authentication', () => {
  beforeEach(async () => {
    const keyPair = await generateKeyPair('ES256')
    publicKey = keyPair.publicKey
    vi.stubEnv(
      'DOC_QUERY_SCOPE_PRIVATE_KEY',
      await exportPKCS8(keyPair.privateKey)
    )
    vi.stubEnv('DOC_QUERY_SCOPE_KID', 'test-key')
    vi.stubEnv('DOC_QUERY_SCOPE_ISSUER', TEST_ISSUER)
    vi.stubEnv('DOC_QUERY_SCOPE_AUDIENCE', TEST_AUDIENCE)
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  test('sends only a scoped bearer token to the KB server', async () => {
    const headers = await createAuthHeaders(SCOPE_SERVER, TEST_CONTEXT)
    const token = headers.Authorization?.replace(/^Bearer /, '')

    expect(token).toBeTruthy()
    expect(headers).not.toHaveProperty('Chatbot-ID')

    const { payload } = await jwtVerify(token!, publicKey, {
      algorithms: ['ES256'],
      issuer: TEST_ISSUER,
      audience: TEST_AUDIENCE,
    })
    expect(payload).toMatchObject({
      sub: TEST_CONTEXT.sessionId,
      kb_id: TEST_KB_ID,
      chatbot_id: TEST_CHATBOT_ID,
    })
    expect(payload).not.toHaveProperty('participantId')
    expect(payload).not.toHaveProperty('participant_id')
  })

  test('skips scoped servers when no enabled KB was resolved', () => {
    expect(
      canLoadMCPServer(SCOPE_SERVER, {
        chatbotId: TEST_CHATBOT_ID,
        participantId: TEST_CONTEXT.participantId,
        sessionId: TEST_CONTEXT.sessionId,
      })
    ).toBe(false)
  })

  test('never sends a KB scope token to another server', async () => {
    const otherServer = { ...SCOPE_SERVER, name: 'Other' }

    expect(canLoadMCPServer(otherServer, TEST_CONTEXT)).toBe(false)
    await expect(createAuthHeaders(otherServer, TEST_CONTEXT)).rejects.toThrow(
      'Scoped knowledge retrieval is not available'
    )
  })

  test('rejects a KB server without scoped authentication', async () => {
    const misconfiguredServer = { ...SCOPE_SERVER, authType: 'none' }

    expect(canLoadMCPServer(misconfiguredServer, TEST_CONTEXT)).toBe(false)
    await expect(
      createAuthHeaders(misconfiguredServer, TEST_CONTEXT)
    ).rejects.toThrow('Scoped knowledge retrieval is not available')
  })

  test('keeps the citation card aligned with the runtime tool name', () => {
    expect(DOC_QUERY_TOOL_NAME).toBe('KB_doc_query')
  })

  test('never signs a client-supplied foreign thread as the session subject', () => {
    expect(
      resolveMcpScopeSessionId({
        requestedThreadId: 'foreign-thread',
        owningThreadId: undefined,
        fallbackId: 'server-request',
      })
    ).toBeNull()
    expect(
      resolveMcpScopeSessionId({
        requestedThreadId: 'owned-thread',
        owningThreadId: 'owned-thread',
        fallbackId: 'server-request',
      })
    ).toBe('owned-thread')
    expect(
      resolveMcpScopeSessionId({
        requestedThreadId: null,
        owningThreadId: undefined,
        fallbackId: 'server-request',
      })
    ).toBe('server-request')
  })
})
