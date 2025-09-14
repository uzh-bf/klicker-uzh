import { Hono } from 'hono'
import { bodyLimit } from 'hono/body-limit'
import { cors } from 'hono/cors'
import { secureHeaders } from 'hono/secure-headers'
import { env } from './lib/env.js'
import {
  enforceJson,
  logging,
  originGuard,
  requestId,
} from './middleware/index.js'
import health from './routes/health.js'
import responses from './routes/response.js'

const app = new Hono<{ Variables: { requestId: string } }>()

app.use('*', secureHeaders())

app.use(
  '*',
  cors({
    origin: (origin) => {
      if (!origin || origin === 'null') return undefined
      return env.CORS_ALLOWED_ORIGINS.includes(origin) ? origin : undefined
    },
    credentials: true,
    allowMethods: ['GET', 'POST', 'OPTIONS'],
    allowHeaders: ['Content-Type'],
    exposeHeaders: ['X-Request-Id'],
    maxAge: 86400,
  })
)

app.use('*', requestId)
app.use('*', logging)
app.use('*', bodyLimit({ maxSize: 1024 * 1024 }))
app.use('*', enforceJson)
app.use('/AddResponse', originGuard)

app.route('/', health)
app.route('/', responses)

app.notFound((c) =>
  c.json(
    { error: 'Not found', code: 'NOT_FOUND', requestId: c.get('requestId') },
    404
  )
)

app.onError((err, c) => {
  return c.json(
    {
      error: 'Internal server error',
      code: 'SERVER_ERROR',
      requestId: c.get('requestId'),
    },
    500
  )
})

export default app
