import { beforeEach, describe, expect, test, vi } from 'vitest'

const createSDKMCPClientMock = vi.hoisted(() => vi.fn())
const signDocQueryScopeTokenMock = vi.hoisted(() => vi.fn())
const transportConstructorMock = vi.hoisted(() => vi.fn())
const clientToolsMock = vi.hoisted(() => vi.fn())

vi.mock('@ai-sdk/mcp', () => ({
  experimental_createMCPClient: createSDKMCPClientMock,
}))

vi.mock('@/src/lib/server/docQueryScopeToken', () => ({
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
  normalizeDocQueryKbId,
  resolveMcpScope,
} from '../src/services/mcpScope'

const KB_ID = '7016810d-31e9-4b39-9529-cd46feb2bf63'
const CHATBOT_ID = '8f9c2e1d-4b7a-4c3e-9f5d-1a2b3c4d5e6f'
const SESSION_ID = 'thread-4ca8d6a4'

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
