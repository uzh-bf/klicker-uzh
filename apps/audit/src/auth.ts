import type { Context, Next } from 'hono'
import { config } from './config.js'
import { logger } from './utils/logger.js'

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
      { path: c.req.path },
      'Authentication failed: missing X-Internal-Token header'
    )
    return c.json(
      { error: 'Authentication required: X-Internal-Token header missing' },
      401
    )
  }

  if (token !== config.INTERNAL_TOKEN) {
    logger.warn(
      {
        path: c.req.path,
        tokenPrefix: token.substring(0, 4) + '...',
      },
      'Authentication failed: invalid token'
    )
    return c.json({ error: 'Authentication failed: invalid token' }, 401)
  }

  // Token is valid, proceed to next middleware/handler
  await next()
}
