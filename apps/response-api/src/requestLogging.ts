import type { AppLogger } from '@klicker-uzh/logging/node'
import {
  resolveRequestContext,
  type RequestContext,
} from '@klicker-uzh/logging/request'
import type { IncomingMessage, ServerResponse } from 'node:http'

export type ResponseApiRoute = '/AddResponse' | '/healthz' | '/'

export interface NodeRequestLog {
  context: RequestContext
  log: AppLogger
  complete(statusCode: number): void
}

export function beginNodeRequest(
  req: IncomingMessage,
  res: ServerResponse,
  root: AppLogger,
  route: ResponseApiRoute
): NodeRequestLog {
  const context = resolveRequestContext({
    requestId: req.headers['x-request-id'],
    correlationId: req.headers['x-correlation-id'],
  })
  const log = root.child(context)
  const startedAt = performance.now()
  let completed = false

  res.setHeader('x-request-id', context.requestId)
  res.setHeader('x-correlation-id', context.correlationId)

  const complete = (statusCode: number) => {
    if (completed || route === '/healthz' || route === '/') return
    completed = true
    const level = statusCode >= 500 ? 'error' : 'info'

    log[level](
      {
        event: 'http.request.completed',
        http: {
          method: req.method,
          route,
          statusCode,
          durationMs: Math.round(performance.now() - startedAt),
        },
      },
      'HTTP request completed'
    )
  }

  // The completion event is emitted by Node after the response has been
  // flushed. Keeping this on `finish` avoids recording a request as complete
  // while a response body is still being written.
  res.once('finish', () => complete(res.statusCode))

  return { context, log, complete }
}
