/**
 * Core logger implementation - Functional approach
 */

import { randomUUID } from 'node:crypto'
import { getEnvironmentConfig } from './environment.js'
import {
  formatForDevelopment,
  formatForProduction,
  formatForTest,
} from './formatter.js'
import {
  type LogContext,
  type LogEntry,
  LogLevel,
  type LogLevelString,
  type Logger,
  type LoggerConfig,
  type LoggerState,
} from './types.js'

/**
 * Generate a new correlation ID
 */
export function generateCorrelationId(): string {
  return randomUUID()
}

/**
 * Parse log level string to enum value
 */
function parseLogLevel(level: LogLevelString): LogLevel {
  switch (level) {
    case 'debug':
      return LogLevel.DEBUG
    case 'info':
      return LogLevel.INFO
    case 'warn':
      return LogLevel.WARN
    case 'error':
      return LogLevel.ERROR
  }
}

/**
 * Check if message should be logged based on configured level
 */
function shouldLog(messageLevel: LogLevel, configuredLevel: LogLevel): boolean {
  return messageLevel >= configuredLevel
}

/**
 * Merge base context with message context
 */
function mergeContext(
  baseContext: LogContext,
  messageContext?: LogContext
): LogContext | undefined {
  const hasBaseContext = Object.keys(baseContext).length > 0
  const hasMessageContext =
    messageContext && Object.keys(messageContext).length > 0

  if (!hasBaseContext && !hasMessageContext) {
    return undefined
  }

  if (!hasMessageContext) {
    return baseContext
  }

  if (!hasBaseContext) {
    return messageContext
  }

  return { ...baseContext, ...messageContext }
}

/**
 * Create log entry from parameters
 */
function createLogEntry(
  level: LogLevelString,
  message: string,
  service: string,
  baseContext: LogContext,
  correlationId?: string,
  messageContext?: LogContext
): LogEntry {
  return {
    timestamp: new Date().toISOString(),
    level,
    service,
    message,
    correlationId,
    context: mergeContext(baseContext, messageContext),
  }
}

/**
 * Log a message with the given state and parameters
 */
function logMessage(
  state: LoggerState,
  level: LogLevelString,
  message: string,
  context?: LogContext
): void {
  const levelEnum = parseLogLevel(level)

  if (!shouldLog(levelEnum, state.logLevel)) {
    return
  }

  const entry = createLogEntry(
    level,
    message,
    state.service,
    state.baseContext,
    state.correlationId,
    context
  )

  try {
    const formatted = state.formatter(entry)
    if (formatted) {
      state.output(formatted)
    }
  } catch (error) {
    // Prevent logger errors from crashing the application
    if (state.environment !== 'test') {
      console.error('[LOGGER ERROR]', error)
    }
  }
}

/**
 * Create logger state from configuration
 */
function createLoggerState(config: LoggerConfig): LoggerState {
  const envConfig = getEnvironmentConfig(config.environment)

  const logLevel = config.level
    ? parseLogLevel(config.level)
    : envConfig.logLevel
  const baseContext = config.context || {}

  // Select formatter and output based on environment
  let formatter: (entry: LogEntry) => string
  let output: (message: string) => void

  if (envConfig.isTest) {
    formatter = formatForTest
    output = () => {} // No-op for tests
  } else if (envConfig.isProduction) {
    formatter = formatForProduction
    output = (message) => console.log(message)
  } else {
    formatter = formatForDevelopment
    output = (message) => console.log(message)
  }

  return {
    service: config.service,
    environment: envConfig.environment,
    logLevel,
    baseContext,
    correlationId: config.correlationId,
    formatter,
    output,
  }
}

/**
 * Create a child logger with additional context
 */
function createChildLogger(
  state: LoggerState,
  additionalContext: LogContext
): Logger {
  const childState: LoggerState = {
    ...state,
    baseContext: mergeContext(state.baseContext, additionalContext) || {},
    // Child loggers inherit correlation ID from parent
    correlationId: state.correlationId,
  }

  return createLoggerFromState(childState)
}

/**
 * Create logger instance from state
 */
function createLoggerFromState(state: LoggerState): Logger {
  return {
    debug: (message: string, context?: LogContext) =>
      logMessage(state, 'debug', message, context),
    info: (message: string, context?: LogContext) =>
      logMessage(state, 'info', message, context),
    warn: (message: string, context?: LogContext) =>
      logMessage(state, 'warn', message, context),
    error: (message: string, context?: LogContext) =>
      logMessage(state, 'error', message, context),
    child: (context: LogContext) => createChildLogger(state, context),
  }
}

/**
 * Create a new logger instance
 */
export function createLogger(config: LoggerConfig): Logger {
  const state = createLoggerState(config)
  return createLoggerFromState(state)
}

// Export utility functions for testing
export {
  createLogEntry,
  createLoggerState,
  mergeContext,
  parseLogLevel,
  shouldLog,
}
