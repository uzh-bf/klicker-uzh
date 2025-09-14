import pino, { type LoggerOptions } from 'pino'
import { env } from './env.js'

export const logger = pino({
  level: env.LOG_LEVEL,
  redact: {
    paths: [
      'req.headers.cookie',
      'req.headers.authorization',
      'res.headers["set-cookie"]',
      'correlationKey',
      'body.correlationKey',
    ],
    remove: true,
  },
} as LoggerOptions)
