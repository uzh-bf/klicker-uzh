import { extractBearerToken } from '@klicker-uzh/util'
import type { IncomingHttpHeaders } from 'node:http'
import type { RuntimeSettings } from './config.js'
import { verifyLecturerJwt } from './jwt.js'

export const LECTURER_MCP_TOKEN_PURPOSE = 'lecturer-mcp'

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
  return extractBearerToken(raw ?? null)
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
  settings: Pick<RuntimeSettings, 'jwtIssuer' | 'jwtSecret'>
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
    payload.purpose !== LECTURER_MCP_TOKEN_PURPOSE
  ) {
    throw new LecturerMcpAuthError(
      'Authentication failed: MCP token must identify a lecturer'
    )
  }

  // Per-tool scope requirements are enforced by fastmcp (see toolPolicy),
  // which never sees a session that carries no usable scope at all.
  const scopes = parseScopes(payload.scope)
  if (scopes.length === 0) {
    throw new LecturerMcpAuthError(
      'Authentication failed: MCP token carries no lecturer scope'
    )
  }

  return {
    bearerToken: token,
    scopes,
    userId: payload.sub,
  }
}
