/* eslint-disable global-require */

// initialize APM if so configured
if (process.env.APM_SERVER_URL) {
  require('elastic-apm-node').start({
    active: process.env.NODE_ENV === 'production',
    serviceName: process.env.APM_NAME,
    secretToken: process.env.APM_SECRET_TOKEN,
    serverUrl: process.env.APM_SERVER_URL,
  })
}

/* eslint-disable global-require */
const mongoose = require('mongoose')
const server = require('./app')
const { getRedis } = require('./redis')

const redis = getRedis()

server.listen(process.env.PORT, (err) => {
  if (err) throw err

  // send a ready message to PM2
  if (process.send) {
    process.send('ready')
  }

  console.log(`[klicker-api] ready on http://${process.env.APP_DOMAIN}:${process.env.PORT}${process.env.APP_PATH}!`)
})

process.on('SIGINT', async () => {
  console.log('[klicker-api] Shutting down server')
  await mongoose.disconnect()
  await redis.disconnect()

  console.log('[klicker-api] Shutdown complete')
  process.exit(0)
})

process.on('exit', async () => {
  console.log('[klicker-api] Shutting down server')
  await mongoose.disconnect()
  await redis.disconnect()

  console.log('[klicker-api] Shutdown complete')
  process.exit(0)
})

process.once('SIGUSR2', async () => {
  console.log('[klicker-api] Shutting down server')
  await mongoose.disconnect()
  await redis.disconnect()

  console.log('[klicker-api] Shutdown complete')
  process.exit(0)
})
