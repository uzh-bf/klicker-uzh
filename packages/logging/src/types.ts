/**
 * Type definitions for @klicker-uzh/logging package
 */

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

export type LogLevelString = 'debug' | 'info' | 'warn' | 'error'

export type Environment = 'test' | 'development' | 'production'

export interface LogContext {
  [key: string]: unknown
}

export interface CorrelationContext {
  correlationId: string
  parentId?: string
  spanId?: string
}

export interface LogEntry {
  timestamp: string
  level: LogLevelString
  service: string
  message: string
  correlationId?: string
  context?: LogContext
}

export interface Logger {
  debug(message: string, context?: LogContext): void
  info(message: string, context?: LogContext): void
  warn(message: string, context?: LogContext): void
  error(message: string, context?: LogContext): void
  child(context: LogContext): Logger
}

export interface LoggerConfig {
  service: string
  environment?: Environment
  level?: LogLevelString
  context?: LogContext
  correlationId?: string
}

export interface EnvironmentConfig {
  environment: Environment
  logLevel: LogLevel
  isTest: boolean
  isDevelopment: boolean
  isProduction: boolean
}

export interface LoggerState {
  service: string
  environment: Environment
  logLevel: LogLevel
  baseContext: LogContext
  correlationId?: string
  formatter: (entry: LogEntry) => string
  output: (message: string) => void
}
