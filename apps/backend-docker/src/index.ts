import { createRedisEventTarget } from '@graphql-yoga/redis-event-target'
import {
  enhanceContext,
  getChatModelRegistry,
  handlers,
  schema,
} from '@klicker-uzh/graphql'
import { prisma as prismaBase } from '@klicker-uzh/prisma'
// import * as Sentry from '@sentry/node'
// import '@sentry/tracing'
import { createInMemoryCache, type Cache } from '@envelop/response-cache'
import { createRedisCache } from '@envelop/response-cache-redis'
import { hatchetClient, prepareHatchetTasks } from '@klicker-uzh/hatchet'
import { resolveRequestContext } from '@klicker-uzh/logging/request'
import { useServer } from 'graphql-ws/lib/use/ws'
import { createPubSub } from 'graphql-yoga'
import { Redis } from 'ioredis'
import { EventEmitter } from 'node:events'
import * as WebSocket from 'ws'
import prepareApp from './app.js'
import { logger } from './logger.js'
import { migrate } from './migration.js'

const emitter = new EventEmitter()

let prisma = prismaBase

// if (
//   process.env.NODE_ENV === 'development' &&
//   process.env.PRISMA_OPTIMIZE === 'true'
// ) {
//   prisma = prismaBase.$extends(
//     withOptimize({ apiKey: process.env.PRISMA_OPTIMIZE_API_KEY as string })
//   ) as typeof prisma
// }

// ! Redis setup
// #region
const redisExec = new Redis({
  family: 4,
  host: process.env.REDIS_HOST ?? 'localhost',
  password: process.env.REDIS_PASS ?? '',
  port: Number(process.env.REDIS_PORT ?? 6379),
  tls: process.env.REDIS_TLS ? {} : undefined,
})

const redisAssessmentExec = new Redis({
  family: 4,
  host: process.env.REDIS_ASSESSMENT_HOST ?? 'localhost',
  password: process.env.REDIS_ASSESSMENT_PASS ?? '',
  port: Number(process.env.REDIS_ASSESSMENT_PORT ?? 6381),
  tls: process.env.REDIS_ASSESSMENT_TLS ? {} : undefined,
})

const redisCache = new Redis({
  family: 4,
  host: process.env.REDIS_CACHE_HOST ?? 'localhost',
  password: process.env.REDIS_CACHE_PASS ?? '',
  port: Number(process.env.REDIS_CACHE_PORT ?? 6380),
  tls: process.env.REDIS_CACHE_TLS ? {} : undefined,
})

const publishClient = new Redis({
  family: 4,
  host: process.env.REDIS_CACHE_HOST ?? 'localhost',
  password: process.env.REDIS_CACHE_PASS ?? '',
  port: Number(process.env.REDIS_CACHE_PORT ?? 6380),
  tls: process.env.REDIS_CACHE_TLS ? {} : undefined,
})

const subscribeClient = new Redis({
  family: 4,
  host: process.env.REDIS_CACHE_HOST ?? 'localhost',
  password: process.env.REDIS_CACHE_PASS ?? '',
  port: Number(process.env.REDIS_CACHE_PORT ?? 6380),
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
  } catch {
    logger.warn(
      { event: 'dependency.degraded', dependency: 'redis-cache' },
      'Redis response cache unavailable; using in-memory cache'
    )
    cache = createInMemoryCache()
  }
} else {
  cache = createInMemoryCache()
}

emitter.on('invalidate', (resource: any) => {
  cache.invalidate([
    {
      typename: resource.typename,
      id: resource.id,
    },
  ])
})
// #endregion

// ! PubSub setup
const pubSub = createPubSub({ eventTarget })

// ! Server and context setup
// #region
getChatModelRegistry()

migrate(prisma)
  .then(() => {
  // initialize tasks to be able to call / schedule them inside service functions
  const tasks = prepareHatchetTasks({
    hatchet: hatchetClient,
    pubSub,
    emitter,
    redisCache,
    redisExec,
    redisAssessmentExec,
    handlers,
    logger,
  })

  logger.info(
    {
      event: 'hatchet.tasks.initialized',
      taskCount: Object.keys(tasks).length,
    },
    'Hatchet tasks initialized'
  )
  // #endregion

  const { app, yogaApp } = prepareApp({
    prisma,
    redisCache,
    redisExec,
    redisAssessmentExec,
    pubSub,
    cache,
    emitter,
    hatchet: hatchetClient,
    tasks,
  })

  // Validate required environment variables at startup
  if (!process.env.APP_ORIGIN_API) {
    logger.fatal(
      { event: 'configuration.invalid', variable: 'APP_ORIGIN_API' },
      'Required configuration is missing'
    )
    process.exit(1)
  }

  const server = app.listen(3000, () => {
    logger.info(
      {
        event: 'service.started',
        http: { port: 3000, route: yogaApp.graphqlEndpoint },
      },
      'GraphQL API started'
    )

    const wsServer = new WebSocket.WebSocketServer({
      server,
      path: yogaApp.graphqlEndpoint,
    })

    useServer(
      {
        schema,
        context: enhanceContext({
          prisma,
          redisExec,
          redisAssessmentExec,
          pubSub,
          emitter,
          tasks,
        }),
        execute: (args: any) => args.rootValue.execute(args),
        subscribe: (args: any) => args.rootValue.subscribe(args),
        onSubscribe: async (ctx, msg) => {
          const request = ctx.extra.request as typeof ctx.extra.request & {
            locals?: Record<string, unknown>
          }
          const requestContext = resolveRequestContext({
            requestId: request.headers['x-request-id'],
            correlationId: request.headers['x-correlation-id'],
          })
          request.locals = {
            ...request.locals,
            requestContext,
            log: logger.child(requestContext),
          }

          const {
            schema,
            execute,
            subscribe,
            contextFactory,
            parse,
            validate,
          } = yogaApp.getEnveloped({
            ...ctx,
            req: request,
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
      wsServer as Parameters<typeof useServer>[1]
    )
  })
  })
  .catch(() => {
    logger.fatal(
      { event: 'service.startup.failed' },
      'GraphQL API startup failed'
    )
    process.exit(1)
  })
// #endregion
