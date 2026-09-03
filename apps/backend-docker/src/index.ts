import { EventEmitter } from 'node:events'
// import * as Sentry from '@sentry/node'
// import '@sentry/tracing'
import { type Cache, createInMemoryCache } from '@envelop/response-cache'
import { createRedisCache } from '@envelop/response-cache-redis'
import { createRedisEventTarget } from '@graphql-yoga/redis-event-target'
import { NodeFeatureFlagClient } from '@klicker-uzh/feature-flags/node'
import {
  createElementGenerationRuntimeFromEnv,
  enhanceContext,
  getChatModelRegistry,
  handlers,
  schema,
  settleKbKnowledgeGraphResult,
} from '@klicker-uzh/graphql'
import {
  getKBGraphTerminalResult,
  createHatchetClient,
  prepareHatchetTasks,
} from '@klicker-uzh/hatchet'
import { resolveRequestContext } from '@klicker-uzh/logging/request'
import { prisma as prismaBase } from '@klicker-uzh/prisma'
import { useServer } from 'graphql-ws/lib/use/ws'
import { createPubSub } from 'graphql-yoga'
import { Redis } from 'ioredis'
import * as WebSocket from 'ws'
import prepareApp from './app.js'
import { parseRefreshInterval } from './featureFlags.js'
import { logger } from './logger.js'
import { migrate } from './migration.js'

const hatchetClient = createHatchetClient({ logger })

const emitter = new EventEmitter()
const featureFlags = new NodeFeatureFlagClient({
  apiHost: process.env.GROWTHBOOK_API_HOST,
  clientKey: process.env.GROWTHBOOK_CLIENT_KEY,
  environment: process.env.GROWTHBOOK_ENV ?? process.env.NODE_ENV,
  forcedOn: process.env.FEATURE_FLAGS_FORCED_ON,
  refreshIntervalMs: parseRefreshInterval(
    process.env.GROWTHBOOK_REFRESH_INTERVAL_MS
  ),
})
process.once('exit', () => featureFlags.destroy())
const elementGenerationRuntime = createElementGenerationRuntimeFromEnv(
  process.env
)

const prisma = prismaBase

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

try {
  await migrate(prisma)
} catch {
  // Runtime migrations must not prevent the server from starting: a failed
  // data migration leaves the affected feature degraded but the API usable.
  // The migration record is absent so the next restart retries it.
  logger.error(
    { event: 'migration.failed' },
    'Runtime migrations failed; starting server in degraded state'
  )
}

// Fail-closed feature flag evaluation must be ready before serving.
const initialized = await featureFlags.initialize()
if (initialized) {
  logger.info(
    { event: 'feature_flags.ready' },
    'Backend feature flag evaluator ready'
  )
} else {
  logger.warn(
    { event: 'feature_flags.unavailable' },
    'Backend feature flag evaluator unavailable; false fallbacks are active'
  )
}

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

logger.info(
  { event: 'hatchet.tasks.initialized', taskCount: Object.keys(tasks).length },
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
  elementGenerationRuntime,
  tasks,
  featureFlags,
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
  logger.info({ event: 'service.started', port: 3000 }, 'GraphQL API started')

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
        elementGenerationRuntime,
        tasks,
        featureFlags,
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
        const { schema, execute, subscribe, contextFactory, parse, validate } =
          yogaApp.getEnveloped({
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
// #endregion
