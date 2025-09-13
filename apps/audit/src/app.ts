import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'
import { compress } from 'hono/compress'
import { cors } from 'hono/cors'
import { logger as honoLogger } from 'hono/logger'
import { requestId } from 'hono/request-id'
import { secureHeaders } from 'hono/secure-headers'
import { timeout } from 'hono/timeout'
import { authMiddleware, parseCookies, verifyParticipantToken } from './auth.js'
import { config } from './config.js'
import { AuditEventSchema } from './schemas/audit-event.js'
import { PublicAuditEventSchema } from './schemas/public-audit-event.js'
import { createAuditEntity } from './storage/entities.js'
import { AuditTableClient } from './storage/table-client.js'
import { logger } from './utils/logger.js'
import { metrics } from './utils/metrics.js'

const app = new Hono()

// Custom print function for Hono logger that integrates with pino
const customLoggerPrintFunc = (str: string, ...rest: string[]) => {
  // Parse the Hono log format: "method path status time"
  const parts = str.trim().split(' ')
  if (parts.length >= 4) {
    const method = parts[0]
    const path = parts[1]
    const status = parseInt(parts[2] || '0')
    const time = parts[3]

    logger.info(
      {
        method,
        path,
        status,
        responseTime: time,
        // Note: Request ID will be included in individual handler logs
      },
      'HTTP request'
    )
  } else {
    // Fallback for unexpected format
    logger.info({ message: str, extra: rest }, 'HTTP request')
  }
}

// Apply middlewares in correct order
app.use('*', requestId()) // Generate request ID first
app.use('*', honoLogger(customLoggerPrintFunc)) // Log all requests
app.use(
  '/audit/public',
  cors({
    origin: config.CORS_ORIGINS.split(',').map((origin) => origin.trim()),
    credentials: true, // Allow cookies for JWT auth
    allowMethods: ['POST', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Cookie'],
  })
)
app.use('*', secureHeaders()) // Security headers
app.use('*', compress()) // Response compression
app.use('*', timeout(30000)) // 30 second timeout

// Simple in-memory rate limiter for public endpoint
interface RateLimitRecord {
  count: number
  resetTime: number
}

const rateLimiter = new Map<string, RateLimitRecord>()

function checkRateLimit(key: string, limit = 100, windowMs = 60000): boolean {
  const now = Date.now()
  const record = rateLimiter.get(key)

  // Clean up expired entries periodically
  if (rateLimiter.size > 1000) {
    for (const [k, v] of rateLimiter.entries()) {
      if (v.resetTime < now) {
        rateLimiter.delete(k)
      }
    }
  }

  if (!record || record.resetTime < now) {
    rateLimiter.set(key, { count: 1, resetTime: now + windowMs })
    return true
  }

  if (record.count >= limit) {
    return false
  }

  record.count++
  return true
}

// Whitelist of events allowed from frontend public endpoint
const ALLOWED_PUBLIC_EVENTS = new Set([
  'response.submitted',
  'session.joined',
  'session.left',
  'quiz.started',
  'quiz.completed',
  'feedback.submitted',
  'question.answered',
  'activity.accessed',
])

// Initialize Azure Table client
const tableClient = new AuditTableClient(
  config.AZURE_TABLES_CONNECTION_STRING,
  config.AZURE_TABLES_TABLE_NAME
)

// Readiness check (authenticated, verifies Azure connectivity)
app.get('/ready', authMiddleware, async (c) => {
  try {
    // Verify Azure Table Storage is accessible
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
          requestId: c.get('requestId'),

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
          requestId: c.get('requestId'),

          partitionKey: entity.partitionKey,
          rowKey: entity.rowKey,
          duration: Date.now() - startTime,
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
      // Record error
      metrics.writeErrorsTotal.inc()

      logger.error(
        {
          requestId: c.get('requestId'),

          eventId: event.eventId,
          error: error instanceof Error ? error.message : 'Unknown error',
          duration: Date.now() - startTime,
        },
        'Failed to write audit event'
      )

      // Return retry-aware error response
      if (error instanceof Error) {
        // Non-retryable errors
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

        // Retryable errors - Azure throttling/temporary issues
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
              retryAfter: 5, // seconds
              eventId: event.eventId,
            },
            503
          )
        }
      }

      // Default to retryable for unknown errors
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

// Public audit event ingestion (with JWT cookie authentication and event filtering)
app.post(
  '/audit/public',
  zValidator('json', PublicAuditEventSchema),
  async (c) => {
    const startTime = Date.now()
    const event = c.req.valid('json')

    // Increment request counter
    metrics.requestsTotal.inc()

    try {
      // Rate limit check to prevent DoS attacks
      if (!checkRateLimit(`public-endpoint`, 100, 60000)) {
        logger.warn(
          {
            requestId: c.get('requestId'),

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

      // Extract cookies from request
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

      // Verify JWT token
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

      // Validate event type is allowed
      if (!ALLOWED_PUBLIC_EVENTS.has(event.action)) {
        logger.warn(
          {
            requestId: c.get('requestId'),
            action: event.action,
            participantId: participant.participantId,
            path: c.req.path,
          },
          'Public endpoint rejected event: action not in whitelist'
        )
        return c.json(
          {
            error: `Event type '${event.action}' not allowed from public endpoint`,
          },
          403
        )
      }

      logger.info(
        {
          requestId: c.get('requestId'),

          action: event.action,
          eventId: event.eventId,
          participantId: participant.participantId,
          participantRole: participant.role,
        },
        'Processing public audit event'
      )

      // Inject verified participant context (prevents spoofing)
      const enrichedEvent = {
        ...event,
        subject: `participant:${participant.participantId}`,
        userId: participant.participantId,
        attributes: {
          ...event.attributes,
          source: 'frontend_direct',
          participantRole: participant.role,
        },
      }

      // Convert event to Azure Table entity
      const entity = createAuditEntity(enrichedEvent)

      // Write to Azure Table Storage (direct write for MVP)
      await tableClient.upsertEntity(entity)

      // Record successful write
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
      // Record error
      metrics.writeErrorsTotal.inc()

      logger.error(
        {
          requestId: c.get('requestId'),

          eventId: event.eventId,
          error: error instanceof Error ? error.message : 'Unknown error',
          duration: Date.now() - startTime,
        },
        'Failed to write public audit event'
      )

      // Return retry-aware error response for student clients
      if (error instanceof Error) {
        // Non-retryable errors
        if (
          error.message.includes('exceeds') ||
          error.message.includes('EntityTooLarge')
        ) {
          return c.json(
            {
              error: 'Event data too large',
              retry: false,
              maxSize: '32KB',
              eventId: event.eventId,
            },
            413
          )
        }

        // Retryable errors - Azure throttling/temporary issues
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
              retryAfter: 5, // seconds
              eventId: event.eventId,
              message:
                'Your action was not saved. Please try again in a few seconds.',
            },
            503
          )
        }
      }

      // Default to retryable for unknown errors (important for student data)
      return c.json(
        {
          error: 'Failed to save your action',
          retry: true,
          retryAfter: 10,
          eventId: event.eventId,
          message: 'Your action was not saved. Please try again.',
        },
        503
      )
    }
  }
)

export { app, tableClient }
