import { beforeEach, describe, expect, test, vi } from 'vitest'

const createSDKMCPClientMock = vi.hoisted(() => vi.fn())
const signDocQueryScopeTokenMock = vi.hoisted(() => vi.fn())
const transportConstructorMock = vi.hoisted(() => vi.fn())

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
  getAggregatedMCPTools,
  type MCPServerWithConfig,
} from '../src/services/mcpClients'
import {
  DOC_QUERY_SCOPE_TOKEN_HEADER,
  normalizeDocQueryKbId,
  resolveMcpScope,
} from '../src/services/mcpScope'
import {
  REQUIRED_MCP_UNAVAILABLE_CODE,
  RequiredMCPUnavailableError,
} from '../src/lib/server/mcpRuntimePolicy'

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
    createSDKMCPClientMock.mockResolvedValue({
      tools: vi.fn().mockResolvedValue({ doc_query: {} }),
    })
  })

  test('keeps bearer transport auth separate from the scope token header', async () => {
    await getAggregatedMCPTools([createServer()], CHATBOT_ID, {
      kbId: KB_ID,
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
      kbId: KB_ID,
      chatbotId: CHATBOT_ID,
      sessionId: SESSION_ID,
      jti: expect.any(String),
    })
  })

  test('does not treat authType scope_token as a scope activation', async () => {
    await expect(
      getAggregatedMCPTools(
        [createServer({ authType: 'scope_token' })],
        CHATBOT_ID,
        { kbId: KB_ID, sessionId: SESSION_ID }
      )
    ).rejects.toMatchObject({ code: REQUIRED_MCP_UNAVAILABLE_CODE })
    expect(signDocQueryScopeTokenMock).not.toHaveBeenCalled()
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
    expect(resolveMcpScope([target], 'tutor', [target])).toBe(KB_ID)
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
    ).toBe(KB_ID)
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
    ).toBe(KB_ID)
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
