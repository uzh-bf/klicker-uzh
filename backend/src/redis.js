const Redis = require('ioredis')

// import the configuration
const CFG = require('./klicker.conf.js')

const CACHE_CFG = CFG.get('cache')

const newRedis = (scope = 'redis') => {
  // otherwise initialize a new redis client for the respective url and database
  try {
    const { host, password, port, tls } = CACHE_CFG[scope]
    const newClient = new Redis({ family: 4, host, password, port, tls })

    console.log(`[redis] Connected to cache ${scope}`)
    return newClient
  } catch ({ message }) {
    throw new Error(`[redis] Failed to connect: ${message}`)
  }
}

const clients = new Map()
const getRedis = (scope = 'redis') => {
  // check if the redis client has already been initialized
  // if so, return it (like a singleton)
  if (clients.has(scope)) {
    return clients.get(scope)
  }

  // otherwise initialize a new redis client for the respective url and database
  const newClient = newRedis(scope)
  clients.set(scope, newClient)
  return newClient
}

module.exports = {
  getRedis,
  newRedis,
}
