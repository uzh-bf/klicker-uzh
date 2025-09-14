import { zValidator } from '@hono/zod-validator'
import { hatchetClient } from '@klicker-uzh/hatchet'
import { verifyJWT, type JWTPayload } from '@klicker-uzh/util'
import { Hono } from 'hono'
import { getCookie } from 'hono/cookie'
import { createHash, createHmac, randomUUID } from 'node:crypto'
import { env } from '../lib/env.js'
import { logger } from '../lib/logger.js'
import { getRedis } from '../lib/redis.js'
import {
  AssessmentResponseSchema,
  StandardResponseSchema,
} from '../schemas/index.js'

const app = new Hono<{ Variables: { requestId: string } }>()

app.post(
  '/AddResponse',
  zValidator(
    'json',
    env.ASSESSMENT_MODE ? AssessmentResponseSchema : StandardResponseSchema,
    (result, c) => {
      if (!result.success) {
        return c.json(
          {
            error: 'missing_response',
            code: 'MISSING_FIELDS',
          },
          400
        )
      }
    }
  ),
  async (c) => {
    const now = Date.now()

    if (!env.ASSESSMENT_MODE) {
      const body = c.req.valid('json') as any
      const { response, liveQuizId, instanceId } = body

      const participant = getCookie(c, 'participant_token')
      const temporary = getCookie(c, 'temporary_participant_token')
      const forwardedCookies = [
        participant ? `participant_token=${participant}` : undefined,
        temporary ? `temporary_participant_token=${temporary}` : undefined,
      ]
        .filter(Boolean)
        .join('; ')

      const isAuthenticated = Boolean(participant || temporary)
      const eventName = isAuthenticated
        ? 'response-received:authenticated'
        : 'response-received:anonymous'

      const message = {
        messageId: randomUUID(),
        sessionId: String(liveQuizId),
        instanceId: String(instanceId),
        response,
        cookie: forwardedCookies || undefined,
        responseTimestamp: now,
      }

      try {
        if (
          (logger as any).level === 'debug' ||
          (logger as any).level === 'trace'
        ) {
          logger.debug(
            {
              eventName,
              sessionId: String(liveQuizId),
              instanceId: String(instanceId),
              response,
            },
            'push event'
          )
        }
        await hatchetClient.events.push(eventName, message)
      } catch (err) {
        return c.json(
          {
            error: 'submission_failure',
            code: 'SERVER_ERROR',
            requestId: c.get('requestId'),
          },
          500
        )
      }

      return c.json({ status: 'ok', responseTimestamp: now }, 200)
    }

    const body = c.req.valid('json') as any
    const { correlationKey, response, liveQuizId, instanceId } = body

    let correlationData: JWTPayload | null = null
    try {
      correlationData = await verifyJWT(correlationKey, env.APP_SECRET)
    } catch (err) {
      await hatchetClient.events.push('create-audit-log-entry', {
        info: `[ERROR] [AddResponse Assessment] Failed to verify correlationKey: ${err}`,
      })
      return c.json(
        {
          error: 'invalid_submission',
          code: 'INVALID_SUBMISSION',
          requestId: c.get('requestId'),
        },
        400
      )
    }

    if (
      !correlationData ||
      correlationData.instanceId !== String(instanceId) ||
      correlationData.liveQuizId !== String(liveQuizId)
    ) {
      await hatchetClient.events.push('create-audit-log-entry', {
        info: `[ERROR] [AddResponse Assessment] Invalid correlationKey for response`,
      })
      return c.json(
        {
          error: 'invalid_submission',
          code: 'INVALID_SUBMISSION',
          requestId: c.get('requestId'),
        },
        400
      )
    }

    const assessmentCookie = getCookie(c, 'next-auth.participant-session-token')
    let user: JWTPayload | null = null
    try {
      user = assessmentCookie
        ? await verifyJWT(assessmentCookie, env.APP_SECRET)
        : null
    } catch (err) {
      await hatchetClient.events.push('create-audit-log-entry', {
        info: `[ERROR] [AddResponse Assessment] Failed to verify assessment cookie JWT: ${err}`,
      })
      return c.json(
        {
          error: 'invalid_assessment_cookie',
          code: 'INVALID_ASSESSMENT_COOKIE',
          requestId: c.get('requestId'),
        },
        401
      )
    }

    const isAssessmentCookieValid = !!user && user.role === 'PARTICIPANT'
    if (!user || !user.sub || !isAssessmentCookieValid) {
      await hatchetClient.events.push('create-audit-log-entry', {
        info: `[ERROR] [AddResponse Assessment] Missing or invalid assessment cookie`,
      })
      return c.json(
        {
          error: 'missing_invalid_assessment_cookie',
          code: 'INVALID_ASSESSMENT_COOKIE',
          requestId: c.get('requestId'),
        },
        401
      )
    }

    const combined = `${correlationKey}:${user.sub}`
    const correlationId =
      env.CORRELATION_HASH_ALGO === 'hmac-sha256'
        ? createHmac('sha256', env.APP_SECRET).update(combined).digest('hex')
        : createHash('md5').update(combined).digest('hex')

    await hatchetClient.events.push('create-audit-log-entry', {
      correlationId,
      info: `[AddResponse Assessment] Response-API received response for instance ${instanceId} in live quiz ${liveQuizId} from participant ${user.sub}`,
    })

    let alreadyVoted = false
    try {
      const redis = getRedis()
      const votes = await redis.hget(
        `lq:${liveQuizId}:i:${instanceId}:votes`,
        correlationId
      )
      alreadyVoted = Boolean(votes)
    } catch (err) {
      await hatchetClient.events.push('create-audit-log-entry', {
        correlationId,
        info: `[WARN] [AddResponse Assessment] Redis unavailable for duplicate check: ${err}`,
      })
    }

    if (alreadyVoted) {
      await hatchetClient.events.push('create-audit-log-entry', {
        correlationId,
        info: `[AddResponse Assessment] Duplicate submission ignored for instance ${instanceId} in live quiz ${liveQuizId}`,
      })
      return c.json(
        { status: 'response_recorded_before', responseTimestamp: now },
        208
      )
    }

    const message = {
      correlationId,
      participantId: user.sub,
      liveQuizId: String(liveQuizId),
      instanceId: String(instanceId),
      response,
      responseTimestamp: now,
    }

    try {
      if (
        (logger as any).level === 'debug' ||
        (logger as any).level === 'trace'
      ) {
        logger.debug(
          {
            correlationId,
            liveQuizId: String(liveQuizId),
            instanceId: String(instanceId),
            response,
          },
          'push assessment event'
        )
      }
      await hatchetClient.events.push('response-received:assessment', message)
    } catch (error) {
      try {
        await hatchetClient.events.push('create-audit-log-entry', {
          correlationId,
          info: `[ERROR] [AddResponse Assessment] Failed to push response-received:assessment event: ${error}`,
        })
      } catch (_) {}
      return c.json(
        {
          error: 'submission_failure',
          code: 'SERVER_ERROR',
          requestId: c.get('requestId'),
        },
        500
      )
    }

    return c.json({ status: 'response_submitted', responseTimestamp: now }, 200)
  }
)

export default app
