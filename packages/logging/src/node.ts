import { createRequire } from 'node:module'
import pino, {
  type DestinationStream,
  type Logger,
  type LoggerOptions,
} from 'pino'
import { normalizeLogLevel } from './levels.js'
import {
  type DiagnosticHeader,
  type RequestContext,
  resolveRequestContext,
} from './request.js'

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

export interface RequestLogResponse {
  statusCode: number
  setHeader(name: string, value: string): unknown
  once(event: 'finish', listener: () => void): unknown
}

export interface StartRequestLogOptions {
  method: string
  headers: Record<string, DiagnosticHeader>
  res: RequestLogResponse
  message: string
  /** Resolved when the response finishes, so late route bindings count. */
  route: () => string
  /** Return true to skip the completion record (health checks, or a failure that was already logged). */
  skip?: () => boolean
}

/**
 * Bind a request-scoped child logger, echo the request ID, and write one
 * `http.request.completed` record when the response finishes.
 */
export function startRequestLog(
  root: AppLogger,
  options: StartRequestLogOptions
): { requestContext: RequestContext; log: AppLogger; startedAt: number } {
  const requestContext = resolveRequestContext({
    requestId: options.headers['x-request-id'],
    correlationId: options.headers['x-correlation-id'],
  })
  const log = root.child(requestContext)
  const startedAt = performance.now()
  options.res.setHeader('x-request-id', requestContext.requestId)

  options.res.once('finish', () => {
    if (options.skip?.()) return
    const failed = options.res.statusCode >= 500
    log[failed ? 'error' : 'info'](
      {
        event: 'http.request.completed',
        http: {
          method: options.method,
          route: options.route(),
          statusCode: options.res.statusCode,
          durationMs: Math.round(performance.now() - startedAt),
        },
        outcome: failed ? 'failure' : 'success',
      },
      options.message
    )
  })

  return { requestContext, log, startedAt }
}
