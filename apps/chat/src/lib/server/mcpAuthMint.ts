import { signJWT } from '@klicker-uzh/util'

// JWT lives 5 min; cache evicts one minute earlier so a cached token
// can't expire mid-request.
const JWT_TTL_SECONDS = 5 * 60
const CACHE_TTL_MS = 4 * 60 * 1000

export const LECTURER_MCP_SCOPE_FULL = 'manage:read manage:draft'
export const LECTURER_MCP_SCOPE_READ_ONLY = 'manage:read'

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
 * Klicker MCP server. Tokens are cached per participant for under the
 * JWT TTL so a streaming turn with N tool calls mints once.
 *
 * Throws `McpAuthMintError` if required env is missing so misconfigured
 * environments fail loud at mint time, not at the MCP verifier.
 */
export async function mintParticipantMcpJwt(
  participantId: string
): Promise<string> {
  const secret = process.env.APP_SECRET
  const issuer = process.env.APP_ORIGIN_AUTH

  if (!secret) {
    throw new McpAuthMintError(
      'APP_SECRET is not set; cannot mint participant MCP JWT'
    )
  }
  if (!issuer) {
    throw new McpAuthMintError(
      'APP_ORIGIN_AUTH is not set; cannot mint participant MCP JWT'
    )
  }

  const now = Date.now()
  pruneExpiredCacheEntries(cache, now)

  const cached = cache.get(participantId)
  if (cached && now - cached.mintedAtMs <= CACHE_TTL_MS) {
    return cached.jwt
  }
  if (cached) {
    cache.delete(participantId)
  }

  const jwt = await signJWT(
    { sub: participantId, role: 'PARTICIPANT' },
    secret,
    {
      algorithm: 'HS256',
      expiresIn: `${JWT_TTL_SECONDS}s`,
      issuer,
    }
  )

  cache.set(participantId, { jwt, mintedAtMs: now })
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
      purpose: 'lecturer-mcp',
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
