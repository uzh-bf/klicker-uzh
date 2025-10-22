import { zValidator } from '@hono/zod-validator'
import type { Hono } from 'hono'
import { authMiddleware } from '../middleware/auth.js'
import { AuditEventSchema } from '../schemas/audit-event.js'
import { createAuditEntity } from '../storage/entities.js'
import type { AuditTableClient } from '../storage/table-client.js'
import { logger } from '../utils/logger.js'
import { metrics } from '../utils/metrics.js'

interface Dependencies {
  tableClient: AuditTableClient
}

export function registerAuditPrivateRoutes(
  app: Hono,
  { tableClient }: Dependencies
): void {
  app.post(
    '/audit',
    authMiddleware,
    zValidator('json', AuditEventSchema),
    async (c) => {
      const startTime = Date.now()
      const event = c.req.valid('json')

      metrics.requestsTotal.inc()

      try {
        logger.info(
          {
            requestId: c.get('requestId'),
            action: event.action,
            eventId: event.eventId,
            timestamp: event.timestamp,
            scope: event.scope,
          },
          'Processing audit event'
        )

        const entity = createAuditEntity(event)

        await tableClient.upsertEntity(entity)

        metrics.writesTotal.inc()
        metrics.writeLatency.observe((Date.now() - startTime) / 1000)

        logger.info(
          {
            requestId: c.get('requestId'),
            partitionKey: entity.partitionKey,
            rowKey: entity.rowKey,
            duration: Date.now() - startTime,
            scope: event.scope,
          },
          'Audit event written successfully'
        )

        return c.json(
          {
            status: 'stored',
            eventId: entity.rowKey,
            stored: true,
          },
          200
        )
      } catch (error) {
        metrics.writeErrorsTotal.inc()

        logger.error(
          {
            requestId: c.get('requestId'),
            eventId: event.eventId,
            error: error instanceof Error ? error.message : 'Unknown error',
            duration: Date.now() - startTime,
            scope: event.scope,
          },
          'Failed to write audit event'
        )

        if (error instanceof Error) {
          if (
            error.message.includes('exceeds') ||
            error.message.includes('EntityTooLarge')
          ) {
            return c.json(
              {
                error: 'Event too large',
                retry: false,
                maxSize: '32KB',
                eventId: event.eventId,
              },
              413
            )
          }

          if (
            error.message.includes('ServerBusy') ||
            error.message.includes('TooManyRequests') ||
            error.message.includes('timeout') ||
            error.message.includes('temporarily unavailable')
          ) {
            return c.json(
              {
                error: 'Service temporarily unavailable',
                retry: true,
                retryAfter: 5,
                eventId: event.eventId,
              },
              503
            )
          }
        }

        return c.json(
          {
            error: 'Failed to store event',
            retry: true,
            retryAfter: 10,
            eventId: event.eventId,
          },
          503
        )
      }
    }
  )
}
