/* eslint-disable global-require */
const { createServer } = require('http')
const mongoose = require('mongoose')
const { useServer } = require('graphql-ws/lib/use/ws')
const ws = require('ws')

const { app, schemaWithAuthentication } = require('./app')
const { getRedis } = require('./redis')

// import the configuration
const CFG = require('./klicker.conf.js') // eslint-disable-line

// validate the configuration
// fail early if anything is invalid
CFG.validate({ allowed: 'strict' })

const APP_CFG = CFG.get('app')
const SERVICES_CFG = CFG.get('services')

// initialize APM if so configured
if (SERVICES_CFG.apm.enabled) {
  const { monitorDev, secretToken, serverUrl, serviceName } = SERVICES_CFG.apm
  require('elastic-apm-node').start({
    active: monitorDev || process.env.NODE_ENV !== 'development',
    secretToken,
    serverUrl,
    serviceName,
  })
}

const redisCache = getRedis('redis')
const responseCache = getRedis('exec')

const httpServer = createServer(app)

const wsServer = new ws.Server({
  server: httpServer,
  path: '/graphql',
})

const listenOn = process.env.NODE_ENV === 'development' ? 'localhost' : APP_CFG.host
httpServer.listen(APP_CFG.port, listenOn, (err) => {
  if (err) throw err

  useServer({ schema: schemaWithAuthentication }, wsServer)

  console.log(`[klicker-api] GraphQL ready on ${listenOn}:${APP_CFG.port}/${APP_CFG.path || ''}!`)
})

const shutdown = (signal) => async () => {
  console.log('[klicker-api] Shutting down server')

  await mongoose.disconnect()
  console.log('[mongodb] Disconnected')

  await redisCache.disconnect()
  await responseCache.disconnect()
  console.log('[redis] Disconnected')

  console.log('[klicker-api] Shutdown complete')
  process.kill(process.pid, signal)
}

const shutdownSignals = ['SIGINT', 'SIGUSR2', 'SIGTERM']
shutdownSignals.forEach((signal) => process.once(signal, shutdown(signal)))
