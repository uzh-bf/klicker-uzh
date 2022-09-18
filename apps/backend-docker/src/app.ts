/* eslint-disable react-hooks/rules-of-hooks */
import { useParserCache } from '@envelop/parser-cache'
import { useResponseCache } from '@envelop/response-cache'
import { createRedisCache } from '@envelop/response-cache-redis'
import { useValidationCache } from '@envelop/validation-cache'
import { authZEnvelopPlugin } from '@graphql-authz/envelop-plugin'
import { useHive } from '@graphql-hive/client'
import { createServer, Plugin } from '@graphql-yoga/node'
import { enhanceContext, schema } from '@klicker-uzh/graphql'
import cookieParser from 'cookie-parser'
import express from 'express'
import passport from 'passport'
import { Strategy as JWTStrategy } from 'passport-jwt'
import { AuthSchema, Rules } from './authorization'

function prepareApp({ prisma, redisCache, redisExec }: any) {
  let cache = undefined
  if (redisCache) {
    try {
      cache = createRedisCache({ redis: redisCache })
    } catch (e) {
      console.error(e)
    }
  }

  const app = express()

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
        ttl: process.env.NODE_ENV === 'development' ? 0 : undefined,
        ttlPerType: {
          Participant: 60000,
          // Course: 60000,
          // LearningElement: 60000,
          // QuestionInstance: 60000,
        },
        cache,
        session(ctx) {
          return ctx.user ? ctx.user.sub : null
        },
      }),
      useValidationCache(),
      useParserCache(),
      // // useGraphQlJit(),
      process.env.HIVE_TOKEN
        ? useHive({
            enabled: true,
            debug: true,
            token: process.env.HIVE_TOKEN,
            usage: true,
          })
        : null,
    ].filter(Boolean) as Plugin[],
    context: enhanceContext({ prisma, redisExec }),
    logging: true,
    cors(request) {
      const requestOrigin = request.headers.get('origin') as string
      return {
        origin: requestOrigin,
        credentials: true,
      }
    },
  })

  app.use('/graphql', graphQLServer)

  return app
}

export default prepareApp
