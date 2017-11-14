/* eslint-disable global-require */

require('dotenv').config()

const bodyParser = require('body-parser')
const cors = require('cors')
const cookieParser = require('cookie-parser')
const express = require('express')
const expressJWT = require('express-jwt')
const mongoose = require('mongoose')
const compression = require('compression')
const helmet = require('helmet')
const _invert = require('lodash/invert')
const { graphqlExpress } = require('apollo-server-express')

const schema = require('./schema')
const AuthService = require('./services/auth')
const queryMap = require('./queryMap.json')

mongoose.Promise = Promise

const dev = process.env.NODE_ENV !== 'production'

// require important environment variables to be present
// otherwise exit the application
const appSettings = ['APP_DOMAIN', 'PORT', 'APP_SECRET', 'MONGO_URL', 'ORIGIN']
appSettings.forEach((envVar) => {
  if (!process.env[envVar]) {
    console.warn(`> Error: Please pass the ${envVar} as an environment variable.`)
    process.exit(1)
  }
})

// connect to mongodb
// use username and password authentication if passed in the environment
// otherwise assume that no authentication needed (e.g. docker)
if (process.env.MONGO_USER && process.env.MONGO_PASSWORD) {
  mongoose.connect(`mongodb://${process.env.MONGO_USER}:${process.env.MONGO_PASSWORD}@${process.env.MONGO_URL}`)
} else {
  mongoose.connect(`mongodb://${process.env.MONGO_URL}`)
}

mongoose.connection
  .once('open', () => {
    console.log('> Connection to MongoDB established.')
  })
  .on('error', (error) => {
    console.warn('> Warning: ', error)
  })

// initialize an express server
const server = express()

let middleware = [
  // enable gzip compression
  compression(),
  // secure the server with helmet
  helmet({
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
  // parse json contents
  bodyParser.json(),
]

if (!dev) {
  // persisted query middleware
  middleware.push((req, res, next) => {
    const invertedMap = _invert(queryMap)
    req.body.query = invertedMap[req.body.id]
    next()
  })
}

// setup Apollo Engine (GraphQL API metrics)
let apolloEngine = !!process.env.ENGINE_API_KEY
if (apolloEngine) {
  const { Engine } = require('apollo-engine')
  apolloEngine = new Engine({ engineConfig: { apiKey: process.env.ENGINE_API_KEY } })
  apolloEngine.start()

  // if apollo engine is enabled, add the middleware to the stack
  middleware = [apolloEngine.expressMiddleware(), ...middleware]
}

// expose the GraphQL API endpoint
// parse JWT that are passed as a header and attach their content to req.user
server.use(
  ...middleware,
  // delegate to the GraphQL API
  graphqlExpress((req, res) => ({
    context: { auth: req.auth, res },
    schema,
    tracing: !!process.env.ENGINE_API_KEY,
    cacheControl: !!process.env.ENGINE_API_KEY,
  })),
)

server.listen(process.env.PORT, (err) => {
  if (err) throw err
  console.log(`> API ready on http://localhost:${process.env.PORT}!`)
})
