import { hatchetClient } from '@klicker-uzh/hatchet'
import { verifyJWT } from '@klicker-uzh/util'
import { Redis } from 'ioredis'
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
}

validateResponseServerConfig(serverDependencies)
const server = createResponseServer(serverDependencies)

async function initializeService() {
  console.info('Starting response-api service', {
    port: PORT,
    assessmentMode,
    allowedOriginCount: allowedOrigins.length,
  })
  if (!assessmentMode) {
    await redis.ping()
    console.info('Standard response Redis connection established')
  }
}

await initializeService()
server.listen(PORT, () => {
  console.info(`[response-api] Ready and listening on port ${PORT}`)
})
