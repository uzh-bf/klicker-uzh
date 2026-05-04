import { signJWT } from '@klicker-uzh/util'

// JWT lives 5 min; cache evicts one minute earlier so a cached token
// can't expire mid-request.
const JWT_TTL_SECONDS = 5 * 60
const CACHE_TTL_MS = 4 * 60 * 1000

interface CacheEntry {
  jwt: string
  mintedAtMs: number
}

const cache = new Map<string, CacheEntry>()

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

/** Test-only helper for clearing the in-process cache between cases. */
export function __resetParticipantMcpJwtCacheForTests(): void {
  cache.clear()
}
