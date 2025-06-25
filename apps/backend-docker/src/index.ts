import { createRedisEventTarget } from '@graphql-yoga/redis-event-target'
import { enhanceContext, schema } from '@klicker-uzh/graphql'
import { PrismaClient } from '@klicker-uzh/prisma'
import { withOptimize } from '@prisma/extension-optimize'
// import * as Sentry from '@sentry/node'
// import '@sentry/tracing'
import { createPubSub } from 'graphql-yoga'
import { Redis } from 'ioredis'
import prepareApp from './app.js'
import { logger } from './logging.js'

import { createInMemoryCache, type Cache } from '@envelop/response-cache'
import { createRedisCache } from '@envelop/response-cache-redis'
import { useServer } from 'graphql-ws/lib/use/ws'
import { EventEmitter } from 'node:events'
import { WebSocketServer } from 'ws'
import { migrate } from './migration.js'

const emitter = new EventEmitter()

let prisma =
  process.env.PRISMA_LOG_QUERIES === 'true'
    ? new PrismaClient({
        log: [
          {
            emit: 'event',
            level: 'query',
          },
          { emit: 'event', level: 'info' },
          { emit: 'event', level: 'warn' },
          { emit: 'event', level: 'error' },
        ],
      })
    : new PrismaClient({
        log: [
          { emit: 'event', level: 'info' },
          { emit: 'event', level: 'warn' },
          { emit: 'event', level: 'error' },
        ],
      })

// Set up Prisma logging with our custom logger
prisma.$on('query' as any, (e: any) => {
  logger.debug('Prisma query', {
    query: e.query,
    params: e.params,
    duration: e.duration,
  })
})
prisma.$on('info' as any, (e: any) => {
  logger.info('Prisma info', { message: e.message })
})
prisma.$on('warn' as any, (e: any) => {
  logger.warn('Prisma warning', { message: e.message })
})
prisma.$on('error' as any, (e: any) => {
  logger.error('Prisma error', {
    message: e.message,
    target: e.target,
  })
})

if (
  process.env.NODE_ENV === 'development' &&
  process.env.PRISMA_OPTIMIZE === 'true'
) {
  prisma = prisma.$extends(
    withOptimize({ apiKey: process.env.PRISMA_OPTIMIZE_API_KEY as string })
  ) as PrismaClient
}

// if (process.env.SENTRY_DSN) {
//   Sentry.init({
//     debug: !!process.env.DEBUG,
//     tracesSampleRate: process.env.SENTRY_SAMPLE_RATE
//       ? Number(process.env.SENTRY_SAMPLE_RATE)
//       : 1,
//   })
// }

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

let cache: Cache
if (redisCache) {
  try {
    cache = createRedisCache({ redis: redisCache })
    logger.info('Redis cache initialized successfully')
  } catch (e) {
    logger.error(
      'Failed to initialize Redis cache, falling back to in-memory cache',
      {
        error: e instanceof Error ? e.message : String(e),
      }
    )
    cache = createInMemoryCache()
  }
} else {
  logger.info('Using in-memory cache')
  cache = createInMemoryCache()
}

emitter.on('invalidate', (resource) => {
  cache.invalidate([
    {
      typename: resource.typename,
      id: resource.id,
    },
  ])
})

const pubSub = createPubSub({ eventTarget })

migrate(prisma).then(() => {
  logger.info('Database migrations completed successfully')

  const { app, yogaApp } = prepareApp({
    prisma,
    redisCache,
    redisExec,
    pubSub,
    cache,
    emitter,
  })

  const server = app.listen(3000, () => {
    logger.info('GraphQL server started', {
      endpoint: `0.0.0.0:3000${yogaApp.graphqlEndpoint}`,
      environment: process.env.NODE_ENV,
    })

    const wsServer = new WebSocketServer({
      server,
      path: yogaApp.graphqlEndpoint,
    })

    useServer(
      {
        schema,
        context: enhanceContext({ prisma, redisExec, pubSub, emitter }),
        execute: (args: any) => args.rootValue.execute(args),
        subscribe: (args: any) => args.rootValue.subscribe(args),
        onSubscribe: async (ctx, msg) => {
          const {
            schema,
            execute,
            subscribe,
            contextFactory,
            parse,
            validate,
          } = yogaApp.getEnveloped({
            ...ctx,
            req: ctx.extra.request,
            socket: ctx.extra.socket,
            params: msg.payload,
          })

          const args = {
            schema,
            operationName: msg.payload.operationName,
            document: parse(msg.payload.query),
            variableValues: msg.payload.variables,
            contextValue: await contextFactory(),
            rootValue: {
              execute,
              subscribe,
            },
          }

          const errors = validate(args.schema, args.document)
          if (errors.length) return errors
          return args
        },
      },
      wsServer
    )
  })
})
