import type { AppLogger } from '@klicker-uzh/logging/node'
import {
  type RequestContext,
  resolveRequestContext,
} from '@klicker-uzh/logging/request'
import type { RequestHandler } from 'express'

const LOGGED_ROUTES = new Set([
  '/healthz',
  '/api/graphql',
  '/api/ingestion/resources/:resourceId/versions/:resourceVersion',
  '/api/webhooks/kb-ingestion',
  '/__growthbook__/api/features/sdk-test',
])

declare global {
  namespace Express {
    interface Request {
      locals: {
        user?: unknown
        requestContext: RequestContext
        log: AppLogger
        logRoute?: string
      }
    }
  }
}

/** Bind a template for app.use mounts, which do not populate req.route. */
export function setRequestLogRoute(route: string): RequestHandler {
  return (req, _res, next) => {
    if (LOGGED_ROUTES.has(route)) req.locals.logRoute = route
    next()
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

    req.locals = {
      ...req.locals,
      requestContext,
      log,
    }
    res.setHeader('x-request-id', requestContext.requestId)

    if (req.path !== '/healthz') {
      res.once('finish', () => {
        const matchedRoute = req.locals.logRoute ?? req.route?.path
        const route =
          typeof matchedRoute === 'string' && LOGGED_ROUTES.has(matchedRoute)
            ? matchedRoute
            : '/unmatched'
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
