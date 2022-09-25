import { createPubSub } from '@graphql-yoga/common'
import { createRedisEventTarget } from '@graphql-yoga/redis-event-target'
import { PrismaClient } from '@klicker-uzh/prisma'
import * as Sentry from '@sentry/node'
import '@sentry/tracing'
import Redis from 'ioredis'
import prepareApp from './app'

const prisma = new PrismaClient()

if (process.env.SENTRY_DSN) {
  Sentry.init({
    debug: !!process.env.DEBUG,
    tracesSampleRate: process.env.SENTRY_SAMPLE_RATE
      ? Number(process.env.SENTRY_SAMPLE_RATE)
      : 1,
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

const publishClient = new Redis({
  family: 4,
  host: process.env.REDIS_CACHE_HOST ?? 'localhost',
  password: process.env.REDIS_CACHE_PASS ?? '',
  port: Number(process.env.REDIS_CACHE_PORT) ?? 6380,
  tls: process.env.REDIS_CACHE_TLS ? {} : undefined,
})

const subscribeClient = new Redis({
  family: 4,
  host: process.env.REDIS_CACHE_HOST ?? 'localhost',
  password: process.env.REDIS_CACHE_PASS ?? '',
  port: Number(process.env.REDIS_CACHE_PORT) ?? 6380,
  tls: process.env.REDIS_CACHE_TLS ? {} : undefined,
})

const eventTarget = createRedisEventTarget({
  publishClient,
  subscribeClient,
})

const pubSub = createPubSub({ eventTarget })

const app = prepareApp({ prisma, redisCache, redisExec, pubSub })

app.listen(3000, () => {
  console.log('GraphQL API located at http://0.0.0.0:3000/api/graphql')
})
