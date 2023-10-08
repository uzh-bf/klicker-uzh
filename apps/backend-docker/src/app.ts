import { useSentry } from '@envelop/sentry'
import { EnvelopArmor } from '@escape.tech/graphql-armor'
import { useCSRFPrevention } from '@graphql-yoga/plugin-csrf-prevention'
import { usePersistedOperations } from '@graphql-yoga/plugin-persisted-operations'
// import { useResponseCache } from '@graphql-yoga/plugin-response-cache'
import { enhanceContext, schema } from '@klicker-uzh/graphql'
import persistedOperations from '@klicker-uzh/graphql/dist/server.json'
import cookieParser from 'cookie-parser'
import cors from 'cors'
import express, { Request } from 'express'
import { createYoga } from 'graphql-yoga'
import passport from 'passport'
import { Strategy as JWTStrategy } from 'passport-jwt'

function prepareApp({ prisma, redisExec, pubSub, cache, emitter }: any) {
  const armor = new EnvelopArmor({
    maxDepth: {
      enabled: false,
    },
  })
  const enhancements = armor.protect()

  const app = express()

  /* istanbul ignore next */
  if (global.__coverage__) {
    try {
      require('@cypress/code-coverage/middleware/express')(app)
    } catch (e) {}
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

  passport.use(
    new JWTStrategy(
      {
        jwtFromRequest(req: Request) {
          console.log(req)

          if (req.headers?.['authorization']) {
            return req.headers['authorization']?.replace('Bearer ', '')
          }

          // if (req.cookies?.['next-auth.session-token']) {
          //   decode({
          //     token: req.cookies['next-auth.session-token'],
          //     secret: process.env.NEXTAUTH_SECRET as string,
          //   }).then((decoded) => {
          //     return decoded
          //   })
          // }

          if (req.cookies) {
            if (
              req.headers.origin?.includes(
                process.env.APP_MANAGE_SUBDOMAIN ?? 'manage'
              ) ||
              req.headers.origin?.includes(
                process.env.APP_CONTROL_SUBDOMAIN ?? 'control'
              )
            ) {
              return req.cookies['next-auth.session-token']
            }

            if (
              req.headers.origin?.includes(
                process.env.APP_STUDENT_SUBDOMAIN ?? 'pwa'
              )
            ) {
              return (
                req.cookies['participant_token'] ||
                req.cookies['next-auth.session-token']
              )
            }

            return (
              req.cookies['participant_token'] ||
              req.cookies['next-auth.session-token']
            )
          }

          return null
        },
        // TODO: persist both JWT in separate ctx objects? (allow for parallel logins as user and participant)
        secretOrKey: process.env.APP_SECRET,
        // issuer: 'abcd',
        // audience: 'localhost',
      },
      (jwt, done) => {
        // TODO: if there is a user matching the JWT, return it
        // TODO: if there was an error, return it
        // TODO: if there was no user and no error, return
        return done(null, jwt)
      }
    )
  )

  app.use(cookieParser())
  app.use((req: any, res, next) =>
    passport.authenticate('jwt', { session: false }, (err, user) => {
      req.locals = { user }
      next()
    })(req, res, next)
  )

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
      //   //   LearningElement: 60000,
      //   //   MicroSession: 60000,
      //   //   QuestionInstance: 60000,
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
        allowArbitraryOperations: process.env.NODE_ENV === 'development',
        getPersistedOperation(sha256Hash: string) {
          return persistedOperations[sha256Hash]
        },
      }),
      process.env.SENTRY_DSN &&
        useSentry({
          includeRawResult: false, // set to `true` in order to include the execution result in the metadata collected
          includeResolverArgs: false, // set to `true` in order to include the args passed to resolvers
          includeExecuteVariables: false, // set to `true` in order to include the operation variables values
          // appendTags: args => {}, // if you wish to add custom "tags" to the Sentry transaction created per operation
          // configureScope: (args, scope) => {}, // if you wish to modify the Sentry scope
          // skip: (executionArgs) => {
          //   console.log(executionArgs)
          //   if (!executionArgs.operationName) {
          //     return true
          //   }
          //   return false
          // },
        }),
      // useGraphQlJit(),
      ...enhancements.plugins,
    ].filter(Boolean) as Plugin[],
    context: enhanceContext({ prisma, redisExec, pubSub, emitter }),
    logging: true,
    cors: false,
    maskedErrors: !process.env.DEBUG,
    graphqlEndpoint: '/api/graphql',
  })

  app.use('/healthz', function (req, res) {
    res.send('OK')
  })

  app.use('/api/graphql', yogaApp)

  return { app, yogaApp }
}

export default prepareApp
