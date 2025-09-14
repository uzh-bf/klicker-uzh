import type { MiddlewareHandler } from 'hono'
import { randomUUID } from 'node:crypto'
import { env } from '../lib/env.js'
import { logger } from '../lib/logger.js'

export const requestId: MiddlewareHandler = async (c, next) => {
  const id = randomUUID()
  c.set('requestId', id)
  await next()
  c.header('X-Request-Id', id)
}

export const enforceJson: MiddlewareHandler = async (c, next) => {
  if (c.req.method === 'POST') {
    const ct = c.req.header('Content-Type') || ''
    if (!ct.toLowerCase().startsWith('application/json')) {
      return c.json(
        {
          error: 'invalid_json',
          code: 'INVALID_JSON',
          requestId: c.get('requestId'),
        },
        400
      )
    }
  }
  await next()
}

export const originGuard: MiddlewareHandler = async (c, next) => {
  if (c.req.method === 'POST') {
    const origin = c.req.header('Origin')
    if (
      !origin ||
      origin === 'null' ||
      !env.CORS_ALLOWED_ORIGINS.includes(origin)
    ) {
      return c.json(
        {
          error: 'origin_not_allowed',
          code: 'ORIGIN_NOT_ALLOWED',
          requestId: c.get('requestId'),
        },
        403
      )
    }
  }
  await next()
}

export const logging: MiddlewareHandler = async (c, next) => {
  const start = Date.now()
  const reqId = c.get('requestId')
  const method = c.req.method
  const path = new URL(c.req.url).pathname
  const origin = c.req.header('Origin')
  logger.info({ reqId, method, path, origin }, 'request')
  try {
    await next()
  } finally {
    const ms = Date.now() - start
    const status = c.res.status
    logger.info({ reqId, method, path, status, ms }, 'response')
  }
}
