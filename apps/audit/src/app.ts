import { Hono } from 'hono'
import { compress } from 'hono/compress'
import { cors } from 'hono/cors'
import { logger as honoLogger } from 'hono/logger'
import { requestId } from 'hono/request-id'
import { secureHeaders } from 'hono/secure-headers'
import { timeout } from 'hono/timeout'
import { config } from './config.js'
import { authMiddleware } from './middleware/auth.js'
import { registerAuditPrivateRoutes } from './routes/audit-private.js'
import { registerAuditPublicRoutes } from './routes/audit-public.js'
import { AuditTableClient } from './storage/table-client.js'
import { logger } from './utils/logger.js'

const tableClient = new AuditTableClient(
  config.AUDIT_TABLE_CONNECTION_STRING,
  config.AUDIT_TABLE_NAME
)

const app = new Hono()

const customLoggerPrintFunc = (str: string, ...rest: string[]) => {
  const parts = str.trim().split(' ')
  if (parts.length >= 4) {
    const method = parts[0]
    const path = parts[1]
    const status = parseInt(parts[2] || '0', 10)
    const time = parts[3]

    logger.info(
      {
        method,
        path,
        status,
        responseTime: time,
      },
      'HTTP request'
    )
  } else {
    logger.info({ message: str, extra: rest }, 'HTTP request')
  }
}

app.use('*', requestId())
app.use('*', honoLogger(customLoggerPrintFunc))
app.use(
  '/audit/public',
  cors({
    origin: config.AUDIT_CORS_ORIGINS.split(',').map((origin) => origin.trim()),
    credentials: true,
    allowMethods: ['POST', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Cookie'],
  })
)
app.use('*', secureHeaders())
app.use('*', compress())
app.use('*', timeout(30000))

app.get('/ready', authMiddleware, async (c) => {
  try {
    await tableClient.checkConnection()

    return c.json(
      {
        status: 'ready',
        timestamp: new Date().toISOString(),
        storage: 'connected',
      },
      200
    )
  } catch (error) {
    return c.json(
      {
        status: 'not_ready',
        timestamp: new Date().toISOString(),
        storage: 'disconnected',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      503
    )
  }
})

registerAuditPrivateRoutes(app, { tableClient })
registerAuditPublicRoutes(app, { tableClient })

export { app, tableClient }
