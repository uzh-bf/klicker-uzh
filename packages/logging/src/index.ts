/**
 * @klicker-uzh/logging - Structured logging for KlickerUZH
 */

export { createLogger, generateCorrelationId } from './logger.js'

export {
  createCorrelationContext,
  createOperationContext,
  createPerformanceContext,
  createRequestContext,
  createUserContext,
} from './context.js'

export type {
  CorrelationContext,
  Environment,
  LogContext,
  LogEntry,
  LogLevelString,
  Logger,
  LoggerConfig,
} from './types.js'

export { LogLevel } from './types.js'
