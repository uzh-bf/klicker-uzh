import { Hono } from 'hono'
import { pingRedis } from '../lib/redis.js'

const health = new Hono()

health.get('/', (c) => c.json({ status: 'ok' }, 200))

health.get('/healthz', async (c) => {
  const up = await pingRedis(200)
  return c.json({ status: 'ok', redis: up ? 'up' : 'down' }, 200)
})

export default health
