import { randomUUID } from 'node:crypto'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import {
  DocQueryScopeTokenError,
  signDocQueryScopeToken,
} from './docQueryScopeToken.js'

export const DOC_QUERY_SCOPE_TOKEN_HEADER = 'X-Doc-Query-Scope-Token'
export const DOC_QUERY_SCOPED_ROUTE_PATH = '/mcp/klicker/kb'
export const DOC_QUERY_CLIENT_NAME = 'klicker-doc-query-client'
export const DOC_QUERY_CLIENT_VERSION = '1.0.0'

const DOC_QUERY_SCOPED_ROUTE_ENV = {
  serverId: 'DOC_QUERY_SCOPED_MCP_SERVER_ID',
  legacyUrl: 'DOC_QUERY_SCOPED_MCP_LEGACY_URL',
  url: 'DOC_QUERY_SCOPED_MCP_URL',
} as const

export interface DocQueryMcpClientOptions {
  url: string
  /** Transport bearer credential; sent as Authorization when present. */
  authorization?: string
  /** ES256 scope token; sent on the scope-token header for every request. */
  scopeToken?: string
  /**
   * Deployment-bound scoped route. When present the client mints a fresh
   * scope token for every request and ignores `authorization` and
   * `scopeToken`; the stored credential is never attached. `signToken` is a
   * test seam that defaults to the shared ES256 signer.
   */
  scoped?: DocQueryScopedFetchOptions
}

export interface DocQueryMcpClient {
  client: Client
  close: () => Promise<void>
}

function isInternalTransportHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, '')
  if (
    host === 'localhost' ||
    host === '::1' ||
    host.endsWith('.svc') ||
    host.endsWith('.internal') ||
    host.endsWith('.local')
  ) {
    return true
  }
  const parts = host.split('.')
  if (parts.length !== 4 || parts.some((part) => !/^\d{1,3}$/.test(part))) {
    return false
  }
  const [first = Number.NaN, second = Number.NaN] = parts.map((part) =>
    Number(part)
  )
  return (
    first === 10 ||
    first === 127 ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168)
  )
}

/**
 * Doc Query credentials must not traverse a public network in cleartext.
 * Plain HTTP is accepted only for clearly internal endpoints such as
 * loopback, cluster-local, or RFC1918 addresses; every other target must
 * use HTTPS before any credential header is attached.
 */
export function assertDocQueryTransportSecurity(rawUrl: string): void {
  let url: URL
  try {
    url = new URL(rawUrl)
  } catch {
    throw new Error('Doc Query transport URL is invalid')
  }
  if (url.protocol === 'https:') return
  if (url.protocol === 'http:' && isInternalTransportHost(url.hostname)) {
    return
  }
  throw new Error('Doc Query transport requires HTTPS')
}

/**
 * Matches StreamableHTTP session-lost failures (HTTP 404 on a request that
 * still carries a session id) so callers can retry once with a fresh client
 * and a new initialize handshake.
 */
export function isDocQuerySessionNotFound(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error)
  return /(?:\b404\b|session not found|unknown session)/i.test(message)
}

export async function createDocQueryMcpClient(
  options: DocQueryMcpClientOptions
): Promise<DocQueryMcpClient> {
  const transport = options.scoped
    ? createDocQueryScopedTransport(options.scoped)
    : createStaticTokenTransport(options)
  const client = new Client(
    { name: DOC_QUERY_CLIENT_NAME, version: DOC_QUERY_CLIENT_VERSION },
    {}
  )
  await client.connect(transport)

  let closed = false
  return {
    client,
    close: async () => {
      if (closed) return
      closed = true
      await client.close()
    },
  }
}

function createStaticTokenTransport(
  options: DocQueryMcpClientOptions
): StreamableHTTPClientTransport {
  assertDocQueryTransportSecurity(options.url)

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  if (options.authorization) {
    headers.Authorization = `Bearer ${options.authorization}`
  }
  if (options.scopeToken) {
    headers[DOC_QUERY_SCOPE_TOKEN_HEADER] = `Bearer ${options.scopeToken}`
  }

  return new StreamableHTTPClientTransport(new URL(options.url), {
    requestInit: { headers, redirect: 'error' },
  })
}

/**
 * Custom fetch seam accepted by both locked transports: the MCP SDK 1.30
 * `FetchLike` and the AI SDK HTTP transport's global-fetch-shaped function.
 */
export type DocQueryScopedFetch = typeof globalThis.fetch

export interface DocQueryScopedRoute {
  /** Deployment-controlled target of the scoped KB route. */
  target: URL
  /** Knowledge-base ids authorized for this caller; captured immutably. */
  kbIds: readonly string[]
  /** Owning chatbot, when the caller represents one. */
  chatbotId?: string
  /** Logical session the minted tokens belong to. */
  sessionId?: string
}

export interface DocQueryScopedFetchOptions extends DocQueryScopedRoute {
  /** Signing seam for tests; defaults to the shared ES256 signer. */
  signToken?: typeof signDocQueryScopeToken
}

export interface DocQueryScopedEndpoint {
  id?: unknown
  url?: unknown
  isActive?: unknown
}

function canonicalScopedEndpointUrl(value: unknown): URL {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new DocQueryScopeTokenError(
      'Doc Query scoped route configuration is invalid'
    )
  }

  let url: URL
  try {
    url = new URL(value.trim())
  } catch {
    throw new DocQueryScopeTokenError(
      'Doc Query scoped route configuration is invalid'
    )
  }

  // Credentials are attached to an exact, unambiguous destination only.
  if (url.username || url.password || url.search || url.hash) {
    throw new DocQueryScopeTokenError(
      'Doc Query scoped route configuration is ambiguous'
    )
  }

  return url
}

/**
 * Resolves the deployment-controlled destination of the scoped KB route for an
 * endpoint the caller has already identified as the modern KB binding. All
 * three variables absent keeps the legacy transport bearer; a partial or
 * inconsistent configuration fails closed before any credential is minted.
 * The stored URL is a binding check only, so a database URL edit cannot
 * redirect a scope token.
 */
export function resolveDocQueryScopedRoute(
  endpoint: DocQueryScopedEndpoint
): URL | undefined {
  const configured = {
    serverId: process.env[DOC_QUERY_SCOPED_ROUTE_ENV.serverId]?.trim() ?? '',
    legacyUrl: process.env[DOC_QUERY_SCOPED_ROUTE_ENV.legacyUrl]?.trim() ?? '',
    url: process.env[DOC_QUERY_SCOPED_ROUTE_ENV.url]?.trim() ?? '',
  }
  const present = Object.values(configured).filter(
    (value) => value.length > 0
  ).length

  if (present === 0) return undefined
  if (present !== Object.keys(configured).length) {
    throw new DocQueryScopeTokenError(
      'Doc Query scoped route configuration is incomplete'
    )
  }

  if (endpoint.isActive === false) {
    throw new DocQueryScopeTokenError('Doc Query KB server is not active')
  }
  if (typeof endpoint.id !== 'string' || endpoint.id !== configured.serverId) {
    throw new DocQueryScopeTokenError(
      'Doc Query scoped route does not match the KB server row'
    )
  }

  const boundRowUrl = canonicalScopedEndpointUrl(endpoint.url)
  const expectedRowUrl = canonicalScopedEndpointUrl(configured.legacyUrl)
  if (boundRowUrl.href !== expectedRowUrl.href) {
    throw new DocQueryScopeTokenError(
      'Doc Query scoped route does not match the KB server URL'
    )
  }

  const targetUrl = canonicalScopedEndpointUrl(configured.url)
  if (targetUrl.origin !== expectedRowUrl.origin) {
    throw new DocQueryScopeTokenError(
      'Doc Query scoped route target is not on the bound origin'
    )
  }
  if (targetUrl.pathname !== DOC_QUERY_SCOPED_ROUTE_PATH) {
    throw new DocQueryScopeTokenError(
      'Doc Query scoped route target is not the scoped KB path'
    )
  }

  assertDocQueryTransportSecurity(targetUrl.href)

  return targetUrl
}

/**
 * Mints a fresh scope token for every outbound request of one client. The
 * binding snapshot is captured per call, so the authorization of another turn
 * or user can never be reused. A signing failure rejects before any network
 * call and never falls back to the shared transport bearer.
 */
export function createDocQueryScopedFetch({
  target,
  kbIds,
  chatbotId,
  sessionId,
  signToken = signDocQueryScopeToken,
}: DocQueryScopedFetchOptions): DocQueryScopedFetch {
  return async (input, init) => {
    const rawUrl = input instanceof Request ? input.url : input
    const requestUrl =
      typeof rawUrl === 'string' ? new URL(rawUrl, target) : rawUrl
    if (requestUrl.href !== target.href) {
      throw new DocQueryScopeTokenError('Scope token target mismatch')
    }

    const headers = new Headers(init?.headers)
    headers.delete('authorization')
    headers.delete(DOC_QUERY_SCOPE_TOKEN_HEADER)

    const token = await signToken({
      kbIds,
      chatbotId,
      sessionId,
      jti: randomUUID(),
    })
    headers.set(DOC_QUERY_SCOPE_TOKEN_HEADER, `Bearer ${token}`)

    return fetch(input, {
      ...init,
      headers,
      redirect: 'error',
    })
  }
}

/**
 * Streamable HTTP transport for the scoped route: every request carries a
 * freshly minted scope token and redirects are rejected.
 */
export function createDocQueryScopedTransport(
  options: DocQueryScopedFetchOptions
): StreamableHTTPClientTransport {
  assertDocQueryTransportSecurity(options.target.href)

  return new StreamableHTTPClientTransport(options.target, {
    requestInit: { redirect: 'error' },
    fetch: createDocQueryScopedFetch(options),
  })
}
