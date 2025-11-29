import pino, { Logger, LoggerOptions } from 'pino'

export type AppLogger = Logger

const SERVICE_NAME = process.env.APP_NAME ?? '@klicker-uzh/auth'

const baseOptions: LoggerOptions = {
  level: (process.env.LOG_LEVEL ?? 'info').toLowerCase(),
  base: {
    service: SERVICE_NAME,
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  messageKey: 'message',
}

const shouldPrettyPrint =
  process.env.NODE_ENV !== 'production' && process.env.PINO_PRETTY !== 'false'

const transport = shouldPrettyPrint
  ? pino.transport({
      target: 'pino-pretty',
      options: {
        colorize: true,
        singleLine: true,
        translateTime: 'SYS:standard',
      },
    })
  : undefined

const singleton = pino(baseOptions, transport as any)

export function getLogger(): AppLogger {
  return singleton
}

export function createChildLogger(
  bindings: Record<string, unknown>
): AppLogger {
  return singleton.child(bindings)
}

export default singleton
