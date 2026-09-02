import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

const createSDKMCPClientMock = vi.hoisted(() => vi.fn())
const closeSDKMCPClientMock = vi.hoisted(() => vi.fn())
const signDocQueryScopeTokenMock = vi.hoisted(() => vi.fn())

vi.mock('@ai-sdk/mcp', () => ({
  experimental_createMCPClient: createSDKMCPClientMock,
}))

vi.mock('@/src/lib/server/docQueryScopeToken', () => ({
  signDocQueryScopeToken: signDocQueryScopeTokenMock,
}))

vi.mock('@klicker-uzh/util', () => ({
  safeDecrypt: (value: string) => value,
}))

import {
  parseMCPRuntimePolicy,
  REQUIRED_MCP_UNAVAILABLE_CODE,
} from '../src/lib/server/mcpRuntimePolicy'
import { isDocQueryToolName } from '../src/lib/sources/normalizeSources'
import {
  getAggregatedMCPTools as getAggregatedMCPToolsHandle,
  getMCPTools,
  type MCPServerWithConfig,
} from '../src/services/mcpClients'

const openHandles: Array<
  Awaited<ReturnType<typeof getAggregatedMCPToolsHandle>>
> = []

async function getAggregatedMCPTools(
  ...args: Parameters<typeof getAggregatedMCPToolsHandle>
) {
  const handle = await getAggregatedMCPToolsHandle(...args)
  openHandles.push(handle)
  return handle.tools
}

function createServer(
  overrides: Partial<MCPServerWithConfig['server']> = {},
  config: Partial<MCPServerWithConfig['config']> = {}
): MCPServerWithConfig {
  return {
    server: {
      id: 'server-1',
      name: 'IW',
      url: 'https://mcp.example.test',
      authType: 'none',
      isActive: true,
      ...overrides,
    },
    config: {
      priority: 0,
      ...config,
    },
  }
}

function setTools(rawTools: Record<string, unknown>) {
  createSDKMCPClientMock.mockResolvedValue({
    close: closeSDKMCPClientMock,
    tools: vi.fn().mockResolvedValue(rawTools),
  })
}

describe('MCP runtime policy', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    signDocQueryScopeTokenMock.mockResolvedValue('scope-token')
  })

  afterEach(async () => {
    await Promise.all(openHandles.splice(0).map((handle) => handle.close()))
    vi.unstubAllEnvs()
  })

  test('keeps configs without reserved policy keys optional', () => {
    expect(parseMCPRuntimePolicy({ timeoutMs: 1000 })).toEqual({
      required: false,
    })
  })

  test('returns an empty cleanup handle when legacy MCP is not configured', async () => {
    vi.stubEnv('MCP_URL', '')

    const handle = await getMCPTools('chatbot-1', 'participant-1', 'account')

    expect(handle.tools).toEqual({})
    await expect(handle.close()).resolves.toBeUndefined()
  })

  test('uses the AI SDK HTTP transport configuration', async () => {
    setTools({ search_docs: { description: 'search' } })

    await getAggregatedMCPTools(
      [createServer()],
      { chatbotId: 'chatbot-1', authMode: 'account' },
      { requestTimeoutMs: 1_000 }
    )

    expect(createSDKMCPClientMock).toHaveBeenCalledWith({
      transport: {
        type: 'http',
        url: 'https://mcp.example.test',
        headers: { 'Content-Type': 'application/json' },
        redirect: 'error',
      },
      initializationOptions: { timeout: 1_000 },
    })
  })

  test('passes authentication headers through the AI SDK transport', async () => {
    setTools({ search_docs: { description: 'search' } })

    await getAggregatedMCPTools(
      [
        createServer({
          authType: 'bearer',
          authSecret: 'transport-token',
        }),
      ],
      { chatbotId: 'chatbot-1', authMode: 'account' }
    )
    await getAggregatedMCPTools(
      [
        createServer({
          authType: 'custom',
          authSecret: JSON.stringify({
            headers: { 'X-Custom-Auth': 'custom-token' },
          }),
        }),
      ],
      { chatbotId: 'chatbot-1', authMode: 'account' }
    )
    await getAggregatedMCPTools(
      [
        createServer({
          name: 'KB',
          authType: 'scope_token',
          authSecret: 'transport-token',
        }),
      ],
      {
        chatbotId: 'chatbot-1',
        authMode: 'account',
        kbId: 'kb-1',
        sessionId: 'session-1',
      }
    )

    expect(createSDKMCPClientMock).toHaveBeenNthCalledWith(1, {
      transport: {
        type: 'http',
        url: 'https://mcp.example.test',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer transport-token',
        },
        redirect: 'error',
      },
    })
    expect(createSDKMCPClientMock).toHaveBeenNthCalledWith(2, {
      transport: {
        type: 'http',
        url: 'https://mcp.example.test',
        headers: {
          'Content-Type': 'application/json',
          'X-Custom-Auth': 'custom-token',
        },
        redirect: 'error',
      },
    })
    expect(createSDKMCPClientMock).toHaveBeenNthCalledWith(3, {
      transport: {
        type: 'http',
        url: 'https://mcp.example.test',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer transport-token',
          'X-Doc-Query-Scope-Token': 'Bearer scope-token',
        },
        redirect: 'error',
      },
    })
  })

  test('returns an idempotent cleanup handle for every created client', async () => {
    setTools({ search_docs: { description: 'search' } })

    const handle = await getAggregatedMCPToolsHandle(
      [createServer(), createServer({ id: 'server-2', name: 'Second' })],
      { chatbotId: 'chatbot-1', authMode: 'account' }
    )

    expect(Object.keys(handle.tools)).toEqual([
      'IW_search_docs',
      'Second_search_docs',
    ])
    await handle.close()
    await handle.close()

    expect(closeSDKMCPClientMock).toHaveBeenCalledTimes(2)
  })

  test('closes a client when tool discovery fails', async () => {
    createSDKMCPClientMock.mockResolvedValue({
      close: closeSDKMCPClientMock,
      tools: vi.fn().mockRejectedValue(new Error('discovery failed')),
    })

    const handle = await getAggregatedMCPToolsHandle([createServer()], {
      chatbotId: 'chatbot-1',
      authMode: 'account',
    })

    expect(handle.tools).toEqual({})
    expect(closeSDKMCPClientMock).toHaveBeenCalledTimes(1)
    await handle.close()
    expect(closeSDKMCPClientMock).toHaveBeenCalledTimes(1)
  })

  test('requires one exact aliased tool for strict configs', async () => {
    setTools({
      informatik_und_wirtschaft_video_expert: { description: 'search' },
    })

    const tools = await getAggregatedMCPTools(
      [
        createServer(
          {},
          {
            allowedTools: ['informatik_und_wirtschaft_video_expert'],
            parameters: { required: true, toolAlias: 'doc_query' },
          }
        ),
      ],
      { chatbotId: 'chatbot-1', authMode: 'account' }
    )

    expect(Object.keys(tools)).toEqual(['IW_doc_query'])
  })

  test('fails closed when a strict tool is missing or the server is inactive', async () => {
    setTools({ other_tool: { description: 'unrelated' } })

    await expect(
      getAggregatedMCPTools(
        [
          createServer(
            {},
            {
              allowedTools: ['informatik_und_wirtschaft_video_expert'],
              parameters: { required: true, toolAlias: 'doc_query' },
            }
          ),
        ],
        { chatbotId: 'chatbot-1', authMode: 'account' }
      )
    ).rejects.toMatchObject({ code: REQUIRED_MCP_UNAVAILABLE_CODE })

    await expect(
      getAggregatedMCPTools(
        [
          createServer(
            { isActive: false },
            {
              allowedTools: ['informatik_und_wirtschaft_video_expert'],
              parameters: { required: true, toolAlias: 'doc_query' },
            }
          ),
        ],
        { chatbotId: 'chatbot-1', authMode: 'account' }
      )
    ).rejects.toMatchObject({ code: REQUIRED_MCP_UNAVAILABLE_CODE })
    expect(createSDKMCPClientMock).toHaveBeenCalledTimes(1)
  })

  test('retains optional wildcard filtering and optional failure behavior', async () => {
    setTools({ search_docs: { description: 'search' }, unrelated: {} })

    await expect(
      getAggregatedMCPTools(
        [
          createServer(
            { authType: 'custom', authSecret: '{bad json' },
            { allowedTools: ['search*'] }
          ),
        ],
        { chatbotId: 'chatbot-1', authMode: 'account' }
      )
    ).resolves.toEqual({})

    setTools({ search_docs: { description: 'search' }, unrelated: {} })
    await expect(
      getAggregatedMCPTools([createServer({}, { allowedTools: ['search*'] })], {
        chatbotId: 'chatbot-1',
        authMode: 'account',
      })
    ).resolves.toEqual({ IW_search_docs: { description: 'search' } })
  })

  test('treats regex metacharacters as literals in optional allow lists', async () => {
    setTools({ doc_query: { description: 'search' }, unrelated: {} })

    await expect(
      getAggregatedMCPTools(
        [createServer({}, { allowedTools: ['doc_query', '|'] })],
        'chatbot-1'
      )
    ).resolves.toEqual({ IW_doc_query: { description: 'search' } })
  })

  test('rejects malformed strict policy and alias collisions', async () => {
    for (const parameters of [
      { required: true },
      { required: true, toolAlias: 'doc.query' },
      { toolAlias: 'doc_query' },
      { required: false, toolAlias: 'doc_query' },
    ]) {
      expect(() => parseMCPRuntimePolicy(parameters)).toThrowError()
    }

    setTools({
      informatik_und_wirtschaft_video_expert: {},
      doc_query: {},
    })

    await expect(
      getAggregatedMCPTools(
        [
          createServer(
            {},
            {
              allowedTools: ['informatik_und_wirtschaft_video_expert'],
              parameters: { required: true, toolAlias: 'doc_query' },
            }
          ),
        ],
        { chatbotId: 'chatbot-1', authMode: 'account' }
      )
    ).rejects.toMatchObject({ code: REQUIRED_MCP_UNAVAILABLE_CODE })
  })

  test('rejects strict wildcard bindings before MCP discovery', async () => {
    await expect(
      getAggregatedMCPTools(
        [
          createServer(
            {},
            {
              allowedTools: ['informatik_*'],
              parameters: { required: true, toolAlias: 'doc_query' },
            }
          ),
        ],
        { chatbotId: 'chatbot-1', authMode: 'account' }
      )
    ).rejects.toMatchObject({ code: REQUIRED_MCP_UNAVAILABLE_CODE })
    expect(createSDKMCPClientMock).not.toHaveBeenCalled()
  })

  test('rejects a malformed strict allowedTools value before discovery', async () => {
    await expect(
      getAggregatedMCPTools(
        [
          createServer(
            {},
            {
              allowedTools: 'x' as unknown as string[],
              parameters: { required: true, toolAlias: 'doc_query' },
            }
          ),
        ],
        { chatbotId: 'chatbot-1', authMode: 'account' }
      )
    ).rejects.toMatchObject({ code: REQUIRED_MCP_UNAVAILABLE_CODE })
    expect(createSDKMCPClientMock).not.toHaveBeenCalled()
  })

  test('preserves doc_query source recognition when names are truncated', async () => {
    setTools({ video_expert: {} })

    const tools = await getAggregatedMCPTools(
      [
        createServer(
          { name: 'a'.repeat(55) },
          {
            allowedTools: ['video_expert'],
            parameters: { required: true, toolAlias: 'doc_query' },
          }
        ),
      ],
      { chatbotId: 'chatbot-1', authMode: 'account' }
    )

    const [toolName] = Object.keys(tools)
    expect(toolName).toMatch(/_doc_query_[0-9a-f]{8}$/)
    expect(isDocQueryToolName(toolName)).toBe(true)
  })

  test('rejects aggregate collisions regardless of priority order', async () => {
    const optional = createServer(
      { id: 'optional', url: 'https://optional.example.test' },
      { allowedTools: ['doc_query'], priority: 0 }
    )
    const required = createServer(
      { id: 'required', url: 'https://required.example.test' },
      {
        allowedTools: ['video_expert'],
        parameters: { required: true, toolAlias: 'doc_query' },
        priority: 1,
      }
    )

    createSDKMCPClientMock
      .mockResolvedValueOnce({
        close: closeSDKMCPClientMock,
        tools: vi.fn().mockResolvedValue({ doc_query: {} }),
      })
      .mockResolvedValueOnce({
        close: closeSDKMCPClientMock,
        tools: vi.fn().mockResolvedValue({ video_expert: {} }),
      })
    await expect(
      getAggregatedMCPTools([optional, required], {
        chatbotId: 'chatbot-1',
        authMode: 'account',
      })
    ).rejects.toMatchObject({ code: REQUIRED_MCP_UNAVAILABLE_CODE })

    vi.clearAllMocks()
    optional.config.priority = 1
    required.config.priority = 0
    createSDKMCPClientMock
      .mockResolvedValueOnce({
        close: closeSDKMCPClientMock,
        tools: vi.fn().mockResolvedValue({ video_expert: {} }),
      })
      .mockResolvedValueOnce({
        close: closeSDKMCPClientMock,
        tools: vi.fn().mockResolvedValue({ doc_query: {} }),
      })
    await expect(
      getAggregatedMCPTools([optional, required], {
        chatbotId: 'chatbot-1',
        authMode: 'account',
      })
    ).rejects.toMatchObject({ code: REQUIRED_MCP_UNAVAILABLE_CODE })
  })

  test('rejects unsafe strict custom headers before creating an MCP client', async () => {
    const headers = JSON.parse('{"__proto__":"unexpected"}')

    await expect(
      getAggregatedMCPTools(
        [
          createServer(
            {
              authType: 'custom',
              authSecret: JSON.stringify({ headers }),
            },
            {
              allowedTools: ['video_expert'],
              parameters: { required: true, toolAlias: 'doc_query' },
            }
          ),
        ],
        { chatbotId: 'chatbot-1', authMode: 'account' }
      )
    ).rejects.toMatchObject({ code: REQUIRED_MCP_UNAVAILABLE_CODE })
    expect(createSDKMCPClientMock).not.toHaveBeenCalled()
  })
})
