require('dotenv').config()

const bodyParser = require('body-parser')
const cors = require('cors')
const cookieParser = require('cookie-parser')
const express = require('express')
const expressJWT = require('express-jwt')
const mongoose = require('mongoose')
const { graphqlExpress } = require('apollo-server-express')

const schema = require('./schema')
const { isValidJWT } = require('./services/auth')

mongoose.Promise = Promise

const dev = process.env.NODE_ENV !== 'production'

const appSettings = ['APP_DOMAIN', 'APP_PORT', 'APP_SECRET', 'MONGO_URL']
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

// expose the GraphQL API endpoint
// parse JWT that are passed as a header and attach their content to req.user
server.use(
  '/graphql',
  cors({
    credentials: dev, // allow passing credentials over CORS in dev mode
    origin: 'http://localhost:3000',
    optionsSuccessStatus: 200, // some legacy browsers (IE11, various SmartTVs) choke on 204
  }),
  cookieParser(),
  expressJWT({
    credentialsRequired: false,
    requestProperty: 'auth',
    secret: process.env.APP_SECRET,
    getToken: (req) => {
      // try to parse an authorization cookie
      if (req.cookies && req.cookies.jwt && isValidJWT(req.cookies.jwt, process.env.APP_SECRET)) {
        return req.cookies.jwt
      }

      // try to parse the authorization header
      if (
        req.headers.authorization &&
        req.headers.authorization.split(' ')[0] === 'Bearer' &&
        isValidJWT(req.headers.authorization)
      ) {
        return req.headers.authorization.split(' ')[1]
      }

      // no token found
      return null
    },
  }),
  bodyParser.json(),
  graphqlExpress((req, res) => ({ context: { auth: req.auth, res }, schema })),
)

server.listen(process.env.APP_PORT, (err) => {
  if (err) throw err
  console.log(`> API ready on http://localhost:${process.env.APP_PORT}!`)
})
