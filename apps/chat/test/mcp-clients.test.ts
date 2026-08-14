import { beforeEach, describe, expect, test, vi } from 'vitest'

const createSDKMCPClientMock = vi.hoisted(() => vi.fn())

vi.mock('@ai-sdk/mcp', () => ({
  experimental_createMCPClient: createSDKMCPClientMock,
}))

vi.mock('@klicker-uzh/util', () => ({
  safeDecrypt: (value: string) => value,
}))

vi.mock('@modelcontextprotocol/sdk/client/streamableHttp.js', () => ({
  StreamableHTTPClientTransport: class {
    constructor(
      readonly url: URL,
      readonly options: { requestInit: { headers: Record<string, string> } }
    ) {}
  },
}))

import {
  parseMCPRuntimePolicy,
  REQUIRED_MCP_UNAVAILABLE_CODE,
} from '../src/lib/server/mcpRuntimePolicy'
import { isDocQueryToolName } from '../src/lib/sources/normalizeSources'
import {
  getAggregatedMCPTools,
  type MCPServerWithConfig,
} from '../src/services/mcpClients'

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
    tools: vi.fn().mockResolvedValue(rawTools),
  })
}

describe('MCP runtime policy', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('keeps configs without reserved policy keys optional', () => {
    expect(parseMCPRuntimePolicy({ timeoutMs: 1000 })).toEqual({
      required: false,
    })
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
      'chatbot-1'
    )

    expect(Object.keys(tools)).toEqual(['IW_doc_query'])
    expect(isDocQueryToolName('IW_doc_query')).toBe(true)
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
        'chatbot-1'
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
        'chatbot-1'
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
        'chatbot-1'
      )
    ).resolves.toEqual({})

    setTools({ search_docs: { description: 'search' }, unrelated: {} })
    await expect(
      getAggregatedMCPTools(
        [createServer({}, { allowedTools: ['search*'] })],
        'chatbot-1'
      )
    ).resolves.toEqual({ IW_search_docs: { description: 'search' } })
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
        'chatbot-1'
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
        'chatbot-1'
      )
    ).rejects.toMatchObject({ code: REQUIRED_MCP_UNAVAILABLE_CODE })
    expect(createSDKMCPClientMock).not.toHaveBeenCalled()
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
        tools: vi.fn().mockResolvedValue({ doc_query: {} }),
      })
      .mockResolvedValueOnce({
        tools: vi.fn().mockResolvedValue({ video_expert: {} }),
      })
    await expect(
      getAggregatedMCPTools([optional, required], 'chatbot-1')
    ).rejects.toMatchObject({ code: REQUIRED_MCP_UNAVAILABLE_CODE })

    vi.clearAllMocks()
    optional.config.priority = 1
    required.config.priority = 0
    createSDKMCPClientMock
      .mockResolvedValueOnce({
        tools: vi.fn().mockResolvedValue({ video_expert: {} }),
      })
      .mockResolvedValueOnce({
        tools: vi.fn().mockResolvedValue({ doc_query: {} }),
      })
    await expect(
      getAggregatedMCPTools([optional, required], 'chatbot-1')
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
        'chatbot-1'
      )
    ).rejects.toMatchObject({ code: REQUIRED_MCP_UNAVAILABLE_CODE })
    expect(createSDKMCPClientMock).not.toHaveBeenCalled()
  })
})
