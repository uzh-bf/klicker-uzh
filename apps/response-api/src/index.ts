import { serve } from '@hono/node-server'
import app from './app.js'
import { env } from './lib/env.js'
import { quitRedis } from './lib/redis.js'

const server = serve({ fetch: app.fetch, port: env.PORT })
console.log(`[response-api] Listening on http://localhost:${env.PORT}`)

const shutdown = async () => {
  try {
    server.close()
  } catch {}
  await quitRedis()
  process.exit(0)
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
