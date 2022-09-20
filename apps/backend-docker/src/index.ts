import { PrismaClient } from '@klicker-uzh/prisma'
import Redis from 'ioredis'
import prepareApp from './app'
const prisma = new PrismaClient()

if (process.env.SENTRY_DSN) {
  const Tracing = require('@sentry/tracing')
  const Sentry = require('@sentry/node')

  Sentry.init({
    tracesSampleRate: process.env.SENTRY_SAMPLE_RATE ?? 1.0,
  })
}

const redisExec = new Redis({
  family: 4,
  host: process.env.REDIS_HOST ?? 'localhost',
  password: process.env.REDIS_PASS ?? '',
  port: Number(process.env.REDIS_PORT) ?? 6379,
  tls: process.env.REDIS_TLS ? {} : undefined,
})

const redisCache = new Redis({
  family: 4,
  host: process.env.REDIS_CACHE_HOST ?? 'localhost',
  password: process.env.REDIS_CACHE_PASS ?? '',
  port: Number(process.env.REDIS_CACHE_PORT) ?? 6380,
  tls: process.env.REDIS_CACHE_TLS ? {} : undefined,
})

const app = prepareApp({ prisma, redisCache, redisExec })

app.listen(3000, () => {
  console.log('GraphQL API located at http://0.0.0.0:3000/api/graphql')
})
