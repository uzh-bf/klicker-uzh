/**
 * Environment detection and configuration for logging
 */

import { Environment, EnvironmentConfig, LogLevel } from './types.js'
import { parseLogLevel } from './utils.js'

/**
 * Detect current environment from NODE_ENV
 */
export function detectEnvironment(): Environment {
  const nodeEnv = process.env.NODE_ENV?.toLowerCase()

  switch (nodeEnv) {
    case 'test':
      return 'test'
    case 'production':
    case 'prod':
      return 'production'
    case 'development':
    case 'dev':
    default:
      return 'development'
  }
}

/**
 * Get default log level for environment
 */
export function getDefaultLogLevel(environment: Environment): LogLevel {
  switch (environment) {
    case 'test':
      return LogLevel.ERROR // Effectively silent due to no-op logger
    case 'production':
      return LogLevel.INFO
    case 'development':
      return LogLevel.DEBUG
  }
}

/**
 * Type guards for environment checking
 */
export function isTest(environment: Environment): boolean {
  return environment === 'test'
}

export function isDevelopment(environment: Environment): boolean {
  return environment === 'development'
}

export function isProduction(environment: Environment): boolean {
  return environment === 'production'
}

/**
 * Get complete environment configuration
 */
export function getEnvironmentConfig(
  overrideEnv?: Environment
): EnvironmentConfig {
  const environment = overrideEnv || detectEnvironment()

  // Check for log level override from environment variable
  const envLogLevel = parseLogLevel(process.env.LOG_LEVEL)
  const logLevel = envLogLevel ?? getDefaultLogLevel(environment)

  return {
    environment,
    logLevel,
    isTest: isTest(environment),
    isDevelopment: isDevelopment(environment),
    isProduction: isProduction(environment),
  }
}
