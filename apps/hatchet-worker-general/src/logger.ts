import pino from 'pino'

// Service name for log base context
const SERVICE_NAME = process.env.HATCHET_WORKER_NAME ?? 'hatchet-worker-general'

// Decide level and pretty printing
const level = (process.env.LOG_LEVEL ?? 'info').toLowerCase()

const isPretty =
  (process.env.NODE_ENV !== 'production' &&
    process.env.PINO_PRETTY !== 'false') ??
  false

// Configure transport only in pretty/dev mode to avoid extra deps in prod
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
