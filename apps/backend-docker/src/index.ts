import { EventEmitter } from 'node:events'
import { createRedisEventTarget } from '@graphql-yoga/redis-event-target'
import {
  enhanceContext,
  getChatModelRegistry,
  handlers,
  schema,
  settleKbKnowledgeGraphResult,
} from '@klicker-uzh/graphql'
import { prisma as prismaBase } from '@klicker-uzh/prisma'
// import * as Sentry from '@sentry/node'
// import '@sentry/tracing'
import { type Cache, createInMemoryCache } from '@envelop/response-cache'
import { createRedisCache } from '@envelop/response-cache-redis'
import { NodeFeatureFlagClient } from '@klicker-uzh/feature-flags/node'
import {
  getKBGraphTerminalResult,
  hatchetClient,
  prepareHatchetTasks,
} from '@klicker-uzh/hatchet'
import { useServer } from 'graphql-ws/lib/use/ws'
import { createPubSub } from 'graphql-yoga'
import { Redis } from 'ioredis'
import * as WebSocket from 'ws'
import prepareApp from './app.js'
import { migrate } from './migration.js'

const emitter = new EventEmitter()
const featureFlags = new NodeFeatureFlagClient({
  apiHost: process.env.GROWTHBOOK_API_HOST,
  clientKey: process.env.GROWTHBOOK_CLIENT_KEY,
  environment: process.env.GROWTHBOOK_ENV ?? process.env.NODE_ENV,
  forcedOn: process.env.FEATURE_FLAGS_FORCED_ON,
  refreshIntervalMs: process.env.GROWTHBOOK_REFRESH_INTERVAL_MS
    ? Number(process.env.GROWTHBOOK_REFRESH_INTERVAL_MS)
    : undefined,
})
process.once('exit', () => featureFlags.destroy())

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
  } catch (e) {
    console.error(e)
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

migrate(prisma).then(async () => {
  await featureFlags.initialize()
  console.log(
    '[feature-flags] Backend evaluator ready.',
    featureFlags.getStatus()
  )

  // initialize tasks to be able to call / schedule them inside service functions
  const tasks = prepareHatchetTasks({
    hatchet: hatchetClient,
    pubSub,
    emitter,
    redisCache,
    redisExec,
    redisAssessmentExec,
    handlers,
    getKBGraphTerminalResult,
    settleKBGraphTerminalResult: ({
      buildId,
      result,
      finishedAt,
      allowLateSuccess,
    }) =>
      settleKbKnowledgeGraphResult(
        prisma,
        { buildId, result, allowLateSuccess },
        finishedAt
      ),
  })

  console.log('Hatchet tasks initialized.', Object.keys(tasks))
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
    featureFlags,
  })

  // Validate required environment variables at startup
  if (!process.env.APP_ORIGIN_API) {
    console.error('APP_ORIGIN_API is required but not defined')
    process.exit(1)
  }

  const server = app.listen(3000, () => {
    console.log(`GraphQL API located at 0.0.0.0:3000${yogaApp.graphqlEndpoint}`)

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
          featureFlags,
        }),
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
      wsServer as Parameters<typeof useServer>[1]
    )
  })
})
// #endregion
