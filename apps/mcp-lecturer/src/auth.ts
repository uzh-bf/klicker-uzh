import type { IncomingHttpHeaders } from 'node:http'
import type { RuntimeSettings } from './config.js'
import { verifyLecturerJwt } from './jwt.js'

export type LecturerMcpScope = 'manage:read' | 'manage:draft'

export type LecturerMcpSession = {
  bearerToken: string
  scopes: LecturerMcpScope[]
  userId: string
}

export class LecturerMcpAuthError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'LecturerMcpAuthError'
  }
}

export function bearerTokenFromHeaders(
  headers: IncomingHttpHeaders
): string | null {
  const header = headers.authorization
  const raw = Array.isArray(header) ? header[0] : header
  if (!raw) return null

  const [scheme, token] = raw.split(/\s+/, 2)
  if (scheme?.toLowerCase() !== 'bearer' || !token) {
    return null
  }
  return token.trim() || null
}

function parseScopes(value: unknown): LecturerMcpScope[] {
  if (typeof value !== 'string') return []

  return value
    .split(/\s+/)
    .filter((scope): scope is LecturerMcpScope =>
      ['manage:read', 'manage:draft'].includes(scope)
    )
}

export async function verifyLecturerSession(
  token: string,
  settings: Pick<RuntimeSettings, 'jwtIssuer' | 'jwtSecret'>,
  requiredScopes: LecturerMcpScope[] = ['manage:read']
): Promise<LecturerMcpSession> {
  const payload = await verifyLecturerJwt(token, settings.jwtSecret, {
    issuer: settings.jwtIssuer,
  }).catch(() => {
    throw new LecturerMcpAuthError(
      'Authentication failed: invalid lecturer MCP token'
    )
  })

  if (
    !payload.sub ||
    payload.role !== 'USER' ||
    payload.purpose !== 'lecturer-mcp'
  ) {
    throw new LecturerMcpAuthError(
      'Authentication failed: MCP token must identify a lecturer'
    )
  }

  const scopes = parseScopes(payload.scope)
  const missingScope = requiredScopes.find((scope) => !scopes.includes(scope))
  if (missingScope) {
    throw new LecturerMcpAuthError(
      `Authentication failed: MCP token is missing scope ${missingScope}`
    )
  }

  return {
    bearerToken: token,
    scopes,
    userId: payload.sub,
  }
}
