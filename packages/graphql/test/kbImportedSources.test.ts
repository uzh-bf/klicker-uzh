import { createHash } from 'node:crypto'
import { GraphQLError } from 'graphql'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ContextWithUser } from '../src/lib/context.js'
import {
  fetchKbSourceInventory,
  KB_SOURCES_TOOL_NAME,
  type KbSourceInventoryDeps,
} from '../src/services/docQuerySources.js'
import { getKbImportedSourcesConnection } from '../src/services/knowledge.js'

const KB_ID = '11111111-1111-4111-8111-111111111111'
const OWNER_ID = '22222222-2222-4222-8222-222222222222'
const MANAGED_RESOURCE_ID = '33333333-3333-4333-8333-333333333333'
const MANAGED_INGESTED_AT = new Date('2026-09-21T14:44:00.000Z')
const MCP_URL = 'http://localhost:1417/mcp'
const MCP_SERVER_ID = 'mcp-1'
const SCOPED_MCP_URL = 'http://localhost:1417/mcp/klicker/kb'
const SOURCE_GATEWAY_ORIGIN = 'http://source-gateway.example.test:3000'

afterEach(() => {
  vi.unstubAllEnvs()
})

function videoSource(overrides: Record<string, unknown> = {}) {
  return {
    identity_field: 'video_source_id',
    identity_value: 'vid-1',
    external_resource_id: null,
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
    external_resource_id: null,
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
  managedResourceIds = [],
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
  managedResourceIds?: string[]
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
      kBResource: {
        findMany: vi.fn(
          async ({ where }: { where: { id: { in: string[] } } }) =>
            managedResourceIds
              .filter((id) => where.id.in.includes(id))
              .map((id) => ({
                id,
                type: 'BLOB',
                sourceUrl: null,
                ingestedAt: MANAGED_INGESTED_AT,
              }))
        ),
      },
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
        server: {
          id: MCP_SERVER_ID,
          url: MCP_URL,
          authType: 'scope_token',
          authSecret: null,
        },
        kbId: KB_ID,
        limit: 20,
      },
      createDeps(factory)
    )

    expect(inventory.items).toHaveLength(2)
    expect(inventory.items[0]).toEqual({
      id: expectedSourceId('video_source_id', 'vid-1'),
      externalResourceId: null,
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
        server: {
          id: MCP_SERVER_ID,
          url: MCP_URL,
          authType: 'scope_token',
          authSecret: null,
        },
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
        server: {
          id: MCP_SERVER_ID,
          url: MCP_URL,
          authType: 'scope_token',
          authSecret: null,
        },
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
        server: {
          id: MCP_SERVER_ID,
          url: MCP_URL,
          authType: 'scope_token',
          authSecret: null,
        },
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
          id: MCP_SERVER_ID,
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
        server: {
          id: MCP_SERVER_ID,
          url: MCP_URL,
          authType: 'scope_token',
          authSecret: null,
        },
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
          server: {
            id: MCP_SERVER_ID,
            url: MCP_URL,
            authType: 'scope_token',
            authSecret: null,
          },
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
          server: {
            id: MCP_SERVER_ID,
            url: MCP_URL,
            authType: 'scope_token',
            authSecret: null,
          },
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
          server: {
            id: MCP_SERVER_ID,
            url: MCP_URL,
            authType: 'scope_token',
            authSecret: null,
          },
          kbId: KB_ID,
          limit: 20,
        },
        createDeps(toolError)
      )
    ).rejects.toThrow('pipeline unavailable')
  })

  it('rejects a non-boolean truncation flag instead of hiding incompleteness', async () => {
    const factory = createClientFactory([
      textResult(envelope({ truncated: 'true' })),
    ])

    await expect(
      fetchKbSourceInventory(
        {
          server: {
            id: MCP_SERVER_ID,
            url: MCP_URL,
            authType: 'scope_token',
            authSecret: null,
          },
          kbId: KB_ID,
          limit: 20,
        },
        createDeps(factory)
      )
    ).rejects.toThrow('Malformed Doc Query inventory payload')
  })

  it('rejects cleartext public transport URLs before minting credentials', async () => {
    const factory = createClientFactory([])

    await expect(
      fetchKbSourceInventory(
        {
          server: {
            id: MCP_SERVER_ID,
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
  describe('scoped KB route binding', () => {
    const scopedServer = {
      id: MCP_SERVER_ID,
      isActive: true,
      url: MCP_URL,
      authType: 'bearer',
      authSecret: 'stored-transport-bearer-must-stay-unused',
    }

    afterEach(() => {
      vi.unstubAllEnvs()
    })

    function stubScopedRoute(
      overrides: Partial<{
        serverId: string
        legacyUrl: string
        url: string
      }> = {}
    ) {
      const configured = {
        serverId: MCP_SERVER_ID,
        legacyUrl: MCP_URL,
        url: SCOPED_MCP_URL,
        ...overrides,
      }
      vi.stubEnv('DOC_QUERY_SCOPED_MCP_SERVER_ID', configured.serverId)
      vi.stubEnv('DOC_QUERY_SCOPED_MCP_LEGACY_URL', configured.legacyUrl)
      vi.stubEnv('DOC_QUERY_SCOPED_MCP_URL', configured.url)
    }

    it('binds the modern row to the scoped route without reading the stored bearer', async () => {
      stubScopedRoute()
      const factory = createClientFactory([textResult(envelope())])
      const decryptSecret = vi.fn((secret: string) => secret)
      const signScopeToken = vi.fn(async () => 'synthetic-scope-token')

      const inventory = await fetchKbSourceInventory(
        { server: scopedServer, kbId: KB_ID, limit: 20 },
        createDeps(factory, { decryptSecret, signScopeToken })
      )

      expect(inventory.items).toHaveLength(2)
      expect(factory.createdOptions[0]).toEqual({
        url: SCOPED_MCP_URL,
        scoped: {
          target: expect.any(URL),
          kbIds: [KB_ID],
          signToken: signScopeToken,
        },
      })
      const scoped = factory.createdOptions[0]?.scoped as { target: URL }
      expect(scoped.target.href).toBe(SCOPED_MCP_URL)
      // The stored credential is never decrypted and no token is minted up
      // front; the transport mints one per request instead.
      expect(decryptSecret).not.toHaveBeenCalled()
      expect(signScopeToken).not.toHaveBeenCalled()
    })

    it('applies the scoped binding through the resolver path', async () => {
      stubScopedRoute()
      const factory = createClientFactory([textResult(envelope())])

      const connection = await getKbImportedSourcesConnection(
        { kbId: KB_ID },
        createContext(),
        createDeps(factory)
      )

      expect(connection.items).toHaveLength(2)
      expect(factory.createdOptions[0]?.url).toBe(SCOPED_MCP_URL)
      expect(factory.createdOptions[0]?.authorization).toBeUndefined()
      expect(factory.createdOptions[0]?.scopeToken).toBeUndefined()
    })

    it('ignores a custom auth type and malformed stored secret in scope mode', async () => {
      stubScopedRoute()
      const factory = createClientFactory([textResult(envelope())])

      await expect(
        fetchKbSourceInventory(
          {
            server: {
              ...scopedServer,
              authType: 'custom',
              authSecret: 'not-json',
            },
            kbId: KB_ID,
            limit: 20,
          },
          createDeps(factory)
        )
      ).resolves.toMatchObject({ totalSourcesInScan: 2 })
      expect(factory.createdOptions[0]?.authorization).toBeUndefined()
    })

    it.each([
      {
        name: 'a partial binding',
        stub: () => vi.stubEnv('DOC_QUERY_SCOPED_MCP_SERVER_ID', MCP_SERVER_ID),
        message: 'incomplete',
      },
      {
        name: 'another KB server row',
        stub: () => stubScopedRoute({ serverId: 'other-server' }),
        message: 'does not match the KB server row',
      },
      {
        name: 'a changed legacy URL',
        stub: () =>
          stubScopedRoute({ legacyUrl: 'http://localhost:1417/mcp-renamed' }),
        message: 'does not match the KB server URL',
      },
      {
        name: 'a target on another origin',
        stub: () =>
          stubScopedRoute({ url: 'http://localhost:9999/mcp/klicker/kb' }),
        message: 'not on the bound origin',
      },
      {
        name: 'a target outside the scoped path',
        stub: () =>
          stubScopedRoute({ url: 'http://localhost:1417/mcp/klicker' }),
        message: 'not the scoped KB path',
      },
    ])('fails closed on $name', async ({ stub, message }) => {
      stub()
      const factory = createClientFactory([])
      const decryptSecret = vi.fn((secret: string) => secret)

      await expect(
        fetchKbSourceInventory(
          { server: scopedServer, kbId: KB_ID, limit: 20 },
          createDeps(factory, { decryptSecret })
        )
      ).rejects.toThrow(message)
      expect(factory.createClient).not.toHaveBeenCalled()
      expect(decryptSecret).not.toHaveBeenCalled()
    })

    it('rejects an inactive KB row even with a complete binding', async () => {
      stubScopedRoute()
      const factory = createClientFactory([])

      await expect(
        fetchKbSourceInventory(
          {
            server: { ...scopedServer, isActive: false },
            kbId: KB_ID,
            limit: 20,
          },
          createDeps(factory)
        )
      ).rejects.toThrow('not active')
      expect(factory.createClient).not.toHaveBeenCalled()
    })
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
    // A source without an app-managed resource id stays manually imported.
    expect(connection.items.map((item) => item.origin)).toEqual([
      'IMPORTED',
      'IMPORTED',
    ])
    expect(factory.toolCalls[0]?.arguments).toEqual({
      limit: 20,
      after: 'cursor-1',
    })
  })

  it('labels a source whose resource id belongs to the KB as app-managed', async () => {
    const factory = createClientFactory([
      textResult(
        envelope({
          sources: [
            videoSource(),
            documentSource({ external_resource_id: MANAGED_RESOURCE_ID }),
          ],
        })
      ),
    ])

    const context = createContext({ managedResourceIds: [MANAGED_RESOURCE_ID] })
    const connection = await getKbImportedSourcesConnection(
      { kbId: KB_ID },
      context,
      createDeps(factory)
    )

    expect(connection.items.map((item) => item.origin)).toEqual([
      'IMPORTED',
      'MANAGED',
    ])
    // The lookup is bounded to the UUID-shaped ids that actually appeared.
    expect(context.prisma.kBResource.findMany).toHaveBeenCalledWith({
      where: { kbId: KB_ID, id: { in: [MANAGED_RESOURCE_ID] } },
      select: {
        id: true,
        type: true,
        sourceUrl: true,
        ingestedAt: true,
      },
    })
  })

  it('recognizes legacy managed blobs from their ingestion gateway URL', async () => {
    vi.stubEnv('KB_SOURCE_GATEWAY_URL', SOURCE_GATEWAY_ORIGIN)
    const factory = createClientFactory([
      textResult(
        envelope({
          sources: [
            documentSource({
              external_resource_id: null,
              source_url: `${SOURCE_GATEWAY_ORIGIN}/api/ingestion/resources/${MANAGED_RESOURCE_ID}/versions/1`,
              ingested_at: null,
            }),
          ],
        })
      ),
    ])

    const connection = await getKbImportedSourcesConnection(
      { kbId: KB_ID },
      createContext({ managedResourceIds: [MANAGED_RESOURCE_ID] }),
      createDeps(factory)
    )

    expect(connection.items[0]).toMatchObject({
      origin: 'MANAGED',
      sourceUrl: null,
      ingestedAt: MANAGED_INGESTED_AT,
    })
  })

  it('does not recognize a legacy lookalike from a foreign origin', async () => {
    vi.stubEnv('KB_SOURCE_GATEWAY_URL', SOURCE_GATEWAY_ORIGIN)
    const factory = createClientFactory([
      textResult(
        envelope({
          sources: [
            documentSource({
              external_resource_id: null,
              source_url: `https://foreign.example.org/api/ingestion/resources/${MANAGED_RESOURCE_ID}/versions/1`,
            }),
          ],
        })
      ),
    ])

    const context = createContext({
      managedResourceIds: [MANAGED_RESOURCE_ID],
    })
    const connection = await getKbImportedSourcesConnection(
      { kbId: KB_ID },
      context,
      createDeps(factory)
    )

    expect(connection.items[0]?.origin).toBe('IMPORTED')
    expect(context.prisma.kBResource.findMany).not.toHaveBeenCalled()
  })

  it('keeps an unmatched or non-UUID resource id as imported', async () => {
    const factory = createClientFactory([
      textResult(
        envelope({
          sources: [
            // A UUID that belongs to another knowledge base must not count.
            documentSource({ external_resource_id: MANAGED_RESOURCE_ID }),
            // A non-UUID operator marker is never a resource id.
            videoSource({ external_resource_id: 'video-lecture:01' }),
          ],
        })
      ),
    ])

    const context = createContext()
    const connection = await getKbImportedSourcesConnection(
      { kbId: KB_ID },
      context,
      createDeps(factory)
    )

    expect(connection.items.map((item) => item.origin)).toEqual([
      'IMPORTED',
      'IMPORTED',
    ])
    expect(context.prisma.kBResource.findMany).toHaveBeenCalledTimes(1)
  })

  it('does not query resources when no source carries a UUID', async () => {
    const factory = createClientFactory([
      textResult(
        envelope({
          sources: [videoSource({ external_resource_id: 'video-lecture:01' })],
        })
      ),
    ])

    const context = createContext()
    const connection = await getKbImportedSourcesConnection(
      { kbId: KB_ID },
      context,
      createDeps(factory)
    )

    expect(connection.items[0]?.origin).toBe('IMPORTED')
    expect(context.prisma.kBResource.findMany).not.toHaveBeenCalled()
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
