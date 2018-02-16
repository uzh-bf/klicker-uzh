/* eslint-disable global-require */
require('dotenv').config()

// initialize APM if so configured
let apm
if (process.env.APM_SERVER_URL) {
  apm = require('elastic-apm-node')
}

const bodyParser = require('body-parser')
const cors = require('cors')
const cookieParser = require('cookie-parser')
const express = require('express')
const expressJWT = require('express-jwt')
const mongoose = require('mongoose')
const compression = require('compression')
const helmet = require('helmet')
const morgan = require('morgan')
const _invert = require('lodash/invert')
const RateLimit = require('express-rate-limit')
const { graphqlExpress } = require('apollo-server-express')

const schema = require('./schema')
const AuthService = require('./services/auth')
const queryMap = require('./queryMap.json')
const { getRedis } = require('./redis')
const { exceptTest } = require('./lib/utils')

// require important environment variables to be present
// otherwise exit the application
const appSettings = ['APP_DOMAIN', 'PORT', 'APP_SECRET', 'MONGO_URL', 'ORIGIN']
appSettings.forEach((envVar) => {
  if (!process.env[envVar]) {
    exceptTest(() => console.warn(`> Error: Please pass ${envVar} as an environment variable.`))
    process.exit(1)
  }
})

// connect to mongodb
// use username and password authentication if passed in the environment
// otherwise assume that no authentication needed (e.g. docker)
mongoose.Promise = Promise
const mongoConfig = {
  keepAlive: true,
  reconnectTries: 10,
  promiseLibrary: Promise,
}
if (process.env.MONGO_USER && process.env.MONGO_PASSWORD) {
  mongoose.connect(
    `mongodb://${process.env.MONGO_USER}:${process.env.MONGO_PASSWORD}@${process.env.MONGO_URL}`,
    mongoConfig,
  )
} else {
  mongoose.connect(`mongodb://${process.env.MONGO_URL}`, mongoConfig)
}

mongoose.connection
  .once('open', () => {
    exceptTest(() => console.log('> Connection to MongoDB established.'))
  })
  .on('error', (error) => {
    exceptTest(() => console.warn('> Warning: ', error))
  })

// setup Apollo Engine (GraphQL API metrics)
let apolloEngine
if (process.env.NODE_ENV === 'production' && process.env.ENGINE_API_KEY) {
  const { Engine } = require('apollo-engine')
  apolloEngine = new Engine({ engineConfig: { apiKey: process.env.ENGINE_API_KEY } })
  apolloEngine.start()
}

// initialize an express server
const server = express()

// if the server is behind a proxy, set the APP_PROXY env to true
// this will make express trust the X-* proxy headers and set corresponding req.ip
if (process.env.APP_PROXY) {
  server.enable('trust proxy')
}

// setup middleware stack
const middleware = [
  // enable gzip compression
  compression(),
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
  // setup JWT authentication
  expressJWT({
    credentialsRequired: false,
    requestProperty: 'auth',
    secret: process.env.APP_SECRET,
    getToken: AuthService.getToken,
  }),
]

if (process.env.APP_RATE_LIMITING) {
  // basic rate limiting configuration
  const limiterSettings = {
    // TODO: skipping for admins or similar?
    windowMs: 5 * 60 * 1000, // in a 5 minute window
    max: 1000, // limit to 200 requests
    delayAfter: 500, // start delaying responses after 100 requests
    delayMs: 50, // delay responses by 250ms * (numResponses - delayAfter)
    keyGenerator: req => `${req.auth ? req.auth.sub : req.ip}`,
    onLimitReached: req =>
      exceptTest(() => {
        const error = `> Rate-Limited a Request from ${req.ip} ${req.auth.sub || 'anon'}!`

        console.error(error)

        if (apm) {
          apm.captureError(error)
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

// parse json contents
middleware.push(bodyParser.json())

if (process.env.NODE_ENV === 'production') {
  // add the morgan logging middleware in production
  middleware.push(morgan('combined'))

  // add the persisted query middleware in production
  middleware.push((req, res, next) => {
    const invertedMap = _invert(queryMap)
    req.body.query = invertedMap[req.body.id]

    // set the APM transaction name
    if (apm) {
      apm.setTransactionName(`[${req.body.id}] ${req.body.operationName}`)

      // if the request is authenticated, set the user context
      if (req.auth) {
        apm.setUserContext({ id: req.auth.sub })
      }
    }

    next()
  })
}

// if apollo engine is enabled, add the middleware to the production stack
if (apolloEngine) {
  middleware.push(apolloEngine.expressMiddleware())
}

// expose the GraphQL API endpoint
// parse JWT that are passed as a header and attach their content to req.user
server.use(
  ...middleware,
  // delegate to the GraphQL API
  graphqlExpress((req, res) => ({
    context: { auth: req.auth, ip: req.ip, res },
    schema,
    tracing: !!process.env.ENGINE_API_KEY,
    cacheControl: !!process.env.ENGINE_API_KEY,
  })),
)

module.exports = server
