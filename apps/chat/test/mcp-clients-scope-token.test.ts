import { exportPKCS8, generateKeyPair, jwtVerify, type KeyLike } from 'jose'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import {
  createAuthHeaders,
  type MCPRequestContext,
  type MCPServerConfig,
} from '../src/services/mcpClients'
import {
  canLoadMCPServer,
  DOC_QUERY_SCOPE_TOKEN_HEADER,
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
  authSecret: 'transport-token',
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

  test('keeps transport auth separate from the scoped bearer token', async () => {
    const headers = await createAuthHeaders(SCOPE_SERVER, TEST_CONTEXT)
    const token = headers[DOC_QUERY_SCOPE_TOKEN_HEADER]?.replace(/^Bearer /, '')

    expect(token).toBeTruthy()
    expect(headers.Authorization).toBe('Bearer transport-token')
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

  test('retains scope-only authentication for standalone KB deployments', async () => {
    const headers = await createAuthHeaders(
      { ...SCOPE_SERVER, authSecret: undefined },
      TEST_CONTEXT
    )

    expect(headers.Authorization).toBeUndefined()
    expect(headers[DOC_QUERY_SCOPE_TOKEN_HEADER]).toMatch(/^Bearer /)
  })

  test.each([
    'none',
    'bearer',
  ])('rejects %s KB auth without a transport secret', async (authType) => {
    await expect(
      createAuthHeaders(
        { ...SCOPE_SERVER, authType, authSecret: undefined },
        TEST_CONTEXT
      )
    ).rejects.toThrow('Doc Query transport authentication is invalid')
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

  test('preserves legacy bearer transport authentication during rollout', async () => {
    const legacyServer = {
      ...SCOPE_SERVER,
      authType: 'bearer',
      authSecret: 'legacy-secret-must-not-leave-klicker',
    }

    expect(canLoadMCPServer(legacyServer, TEST_CONTEXT)).toBe(true)
    const headers = await createAuthHeaders(legacyServer, TEST_CONTEXT)
    const token = headers[DOC_QUERY_SCOPE_TOKEN_HEADER]?.replace(/^Bearer /, '')

    expect(token).toBeTruthy()
    expect(headers.Authorization).toBe(`Bearer ${legacyServer.authSecret}`)
    expect(headers).not.toHaveProperty('Chatbot-ID')
    await expect(
      jwtVerify(token!, publicKey, {
        algorithms: ['ES256'],
        issuer: TEST_ISSUER,
        audience: TEST_AUDIENCE,
      })
    ).resolves.toBeTruthy()
  })

  test('rejects a scope header that would replace transport authorization', async () => {
    await expect(
      createAuthHeaders(
        {
          ...SCOPE_SERVER,
          parameters: { scope_token: { header: 'authorization' } },
        },
        TEST_CONTEXT
      )
    ).rejects.toThrow('Invalid Doc Query scope-token header')
  })

  test('accepts a valid custom scope header', async () => {
    const headers = await createAuthHeaders(
      {
        ...SCOPE_SERVER,
        parameters: { scope_token: { header: 'X-Custom-Scope' } },
      },
      TEST_CONTEXT
    )

    expect(headers['X-Custom-Scope']).toMatch(/^Bearer /)
    expect(headers.Authorization).toBe('Bearer transport-token')
  })

  test.each([
    '__proto__',
    'constructor',
    'prototype',
    'Content-Type',
    'Chatbot-ID',
    'Mcp-Session-Id',
  ])('rejects reserved scope header %s', async (header) => {
    await expect(
      createAuthHeaders(
        { ...SCOPE_SERVER, parameters: { scope_token: { header } } },
        TEST_CONTEXT
      )
    ).rejects.toThrow('Invalid Doc Query scope-token header')
  })

  test('rejects malformed scope-token configuration', async () => {
    await expect(
      createAuthHeaders(
        {
          ...SCOPE_SERVER,
          parameters: { scope_token: 'authorization' },
        },
        TEST_CONTEXT
      )
    ).rejects.toThrow('Invalid Doc Query scope-token configuration')
  })

  test.each([
    null,
    [],
    'scope_token',
  ])('rejects malformed server parameters %j', async (parameters) => {
    await expect(
      createAuthHeaders({ ...SCOPE_SERVER, parameters }, TEST_CONTEXT)
    ).rejects.toThrow('Invalid Doc Query scope-token configuration')
  })

  test('rejects an explicitly null scope-token header', async () => {
    await expect(
      createAuthHeaders(
        {
          ...SCOPE_SERVER,
          parameters: { scope_token: { header: null } },
        },
        TEST_CONTEXT
      )
    ).rejects.toThrow('Invalid Doc Query scope-token header')
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
