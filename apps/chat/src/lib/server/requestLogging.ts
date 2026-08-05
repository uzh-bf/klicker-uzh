import { AsyncLocalStorage } from 'node:async_hooks'
import type { AppLogger } from '@klicker-uzh/logging/node'
import { toSafeError } from '@klicker-uzh/logging/node'
import {
  type RequestContext,
  resolveRequestContext,
} from '@klicker-uzh/logging/request'
import { logger } from './logger'

const routeLoggerStorage = new AsyncLocalStorage<AppLogger>()

type RouteHandler<T extends Response> = (
  log: AppLogger,
  requestContext: RequestContext
) => T | Promise<T>

export async function withRouteLogging<T extends Response>(
  request: Request,
  route: string,
  handler: RouteHandler<T>,
  rootLogger: AppLogger = logger
): Promise<T> {
  const requestContext = resolveRequestContext({
    requestId: request.headers.get('x-request-id'),
    correlationId: request.headers.get('x-correlation-id'),
  })
  const log = rootLogger.child(requestContext)
  const startedAt = performance.now()
  const suppressCompletion = route === '/api/health'

  try {
    const response = await routeLoggerStorage.run(log, () =>
      handler(log, requestContext)
    )
    response.headers.set('x-request-id', requestContext.requestId)

    if (!suppressCompletion) {
      const outcome =
        response.status >= 500
          ? 'failure'
          : response.status >= 400
            ? 'rejected'
            : 'success'
      const fields = {
        event: 'http.request.completed',
        http: {
          method: request.method,
          route,
          statusCode: response.status,
          durationMs: Math.round(performance.now() - startedAt),
        },
        outcome,
        ...(response.status >= 500
          ? { err: toSafeError('Chat request failed') }
          : {}),
      }

      if (response.status >= 500) {
        log.error(fields, 'Chat request completed')
      } else {
        log.info(fields, 'Chat request completed')
      }
    }

    return response
  } catch (error) {
    if (!suppressCompletion) {
      log.error(
        {
          event: 'http.request.completed',
          http: {
            method: request.method,
            route,
            statusCode: 500,
            durationMs: Math.round(performance.now() - startedAt),
          },
          outcome: 'failure',
          err: toSafeError('Chat request failed'),
        },
        'Chat request completed'
      )
    }
    throw error
  }
}

export function getRouteLogger(): AppLogger {
  return routeLoggerStorage.getStore() ?? logger
}
