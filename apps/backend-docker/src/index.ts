import { createRedisEventTarget } from '@graphql-yoga/redis-event-target'
import { enhanceContext, schema } from '@klicker-uzh/graphql'
import { PrismaClient } from '@klicker-uzh/prisma'
import * as Sentry from '@sentry/node'
import '@sentry/tracing'
import { createPubSub } from 'graphql-yoga'
import { Redis } from 'ioredis'
import prepareApp from './app.js'
import { withOptimize } from '@prisma/extension-optimize'

import { createInMemoryCache, type Cache } from '@envelop/response-cache'
import { createRedisCache } from '@envelop/response-cache-redis'
import { useServer } from 'graphql-ws/lib/use/ws'
import { EventEmitter } from 'node:events'
import { WebSocketServer } from 'ws'
import { migrate } from './migration.js'

const emitter = new EventEmitter()

let prisma = new PrismaClient({
  log:
    process.env.NODE_ENV === 'development'
      ? ['query', 'info', 'warn', 'error']
      : ['warn', 'error'],
})

if (
  process.env.NODE_ENV === 'development' &&
  process.env.PRISMA_OPTIMIZE === 'true'
) {
  prisma = prisma.$extends(withOptimize()) as PrismaClient
}

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

let cache: Cache
if (redisCache) {
  try {
    cache = createRedisCache({ redis: redisCache })
  } catch (e) {
    console.error(e)
    cache = createInMemoryCache()
  }
} else {
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
  const { app, yogaApp } = prepareApp({
    prisma,
    redisCache,
    redisExec,
    pubSub,
    cache,
    emitter,
  })

  const server = app.listen(3000, () => {
    console.log(`GraphQL API located at 0.0.0.0:3000${yogaApp.graphqlEndpoint}`)

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
