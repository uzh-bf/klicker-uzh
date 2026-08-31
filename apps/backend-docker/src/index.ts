import { createRedisEventTarget } from '@graphql-yoga/redis-event-target'
import { enhanceContext, handlers, schema } from '@klicker-uzh/graphql'
import { prisma as prismaBase } from '@klicker-uzh/prisma'
// import * as Sentry from '@sentry/node'
// import '@sentry/tracing'
import { createInMemoryCache, type Cache } from '@envelop/response-cache'
import { createRedisCache } from '@envelop/response-cache-redis'
import { hatchetClient, prepareHatchetTasks } from '@klicker-uzh/hatchet'
import { parseCookiesHeader, verifyJWT } from '@klicker-uzh/util'
import { useServer } from 'graphql-ws/lib/use/ws'
import { createPubSub } from 'graphql-yoga'
import { Redis } from 'ioredis'
import { EventEmitter } from 'node:events'
import * as WebSocket from 'ws'
import prepareApp from './app.js'
import { migrate } from './migration.js'

const emitter = new EventEmitter()

function getConnectionToken(
  connectionParams?: Readonly<Record<string, unknown>>
) {
  const authorization = connectionParams?.authorization
  if (typeof authorization !== 'string') return undefined

  return authorization.replace(/^Bearer\s+/i, '')
}

function getSubscriptionCookieToken({
  cookies,
  origin,
}: {
  cookies: Record<string, string>
  origin?: string
}) {
  const isManageOrControl =
    origin?.includes(process.env.APP_MANAGE_SUBDOMAIN ?? 'manage') ||
    origin?.includes(process.env.APP_CONTROL_SUBDOMAIN ?? 'control')

  if (process.env.ASSESSMENT_MODE === 'true') {
    if (isManageOrControl) return cookies['next-auth.session-token']
    if (
      origin?.includes(process.env.APP_ASSESSMENT_SUBDOMAIN ?? 'assessment')
    ) {
      return cookies['next-auth.participant-session-token']
    }
    return undefined
  }

  if (isManageOrControl) return cookies['next-auth.session-token']
  if (origin?.includes(process.env.APP_STUDENT_SUBDOMAIN ?? 'pwa')) {
    return (
      cookies['participant_token'] ??
      cookies['temporary_participant_token'] ??
      cookies['next-auth.session-token']
    )
  }
  return undefined
}

async function authenticateSubscriptionRequest({
  cookieHeader,
  origin,
  connectionParams,
}: {
  cookieHeader?: string
  origin?: string
  connectionParams?: Readonly<Record<string, unknown>>
}) {
  const cookies = parseCookiesHeader(cookieHeader)
  const token =
    getConnectionToken(connectionParams) ??
    getSubscriptionCookieToken({ cookies, origin })

  if (!token) return undefined

  try {
    return await verifyJWT(token, process.env.APP_SECRET as string)
  } catch {
    return undefined
  }
}

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
migrate(prisma).then(() => {
  // initialize tasks to be able to call / schedule them inside service functions
  const tasks = prepareHatchetTasks({
    hatchet: hatchetClient,
    pubSub,
    emitter,
    redisCache,
    redisExec,
    redisAssessmentExec,
    handlers,
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
        }),
        execute: (args: any) => args.rootValue.execute(args),
        subscribe: (args: any) => args.rootValue.subscribe(args),
        onSubscribe: async (ctx, msg) => {
          const request = ctx.extra.request as typeof ctx.extra.request & {
            locals?: { user?: unknown }
          }
          request.locals = {
            user: await authenticateSubscriptionRequest({
              cookieHeader: request.headers.cookie,
              origin: request.headers.origin,
              connectionParams: ctx.connectionParams,
            }),
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
// #endregion
