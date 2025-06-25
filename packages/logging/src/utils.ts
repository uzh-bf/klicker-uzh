/**
 * Shared utility functions for logging package
 */

import { LogLevel, type LogLevelString } from './types.js'

/**
 * Parse log level from string to enum
 */
export function parseLogLevel(level: string | undefined): LogLevel | undefined {
  if (!level) return undefined

  switch (level.toLowerCase()) {
    case 'debug':
      return LogLevel.DEBUG
    case 'info':
      return LogLevel.INFO
    case 'warn':
    case 'warning':
      return LogLevel.WARN
    case 'error':
      return LogLevel.ERROR
    default:
      return undefined
  }
}

/**
 * Get log level string from enum
 */
export function getLogLevelString(level: LogLevel): LogLevelString {
  switch (level) {
    case LogLevel.DEBUG:
      return 'debug'
    case LogLevel.INFO:
      return 'info'
    case LogLevel.WARN:
      return 'warn'
    case LogLevel.ERROR:
      return 'error'
  }
}

/**
 * Parse log level string to enum value (strict version for internal use)
 * This version requires a valid LogLevelString and always returns a LogLevel
 */
export function parseLogLevelStrict(level: LogLevelString): LogLevel {
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
