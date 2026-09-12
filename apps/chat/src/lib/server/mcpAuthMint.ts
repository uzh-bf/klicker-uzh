import { signJWT } from '@klicker-uzh/util'
import type { AuthMode } from '@/src/lib/server/ltiGuest'

// JWT lives 5 min; cache evicts one minute earlier so a cached token
// can't expire mid-request.
const JWT_TTL_SECONDS = 5 * 60
const CACHE_TTL_MS = 4 * 60 * 1000

export const LECTURER_MCP_SCOPE_FULL = 'manage:read manage:draft'
export const LECTURER_MCP_SCOPE_READ_ONLY = 'manage:read'

// Purpose claims separate a chatbot-minted MCP token from every other token
// signed for the same subject; the MCP services reject a token without them.
const STUDENT_MCP_PURPOSE = 'student-mcp'
const LECTURER_MCP_PURPOSE = 'lecturer-mcp'

// Both participant kinds get the same practice access today. The scopes are
// minted separately so a future policy can withhold submitting without
// changing the token shape.
export const STUDENT_MCP_SCOPE_FULL =
  'student:practice:read student:practice:submit'

// Lecturer session UserLoginScope values (packages/prisma schema/user.prisma)
// that map to full read+draft MCP access. ACCOUNT_OWNER is the scope a real
// Edu-ID lecturer session carries (see apps/auth jwt callback); FULL_ACCESS
// is the equivalent delegated-login scope.
const FULL_ACCESS_SESSION_SCOPES = new Set(['ACCOUNT_OWNER', 'FULL_ACCESS'])

// Session scopes that only ever grant read access at the GraphQL layer
// (packages/graphql/src/schema/mutation.ts gates every content-authoring
// mutation behind FULL_ACCESS or higher; SESSION_EXEC only unlocks live-quiz
// run/feedback-moderation mutations, never question/course drafting).
const READ_ONLY_SESSION_SCOPES = new Set(['READ_ONLY', 'SESSION_EXEC'])

// OTP sessions are activation/reset flows, not working sessions: the
// GraphQL layer does not even consider them authenticated
// (packages/graphql/src/builder.ts), so they must never mint a usable MCP
// token.
const REJECTED_SESSION_SCOPES = new Set(['OTP'])

/**
 * Maps a lecturer session's `UserLoginScope` to the scope string minted
 * into the lecturer MCP JWT. Unknown or missing scopes (e.g. a session
 * minted before scope was tracked, or a future enum member) degrade to the
 * read-only floor rather than over-granting or breaking the assistant.
 */
export function resolveLecturerMcpScope(
  sessionScope: string | undefined
): string {
  if (sessionScope && FULL_ACCESS_SESSION_SCOPES.has(sessionScope)) {
    return LECTURER_MCP_SCOPE_FULL
  }
  if (sessionScope && READ_ONLY_SESSION_SCOPES.has(sessionScope)) {
    return LECTURER_MCP_SCOPE_READ_ONLY
  }
  return LECTURER_MCP_SCOPE_READ_ONLY
}

interface CacheEntry {
  jwt: string
  mintedAtMs: number
}

const cache = new Map<string, CacheEntry>()
const lecturerCache = new Map<string, CacheEntry>()

export class McpAuthMintError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'McpAuthMintError'
  }
}

/**
 * Mints a short-lived HS256 JWT identifying `participantId` for the
 * Klicker MCP server. `authMode` is the caller's verified participant kind
 * (`anonymous` is an LTI guest persona) and is carried into the token so
 * tool policy can distinguish the two. Tokens are cached per participant
 * and actor kind for under the JWT TTL so a streaming turn with N tool
 * calls mints once.
 *
 * Throws `McpAuthMintError` if required env is missing so misconfigured
 * environments fail loud at mint time, not at the MCP verifier.
 */
export async function mintParticipantMcpJwt(
  participantId: string,
  authMode: AuthMode
): Promise<string> {
  const secret = process.env.MCP_STUDENT_JWT_SECRET ?? process.env.APP_SECRET
  const issuer = process.env.APP_ORIGIN_AUTH

  if (!secret) {
    throw new McpAuthMintError(
      'APP_SECRET or MCP_STUDENT_JWT_SECRET is not set; cannot mint participant MCP JWT'
    )
  }
  if (!issuer) {
    throw new McpAuthMintError(
      'APP_ORIGIN_AUTH is not set; cannot mint participant MCP JWT'
    )
  }

  const cacheKey = `${participantId}:${authMode}`

  const now = Date.now()
  pruneExpiredCacheEntries(cache, now)

  const cached = cache.get(cacheKey)
  if (cached && now - cached.mintedAtMs <= CACHE_TTL_MS) {
    return cached.jwt
  }
  if (cached) {
    cache.delete(cacheKey)
  }

  const jwt = await signJWT(
    {
      sub: participantId,
      role: 'PARTICIPANT',
      purpose: STUDENT_MCP_PURPOSE,
      scope: STUDENT_MCP_SCOPE_FULL,
      actor: authMode,
    },
    secret,
    {
      algorithm: 'HS256',
      expiresIn: `${JWT_TTL_SECONDS}s`,
      issuer,
    }
  )

  cache.set(cacheKey, { jwt, mintedAtMs: now })
  return jwt
}

function pruneExpiredCacheEntries(
  entries: Map<string, CacheEntry>,
  now: number
): void {
  for (const [key, entry] of entries) {
    if (now - entry.mintedAtMs > CACHE_TTL_MS) {
      entries.delete(key)
    }
  }
}

/**
 * Mints a short-lived HS256 JWT identifying a Manage lecturer for the
 * lecturer MCP server. `sessionScope` is the lecturer's `UserLoginScope`
 * from their Manage session (see `getAuthenticatedManageUser`); it is
 * mapped to the minted MCP scope via `resolveLecturerMcpScope` so the
 * token never grants more than the session itself would allow at the
 * GraphQL layer. Cached per lecturer *and* effective MCP scope, since one
 * user can hold sessions with different scopes.
 *
 * Throws `McpAuthMintError` if required env is missing (fails loud on
 * misconfiguration) or if `sessionScope` is `OTP` (activation/reset
 * sessions are not working sessions and must never reach the MCP server).
 */
export async function mintLecturerMcpJwt(
  userId: string,
  sessionScope: string | undefined
): Promise<string> {
  if (sessionScope && REJECTED_SESSION_SCOPES.has(sessionScope)) {
    throw new McpAuthMintError(
      `Lecturer session scope '${sessionScope}' cannot mint a lecturer MCP JWT`
    )
  }

  const secret = process.env.MCP_LECTURER_JWT_SECRET ?? process.env.APP_SECRET
  const issuer = process.env.APP_ORIGIN_AUTH

  if (!secret) {
    throw new McpAuthMintError(
      'APP_SECRET or MCP_LECTURER_JWT_SECRET is not set; cannot mint lecturer MCP JWT'
    )
  }
  if (!issuer) {
    throw new McpAuthMintError(
      'APP_ORIGIN_AUTH is not set; cannot mint lecturer MCP JWT'
    )
  }

  const mcpScope = resolveLecturerMcpScope(sessionScope)
  const cacheKey = `${userId}:${mcpScope}`

  const now = Date.now()
  pruneExpiredCacheEntries(lecturerCache, now)

  const cached = lecturerCache.get(cacheKey)
  if (cached && now - cached.mintedAtMs <= CACHE_TTL_MS) {
    return cached.jwt
  }
  if (cached) {
    lecturerCache.delete(cacheKey)
  }

  const jwt = await signJWT(
    {
      sub: userId,
      role: 'USER',
      purpose: LECTURER_MCP_PURPOSE,
      scope: mcpScope,
    },
    secret,
    {
      algorithm: 'HS256',
      expiresIn: `${JWT_TTL_SECONDS}s`,
      issuer,
    }
  )

  lecturerCache.set(cacheKey, { jwt, mintedAtMs: now })
  return jwt
}

/** Test-only helper for clearing the in-process cache between cases. */
export function __resetParticipantMcpJwtCacheForTests(): void {
  cache.clear()
}

/** Test-only helper for clearing the in-process cache between cases. */
export function __resetLecturerMcpJwtCacheForTests(): void {
  lecturerCache.clear()
}
