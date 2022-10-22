import Redis from 'ioredis'

let redis: Redis

function getRedis() {
  if (!redis) {
    redis = new Redis({
      family: 4,
      host: process.env.REDIS_HOST,
      password: process.env.REDIS_PASS ?? '',
      port: Number(process.env.REDIS_PORT) ?? 6379,
      tls: process.env.REDIS_TLS ? {} : undefined,
    })
  }

  return redis
}

export default getRedis
