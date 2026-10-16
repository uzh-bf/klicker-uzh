import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

const createSDKMCPClientMock = vi.hoisted(() => vi.fn())
const signDocQueryScopeTokenMock = vi.hoisted(() => vi.fn())
const transportConstructorMock = vi.hoisted(() => vi.fn())
const clientToolsMock = vi.hoisted(() => vi.fn())
const scopedFetchMock = vi.hoisted(() => vi.fn())
const createDocQueryScopedFetchMock = vi.hoisted(() =>
  vi.fn(() => scopedFetchMock)
)

vi.mock('@ai-sdk/mcp', () => ({
  experimental_createMCPClient: createSDKMCPClientMock,
}))

vi.mock('@/src/lib/server/docQueryScopeToken', () => ({
  createDocQueryScopedFetch: createDocQueryScopedFetchMock,
  signDocQueryScopeToken: signDocQueryScopeTokenMock,
}))

vi.mock('@klicker-uzh/util', () => ({
  safeDecrypt: (value: string) => value,
}))

vi.mock('@modelcontextprotocol/sdk/client/streamableHttp.js', () => ({
  StreamableHTTPClientTransport: class {
    constructor(
      readonly url: URL,
      readonly options: { requestInit: { headers: Record<string, string> } }
    ) {
      transportConstructorMock(url, options)
    }
  },
}))

import {
  REQUIRED_MCP_UNAVAILABLE_CODE,
  RequiredMCPUnavailableError,
} from '../src/lib/server/mcpRuntimePolicy'
import {
  getAggregatedMCPTools,
  type MCPServerWithConfig,
} from '../src/services/mcpClients'
import {
  assertDocQueryTransportSecurity,
  DOC_QUERY_SCOPE_TOKEN_HEADER,
  DOC_QUERY_SCOPED_ROUTE_PATH,
  normalizeDocQueryKbId,
  resolveMcpScope,
} from '../src/services/mcpScope'

const KB_ID = '7016810d-31e9-4b39-9529-cd46feb2bf63'
const CHATBOT_ID = '8f9c2e1d-4b7a-4c3e-9f5d-1a2b3c4d5e6f'
const SESSION_ID = 'thread-4ca8d6a4'
const SCOPED_SERVER_ID = 'b1b1a0c2-6a86-4f47-9e2d-2a8c58b1f0a4'
const SCOPED_LEGACY_URL = 'https://doc-query.svc.cluster.local'
const SCOPED_URL = `${SCOPED_LEGACY_URL}${DOC_QUERY_SCOPED_ROUTE_PATH}`

function stubScopedRouteEnv(
  overrides: Partial<Record<'serverId' | 'legacyUrl' | 'url', string>> = {}
): void {
  const values = {
    serverId: SCOPED_SERVER_ID,
    legacyUrl: SCOPED_LEGACY_URL,
    url: SCOPED_URL,
    ...overrides,
  }
  vi.stubEnv('DOC_QUERY_SCOPED_MCP_SERVER_ID', values.serverId)
  vi.stubEnv('DOC_QUERY_SCOPED_MCP_LEGACY_URL', values.legacyUrl)
  vi.stubEnv('DOC_QUERY_SCOPED_MCP_URL', values.url)
}

function createServer(
  overrides: Partial<MCPServerWithConfig['server']> = {},
  config: Partial<MCPServerWithConfig['config']> = {}
): MCPServerWithConfig {
  return {
    server: {
      id: 'kb-server',
      name: 'KB',
      url: 'https://mcp.example.test',
      authType: 'bearer',
      authSecret: 'opaque-transport-token',
      isActive: true,
      ...overrides,
    },
    config: {
      priority: 0,
      allowedTools: ['doc_query'],
      parameters: {
        required: true,
        toolAlias: 'doc_query',
        kb_id: KB_ID,
      },
      ...config,
    },
  }
}

describe('current-v3 Doc Query scope', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    signDocQueryScopeTokenMock.mockResolvedValue('scope-token')
    clientToolsMock.mockResolvedValue({ doc_query: {} })
    createSDKMCPClientMock.mockResolvedValue({ tools: clientToolsMock })
  })

  test('keeps bearer transport auth separate from the scope token header', async () => {
    await getAggregatedMCPTools([createServer()], CHATBOT_ID, {
      kbIds: [KB_ID],
      sessionId: SESSION_ID,
    })

    expect(transportConstructorMock).toHaveBeenCalledWith(
      new URL('https://mcp.example.test'),
      {
        requestInit: {
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer opaque-transport-token',
            [DOC_QUERY_SCOPE_TOKEN_HEADER]: 'Bearer scope-token',
          },
          redirect: 'error',
        },
      }
    )
    expect(signDocQueryScopeTokenMock).toHaveBeenCalledWith({
      kbIds: [KB_ID],
      chatbotId: CHATBOT_ID,
      sessionId: SESSION_ID,
      jti: expect.any(String),
    })
    expect(createSDKMCPClientMock).toHaveBeenCalledTimes(1)
    expect(clientToolsMock).toHaveBeenCalledTimes(1)
  })

  test('emits a multi-knowledge-base scope through one client and tool discovery', async () => {
    const secondKbId = '8016810d-31e9-4b39-9529-cd46feb2bf63'
    await getAggregatedMCPTools(
      [
        createServer(
          {},
          {
            parameters: {
              required: true,
              toolAlias: 'doc_query',
              kb_ids: [secondKbId, KB_ID],
            },
          }
        ),
      ],
      CHATBOT_ID,
      { kbIds: [KB_ID, secondKbId], sessionId: SESSION_ID }
    )

    expect(signDocQueryScopeTokenMock).toHaveBeenCalledWith({
      kbIds: [KB_ID, secondKbId],
      chatbotId: CHATBOT_ID,
      sessionId: SESSION_ID,
      jti: expect.any(String),
    })
    expect(createSDKMCPClientMock).toHaveBeenCalledTimes(1)
    expect(clientToolsMock).toHaveBeenCalledTimes(1)
  })

  test('does not treat authType scope_token as a scope activation', async () => {
    await expect(
      getAggregatedMCPTools(
        [createServer({ authType: 'scope_token' })],
        CHATBOT_ID,
        { kbIds: [KB_ID], sessionId: SESSION_ID }
      )
    ).rejects.toMatchObject({ code: REQUIRED_MCP_UNAVAILABLE_CODE })
    expect(signDocQueryScopeTokenMock).not.toHaveBeenCalled()
  })

  test('rejects credentials on a public cleartext endpoint', async () => {
    await expect(
      getAggregatedMCPTools(
        [createServer({ url: 'http://mcp.example.test' })],
        CHATBOT_ID,
        { kbIds: [KB_ID], sessionId: SESSION_ID }
      )
    ).rejects.toMatchObject({ code: REQUIRED_MCP_UNAVAILABLE_CODE })
    expect(signDocQueryScopeTokenMock).not.toHaveBeenCalled()
    expect(transportConstructorMock).not.toHaveBeenCalled()
  })

  test('accepts HTTPS and internal cleartext endpoints', async () => {
    const internalUrls = [
      'https://mcp.example.test',
      'http://doc-query.default.svc:8080',
      'http://doc-query.internal',
      'http://localhost:8080',
      'http://127.0.0.1:8080',
      'http://10.1.2.3',
      'http://172.16.0.9',
      'http://192.168.1.5',
    ]
    for (const url of internalUrls) {
      await getAggregatedMCPTools([createServer({ url })], CHATBOT_ID, {
        kbIds: [KB_ID],
        sessionId: SESSION_ID,
      })
      expect(transportConstructorMock).toHaveBeenCalledWith(
        new URL(url),
        expect.objectContaining({
          requestInit: expect.objectContaining({
            headers: expect.objectContaining({
              Authorization: 'Bearer opaque-transport-token',
            }),
          }),
        })
      )
    }
  })

  test('transport guard boundary cases', () => {
    expect(() =>
      assertDocQueryTransportSecurity('http://172.32.0.1')
    ).toThrowError(/HTTPS/)
    expect(() =>
      assertDocQueryTransportSecurity('ftp://mcp.example.test')
    ).toThrowError(/HTTPS/)
    expect(() => assertDocQueryTransportSecurity('not-a-url')).toThrowError(
      /invalid/
    )
    expect(() =>
      assertDocQueryTransportSecurity('http://[::1]:8080')
    ).not.toThrowError()
  })

  test('fails a required target without both scope values', async () => {
    await expect(
      getAggregatedMCPTools([createServer()], CHATBOT_ID)
    ).rejects.toMatchObject({ code: REQUIRED_MCP_UNAVAILABLE_CODE })
    expect(createSDKMCPClientMock).not.toHaveBeenCalled()
  })

  test('normalizes a valid UUID and rejects malformed bindings', () => {
    expect(normalizeDocQueryKbId(`  ${KB_ID.toUpperCase()} `)).toBe(KB_ID)

    expect(() => normalizeDocQueryKbId('not-a-uuid')).toThrowError(
      RequiredMCPUnavailableError
    )

    const target = {
      chatMode: 'tutor',
      parameters: { required: true, toolAlias: 'doc_query', kb_id: KB_ID },
      mcpServer: { id: 'kb-server', name: 'KB' },
    }
    expect(resolveMcpScope([target], 'tutor', [target])).toEqual([KB_ID])
    const explainerTarget = {
      ...target,
      chatMode: 'explainer',
      parameters: {
        required: true,
        toolAlias: 'doc_query',
        kb_id: KB_ID.toUpperCase(),
      },
    }
    expect(
      resolveMcpScope([target, explainerTarget], 'explainer', [explainerTarget])
    ).toEqual([KB_ID])
  })

  test('canonicalizes kb_ids and rejects mixed or mismatched scopes', () => {
    const secondKbId = '8016810d-31e9-4b39-9529-cd46feb2bf63'
    const tutorTarget = {
      chatMode: 'tutor',
      parameters: {
        required: true,
        toolAlias: 'doc_query',
        kb_ids: [secondKbId, KB_ID],
      },
      mcpServer: { id: 'kb-server', name: 'KB' },
    }
    const explainerTarget = {
      ...tutorTarget,
      chatMode: 'explainer',
      parameters: {
        required: true,
        toolAlias: 'doc_query',
        kb_ids: [KB_ID, secondKbId],
      },
    }

    expect(
      resolveMcpScope([tutorTarget, explainerTarget], 'explainer', [
        explainerTarget,
      ])
    ).toEqual([KB_ID, secondKbId])

    expect(() =>
      resolveMcpScope(
        [
          tutorTarget,
          {
            ...explainerTarget,
            parameters: {
              ...explainerTarget.parameters,
              kb_ids: [KB_ID],
            },
          },
        ],
        'explainer',
        [explainerTarget]
      )
    ).toThrowError(RequiredMCPUnavailableError)

    expect(() =>
      resolveMcpScope([tutorTarget, explainerTarget], 'explainer', [
        {
          ...explainerTarget,
          parameters: {
            required: true,
            toolAlias: 'doc_query',
            kb_id: KB_ID,
          },
        },
      ])
    ).toThrowError(RequiredMCPUnavailableError)
  })

  test('rejects empty, duplicate, oversized, and mixed kb representations', () => {
    const secondKbId = '8016810d-31e9-4b39-9529-cd46feb2bf63'
    expect(() =>
      resolveMcpScope(
        [
          {
            chatMode: 'tutor',
            parameters: {
              required: true,
              toolAlias: 'doc_query',
              kb_id: KB_ID,
              kb_ids: [KB_ID],
            },
            mcpServer: { id: 'kb-server', name: 'KB' },
          },
        ],
        'tutor',
        []
      )
    ).toThrowError(RequiredMCPUnavailableError)

    for (const kbIds of [
      [],
      [KB_ID],
      [KB_ID, KB_ID],
      Array.from(
        { length: 33 },
        (_, index) =>
          `7016810d-31e9-4b39-9529-${index.toString(16).padStart(12, '0')}`
      ),
      [secondKbId, 'not-a-uuid'],
    ]) {
      expect(() =>
        resolveMcpScope(
          [
            {
              chatMode: 'tutor',
              parameters: {
                required: true,
                toolAlias: 'doc_query',
                kb_ids: kbIds,
              },
              mcpServer: { id: 'kb-server', name: 'KB' },
            },
          ],
          'tutor',
          [
            {
              chatMode: 'tutor',
              parameters: {
                required: true,
                toolAlias: 'doc_query',
                kb_ids: kbIds,
              },
              mcpServer: { id: 'kb-server', name: 'KB' },
            },
          ]
        )
      ).toThrowError(RequiredMCPUnavailableError)
    }
  })

  test('rejects a request scope that is wider than the stored configuration', async () => {
    const secondKbId = '8016810d-31e9-4b39-9529-cd46feb2bf63'

    await expect(
      getAggregatedMCPTools([createServer()], CHATBOT_ID, {
        kbIds: [KB_ID, secondKbId],
        sessionId: SESSION_ID,
      })
    ).rejects.toMatchObject({ code: REQUIRED_MCP_UNAVAILABLE_CODE })

    expect(signDocQueryScopeTokenMock).not.toHaveBeenCalled()
    expect(transportConstructorMock).not.toHaveBeenCalled()
  })

  test('accepts a Tutor binding safely inherited by Quizzer', () => {
    const tutorBinding = {
      chatMode: 'tutor',
      parameters: { required: true, toolAlias: 'doc_query', kb_id: KB_ID },
      mcpServer: { id: 'kb-server', name: 'KB' },
    }
    const inheritedQuizzerBinding = {
      ...tutorBinding,
      chatMode: 'quizzer',
    }

    expect(
      resolveMcpScope([tutorBinding], 'quizzer', [inheritedQuizzerBinding])
    ).toEqual([KB_ID])
  })

  test('rejects an effective binding outside the validated chatbot scope', () => {
    const tutorBinding = {
      chatMode: 'tutor',
      parameters: { required: true, toolAlias: 'doc_query', kb_id: KB_ID },
      mcpServer: { id: 'kb-server', name: 'KB' },
    }

    expect(() =>
      resolveMcpScope([tutorBinding], 'quizzer', [
        {
          ...tutorBinding,
          chatMode: 'quizzer',
          parameters: {
            ...tutorBinding.parameters,
            kb_id: '8016810d-31e9-4b39-9529-cd46feb2bf63',
          },
        },
      ])
    ).toThrowError(RequiredMCPUnavailableError)
  })

  test.each([
    {
      name: 'a non-KB config carries kb_id',
      configurations: [
        {
          chatMode: 'tutor',
          parameters: { kb_id: KB_ID },
          mcpServer: { id: 'other', name: 'Other' },
        },
      ],
    },
    {
      name: 'the selected mode is not bound',
      configurations: [
        {
          chatMode: 'tutor',
          parameters: { required: true, toolAlias: 'doc_query', kb_id: KB_ID },
          mcpServer: { id: 'kb-server', name: 'KB' },
        },
      ],
      selectedMode: 'explainer',
    },
    {
      name: 'two KB configs share a mode',
      configurations: [
        {
          chatMode: 'tutor',
          parameters: { required: true, toolAlias: 'doc_query', kb_id: KB_ID },
          mcpServer: { id: 'kb-server', name: 'KB' },
        },
        {
          chatMode: 'tutor',
          parameters: { required: true, toolAlias: 'doc_query', kb_id: KB_ID },
          mcpServer: { id: 'kb-server', name: 'KB' },
        },
      ],
    },
    {
      name: 'KB configs use different server IDs',
      configurations: [
        {
          chatMode: 'tutor',
          parameters: { required: true, toolAlias: 'doc_query', kb_id: KB_ID },
          mcpServer: { id: 'kb-server-1', name: 'KB' },
        },
        {
          chatMode: 'explainer',
          parameters: { required: true, toolAlias: 'doc_query', kb_id: KB_ID },
          mcpServer: { id: 'kb-server-2', name: 'KB' },
        },
      ],
      selectedMode: 'explainer',
    },
    {
      name: 'KB configs use different knowledge-base IDs',
      configurations: [
        {
          chatMode: 'tutor',
          parameters: { required: true, toolAlias: 'doc_query', kb_id: KB_ID },
          mcpServer: { id: 'kb-server', name: 'KB' },
        },
        {
          chatMode: 'explainer',
          parameters: {
            required: true,
            toolAlias: 'doc_query',
            kb_id: '8016810d-31e9-4b39-9529-cd46feb2bf63',
          },
          mcpServer: { id: 'kb-server', name: 'KB' },
        },
      ],
      selectedMode: 'explainer',
    },
    {
      name: 'a KB config omits the binding',
      configurations: [
        {
          chatMode: 'tutor',
          parameters: { required: true, toolAlias: 'doc_query' },
          mcpServer: { id: 'kb-server', name: 'KB' },
        },
      ],
    },
  ])('$name fails closed', ({ configurations, selectedMode = 'tutor' }) => {
    expect(() =>
      resolveMcpScope(
        configurations,
        selectedMode,
        configurations.filter(
          (configuration) => configuration.chatMode === selectedMode
        )
      )
    ).toThrowError(RequiredMCPUnavailableError)
  })
})

describe('deployment-bound scoped KB route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    signDocQueryScopeTokenMock.mockResolvedValue('scope-token')
    clientToolsMock.mockResolvedValue({ doc_query: {} })
    createSDKMCPClientMock.mockResolvedValue({ tools: clientToolsMock })
    createDocQueryScopedFetchMock.mockReturnValue(scopedFetchMock)
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  function createScopedServer(
    overrides: Partial<MCPServerWithConfig['server']> = {}
  ): MCPServerWithConfig {
    return createServer({
      id: SCOPED_SERVER_ID,
      url: SCOPED_LEGACY_URL,
      authType: 'none',
      authSecret: undefined,
      ...overrides,
    })
  }

  test('binds the modern KB server to the deployment route and drops the stored bearer', async () => {
    stubScopedRouteEnv()

    await getAggregatedMCPTools([createScopedServer()], CHATBOT_ID, {
      kbIds: [KB_ID],
      sessionId: SESSION_ID,
    })

    expect(transportConstructorMock).toHaveBeenCalledWith(new URL(SCOPED_URL), {
      requestInit: {
        headers: { 'Content-Type': 'application/json' },
        redirect: 'error',
      },
      fetch: scopedFetchMock,
    })
    expect(createDocQueryScopedFetchMock).toHaveBeenCalledWith({
      target: new URL(SCOPED_URL),
      kbIds: [KB_ID],
      chatbotId: CHATBOT_ID,
      sessionId: SESSION_ID,
    })
    // Tokens are minted per outbound request, never while building the client.
    expect(signDocQueryScopeTokenMock).not.toHaveBeenCalled()
    expect(clientToolsMock).toHaveBeenCalledTimes(1)
  })

  test('needs the turn authorization even when the route is configured', async () => {
    stubScopedRouteEnv()

    await expect(
      getAggregatedMCPTools([createScopedServer()], CHATBOT_ID)
    ).rejects.toMatchObject({ code: REQUIRED_MCP_UNAVAILABLE_CODE })

    expect(createDocQueryScopedFetchMock).not.toHaveBeenCalled()
    expect(transportConstructorMock).not.toHaveBeenCalled()
  })

  test('rejects a partial scope configuration before any credential exists', async () => {
    stubScopedRouteEnv({ url: '' })

    await expect(
      getAggregatedMCPTools([createScopedServer()], CHATBOT_ID, {
        kbIds: [KB_ID],
        sessionId: SESSION_ID,
      })
    ).rejects.toMatchObject({ code: REQUIRED_MCP_UNAVAILABLE_CODE })

    expect(createDocQueryScopedFetchMock).not.toHaveBeenCalled()
    expect(transportConstructorMock).not.toHaveBeenCalled()
  })

  test.each([
    {
      name: 'a server row the deployment does not bind',
      env: {},
      server: { id: 'e0a1f0d4-3c2f-4a4c-9a1e-9b6b1a0c2f11' },
    },
    {
      name: 'a stored URL that differs from the bound row URL',
      env: {},
      server: { url: `${SCOPED_LEGACY_URL}/legacy` },
    },
    {
      name: 'an inactive KB server',
      env: {},
      server: { isActive: false },
    },
    {
      name: 'a scope target on another path',
      env: { url: `${SCOPED_LEGACY_URL}/mcp/klicker` },
      server: {},
    },
    {
      name: 'a trailing-slash scope target',
      env: { url: `${SCOPED_URL}/` },
      server: {},
    },
    {
      name: 'a scope target on another origin',
      env: { url: `https://other.example.test${DOC_QUERY_SCOPED_ROUTE_PATH}` },
      server: {},
    },
    {
      name: 'a scope target carrying a query',
      env: { url: `${SCOPED_URL}?tenant=klicker` },
      server: {},
    },
    {
      name: 'a scope target carrying userinfo',
      env: {
        url: `https://user:secret@doc-query.svc.cluster.local${DOC_QUERY_SCOPED_ROUTE_PATH}`,
      },
      server: {},
    },
    {
      name: 'a cleartext public scope target',
      env: {
        legacyUrl: 'http://doc-query.example.test',
        url: `http://doc-query.example.test${DOC_QUERY_SCOPED_ROUTE_PATH}`,
      },
      server: { url: 'http://doc-query.example.test' },
    },
  ])('rejects $name', async ({ env, server }) => {
    stubScopedRouteEnv(env)

    await expect(
      getAggregatedMCPTools([createScopedServer(server)], CHATBOT_ID, {
        kbIds: [KB_ID],
        sessionId: SESSION_ID,
      })
    ).rejects.toMatchObject({ code: REQUIRED_MCP_UNAVAILABLE_CODE })

    expect(createDocQueryScopedFetchMock).not.toHaveBeenCalled()
    expect(signDocQueryScopeTokenMock).not.toHaveBeenCalled()
    expect(transportConstructorMock).not.toHaveBeenCalled()
    expect(createSDKMCPClientMock).not.toHaveBeenCalled()
  })

  test('leaves generic and compatibility servers on their existing authentication', async () => {
    stubScopedRouteEnv()

    await getAggregatedMCPTools(
      [
        createServer(
          {
            id: 'compat-server',
            name: 'Klicker-compat',
            url: 'https://compat.example.test',
            authType: 'bearer',
            authSecret: 'compat-transport-token',
          },
          { allowedTools: ['doc_query'], parameters: {} }
        ),
      ],
      CHATBOT_ID,
      { kbIds: [KB_ID], sessionId: SESSION_ID }
    )

    expect(transportConstructorMock).toHaveBeenCalledWith(
      new URL('https://compat.example.test'),
      {
        requestInit: {
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer compat-transport-token',
          },
          redirect: 'error',
        },
      }
    )
    expect(createDocQueryScopedFetchMock).not.toHaveBeenCalled()
  })
})
