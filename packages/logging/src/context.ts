/**
 * Context utilities for logging
 */

import { LogContext } from './types.js'

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
  const context: LogContext = {
    operationId,
  }
  
  if (operationType) {
    context.operationType = operationType
  }
  
  if (additionalContext) {
    Object.assign(context, additionalContext)
  }
  
  return context
}

/**
 * Create context for user tracking
 */
export function createUserContext(
  userId: string,
  additionalContext?: LogContext
): LogContext {
  const context: LogContext = {
    userId,
  }
  
  if (additionalContext) {
    Object.assign(context, additionalContext)
  }
  
  return context
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
  const context: LogContext = {
    requestId,
  }
  
  if (method) {
    context.method = method
  }
  
  if (path) {
    context.path = path
  }
  
  if (additionalContext) {
    Object.assign(context, additionalContext)
  }
  
  return context
}

/**
 * Create context for performance tracking
 */
export function createPerformanceContext(
  startTime: number,
  additionalContext?: LogContext
): LogContext {
  const duration = Date.now() - startTime
  
  const context: LogContext = {
    duration,
    durationMs: duration,
  }
  
  if (additionalContext) {
    Object.assign(context, additionalContext)
  }
  
  return context
}