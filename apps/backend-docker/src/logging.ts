import {
  createLogger,
  generateCorrelationId,
  type Logger,
} from '@klicker-uzh/logging'
import type { Request as ExpressRequest } from 'express'

/**
 * Create the base logger for the backend application
 */
export const logger = createLogger({
  service: 'backend-docker',
  environment: process.env.NODE_ENV as any,
})

/**
 * Extract correlation ID from various sources in the request
 */
export function extractCorrelationId(
  req: ExpressRequest | Request
): string | undefined {
  // Handle both Express and Fetch API Request objects
  let headers: any

  if (req instanceof Request) {
    // Fetch API Request (GraphQL Yoga)
    headers = Object.fromEntries(req.headers.entries())
  } else {
    // Express Request
    headers = req.headers
  }

  // Check common correlation ID headers
  const correlationId =
    headers['x-correlation-id'] ||
    headers['x-request-id'] ||
    headers['x-trace-id']

  return typeof correlationId === 'string' ? correlationId : undefined
}

/**
 * Create a request-scoped logger with correlation ID
 */
export function createRequestLogger(req: ExpressRequest | Request): Logger {
  const correlationId = extractCorrelationId(req) || generateCorrelationId()

  // Store correlation ID on request for later use
  ;(req as any).correlationId = correlationId

  // Extract request details based on request type
  let method: string
  let path: string
  let ip: string | undefined
  let userAgent: string | undefined

  if (typeof (req as any).get === 'function') {
    // Express Request
    method = req.method
    path = (req as any).path
    ip = (req as any).ip
    userAgent = (req as any).get('user-agent')
  } else if (
    (req as any).headers &&
    typeof (req as any).headers.get === 'function'
  ) {
    // Fetch API Request (GraphQL Yoga)
    const url = new URL((req as any).url)
    method = req.method
    path = url.pathname
    userAgent = (req as any).headers.get('user-agent') || undefined
    // IP is not directly available in Fetch API Request
  } else {
    // Fallback for unknown request types
    method = (req as any).method || 'UNKNOWN'
    path = (req as any).path || (req as any).url || '/'
    userAgent = (req as any).headers?.['user-agent'] || undefined
  }

  return logger.child({
    correlationId,
    method,
    path,
    ...(ip && { ip }),
    ...(userAgent && { userAgent }),
  })
}

/**
 * Extend GraphQL context with logger
 */
export interface LoggerContext {
  logger: Logger
  correlationId: string
}
