import { hatchetClient } from '@klicker-uzh/hatchet'
import { toSafeError } from '@klicker-uzh/logging/node'
import { verifyJWT } from '@klicker-uzh/util'
import { Redis } from 'ioredis'
import { logger } from './logger.js'
import {
  createResponseServer,
  type ResponseServerDependencies,
  validateResponseServerConfig,
} from './server.js'

const PORT = Number(process.env.PORT ?? 7078)
const assessmentMode = process.env.ASSESSMENT_MODE === 'true'
const allowedOrigins = (process.env.CORS_ALLOWED_ORIGINS || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean)

const redis = new Redis({
  family: 4,
  host: process.env.REDIS_HOST,
  password: process.env.REDIS_PASS ?? '',
  port: Number(process.env.REDIS_PORT ?? 6379),
  tls: process.env.REDIS_TLS ? {} : undefined,
  lazyConnect: assessmentMode,
})

const serverDependencies: ResponseServerDependencies = {
  assessmentMode,
  allowedOrigins,
  appSecret: process.env.APP_SECRET ?? '',
  assessmentApiOrigin: process.env.APP_ORIGIN_ASSESSMENT_API,
  authOrigin: process.env.APP_ORIGIN_AUTH,
  pushEvent: (name, payload, options) =>
    hatchetClient.events.push(name, payload, options),
  verifyToken: verifyJWT,
  logger,
}

validateResponseServerConfig(serverDependencies)
const server = createResponseServer(serverDependencies)

async function initializeService() {
  logger.info(
    {
      event: 'service.starting',
      port: PORT,
      assessment: assessmentMode,
      allowedOriginCount: allowedOrigins.length,
    },
    'Starting response-api service'
  )
  if (!assessmentMode) {
    try {
      await redis.ping()
      logger.info(
        { event: 'dependency.connected', dependency: 'redis' },
        'Redis connected'
      )
    } catch {
      logger.error(
        {
          event: 'dependency.unavailable',
          dependency: 'redis',
          err: toSafeError('Redis connection failed'),
        },
        'Redis connection failed'
      )
      throw new Error('Redis connection failed')
    }
  }
}

await initializeService()
server.listen(PORT, () => {
  logger.info(
    {
      event: 'service.started',
      port: PORT,
      assessment: assessmentMode,
    },
    'Response API is ready'
  )
})
