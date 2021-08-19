/* eslint-disable global-require */

const isProd = process.env.NODE_ENV === 'production'

// base packages
const path = require('path')
const mongoose = require('mongoose')
const express = require('express')
const PrettyError = require('pretty-error')
const { ApolloServer } = require('apollo-server-express')
const { applyMiddleware } = require('graphql-middleware')
const { makeExecutableSchema } = require('@graphql-tools/schema')

// express middlewares
const bodyParser = require('body-parser')
const cors = require('cors')
const cookieParser = require('cookie-parser')
const expressJWT = require('express-jwt')
const compression = require('compression')
const helmet = require('helmet')
const morgan = require('morgan')
const RateLimit = require('express-rate-limit')

// authentication middleware
const { permissions } = require('./services/authentication')

// import the configuration
const CFG = require('./klicker.conf.js')

// log the configuration
console.log('[klicker-api] Successfully loaded configuration')
console.log(CFG.toString())

const APP_CFG = CFG.get('app')
const MONGO_CFG = CFG.get('mongo')
const SECURITY_CFG = CFG.get('security')
const SERVICES_CFG = CFG.get('services')

// initialize APM if so configured
let apm
if (SERVICES_CFG.apm.enabled) {
  apm = require('elastic-apm-node')
}

let Raven
if (SERVICES_CFG.sentry.enabled) {
  Raven = require('raven')
}

const AccountService = require('./services/accounts')
const { resolvers, typeDefs } = require('./schema')
const { getRedis } = require('./redis')
const { createLoaders } = require('./lib/loaders')

// connect to mongodb
// use username and password authentication if passed in the environment
// otherwise assume that no authentication needed (e.g. docker)
const mongoConfig = {
  // keepAlive: true,
  // promiseLibrary: global.Promise,
  useNewUrlParser: true,
  useUnifiedTopology: true,
  retryWrites: false,
}
if (MONGO_CFG.user && MONGO_CFG.password) {
  mongoose.connect(`mongodb://${MONGO_CFG.url}`, {
    ...mongoConfig,
    auth: {
      user: MONGO_CFG.user,
      password: MONGO_CFG.password,
    },
  })
} else {
  mongoose.connect(`mongodb://${MONGO_CFG.url}`, mongoConfig)
}

if (MONGO_CFG.debug) {
  // activate mongoose debug mode (log all queries)
  mongoose.set('debug', true)
}

// Make Mongoose use `findOneAndUpdate()`. Note that this option is `true`
// by default, you need to set it to false.
mongoose.set('useFindAndModify', false)

mongoose.connection
  .once('open', () => {
    console.log('[mongo] Connection to MongoDB established.')
  })
  .on('error', (error) => {
    throw new Error(`[mongo] Could not connect to MongoDB: ${error}`)
  })

// initialize a connection to redis
const pageCache = getRedis()
const limitRedis = getRedis(1)
const responseCache = getRedis(3)

// initialize an express server
const app = express()

// serve public files
app.use(express.static(path.join(__dirname, 'public')))

// if the server is behind a proxy, set the APP_PROXY env to true
// this will make express trust the X-* proxy headers and set corresponding req.ip
if (APP_CFG.trustProxy) {
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
    credentials: SECURITY_CFG.cors.credentials,
    origin: SECURITY_CFG.cors.origin,
    optionsSuccessStatus: 200, // some legacy browsers (IE11, various SmartTVs) choke on 204
  }),
  // enable cookie parsing
  cookieParser(),
  // parse json contents
  bodyParser.json(),
  // setup JWT authentication
  expressJWT({
    algorithms: ['HS256'],
    credentialsRequired: false,
    requestProperty: 'auth',
    secret: APP_CFG.secret,
    getToken: AccountService.getToken,
  }),
]

// add the morgan logging middleware
if (process.env.NODE_ENV !== 'test') {
  middleware.push(morgan(isProd ? 'combined' : 'dev'))
}

// add production middlewares
if (isProd) {
  if (Raven) {
    // if a sentry dsn is set, configure raven
    Raven.config(SERVICES_CFG.sentry.dsn, {
      environment: process.env.NODE_ENV,
    }).install()
    middleware = [Raven.requestHandler(), compression(), ...middleware, Raven.errorHandler()]
  } else {
    middleware = [compression(), ...middleware]
  }

  // add an elastic APM middleware
  middleware.push((req, res, next) => {
    // set the APM transaction name
    if (apm) {
      // if the transaction is a single operation
      if (req.body.operationName) {
        apm.setTransactionName(req.body.operationName)
      } else if (Array.isArray(req.body)) {
        // if the transaction is a batch of operations
        const operationsConcat = req.body
          .map((o) => o.operationName)
          .sort()
          .join('/')
        apm.setTransactionName(operationsConcat)
      }

      // if the request is authenticated, set the user context
      if (req.auth) {
        apm.setUserContext({ id: req.auth.sub })
      }
    }

    next()
  })

  // add a rate limiting middleware
  if (SECURITY_CFG.rateLimit.enabled) {
    const RedisStore = require('rate-limit-redis')

    const { windowMs, max } = SECURITY_CFG.rateLimit

    const limiterSettings = {
      windowMs,
      max,
      keyGenerator: (req) => `${req.auth ? req.auth.sub : req.ip}`,
      onLimitReached: (req) => {
        const error = `> Rate-Limited a Request from ${req.ip} ${req.auth.sub || 'anon'}!`

        console.error(error)

        if (apm) {
          apm.captureError(error)
        }

        if (Raven) {
          Raven.captureException(error)
        }
      },
      store: new RedisStore({
        client: limitRedis,
        expiry: Math.round(windowMs / 1000),
        prefix: 'limiter:',
      }),
    }

    middleware.push(new RateLimit(limiterSettings))
  }
}

// inject the middleware into express
app.use(middleware)

// instantiate pretty error
const pe = new PrettyError()

// apply the graphql-shield middleware to the schema
const schema = makeExecutableSchema({ typeDefs, resolvers })
const schemaWithAuthentication = applyMiddleware(schema, permissions)

// setup a new apollo server instance
const apollo = new ApolloServer({
  schema: schemaWithAuthentication,
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
  engine: SERVICES_CFG.apolloEngine.enabled && {
    apiKey: SERVICES_CFG.apolloEngine.apiKey,
  },
  formatError: (e) => {
    console.log(pe.render(e))

    if (isProd && Raven) {
      if (e.path || e.name !== 'GraphQLError') {
        Raven.captureException(e, {
          tags: { graphql: 'exec_error' },
          extra: {
            source: e.source && e.source.body,
            positions: e.locations,
            path: e.path,
          },
        })
      } else {
        Raven.captureMessage(`GraphQLWrongQuery: ${e.message}`, {
          tags: { graphql: 'wrong_query' },
          extra: {
            source: e.source && e.source.body,
            positions: e.locations,
            path: e.path,
          },
        })
      }
    }

    return e
    /* return {
      message: e.message,
      stack: isDev ? e.stack && e.stack.split('\n') : null,
    } */
  },
})

// apply the apollo middleware to express
apollo.applyMiddleware({
  app,
  cors: false,
  bodyParserConfig: false,
  onHealthCheck: async () => {
    // check connection to mongo
    if (!mongoose.connection.readyState) {
      console.error('[klicker-react] MongoDB connection failure...')
      throw new Error('MONGODB_CONNECTION_ERROR')
    }

    // check connection to redis
    if (
      (limitRedis && limitRedis.status !== 'ready') ||
      (pageCache && pageCache.status !== 'ready') ||
      (responseCache && responseCache.status !== 'ready')
    ) {
      console.error('[klicker-react] Redis connection failure...')
      throw new Error('REDIS_CONNECTION_ERROR')
    }
  },
})

module.exports = { app, apollo }
