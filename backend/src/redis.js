const Redis = require('ioredis')

// import the configuration
const CFG = require('./klicker.conf.js')

const CACHE_CFG = CFG.get('cache')

const newRedis = (db = 0) => {
  // otherwise initialize a new redis client for the respective url and database
  try {
    const { host, password, port } = CACHE_CFG.redis
    const newClient = new Redis({ db, family: 4, host, password, port })

    console.log(`[redis] Connected to db ${db}`)
    return newClient
  } catch ({ message }) {
    throw new Error(`[redis] Failed to connect: ${message}`)
  }
}

const clients = new Map()
const getRedis = (db = 0) => {
  // check if the redis client has already been initialized
  // if so, return it (like a singleton)
  if (clients.has(db)) {
    return clients.get(db)
  }

  // otherwise initialize a new redis client for the respective url and database
  return newRedis(db)
}

module.exports = {
  getRedis,
  newRedis,
}
