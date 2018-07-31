/* eslint-disable global-require */
require('dotenv').config()

const isProd = process.env.NODE_ENV === 'production'

// initialize APM if so configured
let apm
if (process.env.APM_SERVER_URL) {
  apm = require('elastic-apm-node')
}

let Raven
if (process.env.SENTRY_DSN) {
  Raven = require('raven')
}

// base packages
const mongoose = require('mongoose')
const express = require('express')
const { ApolloServer } = require('apollo-server-express')
mongoose.Promise = require('bluebird')

// express middlewares
const bodyParser = require('body-parser')
const cors = require('cors')
const cookieParser = require('cookie-parser')
const expressJWT = require('express-jwt')
const compression = require('compression')
const helmet = require('helmet')
const morgan = require('morgan')
const RateLimit = require('express-rate-limit')

const AuthService = require('./services/auth')
const { resolvers, typeDefs } = require('./schema')
const { getRedis } = require('./redis')
const { exceptTest } = require('./lib/utils')
const { createLoaders } = require('./lib/loaders')

// require important environment variables to be present
// otherwise exit the application
const appSettings = ['APP_DOMAIN', 'PORT', 'APP_SECRET', 'MONGO_URL', 'ORIGIN']
appSettings.forEach(envVar => {
  if (!process.env[envVar]) {
    exceptTest(() => console.warn(`> Error: Please pass ${envVar} as an environment variable.`))
    process.exit(1)
  }
})

// connect to mongodb
// use username and password authentication if passed in the environment
// otherwise assume that no authentication needed (e.g. docker)
const mongoConfig = {
  keepAlive: true,
  reconnectTries: Number.MAX_VALUE,
  reconnectInterval: 1000,
}
if (process.env.MONGO_USER && process.env.MONGO_PASSWORD) {
  mongoose.connect(
    `mongodb://${process.env.MONGO_USER}:${process.env.MONGO_PASSWORD}@${process.env.MONGO_URL}`,
    mongoConfig
  )
} else {
  mongoose.connect(
    `mongodb://${process.env.MONGO_URL}`,
    mongoConfig
  )
}

if (process.env.MONGO_DEBUG) {
  // activate mongoose debug mode (log all queries)
  mongoose.set('debug', true)
}

mongoose.connection
  .once('open', () => {
    exceptTest(() => console.log('> Connection to MongoDB established.'))
  })
  .on('error', error => {
    exceptTest(() => console.warn('> Warning: ', error))
  })

// initialize an express server
const app = express()

// if the server is behind a proxy, set the APP_PROXY env to true
// this will make express trust the X-* proxy headers and set corresponding req.ip
if (process.env.APP_PROXY) {
  app.enable('trust proxy')
}

// setup middleware stack
let middleware = [
  // secure the server with helmet
  helmet({
    // TODO: activate security settings with environment vars
    hsts: false,
  }),
  // setup CORS
  cors({
    // HACK: temporarily always allow sending credentials over CORS
    // credentials: dev, // allow passing credentials over CORS in dev mode
    credentials: true,
    origin: process.env.ORIGIN,
    optionsSuccessStatus: 200, // some legacy browsers (IE11, various SmartTVs) choke on 204
  }),
  // enable cookie parsing
  cookieParser(),
  // parse json contents
  bodyParser.json(),
  // setup JWT authentication
  expressJWT({
    credentialsRequired: false,
    requestProperty: 'auth',
    secret: process.env.APP_SECRET,
    getToken: AuthService.getToken,
  }),
]

// add production middlewares
if (isProd) {
  // add the morgan logging middleware in production
  middleware.push(morgan('combined'))

  if (process.env.SENTRY_DSN) {
    // if a sentry dsn is set, configure raven
    Raven.config(process.env.SENTRY_DSN).install()
    middleware = [Raven.requestHandler(), compression(), ...middleware, Raven.errorHandler()]
  } else {
    middleware = [compression(), ...middleware]
  }

  // add an elastic APM middleware
  middleware.push((req, res, next) => {
    // set the APM transaction name
    if (apm) {
      apm.setTransactionName(`${req.body.operationName}`)

      // if the request is authenticated, set the user context
      if (req.auth) {
        apm.setUserContext({ id: req.auth.sub })
      }
    }

    next()
  })

  // add a rate limiting middleware
  if (process.env.APP_RATE_LIMITING) {
    // basic rate limiting configuration
    const limiterSettings = {
      windowMs: 5 * 60 * 1000, // in a 5 minute window
      max: 1000, // limit to 200 requests
      delayAfter: 200, // start delaying responses after 100 requests
      delayMs: 50, // delay responses by 250ms * (numResponses - delayAfter)
      keyGenerator: req => `${req.auth ? req.auth.sub : req.ip}`,
      onLimitReached: req =>
        exceptTest(() => {
          const error = `> Rate-Limited a Request from ${req.ip} ${req.auth.sub || 'anon'}!`

          console.error(error)

          if (apm) {
            apm.captureError(error)
          }

          if (Raven) {
            Raven.captureException(error)
          }
        }),
    }

    // if redis is available, use it to centrally store rate limiting dataconst
    const redis = getRedis(1)
    let limiter
    if (redis) {
      const RedisStore = require('rate-limit-redis')
      limiter = new RateLimit({
        ...limiterSettings,
        store:
          redis &&
          new RedisStore({
            client: redis,
            expiry: 5 * 60,
            prefix: 'rl-api:',
          }),
      })
    } else {
      // if redis is not available, setup basic rate limiting with in-memory store
      limiter = new RateLimit(limiterSettings)
    }

    middleware.push(limiter)
  }
}

// inject the middleware into express
app.use(middleware)

// setup a new apollo server instance
const apollo = new ApolloServer({
  typeDefs,
  resolvers,
  context: async ({ connection, req, res }) => {
    // context handler for subscriptions
    if (connection) {
      return {}
    }

    // context handler for normal requests
    return {
      auth: req.auth,
      ip: req.ip,
      loaders: createLoaders(req.auth),
      res,
    }
  },
})

// apply the apollo middleware to express
apollo.applyMiddleware({
  app,
  cors: false,
  bodyParserConfig: false,
})

module.exports = { app, apollo }
