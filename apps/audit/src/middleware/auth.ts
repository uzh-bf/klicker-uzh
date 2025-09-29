import { verifyJWT } from '@klicker-uzh/util'
import type { Context, Next } from 'hono'
import { config } from '../config.js'
import { logger } from '../utils/logger.js'

export interface ParticipantContext {
  participantId: string
  role: string
}

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

  if (token !== config.AUDIT_TOKEN) {
    logger.warn(
      { requestId: c.get('requestId'), path: c.req.path },
      'Authentication failed: invalid token'
    )
    return c.json({ error: 'Authentication failed: invalid token' }, 401)
  }

  await next()
}

export async function verifyParticipantToken(
  token: string,
  appSecret: string
): Promise<ParticipantContext | null> {
  if (!appSecret) {
    throw new Error('APP_SECRET not configured')
  }

  try {
    const payload = await verifyJWT(token, appSecret, {
      clockTolerance: 30,
      issuer: process.env.APP_ORIGIN_AUTH,
    })

    const participantId = payload.sub as string
    const role = payload.role as string

    if (!participantId || !role) {
      return null
    }

    if (role !== 'PARTICIPANT') {
      return null
    }

    return {
      participantId,
      role,
    }
  } catch (error) {
    return null
  }
}
