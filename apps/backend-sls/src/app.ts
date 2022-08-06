import express from 'express'
import passport from 'passport'
import cookieParser from 'cookie-parser'
import { Strategy as JWTStrategy, ExtractJwt } from 'passport-jwt'
import { createServer } from '@graphql-yoga/node'

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
      return done(null, {
        ...jwt,
      })
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
  schema: {
    typeDefs: /* GraphQL */ `
      scalar File
      type Query {
        hello: String
      }
      type Mutation {
        getFileName(file: File!): String
      }
    `,
    resolvers: {
      Query: {
        hello: (_, args, ctx: any) => `world ${ctx.user?.sub}`,
      },
      Mutation: {
        getFileName: (root, { file }: { file: File }) => file.name,
      },
    },
  },
  context({ req }: any) {
    return {
      user: req.locals?.user,
    }
  },
  // logging: false,
  // graphiql: {
  //   endpoint: '/api/graphql',
  // },
})

app.use('/api/graphql', graphQLServer)

export default app
