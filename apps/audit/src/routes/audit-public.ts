import type { Hono } from 'hono'
import { config } from '../config.js'
import { verifyParticipantToken } from '../middleware/auth.js'
import { AuditEventSchema } from '../schemas/audit-event.js'
import { createAuditEntity } from '../storage/entities.js'
import type { AuditTableClient } from '../storage/table-client.js'
import { parseCookies } from '../utils/cookies.js'
import { logger } from '../utils/logger.js'
import { metrics } from '../utils/metrics.js'
import { checkRateLimit } from '../utils/rate-limit.js'

interface Dependencies {
  tableClient: AuditTableClient
}

export function registerAuditPublicRoutes(
  app: Hono,
  { tableClient }: Dependencies
): void {
  app.post('/audit/public', async (c) => {
    const startTime = Date.now()
    metrics.requestsTotal.inc()

    try {
      const cookieHeader = c.req.header('cookie')
      if (!cookieHeader) {
        logger.warn(
          { requestId: c.get('requestId'), path: c.req.path },
          'Public endpoint authentication failed: no cookies provided'
        )
        return c.json({ error: 'No cookies provided' }, 401)
      }

      const cookies = parseCookies(cookieHeader)
      const participantToken = cookies['participant_token']

      if (!participantToken) {
        logger.warn(
          { requestId: c.get('requestId'), path: c.req.path },
          'Public endpoint authentication failed: participant_token cookie required'
        )
        return c.json({ error: 'participant_token cookie required' }, 401)
      }

      const participant = await verifyParticipantToken(
        participantToken,
        config.APP_SECRET
      )

      if (!participant) {
        logger.warn(
          { requestId: c.get('requestId'), path: c.req.path },
          'Public endpoint authentication failed: invalid or expired participant token'
        )
        return c.json({ error: 'Invalid or expired participant token' }, 401)
      }

      const rateLimitKey = `public:${participant.participantId}`
      if (!checkRateLimit(rateLimitKey, 100, 60000)) {
        logger.warn(
          {
            requestId: c.get('requestId'),
            participantId: participant.participantId,
            path: c.req.path,
          },
          'Public endpoint rate limit exceeded'
        )
        return c.json(
          {
            error: 'Rate limit exceeded',
            retry: true,
            retryAfter: 60,
            message:
              'Too many requests. Please wait a minute before trying again.',
          },
          429
        )
      }

      let rawBody: unknown
      try {
        rawBody = await c.req.json()
      } catch (error) {
        logger.warn(
          {
            requestId: c.get('requestId'),
            participantId: participant.participantId,
            error: error instanceof Error ? error.message : 'Unknown error',
          },
          'Public endpoint received invalid JSON payload'
        )
        return c.json({ error: 'Invalid JSON body' }, 400)
      }

      const {
        attributes,
        subject: _subjectIgnored,
        userId: _userIdIgnored,
        scope: _scopeIgnored,
        schemaVersion: _schemaVersionIgnored,
        ...rest
      } = (rawBody ?? {}) as Record<string, unknown>

      const attributeRecord =
        attributes &&
        typeof attributes === 'object' &&
        !Array.isArray(attributes)
          ? (attributes as Record<string, unknown>)
          : undefined

      const enrichedEventInput = {
        ...rest,
        scope: 'public' as const,
        subject: `participant:${participant.participantId}`,
        userId: participant.participantId,
        attributes: {
          ...(attributeRecord ?? {}),
          source: 'frontend_direct',
          participantRole: participant.role,
        },
      }

      const parsedEvent = AuditEventSchema.safeParse(enrichedEventInput)
      if (!parsedEvent.success) {
        logger.warn(
          {
            requestId: c.get('requestId'),
            participantId: participant.participantId,
            issues: parsedEvent.error.flatten(),
          },
          'Public endpoint validation failed'
        )

        return c.json(
          {
            error: 'Invalid event payload',
            retry: false,
            message: 'Your action was not saved. Please try again.',
          },
          400
        )
      }

      if (parsedEvent.data.correlationId) {
        logger.info(
          {
            requestId: c.get('requestId'),
            participantId: participant.participantId,
            correlationId: parsedEvent.data.correlationId,
          },
          'Received public event with correlation identifier'
        )
      }

      logger.info(
        {
          requestId: c.get('requestId'),
          action: parsedEvent.data.action,
          eventId: parsedEvent.data.eventId,
          participantId: participant.participantId,
          participantRole: participant.role,
          scope: parsedEvent.data.scope,
        },
        'Processing public audit event'
      )

      const entity = createAuditEntity(parsedEvent.data)

      await tableClient.upsertEntity(entity)

      metrics.writesTotal.inc()
      metrics.writeLatency.observe((Date.now() - startTime) / 1000)

      logger.info(
        {
          requestId: c.get('requestId'),
          partitionKey: entity.partitionKey,
          rowKey: entity.rowKey,
          participantId: participant.participantId,
          duration: Date.now() - startTime,
        },
        'Public audit event written successfully'
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
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        'Failed to write public audit event'
      )

      if (error instanceof Error) {
        if (
          error.message.includes('exceeds') ||
          error.message.includes('EntityTooLarge')
        ) {
          return c.json(
            {
              error: 'Event data too large',
              retry: false,
              maxSize: '32KB',
              message:
                'Your action was not saved because it exceeded the size limit.',
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
              error: 'Audit service temporarily unavailable',
              retry: true,
              retryAfter: 5,
              message:
                'Your action was not saved. Please try again in a few seconds.',
            },
            503
          )
        }
      }

      return c.json(
        {
          error: 'Failed to save your action',
          retry: true,
          retryAfter: 10,
          message: 'Your action was not saved. Please try again.',
        },
        503
      )
    }
  })
}
