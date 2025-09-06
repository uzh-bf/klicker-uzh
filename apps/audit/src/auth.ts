import { verifyJWT } from '@klicker-uzh/util'
import type { Context, Next } from 'hono'
import { config } from './config.js'
import { logger } from './utils/logger.js'

export interface ParticipantContext {
  participantId: string
  role: string
}

/**
 * Simple internal token authentication middleware for MVP
 * Validates X-Internal-Token header against configured token
 */
export async function authMiddleware(
  c: Context,
  next: Next
): Promise<Response | void> {
  const token = c.req.header('X-Internal-Token')

  if (!token) {
    logger.warn(
      { requestId: c.get('requestId'), path: c.req.path },
      'Authentication failed: missing X-Internal-Token header'
    )
    return c.json(
      { error: 'Authentication required: X-Internal-Token header missing' },
      401
    )
  }

  if (token !== config.INTERNAL_TOKEN) {
    logger.warn(
      { requestId: c.get('requestId'), path: c.req.path },
      'Authentication failed: invalid token'
    )
    return c.json({ error: 'Authentication failed: invalid token' }, 401)
  }

  // Token is valid, proceed to next middleware/handler
  await next()
}

/**
 * Verify participant JWT token using APP_SECRET
 * Uses the shared JWT utilities from @klicker-uzh/util
 */
export async function verifyParticipantToken(
  token: string,
  appSecret: string
): Promise<ParticipantContext | null> {
  if (!appSecret) {
    throw new Error('APP_SECRET not configured')
  }

  try {
    const payload = await verifyJWT(token, appSecret, {
      clockTolerance: 30, // Allow 30 seconds clock skew
    })

    // Extract participant data from JWT payload
    const participantId = payload.sub as string
    const role = payload.role as string

    // Validate required claims
    if (!participantId || !role) {
      return null
    }

    // Validate role is expected value
    if (!['PARTICIPANT', 'TEMPORARY_PARTICIPANT'].includes(role)) {
      return null
    }

    return {
      participantId,
      role,
    }
  } catch (error) {
    // JWT verification failed (expired, invalid signature, malformed, etc.)
    return null
  }
}

/**
 * Parse cookies from HTTP Cookie header
 * Based on the pattern used in func-response-processor and hatchet-worker-response-processor
 */
export function parseCookies(cookieHeader: string): Record<string, string> {
  return cookieHeader
    .split(';')
    .map((v) => v.split('='))
    .reduce(
      (acc, v) => {
        // Handle case where cookie might not have a value or might be malformed
        if (v.length >= 2) {
          acc[decodeURIComponent(v[0]!.trim())] = decodeURIComponent(
            v[1]!.trim()
          )
        }
        return acc
      },
      {} as Record<string, string>
    )
}
