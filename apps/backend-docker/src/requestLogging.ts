import type { AppLogger } from '@klicker-uzh/logging/node'
import {
  resolveRequestContext,
  type RequestContext,
} from '@klicker-uzh/logging/request'
import type { RequestHandler } from 'express'

declare global {
  namespace Express {
    interface Request {
      locals: {
        user?: unknown
        requestContext: RequestContext
        log: AppLogger
      }
    }
  }
}

export function requestLoggingMiddleware(root: AppLogger): RequestHandler {
  return (req, res, next) => {
    const requestContext = resolveRequestContext({
      requestId: req.headers['x-request-id'],
      correlationId: req.headers['x-correlation-id'],
    })
    const log = root.child(requestContext)
    const startedAt = performance.now()
    const route = req.path === '/healthz' ? '/healthz' : '/api/graphql'

    req.locals = {
      ...req.locals,
      requestContext,
      log,
    }
    res.setHeader('x-request-id', requestContext.requestId)

    if (route !== '/healthz') {
      res.once('finish', () => {
        const level = res.statusCode >= 500 ? 'error' : 'info'
        log[level](
          {
            event: 'http.request.completed',
            http: {
              method: req.method,
              route,
              statusCode: res.statusCode,
              durationMs: Math.round(performance.now() - startedAt),
            },
          },
          'HTTP request completed'
        )
      })
    }

    next()
  }
}
