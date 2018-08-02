require('dotenv').config()
const convict = require('convict')

module.exports = convict({
  api: {
    endpoint: {
      default: 'http://localhost:4000/graphql',
      env: 'API_URL',
      format: String,
    },
    endpointWS: {
      default: 'ws://localhost:4000/graphql',
      env: 'API_URL_WS',
      format: String,
    },
  },
  app: {
    port: {
      default: 3000,
      env: 'APP_PORT',
      format: Number,
    },
  },
  cache: {},
  db: {},
  env: {
    arg: 'nodeEnv',
    default: 'development',
    env: 'NODE_ENV',
    format: ['production', 'development', 'test'],
  },
  features: {},
  security: {},
})
