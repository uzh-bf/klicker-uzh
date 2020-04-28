/* eslint-disable global-require */

// import the configuration
const cfg = require('./klicker.conf.js') // eslint-disable-line

// validate the configuration
// fail early if anything is invalid
cfg.validate({ allowed: 'strict' })

const APP_CFG = cfg.get('app')
const CACHE_CFG = cfg.get('cache')
const SERVICES_CFG = cfg.get('services')

if (SERVICES_CFG.newRelic.enabled) {
  require('newrelic')
}

const { createServer } = require('http')
const mongoose = require('mongoose')

const isDev = process.env.NODE_ENV === 'development'

// initialize APM if so configured
if (cfg.get('services.apm.enabled')) {
  const { monitorDev, secretToken, serverUrl, serviceName } = cfg.get('services.apm')
  require('elastic-apm-node').start({
    active: monitorDev || !isDev,
    secretToken,
    serverUrl,
    serviceName,
  })
}

const { app, apollo } = require('./app')

let redis
if (CACHE_CFG.redis.enabled) {
  const { getRedis } = require('./redis')

  // get the redis singleton
  redis = getRedis()
}

// wrap express for websockets
const httpServer = createServer(app)
apollo.installSubscriptionHandlers(httpServer)

httpServer.listen(APP_CFG.port, (err) => {
  if (err) throw err

  console.log(`[klicker-api] GraphQL ready on http://${APP_CFG.domain}:${APP_CFG.port}/${APP_CFG.path || ''}!`)
})

const shutdown = (signal) => async () => {
  console.log('[klicker-api] Shutting down server')

  await mongoose.disconnect()
  console.log('[mongodb] Disconnected')

  if (CACHE_CFG.redis.enabled) {
    await redis.disconnect()
    console.log('[redis] Disconnected')
  }

  console.log('[klicker-api] Shutdown complete')
  process.kill(process.pid, signal)
}

const shutdownSignals = ['SIGINT', 'SIGUSR2', 'SIGTERM']
shutdownSignals.forEach((signal) => process.once(signal, shutdown(signal)))
