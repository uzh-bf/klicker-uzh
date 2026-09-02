import pino, {
  type DestinationStream,
  type Logger,
  type LoggerOptions,
} from 'pino'

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
  const level =
    options.level ??
    process.env.LOG_LEVEL ??
    (environment === 'test' ? 'silent' : 'info')
  const pretty =
    options.pretty ??
    (environment.toLowerCase() === 'development' &&
      process.env.PINO_PRETTY !== 'false')
  const loggerOptions: LoggerOptions = {
    level: level.toLowerCase(),
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

  return pino(
    loggerOptions,
    pino.transport({
      target: 'pino-pretty',
      options: {
        colorize: true,
        singleLine: true,
        translateTime: 'SYS:standard',
      },
    })
  )
}
