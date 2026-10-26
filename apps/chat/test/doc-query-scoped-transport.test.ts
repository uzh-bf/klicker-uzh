import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from 'node:http'
import { experimental_createMCPClient as createSDKMCPClient } from '@ai-sdk/mcp'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { exportPKCS8, generateKeyPair, jwtVerify, type KeyLike } from 'jose'
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  test,
  vi,
} from 'vitest'
import { z } from 'zod'
import { createDocQueryScopedFetch } from '../src/lib/server/docQueryScopeToken'
import { REQUIRED_MCP_UNAVAILABLE_CODE } from '../src/lib/server/mcpRuntimePolicy'
import {
  getAggregatedMCPTools,
  type MCPServerWithConfig,
} from '../src/services/mcpClients'
import {
  DOC_QUERY_SCOPE_TOKEN_HEADER,
  DOC_QUERY_SCOPED_ROUTE_PATH,
} from '../src/services/mcpScope'

const TEST_ISSUER = 'https://chat.klicker.test'
const TEST_AUDIENCE = 'klicker-doc-query-test'
const TEST_KID = 'test-key-2026-08'
const TEST_CHATBOT_ID = '8f9c2e1d-4b7a-4c3e-9f5d-1a2b3c4d5e6f'
const KB_ID = '7016810d-31e9-4b39-9529-cd46feb2bf63'
const SECOND_KB_ID = '8016810d-31e9-4b39-9529-cd46feb2bf63'
const REJECTED_KB_ID = '9016810d-31e9-4b39-9529-cd46feb2bf63'
const SLOW_KB_ID = 'a016810d-31e9-4b39-9529-cd46feb2bf63'
const SCOPED_SERVER_ID = 'b1b1a0c2-6a86-4f47-9e2d-2a8c58b1f0a4'
const SLOW_RESPONSE_MS = 400
const TURN_START = new Date('2026-09-20T10:00:00.000Z')
const TURN_AFTER_EXPIRY = new Date('2026-09-20T10:06:00.000Z')

type RecordedRequest = {
  jti: string | undefined
  subject: string | undefined
  kbId: unknown
  issuedAt: number
  expiresAt: number
  method: string | undefined
}

let publicKey: KeyLike
let legacyUrl: string
let scopedUrl: string
let server: ReturnType<typeof createServer>
const recorded: RecordedRequest[] = []
const rejections: string[] = []

function scopedServerChain(kbId: string): MCPServerWithConfig {
  return {
    server: {
      id: SCOPED_SERVER_ID,
      name: 'KB',
      url: legacyUrl,
      authType: 'bearer',
      authSecret: 'stored-transport-bearer-must-stay-unused',
      isActive: true,
    },
    config: {
      allowedTools: ['doc_query'],
      priority: 0,
      parameters: { required: true, toolAlias: 'doc_query', kb_id: kbId },
    },
  }
}

async function readJsonBody(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = []
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  }
  return chunks.length > 0
    ? JSON.parse(Buffer.concat(chunks).toString('utf8'))
    : undefined
}

function jsonRpcMethod(body: unknown): string | undefined {
  if (!body || typeof body !== 'object' || !('method' in body)) return undefined
  const method = (body as { method?: unknown }).method
  return typeof method === 'string' ? method : undefined
}

function listen(httpServer: ReturnType<typeof createServer>): Promise<string> {
  return new Promise((resolvePromise) => {
    httpServer.listen(0, '127.0.0.1', () => {
      const address = httpServer.address()
      if (!address || typeof address === 'string') {
        throw new Error('synthetic Doc Query server did not bind')
      }
      resolvePromise('http://127.0.0.1:' + address.port)
    })
  })
}

function closeServer(
  httpServer: ReturnType<typeof createServer>
): Promise<void> {
  httpServer.closeAllConnections()
  return new Promise((resolvePromise, reject) => {
    httpServer.close((error) => (error ? reject(error) : resolvePromise()))
  })
}

/**
 * Accepts a request only with a valid, unexpired scope token and no shared
 * bearer. Every transport request must authenticate, so a stale or missing
 * token is recorded as a rejection instead of being answered.
 */
async function authorizeRequest(
  request: IncomingMessage,
  response: ServerResponse,
  method: string | undefined
): Promise<RecordedRequest | undefined> {
  const authorization = request.headers.authorization ?? null
  const rawToken = request.headers[DOC_QUERY_SCOPE_TOKEN_HEADER.toLowerCase()]
  const tokenHeader = Array.isArray(rawToken) ? rawToken[0] : rawToken

  if (authorization !== null) {
    rejections.push('authorization-header-present')
    response.writeHead(401).end()
    return undefined
  }
  if (!tokenHeader?.startsWith('Bearer ')) {
    rejections.push('scope-header-missing')
    response.writeHead(401).end()
    return undefined
  }

  let payload: Record<string, unknown>
  try {
    ;({ payload } = await jwtVerify(
      tokenHeader.slice('Bearer '.length),
      publicKey,
      { algorithms: ['ES256'], issuer: TEST_ISSUER, audience: TEST_AUDIENCE }
    ))
  } catch {
    rejections.push('scope-token-invalid')
    response.writeHead(401).end()
    return undefined
  }

  const issuedAt = payload.iat
  const expiresAt = payload.exp
  const now = Math.floor(Date.now() / 1000)
  if (
    typeof issuedAt !== 'number' ||
    typeof expiresAt !== 'number' ||
    expiresAt - issuedAt !== 300
  ) {
    rejections.push('scope-lifetime-invalid')
    response.writeHead(401).end()
    return undefined
  }
  if (expiresAt <= now) {
    rejections.push('scope-token-expired')
    response.writeHead(401).end()
    return undefined
  }

  const entry: RecordedRequest = {
    jti: typeof payload.jti === 'string' ? payload.jti : undefined,
    subject: typeof payload.sub === 'string' ? payload.sub : undefined,
    kbId: payload.kb_id,
    issuedAt,
    expiresAt,
    method,
  }
  recorded.push(entry)

  if (entry.kbId === REJECTED_KB_ID) {
    rejections.push('forced-401')
    response.writeHead(401).end()
    return undefined
  }

  return entry
}

describe('scoped KB transport over real HTTP', () => {
  beforeAll(async () => {
    const keyPair = await generateKeyPair('ES256')
    publicKey = keyPair.publicKey
    vi.stubEnv(
      'DOC_QUERY_SCOPE_PRIVATE_KEY',
      await exportPKCS8(keyPair.privateKey)
    )
    vi.stubEnv('DOC_QUERY_SCOPE_KID', TEST_KID)
    vi.stubEnv('DOC_QUERY_SCOPE_ISSUER', TEST_ISSUER)
    vi.stubEnv('DOC_QUERY_SCOPE_AUDIENCE', TEST_AUDIENCE)

    let transport: StreamableHTTPServerTransport | undefined

    server = createServer(
      async (request: IncomingMessage, response: ServerResponse) => {
        const isPost = request.method === 'POST'
        const body = isPost ? await readJsonBody(request) : undefined
        const method = jsonRpcMethod(body)

        const authorized = await authorizeRequest(request, response, method)
        if (!authorized) return

        if (
          authorized.kbId === SLOW_KB_ID &&
          method !== undefined &&
          method.startsWith('tools/')
        ) {
          await new Promise((resolvePromise) =>
            setTimeout(resolvePromise, SLOW_RESPONSE_MS)
          )
        }

        if (!isPost) {
          response.writeHead(405).end()
          return
        }

        if (!transport) {
          if (method !== 'initialize') {
            response.writeHead(400).end()
            return
          }
          transport = new StreamableHTTPServerTransport({
            sessionIdGenerator: undefined,
            enableJsonResponse: true,
          })
          const mcpServer = new McpServer({
            name: 'synthetic-doc-query',
            version: '1.0.0',
          })
          mcpServer.tool(
            'doc_query',
            { query: z.string() },
            async ({ query }) => ({
              content: [
                {
                  type: 'text',
                  text: JSON.stringify({
                    query,
                    marker: 'SYNTHETIC_SCOPED_ROUTE_OK',
                  }),
                },
              ],
            })
          )
          await mcpServer.connect(transport)
        }

        await transport.handleRequest(request, response, body)
      }
    )

    legacyUrl = await listen(server)
    scopedUrl = legacyUrl + DOC_QUERY_SCOPED_ROUTE_PATH

    vi.stubEnv('DOC_QUERY_SCOPED_MCP_SERVER_ID', SCOPED_SERVER_ID)
    vi.stubEnv('DOC_QUERY_SCOPED_MCP_LEGACY_URL', legacyUrl)
    vi.stubEnv('DOC_QUERY_SCOPED_MCP_URL', scopedUrl)

    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(TURN_START)
  })

  afterAll(async () => {
    vi.useRealTimers()
    vi.unstubAllEnvs()
    await closeServer(server)
  })

  afterEach(() => {
    rejections.length = 0
    vi.setSystemTime(TURN_START)
  })

  test('discovers, calls and refreshes the scope token through the real transport', async () => {
    const start = recorded.length
    const firstTurnIssuedAt = Math.floor(TURN_START.getTime() / 1000)

    const tools = await getAggregatedMCPTools(
      [scopedServerChain(KB_ID)],
      TEST_CHATBOT_ID,
      { kbIds: [KB_ID], sessionId: 'thread-first-turn' }
    )

    expect(Object.keys(tools)).toEqual(['KB_doc_query'])
    const discovery = recorded.slice(start)
    expect(discovery.length).toBeGreaterThanOrEqual(3)
    expect(rejections).toEqual([])
    expect(new Set(discovery.map(({ jti }) => jti)).size).toBe(discovery.length)
    expect(
      discovery.every(
        ({ kbId, subject, issuedAt, expiresAt }) =>
          kbId === KB_ID &&
          subject === 'thread-first-turn' &&
          issuedAt === firstTurnIssuedAt &&
          expiresAt - issuedAt === 300
      )
    ).toBe(true)

    const tool = tools.KB_doc_query as {
      execute?: (input: { query: string }) => Promise<unknown>
    }
    await expect(
      tool.execute?.({ query: 'before expiry' })
    ).resolves.toMatchObject({
      content: [
        {
          type: 'text',
          text: expect.stringContaining('SYNTHETIC_SCOPED_ROUTE_OK'),
        },
      ],
    })

    // The token of the first turn is expired by now, so only a freshly
    // minted token can still pass the synthetic server.
    vi.setSystemTime(TURN_AFTER_EXPIRY)
    const afterExpiryIssuedAt = Math.floor(TURN_AFTER_EXPIRY.getTime() / 1000)
    const beforeRefresh = recorded.length

    await expect(
      tool.execute?.({ query: 'after expiry' })
    ).resolves.toMatchObject({
      content: [
        { type: 'text', text: expect.stringContaining('after expiry') },
      ],
    })

    const refreshed = recorded.slice(beforeRefresh)
    expect(refreshed.length).toBeGreaterThan(0)
    expect(rejections).toEqual([])
    expect(new Set(recorded.map(({ jti }) => jti)).size).toBe(recorded.length)
    expect(
      refreshed.every(
        ({ kbId, subject, issuedAt, expiresAt }) =>
          kbId === KB_ID &&
          subject === 'thread-first-turn' &&
          issuedAt === afterExpiryIssuedAt &&
          expiresAt - issuedAt === 300
      )
    ).toBe(true)
  })

  test('keeps concurrent turns on their own authorized scope', async () => {
    const start = recorded.length
    const [firstTools, secondTools] = await Promise.all([
      getAggregatedMCPTools([scopedServerChain(KB_ID)], TEST_CHATBOT_ID, {
        kbIds: [KB_ID],
        sessionId: 'thread-concurrent-a',
      }),
      getAggregatedMCPTools(
        [
          {
            ...scopedServerChain(SECOND_KB_ID),
            config: {
              allowedTools: ['doc_query'],
              priority: 0,
              parameters: {
                required: true,
                toolAlias: 'doc_query',
                kb_id: SECOND_KB_ID,
              },
            },
          },
        ],
        TEST_CHATBOT_ID,
        { kbIds: [SECOND_KB_ID], sessionId: 'thread-concurrent-b' }
      ),
    ])

    await Promise.all([
      (
        firstTools.KB_doc_query as {
          execute?: (input: { query: string }) => Promise<unknown>
        }
      ).execute?.({ query: 'first scope' }),
      (
        secondTools.KB_doc_query as {
          execute?: (input: { query: string }) => Promise<unknown>
        }
      ).execute?.({ query: 'second scope' }),
    ])

    const scoped = recorded.slice(start)
    expect(scoped.length).toBeGreaterThan(0)
    expect(rejections).toEqual([])
    expect(
      scoped.every(
        ({ kbId, subject }) =>
          (kbId === KB_ID && subject === 'thread-concurrent-a') ||
          (kbId === SECOND_KB_ID && subject === 'thread-concurrent-b')
      )
    ).toBe(true)
    expect(scoped.some(({ kbId }) => kbId === SECOND_KB_ID)).toBe(true)
  })

  test('surfaces a rejection without falling back to the stored bearer', async () => {
    const start = recorded.length

    await expect(
      getAggregatedMCPTools(
        [scopedServerChain(REJECTED_KB_ID)],
        TEST_CHATBOT_ID,
        { kbIds: [REJECTED_KB_ID], sessionId: 'thread-rejected' }
      )
    ).rejects.toMatchObject({ code: REQUIRED_MCP_UNAVAILABLE_CODE })

    expect(rejections).toContain('forced-401')
    expect(rejections).not.toContain('authorization-header-present')
    expect(recorded.slice(start).length).toBeGreaterThan(0)
  })

  test('aborts an in-flight scoped request when the client closes', async () => {
    const start = recorded.length
    const target = new URL(scopedUrl)
    const transport = new StreamableHTTPClientTransport(target, {
      requestInit: { redirect: 'error' },
      fetch: createDocQueryScopedFetch({
        target,
        kbIds: [SLOW_KB_ID],
        chatbotId: TEST_CHATBOT_ID,
        sessionId: 'thread-cancelled',
      }),
    })
    const client = await createSDKMCPClient({ transport })

    const startedAt = performance.now()
    const pending = client.listTools()
    await vi.waitFor(() => expect(recorded[start]?.kbId).toBe(SLOW_KB_ID))
    await client.close()

    await expect(pending).rejects.toThrow()
    expect(performance.now() - startedAt).toBeLessThan(SLOW_RESPONSE_MS)
    expect(rejections).toEqual([])
    expect(recorded.some(({ kbId }) => kbId === SLOW_KB_ID)).toBe(true)
  })
})
