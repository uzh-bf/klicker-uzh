import { createRequire } from 'node:module'
import pino, {
  type DestinationStream,
  type Logger,
  type LoggerOptions,
} from 'pino'
import { normalizeLogLevel } from './levels.js'

export type AppLogger = Logger

export interface CreateLoggerOptions {
  service: string
  level?: string
  environment?: string
  pretty?: boolean
}

export function createSafeError(message: string): Error {
  return new Error(message)
}

/** @deprecated Use createSafeError for synthetic, privacy-safe errors. */
export const toSafeError = createSafeError

export function createLogger(
  options: CreateLoggerOptions,
  destination?: DestinationStream
): AppLogger {
  const environment =
    options.environment ?? process.env.NODE_ENV ?? 'production'
  // Test silence must beat an ambient LOG_LEVEL so the suite output contract
  // holds in environments that export LOG_LEVEL globally (devcontainers, CI).
  const configuredLevel =
    options.level ??
    (environment === 'test' ? 'silent' : (process.env.LOG_LEVEL ?? 'info'))
  const pretty =
    options.pretty ??
    (environment.toLowerCase() === 'development' &&
      process.env.PINO_PRETTY !== 'false')
  const loggerOptions: LoggerOptions = {
    level: normalizeLogLevel(configuredLevel),
    base: { service: options.service },
    formatters: {
      level(label) {
        return { level: label }
      },
    },
    serializers: {
      err: pino.stdSerializers.err,
    },
    redact: {
      censor: '[REDACTED]',
      paths: [
        'authorization',
        'cookie',
        'headers',
        'req.headers',
        'request.headers',
        'body',
        'req.body',
        'request.body',
        'payload',
        'accessToken',
        'refreshToken',
        'idToken',
        'token',
        'password',
        'secret',
        'connectionString',
      ],
    },
  }

  if (destination) return pino(loggerOptions, destination)
  if (!pretty) return pino(loggerOptions)

  // Load the development-only dependency only when pretty output is selected.
  // An in-process stream avoids tsx watch messages colliding with the
  // thread-stream worker protocol. Production still writes NDJSON directly.
  const prettyStream = createRequire(import.meta.url)('pino-pretty')
  return pino(
    loggerOptions,
    prettyStream({
      colorize: true,
      singleLine: true,
      translateTime: 'SYS:standard',
      sync: true,
    })
  )
}
