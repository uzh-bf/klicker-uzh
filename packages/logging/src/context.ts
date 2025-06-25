/**
 * Context utilities for logging
 */

import { CorrelationContext, LogContext } from './types.js'

/**
 * Maximum context size to prevent memory issues
 */
const MAX_CONTEXT_SIZE = 1000 // characters when stringified

/**
 * Validate and sanitize context object
 */
export function sanitizeContext(context: LogContext): LogContext {
  if (!context || typeof context !== 'object') {
    return {}
  }

  // Check size
  try {
    const size = JSON.stringify(context).length
    if (size > MAX_CONTEXT_SIZE) {
      return {
        _warning: 'Context too large, truncated',
        _originalSize: size,
      }
    }
  } catch {
    return {
      _warning: 'Context contains circular references',
    }
  }

  return context
}

/**
 * Create context for operation tracking
 */
export function createOperationContext(
  operationId: string,
  operationType?: string,
  additionalContext?: LogContext
): LogContext {
  return {
    operationId,
    ...(operationType && { operationType }),
    ...(additionalContext || {}),
  }
}

/**
 * Create context for user tracking
 */
export function createUserContext(
  userId: string,
  additionalContext?: LogContext
): LogContext {
  return {
    userId,
    ...(additionalContext || {}),
  }
}

/**
 * Create context for request tracking
 */
export function createRequestContext(
  requestId: string,
  method?: string,
  path?: string,
  additionalContext?: LogContext
): LogContext {
  return {
    requestId,
    ...(method && { method }),
    ...(path && { path }),
    ...(additionalContext || {}),
  }
}

/**
 * Create context for performance tracking
 */
export function createPerformanceContext(
  startTime: number,
  additionalContext?: LogContext
): LogContext {
  const duration = Date.now() - startTime

  return {
    duration,
    durationMs: duration,
    ...(additionalContext || {}),
  }
}

/**
 * Create correlation context for distributed tracing
 */
export function createCorrelationContext(
  correlationId: string,
  parentId?: string,
  spanId?: string
): CorrelationContext {
  return {
    correlationId,
    parentId,
    spanId,
  }
}
