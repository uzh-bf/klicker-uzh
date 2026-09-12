import { createHash } from 'node:crypto'
import { GraphQLError } from 'graphql'
import { describe, expect, it, vi } from 'vitest'
import type { ContextWithUser } from '../src/lib/context.js'
import {
  fetchKbSourceInventory,
  KB_SOURCES_TOOL_NAME,
  type KbSourceInventoryDeps,
} from '../src/services/docQuerySources.js'
import { getKbImportedSourcesConnection } from '../src/services/knowledge.js'

const KB_ID = '11111111-1111-4111-8111-111111111111'
const OWNER_ID = '22222222-2222-4222-8222-222222222222'
const MCP_URL = 'http://localhost:1417/mcp'

function videoSource(overrides: Record<string, unknown> = {}) {
  return {
    identity_field: 'video_source_id',
    identity_value: 'vid-1',
    title: 'Synthetic lecture recording',
    source_type: 'video',
    source_url: null,
    ingested_at: '2026-07-18T14:30:00.000Z',
    observed_at: '2026-08-02T09:00:00.000Z',
    chunk_count: 12,
    ...overrides,
  }
}

function documentSource(overrides: Record<string, unknown> = {}) {
  return {
    identity_field: 'source_id',
    identity_value: 'src-1',
    title: 'Synthetic handbook',
    source_type: 'document',
    source_url: 'https://example.org/handbook',
    ingested_at: '2026-07-18T14:30:00.000Z',
    observed_at: '2026-08-02T09:00:00.000Z',
    chunk_count: 7,
    ...overrides,
  }
}

function envelope(overrides: Record<string, unknown> = {}) {
  return {
    collection_name: 'klicker-synthetic',
    sample_limit: 5000,
    scanned_chunks: 19,
    truncated: false,
    unidentified_chunks: 0,
    total_sources_in_scan: 2,
    sources: [videoSource(), documentSource()],
    next_cursor: null,
    ...overrides,
  }
}

function textResult(payload: unknown) {
  return {
    content: [{ type: 'text', text: JSON.stringify(payload) }],
  }
}

function expectedSourceId(field: string, value: string) {
  return createHash('sha256').update(`${field}\n${value}`).digest('hex')
}

function createClientFactory(results: Array<unknown>) {
  const createdOptions: Array<Record<string, unknown>> = []
  const toolCalls: Array<{ name: string; arguments: unknown }> = []
  const close = vi.fn(async () => {})
  const createClient = vi.fn(async (options: Record<string, unknown>) => {
    createdOptions.push(options)
    return {
      client: {
        callTool: vi.fn(
          async (request: { name: string; arguments: unknown }) => {
            toolCalls.push(request)
            const next = results.shift()
            if (next instanceof Error) throw next
            return next
          }
        ),
      },
      close,
    }
  })
  return {
    close,
    createClient,
    createdOptions,
    toolCalls,
  }
}

function createDeps(
  factory: ReturnType<typeof createClientFactory>,
  overrides: Partial<KbSourceInventoryDeps> = {}
): KbSourceInventoryDeps {
  return {
    createClient:
      factory.createClient as unknown as KbSourceInventoryDeps['createClient'],
    signScopeToken: async () => 'synthetic-scope-token',
    ...overrides,
  }
}

function createContext({
  kb = { id: KB_ID, ownerId: OWNER_ID },
  account = { aiFeaturesEnabled: true, betaEnabled: true },
  mcpServer = {
    id: 'mcp-1',
    isActive: true,
    url: MCP_URL,
    authType: 'scope_token',
    authSecret: null,
  },
}: {
  kb?: { id: string; ownerId: string } | null
  account?: { aiFeaturesEnabled: boolean; betaEnabled: boolean } | null
  mcpServer?: Record<string, unknown> | null
} = {}) {
  return {
    user: {
      sub: OWNER_ID,
      role: 'USER',
      scope: 'ACCOUNT',
      catalystInstitutional: false,
      catalystIndividual: false,
    },
    prisma: {
      kB: { findFirst: vi.fn(async () => kb) },
      user: { findUnique: vi.fn(async () => account) },
      chatbotMCPServer: { findUnique: vi.fn(async () => mcpServer) },
    },
    featureFlags: {
      getAiBetaDecision: vi.fn(() => 'enabled'),
    },
  } as unknown as ContextWithUser
}

describe('fetchKbSourceInventory', () => {
  it('maps a valid envelope with deterministic ids and honest window fields', async () => {
    const factory = createClientFactory([
      textResult(
        envelope({
          next_cursor: 'cursor-2',
          total_sources_in_scan: 3,
          unidentified_chunks: 4,
        })
      ),
    ])

    const inventory = await fetchKbSourceInventory(
      {
        server: { url: MCP_URL, authType: 'scope_token', authSecret: null },
        kbId: KB_ID,
        limit: 20,
      },
      createDeps(factory)
    )

    expect(inventory.items).toHaveLength(2)
    expect(inventory.items[0]).toEqual({
      id: expectedSourceId('video_source_id', 'vid-1'),
      title: 'Synthetic lecture recording',
      sourceType: 'video',
      sourceUrl: null,
      ingestedAt: new Date('2026-07-18T14:30:00.000Z'),
      observedAt: new Date('2026-08-02T09:00:00.000Z'),
      chunkCount: 12,
    })
    expect(inventory.items[1]?.id).toBe(expectedSourceId('source_id', 'src-1'))
    expect(inventory.nextCursor).toBe('cursor-2')
    expect(inventory.totalSourcesInScan).toBe(3)
    expect(inventory.incomplete).toBe(false)
    expect(inventory.unidentifiedChunks).toBe(4)
    expect(factory.createdOptions[0]).toEqual({
      url: MCP_URL,
      authorization: undefined,
      scopeToken: 'synthetic-scope-token',
    })
    expect(factory.toolCalls[0]?.name).toBe(KB_SOURCES_TOOL_NAME)
    expect(factory.toolCalls[0]?.arguments).toEqual({ limit: 20 })
    expect(factory.close).toHaveBeenCalledTimes(1)
  })

  it('falls back to the identity value and null for missing metadata', async () => {
    const factory = createClientFactory([
      textResult(
        envelope({
          sources: [
            videoSource({
              title: '',
              ingested_at: 'not-a-timestamp',
              observed_at: null,
            }),
          ],
        })
      ),
    ])

    const inventory = await fetchKbSourceInventory(
      {
        server: { url: MCP_URL, authType: 'scope_token', authSecret: null },
        kbId: KB_ID,
        limit: 20,
      },
      createDeps(factory)
    )

    expect(inventory.items[0]?.title).toBe('vid-1')
    expect(inventory.items[0]?.ingestedAt).toBeNull()
    expect(inventory.items[0]?.observedAt).toBeNull()
  })

  it('forwards the cursor only after the first page', async () => {
    const factory = createClientFactory([textResult(envelope())])

    await fetchKbSourceInventory(
      {
        server: { url: MCP_URL, authType: 'scope_token', authSecret: null },
        kbId: KB_ID,
        limit: 20,
        after: 'cursor-1',
      },
      createDeps(factory)
    )

    expect(factory.toolCalls[0]?.arguments).toEqual({
      limit: 20,
      after: 'cursor-1',
    })
  })

  it('sends decrypted bearer credentials only for bearer rows', async () => {
    const scopedFactory = createClientFactory([textResult(envelope())])
    await fetchKbSourceInventory(
      {
        server: { url: MCP_URL, authType: 'scope_token', authSecret: null },
        kbId: KB_ID,
        limit: 20,
      },
      createDeps(scopedFactory)
    )
    expect(scopedFactory.createdOptions[0]?.authorization).toBeUndefined()

    const bearerFactory = createClientFactory([textResult(envelope())])
    await fetchKbSourceInventory(
      {
        server: {
          url: MCP_URL,
          authType: 'bearer',
          authSecret: 'encrypted-secret',
        },
        kbId: KB_ID,
        limit: 20,
      },
      createDeps(bearerFactory, {
        decryptSecret: () => 'transport-secret',
      })
    )
    expect(bearerFactory.createdOptions[0]?.authorization).toBe(
      'transport-secret'
    )
  })

  it('retries exactly once after a session-not-found failure', async () => {
    const factory = createClientFactory([
      new Error('HTTP 404 Not Found: unknown session id'),
      textResult(envelope()),
    ])

    const inventory = await fetchKbSourceInventory(
      {
        server: { url: MCP_URL, authType: 'scope_token', authSecret: null },
        kbId: KB_ID,
        limit: 20,
      },
      createDeps(factory)
    )

    expect(inventory.items).toHaveLength(2)
    expect(factory.createClient).toHaveBeenCalledTimes(2)
    expect(factory.close).toHaveBeenCalledTimes(2)
  })

  it('propagates transport failures without a retry', async () => {
    const factory = createClientFactory([])
    factory.createClient.mockRejectedValue(
      new Error('McpError: Request timed out')
    )

    await expect(
      fetchKbSourceInventory(
        {
          server: { url: MCP_URL, authType: 'scope_token', authSecret: null },
          kbId: KB_ID,
          limit: 20,
        },
        createDeps(factory)
      )
    ).rejects.toThrow('Request timed out')
    expect(factory.createClient).toHaveBeenCalledTimes(1)
  })

  it('rejects malformed payloads and tool error envelopes', async () => {
    const malformed = createClientFactory([
      { content: [{ type: 'text', text: 'not json' }] },
    ])
    await expect(
      fetchKbSourceInventory(
        {
          server: { url: MCP_URL, authType: 'scope_token', authSecret: null },
          kbId: KB_ID,
          limit: 20,
        },
        createDeps(malformed)
      )
    ).rejects.toThrow('Malformed Doc Query inventory payload')

    const toolError = createClientFactory([
      textResult({ error: 'pipeline unavailable', sources: [] }),
    ])
    await expect(
      fetchKbSourceInventory(
        {
          server: { url: MCP_URL, authType: 'scope_token', authSecret: null },
          kbId: KB_ID,
          limit: 20,
        },
        createDeps(toolError)
      )
    ).rejects.toThrow('pipeline unavailable')
  })

  it('rejects cleartext public transport URLs before minting credentials', async () => {
    const factory = createClientFactory([])

    await expect(
      fetchKbSourceInventory(
        {
          server: {
            url: 'http://doc-query.example.org/mcp',
            authType: 'bearer',
            authSecret: 's',
          },
          kbId: KB_ID,
          limit: 20,
        },
        createDeps(factory)
      )
    ).rejects.toThrow('Doc Query transport requires HTTPS')
    expect(factory.createClient).not.toHaveBeenCalled()
  })
})

describe('getKbImportedSourcesConnection', () => {
  it('maps the inventory to the GraphQL connection', async () => {
    const factory = createClientFactory([
      textResult(
        envelope({
          next_cursor: 'cursor-2',
          truncated: true,
          total_sources_in_scan: 5000,
          unidentified_chunks: 6,
        })
      ),
    ])

    const connection = await getKbImportedSourcesConnection(
      { kbId: KB_ID, first: 20, after: 'cursor-1' },
      createContext(),
      createDeps(factory)
    )

    expect(connection.pageInfo).toEqual({
      hasNextPage: true,
      endCursor: 'cursor-2',
    })
    expect(connection.totalSourcesInScan).toBe(5000)
    expect(connection.incomplete).toBe(true)
    expect(connection.unidentifiedChunks).toBe(6)
    expect(connection.items[0]?.id).toBe(
      expectedSourceId('video_source_id', 'vid-1')
    )
    expect(factory.toolCalls[0]?.arguments).toEqual({
      limit: 20,
      after: 'cursor-1',
    })
  })

  it('rejects knowledge bases owned by another user', async () => {
    const factory = createClientFactory([textResult(envelope())])

    await expect(
      getKbImportedSourcesConnection(
        { kbId: KB_ID },
        createContext({ kb: { id: KB_ID, ownerId: 'other-owner' } }),
        createDeps(factory)
      )
    ).rejects.toThrow('KB not found')
    expect(factory.createClient).not.toHaveBeenCalled()
  })

  it('requires the manage AI entitlement', async () => {
    const factory = createClientFactory([textResult(envelope())])

    await expect(
      getKbImportedSourcesConnection(
        { kbId: KB_ID },
        createContext({
          account: { aiFeaturesEnabled: false, betaEnabled: true },
        }),
        createDeps(factory)
      )
    ).rejects.toThrow('AI beta access is required')
    expect(factory.createClient).not.toHaveBeenCalled()
  })

  it('fails closed when the KB MCP server is inactive', async () => {
    const factory = createClientFactory([textResult(envelope())])

    await expect(
      getKbImportedSourcesConnection(
        { kbId: KB_ID },
        createContext({ mcpServer: null }),
        createDeps(factory)
      )
    ).rejects.toThrow('Knowledge base retrieval is not configured')
    expect(factory.createClient).not.toHaveBeenCalled()
  })

  it('maps any transport failure to a generic inventory error', async () => {
    const factory = createClientFactory([])
    factory.createClient.mockRejectedValue(new Error('connection refused'))

    const error = await getKbImportedSourcesConnection(
      { kbId: KB_ID },
      createContext(),
      createDeps(factory)
    ).then(
      () => undefined,
      (reason: unknown) => reason
    )

    expect(error).toBeInstanceOf(GraphQLError)
    expect((error as GraphQLError).message).toBe(
      'Imported sources could not be loaded'
    )
  })
})
