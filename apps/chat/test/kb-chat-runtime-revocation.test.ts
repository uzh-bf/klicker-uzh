import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

const access = vi.hoisted(() => ({
  assertCurrentChatbotKnowledgeAccess: vi.fn(),
}))
const createSDKMCPClient = vi.hoisted(() => vi.fn())
const closeClient = vi.hoisted(() => vi.fn())
const signScopeToken = vi.hoisted(() => vi.fn())

vi.mock('@ai-sdk/mcp', () => ({
  experimental_createMCPClient: createSDKMCPClient,
}))

vi.mock('@/src/lib/server/chatbotKnowledgeAccess', () => access)

vi.mock('@/src/lib/server/docQueryScopeToken', () => ({
  signDocQueryScopeToken: signScopeToken,
}))

vi.mock('@klicker-uzh/util', () => ({
  safeDecrypt: (value: string) => value,
}))

import { RequiredMCPUnavailableError } from '../src/lib/server/mcpRuntimePolicy'
import {
  getAggregatedMCPTools,
  type MCPServerWithConfig,
} from '../src/services/mcpClients'

const CHATBOT_ID = '8f9c2e1d-4b7a-4c3e-9f5d-1a2b3c4d5e6f'
const KB_ID = '7016810d-31e9-4b39-9529-cd46feb2bf63'

function kbServer(): MCPServerWithConfig {
  return {
    server: {
      id: 'kb-server',
      name: 'KB',
      url: 'https://mcp.example.test',
      authType: 'bearer',
      authSecret: 'opaque-transport-token',
      isActive: true,
    },
    config: {
      priority: 0,
      allowedTools: ['doc_query'],
      parameters: {
        required: true,
        toolAlias: 'doc_query',
        kb_id: KB_ID,
      },
    },
  }
}

describe('Chat KB revocation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    signScopeToken.mockResolvedValue('synthetic-scope-token')
    access.assertCurrentChatbotKnowledgeAccess.mockResolvedValue(undefined)
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  test('denies the second tool execution after revoke before raw dispatch or outbound fetch', async () => {
    const outbound = vi.fn(async () => new Response('{}', { status: 200 }))
    vi.stubGlobal('fetch', outbound)

    let guardedFetch: typeof fetch | undefined
    const rawExecute = vi.fn(async () => {
      if (!guardedFetch) throw new Error('guarded transport fetch missing')
      await guardedFetch('https://mcp.example.test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      })
      return { content: [] }
    })
    createSDKMCPClient.mockImplementation(async ({ transport }) => {
      guardedFetch = transport.fetch
      return {
        close: closeClient,
        tools: vi
          .fn()
          .mockResolvedValue({ doc_query: { execute: rawExecute } }),
      }
    })

    const handle = await getAggregatedMCPTools([kbServer()], {
      chatbotId: CHATBOT_ID,
      participantId: 'synthetic-participant',
      authMode: 'account',
      courseId: 'synthetic-course',
      kbIds: [KB_ID],
      sessionId: 'synthetic-thread',
    })
    const tool = handle.tools.KB_doc_query

    await tool.execute({ query: 'first synthetic request' }, {})
    expect(rawExecute).toHaveBeenCalledTimes(1)
    expect(outbound).toHaveBeenCalledTimes(1)

    access.assertCurrentChatbotKnowledgeAccess.mockRejectedValue(
      new RequiredMCPUnavailableError('scope_violation')
    )
    await expect(
      tool.execute({ query: 'second synthetic request' }, {})
    ).rejects.toMatchObject({ reason: 'scope_violation' })

    expect(rawExecute).toHaveBeenCalledTimes(1)
    expect(outbound).toHaveBeenCalledTimes(1)
    await handle.close()
  })
})
