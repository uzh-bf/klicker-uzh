import { verifyJWT } from '@klicker-uzh/util'
import type { IncomingHttpHeaders } from 'node:http'
import type { RuntimeSettings } from './config.js'

export type StudentMcpSession = {
  bearerToken: string
  participantId: string
}

export class StudentMcpAuthError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'StudentMcpAuthError'
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

export async function verifyParticipantSession(
  token: string,
  settings: Pick<RuntimeSettings, 'appSecret' | 'jwtIssuer'>
): Promise<StudentMcpSession> {
  const payload = await verifyJWT(token, settings.appSecret, {
    issuer: settings.jwtIssuer,
  }).catch(() => {
    throw new StudentMcpAuthError(
      'Authentication failed: invalid participant token'
    )
  })

  if (!payload.sub || payload.role !== 'PARTICIPANT') {
    throw new StudentMcpAuthError(
      'Authentication failed: MCP token must identify a participant'
    )
  }

  return {
    bearerToken: token,
    participantId: payload.sub,
  }
}
