import {
  createLogger,
  toSafeError,
  type AppLogger,
} from '@klicker-uzh/logging/node'
import {
  resolveRequestContext,
  type DiagnosticHeader,
  type RequestContext,
} from '@klicker-uzh/logging/request'

const service =
  process.env.ASSESSMENT_MODE === 'true'
    ? 'frontend-assessment'
    : 'frontend-pwa'

export const logger = createLogger({ service })

interface SsrHeaders {
  [key: string]: DiagnosticHeader
}

export interface SsrRequestLogging {
  log: AppLogger
  requestContext: RequestContext
  logFailure(outcome: string): void
}

export function createSsrRequestLogging(
  headers: SsrHeaders,
  route: string
): SsrRequestLogging {
  const requestContext = resolveRequestContext({
    requestId: headers['x-request-id'],
    correlationId: headers['x-correlation-id'],
    traceId: headers['x-trace-id'],
    spanId: headers['x-span-id'],
  })
  const log = logger.child({ ...requestContext, route })

  return {
    log,
    requestContext,
    logFailure(outcome) {
      log.error(
        {
          event: 'ssr.request.failed',
          outcome,
          err: toSafeError('Failed to render server-side request'),
        },
        'Server-side request failed'
      )
    },
  }
}
