import serverlessExpress from '@vendia/serverless-express'
import Redis from 'ioredis'

import prepareApp from './app'

const redisCache = new Redis({
  family: 4,
  host: process.env.REDIS_CACHE_HOST ?? 'localhost',
  password: process.env.REDIS_CACHE_PASS ?? '',
  port: Number(process.env.REDIS_CACHE_PORT) ?? 6379,
  tls: process.env.REDIS_CACHE_TLS ? {} : undefined,
})

const redisExec = new Redis({
  family: 4,
  host: process.env.REDIS_HOST ?? 'localhost',
  password: process.env.REDIS_PASS ?? '',
  port: Number(process.env.REDIS_PORT) ?? 6380,
  tls: process.env.REDIS_TLS ? {} : undefined,
})

const app = prepareApp({ redisCache, redisExec })

const cachedServerlessExpress = serverlessExpress({ app })

export default async function (context: any, req: any) {
  return cachedServerlessExpress(context, req, () => {})
}
