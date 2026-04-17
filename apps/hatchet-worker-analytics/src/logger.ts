import pino from 'pino'

const SERVICE_NAME =
  process.env.HATCHET_WORKER_NAME ?? 'hatchet-worker-analytics'

const level = (process.env.LOG_LEVEL ?? 'info').toLowerCase()

const isPretty =
  (process.env.NODE_ENV !== 'production' &&
    process.env.PINO_PRETTY !== 'false') ??
  false

const transport = isPretty
  ? pino.transport({
      target: 'pino-pretty',
      options: {
        colorize: true,
        singleLine: true,
        translateTime: 'SYS:standard',
      },
    })
  : undefined

export const logger = pino(
  {
    level,
    base: {
      service: SERVICE_NAME,
    },
    timestamp: pino.stdTimeFunctions.isoTime,
    messageKey: 'message',
  },
  transport as any
)

export default logger
