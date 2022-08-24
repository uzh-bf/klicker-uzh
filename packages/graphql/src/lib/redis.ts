import Redis from 'ioredis'

const clients = new Map()

export function newRedis(scope = 'sessions'): Redis {
  try {
    // const { host, password, port, tls } = CACHE_CFG[scope]
    const newClient = new Redis({
      family: 4,
      host: process.env.REDIS_HOST ?? 'localhost',
      password: process.env.REDIS_PASS ?? '',
      port: Number(process.env.REDIS_PORT) ?? 6379,
      tls: process.env.REDIS_TLS ? {} : undefined,
    })

    console.log(`[redis] Connected to cache ${scope}`)
    return newClient
  } catch ({ message }) {
    throw new Error(`[redis] Failed to connect: ${message}`)
  }
}

export function getRedis(scope = 'sessions'): Redis {
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
