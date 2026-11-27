import { type AppLogger, startRequestLog } from '@klicker-uzh/logging/node'
import type { NextFunction, Request, Response } from 'express'

const HEALTH_PATH = '/health'

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
    const route = routeTemplate(req.path) ?? '/unmatched'
    // Handled failures own their record via logRequestFailure; the completion
    // record only covers responses without an explicit failure record.
    const { log, startedAt } = startRequestLog(rootLogger, {
      method: req.method,
      headers: req.headers,
      res,
      message: 'OLAT API request completed',
      route: () => route,
      skip: () => req.path === HEALTH_PATH || !!res.locals.logFailureRecorded,
    })
    res.locals.log = log
    res.locals.logRoute = route
    res.locals.logStartedAt = startedAt
    next()
  }
}

export function requestLogger(res: Response): AppLogger | undefined {
  return res.locals.log as AppLogger | undefined
}
