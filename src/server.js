/* eslint-disable global-require */
const { createServer } = require('http')
const mongoose = require('mongoose')

// initialize APM if so configured
if (process.env.APM_SERVER_URL) {
  require('elastic-apm-node').start({
    active: process.env.NODE_ENV === 'production',
    serviceName: process.env.APM_NAME,
    secretToken: process.env.APM_SECRET_TOKEN,
    serverUrl: process.env.APM_SERVER_URL,
  })
}

const { app, apollo } = require('./app')
const { getRedis } = require('./redis')

// get the redis singleton
const redis = getRedis()

// wrap express for websockets
const httpServer = createServer(app)
apollo.installSubscriptionHandlers(httpServer)

httpServer.listen(process.env.PORT, (err) => {
  if (err) throw err

  console.log(
    `[klicker-api] GraphQL ready on http://${process.env.APP_DOMAIN}:${
      process.env.PORT
    }${process.env.APP_PATH}!`,
  )
})

const shutdown = async () => {
  console.log('[klicker-api] Shutting down server')
  await mongoose.disconnect()
  await redis.disconnect()

  console.log('[klicker-api] Shutdown complete')
  process.exit(0)
}

process.on('SIGINT', async () => {
  await shutdown()
})

process.on('exit', async () => {
  await shutdown()
})

process.once('SIGUSR2', async () => {
  await shutdown()
})
