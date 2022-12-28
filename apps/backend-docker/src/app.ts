/* eslint-disable react-hooks/rules-of-hooks */
import { useParserCache } from '@envelop/parser-cache'
import { useResponseCache } from '@envelop/response-cache'
import { useSentry } from '@envelop/sentry'
import { useValidationCache } from '@envelop/validation-cache'
// import { EnvelopArmor } from '@escape.tech/graphql-armor'
import { authZEnvelopPlugin } from '@graphql-authz/envelop-plugin'
import { createServer, Plugin } from '@graphql-yoga/node'
import { enhanceContext, schema } from '@klicker-uzh/graphql'
import cookieParser from 'cookie-parser'
import cors from 'cors'
import express from 'express'
import passport from 'passport'
import { Strategy as JWTStrategy } from 'passport-jwt'
import { AuthSchema, Rules } from './authorization'

function prepareApp({ prisma, redisExec, pubSub, cache, emitter }: any) {
  // const armor = new EnvelopArmor()
  // const enhancements = armor.protect()

  const app = express()

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
        // TODO: persist both JWT in separate ctx objects? (allow for parallel logins as user and participant)
        jwtFromRequest(req) {
          if (req.headers?.['authorization'])
            return req.headers['authorization']?.replace('Bearer ', '')
          if (req.cookies)
            return req.cookies['user_token'] || req.cookies['participant_token']
          return null
        },
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

  const graphQLServer = createServer({
    schema,
    plugins: [
      authZEnvelopPlugin({
        rules: Rules,
        authSchema: AuthSchema,
      }),
      useResponseCache({
        // set the TTL to 0 to disable response caching by default
        ttl: 0,
        // set caching for each type individually
        ttlPerType: {
          Participant: 60000,
          Course: 60000,
          LearningElement: 60000,
          MicroSession: 60000,
          QuestionInstance: 60000,
          Participation: 0,
          LeaderboardEntry: 0,
        },
        cache,
        session(ctx) {
          return ctx.user ? ctx.user.sub : null
        },
      }),
      useValidationCache(),
      useParserCache(),
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
      // ...enhancements.plugins,
    ].filter(Boolean) as Plugin[],
    context: enhanceContext({ prisma, redisExec, pubSub, emitter }),
    logging: true,
    cors: false,
    maskedErrors: !process.env.DEBUG,
  })

  app.use('/healthz', function (req, res) {
    res.send('OK')
  })

  app.use('/api/graphql', graphQLServer)

  return app
}

export default prepareApp
