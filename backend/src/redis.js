const Redis = require('ioredis')

const clients = new Map()
const getRedis = (db = 0) => {
  // don't return an instance of redis in test environments or if a url is not set
  if (!process.env.REDIS_URL || process.env.NODE_ENV === 'test') {
    return null
  }

  // check if the redis client has already been initialized
  // if so, return it (like a singleton)
  if (clients.has(db)) {
    return clients.get(db)
  }

  // otherwise initialize a new redis client for the respective url and database
  if (process.env.REDIS_URL) {
    try {
      const newClient = new Redis(`redis://${process.env.REDIS_URL}/${db}`)
      clients.set(db, newClient)

      console.log(`[redis] Connected to db ${db}`)
      return newClient
    } catch ({ message }) {
      console.error(`[redis] Failed to connect: ${message}`)
    }
  }

  return null
}

module.exports = {
  getRedis,
}
