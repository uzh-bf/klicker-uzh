import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'
import { AuditEventSchema } from './audit-event.js'
import { authMiddleware } from './auth.js'
import { config } from './config.js'
import { createAuditEntity } from './storage/entities.js'
import { AuditTableClient } from './storage/table-client.js'
import { logger } from './utils/logger.js'
import { metrics } from './utils/metrics.js'

const app = new Hono()

// Initialize Azure Table client
const tableClient = new AuditTableClient(
  config.AZURE_TABLES_CONNECTION_STRING,
  config.AZURE_TABLES_TABLE_NAME
)

// Health checks (no authentication required)
app.get('/healthz', (c) => {
  return c.json({
    status: 'ok',
    service: config.SERVICE_NAME,
    version: config.SERVICE_VERSION,
  })
})

app.get('/ready', (c) => {
  // Basic readiness check - ensure service is properly initialized
  const ready = {
    status: 'ready',
    service: config.SERVICE_NAME,
    version: config.SERVICE_VERSION,
    timestamp: new Date().toISOString(),
  }

  return c.json(ready, 200)
})

// Audit event ingestion (with authentication and validation)
app.post(
  '/audit',
  authMiddleware,
  zValidator('json', AuditEventSchema),
  async (c) => {
    const startTime = Date.now()
    const event = c.req.valid('json')

    // Increment request counter
    metrics.requestsTotal.inc()

    try {
      logger.info(
        {
          tenantId: event.tenantId,
          action: event.action,
          eventId: event.eventId,
          timestamp: event.timestamp,
        },
        'Processing audit event'
      )

      // Convert event to Azure Table entity
      const entity = createAuditEntity(event)

      // Write to Azure Table Storage (direct write for MVP)
      await tableClient.upsertEntity(entity)

      // Record successful write
      metrics.writesTotal.inc()
      metrics.writeLatency.observe((Date.now() - startTime) / 1000)

      logger.info(
        {
          tenantId: event.tenantId,
          partitionKey: entity.partitionKey,
          rowKey: entity.rowKey,
          duration: Date.now() - startTime,
        },
        'Audit event written successfully'
      )

      return c.json({ status: 'accepted', eventId: entity.rowKey }, 202)
    } catch (error) {
      // Record error
      metrics.writeErrorsTotal.inc()

      logger.error(
        {
          tenantId: event.tenantId,
          eventId: event.eventId,
          error: error instanceof Error ? error.message : 'Unknown error',
          duration: Date.now() - startTime,
        },
        'Failed to write audit event'
      )

      // Return appropriate error response
      if (error instanceof Error && error.message.includes('exceeds')) {
        return c.json({ error: 'Request entity too large' }, 413)
      }

      return c.json({ error: 'Internal server error' }, 500)
    }
  }
)

export { app, tableClient }
