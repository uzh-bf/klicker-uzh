import { authZEnvelopPlugin } from '@graphql-authz/envelop-plugin'
import { createServer } from '@graphql-yoga/node'
import { enhanceContext, schema } from '@klicker-uzh/graphql'
import cookieParser from 'cookie-parser'
import express from 'express'
import passport from 'passport'
import { Strategy as JWTStrategy } from 'passport-jwt'
import { AuthSchema, Rules } from './graphql/authorization'

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
