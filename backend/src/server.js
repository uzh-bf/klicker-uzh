/* eslint-disable global-require */
const mongoose = require('mongoose')
const server = require('./app')
const { getRedis } = require('./redis')

const redis = getRedis()

server.listen(process.env.PORT, (err) => {
  if (err) throw err
  console.log(`[klicker-api] ready on http://localhost:${process.env.PORT}!`)
})

process.on('exit', () => {
  console.log('[klicker-api] Shutting down server')
  mongoose.disconnect()
  redis.disconnect()

  console.log('[klicker-api] Shutdown complete')
  process.exit(0)
})

process.once('SIGUSR2', () => {
  console.log('[klicker-api] Shutting down server')
  mongoose.disconnect()
  redis.disconnect()

  console.log('[klicker-api] Shutdown complete')
  process.exit(0)
})
