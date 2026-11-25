import { type AppLogger, startRequestLog } from '@klicker-uzh/logging/node'
import type { RequestContext } from '@klicker-uzh/logging/request'
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
    const { requestContext, log } = startRequestLog(root, {
      method: req.method,
      headers: req.headers,
      res,
      message: 'HTTP request completed',
      skip: () => req.path === '/healthz',
      route: () => {
        const matchedRoute = req.locals.logRoute ?? req.route?.path
        return typeof matchedRoute === 'string' &&
          LOGGED_ROUTES.has(matchedRoute)
          ? matchedRoute
          : '/unmatched'
      },
    })
    req.locals = { ...req.locals, requestContext, log }
    next()
  }
}
