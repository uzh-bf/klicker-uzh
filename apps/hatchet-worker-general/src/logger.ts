import pino from 'pino'
import pretty from 'pino-pretty'

// Service name for log base context
const SERVICE_NAME = process.env.HATCHET_WORKER_NAME ?? 'hatchet-worker-general'

// Decide level and pretty printing
const level = (process.env.LOG_LEVEL ?? 'info').toLowerCase()

const isPretty =
  (process.env.NODE_ENV !== 'production' &&
    process.env.PINO_PRETTY !== 'false') ??
  false

const options = {
  level,
  base: {
    service: SERVICE_NAME,
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  messageKey: 'message',
}

// Keep development formatting in-process. A Pino transport starts another
// worker thread, whose messages collide with `tsx --watch` worker tracking.
export const logger = isPretty
  ? pino(
      options,
      pretty({
        colorize: true,
        singleLine: true,
        translateTime: 'SYS:standard',
      })
    )
  : pino(options)

export default logger
