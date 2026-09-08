// import { useSentry } from '@envelop/sentry'

import { createRequire } from 'node:module'
import { EnvelopArmor } from '@escape.tech/graphql-armor'
import { useCSRFPrevention } from '@graphql-yoga/plugin-csrf-prevention'
import { usePersistedOperations } from '@graphql-yoga/plugin-persisted-operations'
// import { useResponseCache } from '@graphql-yoga/plugin-response-cache'
import { enhanceContext, schema } from '@klicker-uzh/graphql'
import { verifyJWT } from '@klicker-uzh/util'
import cookieParser from 'cookie-parser'
import cors from 'cors'
import express, {
  type NextFunction,
  type Request,
  type Response,
} from 'express'
import { createYoga } from 'graphql-yoga'
import { registerKBHttpRoutes } from './kbHttpRoutes.js'

const require = createRequire(import.meta.url)
const persistedOperations = require('@klicker-uzh/graphql/dist/server.json')

function prepareApp({
  prisma,
  redisExec,
  redisAssessmentExec,
  pubSub,
  cache,
  emitter,
  hatchet,
  elementGenerationRuntime,
  tasks,
  featureFlags,
}: any) {
  const armor = new EnvelopArmor({
    maxDepth: {
      enabled: false,
    },
    costLimit: {
      enabled: false,
    },
  })
  const enhancements = armor.protect()

  const app = express()

  // Expose the preload's test-fixture controller to the local test browser.
  // Production never mounts these test-only routes.
  if (
    process.env.NODE_ENV === 'test' &&
    process.env.GROWTHBOOK_API_HOST === 'https://growthbook.test' &&
    process.env.GROWTHBOOK_CLIENT_KEY === 'sdk-test'
  ) {
    const learningAnalyticsControllerPath =
      '/__growthbook__/__test/learning-analytics'
    const learningAnalyticsControllerUpstream =
      'https://growthbook.test/__test/learning-analytics'

    app.get(
      '/__growthbook__/api/features/sdk-test',
      async (_req, res, next) => {
        try {
          const response = await fetch(
            'https://growthbook.test/api/features/sdk-test'
          )
          res
            .set('Cache-Control', 'no-store')
            .status(response.status)
            .json(await response.json())
        } catch (error) {
          next(error)
        }
      }
    )

    app.all(
      learningAnalyticsControllerPath,
      async (req: Request, res: Response, next: NextFunction) => {
        res.set('Cache-Control', 'no-store')
        if (req.method !== 'GET' && req.method !== 'POST') {
          res.status(405).json({ error: 'Method not allowed' })
          return
        }

        const queryKeys = Object.keys(req.query)
        let enabled: string | undefined

        if (req.method === 'GET') {
          if (queryKeys.length !== 0) {
            res.status(400).json({
              error:
                'The test fixture controller does not accept query parameters',
            })
            return
          }
        } else {
          const rawEnabled = req.query.enabled
          enabled = typeof rawEnabled === 'string' ? rawEnabled : undefined
          if (
            queryKeys.length !== 1 ||
            queryKeys[0] !== 'enabled' ||
            (enabled !== 'true' && enabled !== 'false')
          ) {
            res.status(400).json({
              error:
                'The test fixture controller requires enabled=true or enabled=false',
            })
            return
          }
        }

        try {
          const upstreamUrl = new URL(learningAnalyticsControllerUpstream)
          if (enabled !== undefined) {
            upstreamUrl.searchParams.set('enabled', enabled)
          }
          const response = await fetch(upstreamUrl, { method: req.method })
          res.status(response.status).json(await response.json())
        } catch (error) {
          next(error)
        }
      }
    )
  }

  app.use(
    cors({
      origin(origin, cb) {
        cb(null, origin)
      },
      credentials: true,
      optionsSuccessStatus: 200,
    })
  )

  // Custom JWT middleware to replace passport-jwt
  async function jwtMiddleware(req: any, res: any, next: any) {
    let token = null

    // Assessment mode: only check for student NextAuth cookie
    if (process.env.ASSESSMENT_MODE === 'true') {
      if (
        req.headers.origin?.includes(
          process.env.APP_MANAGE_SUBDOMAIN ?? 'manage'
        ) ||
        req.headers.origin?.includes(
          process.env.APP_CONTROL_SUBDOMAIN ?? 'control'
        )
      ) {
        token = req.cookies?.['next-auth.session-token']
      } else if (
        req.headers.origin?.includes(
          process.env.APP_ASSESSMENT_SUBDOMAIN ?? 'assessment'
        )
      ) {
        token = req.cookies?.['next-auth.participant-session-token']
      }
    } else {
      if (
        req.headers.origin?.includes(
          process.env.APP_MANAGE_SUBDOMAIN ?? 'manage'
        ) ||
        req.headers.origin?.includes(
          process.env.APP_CONTROL_SUBDOMAIN ?? 'control'
        )
      ) {
        token = req.cookies?.['next-auth.session-token']
      } else if (
        req.headers.origin?.includes(process.env.APP_STUDENT_SUBDOMAIN ?? 'pwa')
      ) {
        token =
          req.cookies?.['participant_token'] ??
          req.cookies?.['temporary_participant_token'] ??
          req.cookies?.['next-auth.session-token']
      }
    }

    // ! DO NOT TOUCH - assessment live quiz mode relies on it
    token =
      token ?? req.headers['authorization']?.replace('Bearer ', '') ?? null

    let user = null
    if (token) {
      try {
        user = await verifyJWT(token, process.env.APP_SECRET as string)
      } catch (error) {
        // JWT verification failed, continue with user = null
        console.log('JWT verification failed:', error)
      }
    }

    req.locals = { user }
    next()
  }

  // The ingestion bridge authenticates with its own gateway key and webhook
  // signature. Register these routes before the end-user JWT middleware so a
  // system bearer key is never interpreted as a Klicker session token.
  registerKBHttpRoutes(app, { prisma })

  app.use(cookieParser())
  app.use(jwtMiddleware)

  const yogaApp = createYoga({
    schema,
    plugins: [
      // useResponseCache({
      //   // set the TTL to 0 to disable response caching by default
      //   ttl: 0,
      //   // set caching for each type individually
      //   // ttlPerType: {
      //   //   Participant: 60000,
      //   //   Course: 60000,
      //   //   PracticeQuiz: 60000,
      //   //   MicroLearning: 60000,
      //   //   ElementInstance: 60000,
      //   //   Participation: 0,
      //   //   LeaderboardEntry: 0,
      //   // },
      //   cache,
      //   session(req) {
      //     // extract user id from locals as stored in passport auth middleware
      //     return req.body?.locals?.user?.sub ?? null
      //   },
      // }),
      useCSRFPrevention({
        requestHeaders: ['x-graphql-yoga-csrf'], // default
      }),
      usePersistedOperations({
        allowArbitraryOperations:
          process.env.NODE_ENV === 'development' ||
          process.env.NODE_ENV === 'test',
        getPersistedOperation(sha256Hash: string) {
          return persistedOperations[sha256Hash]
        },
      }),
      // process.env.SENTRY_DSN &&
      // useSentry({
      //   includeRawResult: false, // set to `true` in order to include the execution result in the metadata collected
      //   includeResolverArgs: false, // set to `true` in order to include the args passed to resolvers
      //   includeExecuteVariables: false, // set to `true` in order to include the operation variables values
      //   // appendTags: args => {}, // if you wish to add custom "tags" to the Sentry transaction created per operation
      //   // configureScope: (args, scope) => {}, // if you wish to modify the Sentry scope
      //   // skip: (executionArgs) => {
      //   //   console.log(executionArgs)
      //   //   if (!executionArgs.operationName) {
      //   //     return true
      //   //   }
      //   //   return false
      //   // },
      // }),
      // useGraphQlJit(),
      ...enhancements.plugins,
    ].filter(Boolean) as Plugin[],
    context: enhanceContext({
      prisma,
      redisExec,
      redisAssessmentExec,
      pubSub,
      emitter,
      hatchet,
      elementGenerationRuntime,
      tasks,
      featureFlags,
    }),
    logging: true,
    cors: false,
    maskedErrors: !process.env.DEBUG,
    graphqlEndpoint: '/api/graphql',
  })

  app.use('/healthz', function (req, res) {
    res.send('OK')
  })

  app.use('/api/graphql', yogaApp as any)

  return { app, yogaApp }
}

export default prepareApp
