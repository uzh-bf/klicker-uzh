import express from 'express'
import passport from 'passport'
import cookieParser from 'cookie-parser'
import { Strategy as JWTStrategy } from 'passport-jwt'
import { createServer } from '@graphql-yoga/node'
import { AuthSchema, Rules } from './graphql/authorization'
import { authZEnvelopPlugin } from '@graphql-authz/envelop-plugin'
import path from 'path'
import { makeSchema } from 'nexus'
import * as types from './graphql/nexus'
import enhanceContext from './lib/context'

const app = express()

passport.use(
  new JWTStrategy(
    {
      jwtFromRequest(req) {
        if (req && req.cookies) return req.cookies['jwt']
        return null
      },
      secretOrKey: 'abcd',
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

const schema = makeSchema({
  types,
  outputs: {
    typegen: path.join(process.cwd(), 'GraphQL/types/nexus-typegen.ts'),
    schema: path.join(process.cwd(), 'GraphQL/graphql/schema.graphql'),
  },
})

const graphQLServer = createServer({
  schema,
  plugins: [
    authZEnvelopPlugin({
      rules: Rules,
      authSchema: AuthSchema,
    }),
  ],
  context: enhanceContext,
  logging: true,
  // graphiql: {
  //   endpoint: '/api/graphql',
  // },
})

app.use('/api/graphql', graphQLServer)

export default app
