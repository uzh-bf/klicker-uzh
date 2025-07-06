import {
  createLogger,
  createOperationContext,
  type Logger,
} from '@klicker-uzh/logging'
import type { Context } from './context.js'

// Create a default logger for the graphql package
const defaultLogger = createLogger({ service: 'graphql' })

/**
 * Get logger from context or return default logger
 */
export function getLogger(ctx: Partial<Context>): Logger {
  return ctx.logger || defaultLogger
}

/**
 * Create a child logger for a specific operation
 */
export function createOperationLogger(
  ctx: Partial<Context>,
  operationName: string,
  operationType?: string
): Logger {
  const baseLogger = getLogger(ctx)
  return baseLogger.child(
    createOperationContext(operationName, operationType, {
      userId: ctx.user?.sub,
      correlationId: ctx.correlationId,
    })
  )
}

/**
 * Log GraphQL errors with context
 */
export function logGraphQLError(
  ctx: Partial<Context>,
  error: Error,
  operation: string,
  additionalContext?: Record<string, any>
) {
  const logger = getLogger(ctx)
  logger.error('GraphQL operation failed', {
    operation,
    error: {
      name: error.name,
      message: error.message,
      stack: error.stack,
    },
    userId: ctx.user?.sub,
    ...additionalContext,
  })
}
