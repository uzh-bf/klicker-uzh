require('dotenv').config()

const Redis = require('ioredis')

const newRedis = (db = 0) => {
  // otherwise initialize a new redis client for the respective url and database
  if (process.env.REDIS_HOST && process.env.NODE_ENV !== 'test') {
    try {
      const newClient = new Redis({
        db,
        family: 4,
        host: process.env.REDIS_HOST,
        password: process.env.REDIS_PASS,
        port: process.env.REDIS_PORT || 6379,
      })
      console.log(`[redis] Connected to db ${db}`)
      return newClient
    } catch ({ message }) {
      console.error(`[redis] Failed to connect: ${message}`)
    }
  }

  return null
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
