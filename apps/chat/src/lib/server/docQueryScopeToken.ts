import { randomUUID } from 'node:crypto'
import { importPKCS8, SignJWT } from 'jose'
import { DOC_QUERY_SCOPE_TOKEN_HEADER } from '@/src/services/mcpScope'

const DOC_QUERY_SCOPE_TOKEN_ALGORITHM = 'ES256'
const DOC_QUERY_SCOPE_TOKEN_TTL_SECONDS = 5 * 60

export class DocQueryScopeTokenError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'DocQueryScopeTokenError'
  }
}

export type DocQueryScopedFetch = (
  url: string | URL,
  init?: RequestInit
) => Promise<Response>

function requireScopeTokenEnv(name: string): string {
  const value = process.env[name]?.trim()
  if (!value) {
    throw new DocQueryScopeTokenError(`${name} is not configured`)
  }
  return value
}

export async function signDocQueryScopeToken({
  kbIds,
  chatbotId,
  sessionId,
  jti,
}: {
  kbIds: readonly string[]
  chatbotId: string
  sessionId: string
  jti: string
}): Promise<string> {
  const privateKeyPem = requireScopeTokenEnv(
    'DOC_QUERY_SCOPE_PRIVATE_KEY'
  ).replaceAll('\\n', '\n')
  const kid = requireScopeTokenEnv('DOC_QUERY_SCOPE_KID')
  const issuer = requireScopeTokenEnv('DOC_QUERY_SCOPE_ISSUER')
  const audience = requireScopeTokenEnv('DOC_QUERY_SCOPE_AUDIENCE')

  try {
    const privateKey = await importPKCS8(
      privateKeyPem,
      DOC_QUERY_SCOPE_TOKEN_ALGORITHM
    )

    return await new SignJWT({
      kb_id: kbIds.length === 1 ? kbIds[0] : kbIds,
      chatbot_id: chatbotId,
    })
      .setProtectedHeader({
        alg: DOC_QUERY_SCOPE_TOKEN_ALGORITHM,
        typ: 'JWT',
        kid,
      })
      .setIssuer(issuer)
      .setAudience(audience)
      .setSubject(sessionId)
      .setJti(jti)
      .setIssuedAt()
      .setExpirationTime(`${DOC_QUERY_SCOPE_TOKEN_TTL_SECONDS}s`)
      .sign(privateKey)
  } catch (error) {
    if (error instanceof DocQueryScopeTokenError) {
      throw error
    }
    throw new DocQueryScopeTokenError('Scope token signing failed')
  }
}

/**
 * Mints a fresh scope token for every outbound request of one MCP client.
 * The binding snapshot is captured per turn, so the authorization of another
 * turn or user can never be reused. A signing failure rejects before any
 * network call and never falls back to the shared transport bearer.
 */
export function createDocQueryScopedFetch({
  target,
  kbIds,
  chatbotId,
  sessionId,
}: {
  target: URL
  kbIds: readonly string[]
  chatbotId: string
  sessionId: string
}): DocQueryScopedFetch {
  return async (url, init) => {
    const requestUrl = typeof url === 'string' ? new URL(url, target) : url
    if (requestUrl.href !== target.href) {
      throw new DocQueryScopeTokenError('Scope token target mismatch')
    }

    const headers = new Headers(init?.headers)
    headers.delete('authorization')
    headers.delete(DOC_QUERY_SCOPE_TOKEN_HEADER)

    const token = await signDocQueryScopeToken({
      kbIds,
      chatbotId,
      sessionId,
      jti: randomUUID(),
    })
    headers.set(DOC_QUERY_SCOPE_TOKEN_HEADER, `Bearer ${token}`)

    return fetch(requestUrl, {
      ...init,
      headers,
      redirect: 'error',
    })
  }
}
