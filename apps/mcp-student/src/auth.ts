import { extractBearerToken, verifyJWT } from '@klicker-uzh/util'
import type { IncomingHttpHeaders } from 'node:http'
import type { RuntimeSettings } from './config.js'

export const STUDENT_MCP_TOKEN_PURPOSE = 'student-mcp'

export type StudentMcpScope =
  | 'student:practice:read'
  | 'student:practice:submit'

const STUDENT_MCP_SCOPES: readonly StudentMcpScope[] = [
  'student:practice:read',
  'student:practice:submit',
]

// Which kind of participant the chatbot is acting for. Mirrors the chat
// `AuthMode` (apps/chat/src/lib/server/ltiGuest.ts): `anonymous` is an LTI
// guest persona, `account` a participant who signed in.
export type StudentMcpActor = 'account' | 'anonymous'

export type StudentMcpSession = {
  actor: StudentMcpActor
  bearerToken: string
  participantId: string
  scopes: StudentMcpScope[]
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
  return extractBearerToken(raw ?? null)
}

function parseScopes(value: unknown): StudentMcpScope[] {
  if (typeof value !== 'string') return []

  return value
    .split(/\s+/)
    .filter((scope): scope is StudentMcpScope =>
      STUDENT_MCP_SCOPES.includes(scope as StudentMcpScope)
    )
}

function parseActor(value: unknown): StudentMcpActor | null {
  return value === 'account' || value === 'anonymous' ? value : null
}

export async function verifyParticipantSession(
  token: string,
  settings: Pick<RuntimeSettings, 'jwtIssuer' | 'jwtSecret'>
): Promise<StudentMcpSession> {
  const payload = await verifyJWT(token, settings.jwtSecret, {
    issuer: settings.jwtIssuer,
  }).catch(() => {
    throw new StudentMcpAuthError(
      'Authentication failed: invalid participant token'
    )
  })

  // The purpose claim is what separates a chatbot-minted MCP token from an
  // ordinary participant session token: both carry `sub` and a PARTICIPANT
  // role and are signed for the same participant, so without it a session
  // cookie would open the MCP service directly.
  if (
    !payload.sub ||
    payload.role !== 'PARTICIPANT' ||
    payload.purpose !== STUDENT_MCP_TOKEN_PURPOSE
  ) {
    throw new StudentMcpAuthError(
      'Authentication failed: MCP token must identify a participant'
    )
  }

  const actor = parseActor(payload.actor)
  if (!actor) {
    throw new StudentMcpAuthError(
      'Authentication failed: MCP token is missing a known actor kind'
    )
  }

  // Per-tool scope requirements are enforced by fastmcp (see toolPolicy),
  // which never sees a session that carries no usable scope at all.
  const scopes = parseScopes(payload.scope)
  if (scopes.length === 0) {
    throw new StudentMcpAuthError(
      'Authentication failed: MCP token carries no student scope'
    )
  }

  return {
    actor,
    bearerToken: token,
    participantId: payload.sub,
    scopes,
  }
}
