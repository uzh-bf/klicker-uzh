import pino from 'pino'
import { config } from '../config.js'

export const logger = pino.default({
  level: config.LOG_LEVEL,
  formatters: {
    level: (label: string) => ({ level: label.toUpperCase() }),
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  // Redact sensitive information from logs
  redact: {
    paths: [
      'password',
      'token',
      'authorization',
      'connectionString',
      'attributes.password',
      'attributes.token',
      'attributes.secret',
    ],
    censor: '[REDACTED]',
  },
  base: {
    env: config.NODE_ENV,
  },
})
