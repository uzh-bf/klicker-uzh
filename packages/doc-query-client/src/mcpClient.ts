import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'

export const DOC_QUERY_SCOPE_TOKEN_HEADER = 'X-Doc-Query-Scope-Token'
export const DOC_QUERY_CLIENT_NAME = 'klicker-doc-query-client'
export const DOC_QUERY_CLIENT_VERSION = '1.0.0'

export interface DocQueryMcpClientOptions {
  url: string
  /** Transport bearer credential; sent as Authorization when present. */
  authorization?: string
  /** ES256 scope token; sent on the scope-token header for every request. */
  scopeToken?: string
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

  const transport = new StreamableHTTPClientTransport(new URL(options.url), {
    requestInit: { headers, redirect: 'error' },
  })
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
