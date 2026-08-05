import type { AppLogger } from '@klicker-uzh/logging/node'
import { resolveRequestContext } from '@klicker-uzh/logging/request'
import type { NextFunction, Request, Response } from 'express'

const ROUTE_TEMPLATES = [
  '/api/configuration/courses',
  '/api/configuration/activityTypes',
  '/api/configuration/course/:courseID/activityTypes',
  '/api/configuration/course/:courseID/:activityTypeKey',
  '/openapi.yaml',
] as const

function routeTemplate(pathname: string): string | undefined {
  if (
    pathname === ROUTE_TEMPLATES[0] ||
    pathname === ROUTE_TEMPLATES[1] ||
    pathname === ROUTE_TEMPLATES[4]
  ) {
    return pathname
  }
  if (/^\/api\/configuration\/course\/[^/]+\/activityTypes$/.test(pathname)) {
    return ROUTE_TEMPLATES[2]
  }
  if (/^\/api\/configuration\/course\/[^/]+\/[^/]+$/.test(pathname)) {
    return ROUTE_TEMPLATES[3]
  }
  return undefined
}

export function createRequestLoggingMiddleware(rootLogger: AppLogger) {
  return (req: Request, res: Response, next: NextFunction) => {
    const route = routeTemplate(req.path)
    if (!route) {
      next()
      return
    }

    const requestContext = resolveRequestContext({
      requestId: req.headers['x-request-id'],
      correlationId: req.headers['x-correlation-id'],
    })
    const log = rootLogger.child(requestContext)
    const startedAt = performance.now()
    res.setHeader('x-request-id', requestContext.requestId)
    res.locals.log = log
    res.locals.logRoute = route
    res.locals.logStartedAt = startedAt

    log.info(
      {
        event: 'http.request.started',
        http: { method: req.method, route },
      },
      'OLAT API request started'
    )

    res.on('finish', () => {
      log.info(
        {
          event: 'http.request.completed',
          http: {
            method: req.method,
            route,
            statusCode: res.statusCode,
            durationMs: Math.round(performance.now() - startedAt),
          },
          outcome: res.statusCode >= 500 ? 'failure' : 'success',
        },
        'OLAT API request completed'
      )
    })

    next()
  }
}

export function requestLogger(res: Response): AppLogger | undefined {
  return res.locals.log as AppLogger | undefined
}
