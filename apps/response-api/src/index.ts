import { hatchetClient } from '@klicker-uzh/hatchet'
import { toSafeError } from '@klicker-uzh/logging/node'
import { UserLoginScope } from '@klicker-uzh/prisma/client'
import { verifyJWT, type JWTPayload } from '@klicker-uzh/util'
import { Redis } from 'ioredis'
import { createHash, randomUUID } from 'node:crypto'
import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from 'node:http'
import { logger } from './logger.js'
import {
  beginNodeRequest,
  type NodeRequestLog,
  type ResponseApiRoute,
} from './requestLogging.js'

const requests = new WeakMap<ServerResponse, NodeRequestLog>()

function startRequest(
  req: IncomingMessage,
  res: ServerResponse,
  route: ResponseApiRoute
) {
  const request = beginNodeRequest(req, res, logger, route)
  requests.set(res, request)
  return request
}

function requestFor(res: ServerResponse) {
  const request = requests.get(res)
  if (!request) throw new Error('Request logging context is unavailable')
  return request
}

const redis = new Redis({
  family: 4,
  host: process.env.REDIS_HOST,
  password: process.env.REDIS_PASS ?? '',
  port: Number(process.env.REDIS_PORT ?? 6379),
  tls: process.env.REDIS_TLS ? {} : undefined,
})

const assessmentRedis = new Redis({
  family: 4,
  host: process.env.REDIS_ASSESSMENT_HOST,
  password: process.env.REDIS_ASSESSMENT_PASS ?? '',
  port: Number(process.env.REDIS_ASSESSMENT_PORT ?? 6381),
  tls: process.env.REDIS_ASSESSMENT_TLS ? {} : undefined,
})

const PORT = Number(process.env.PORT ?? 7078)
const CORS_ALLOWED_ORIGINS = (process.env.CORS_ALLOWED_ORIGINS || '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean)

function setCorsHeaders(req: IncomingMessage, res: ServerResponse) {
  const origin = req.headers.origin
  // Only allow explicitly whitelisted origins, and never allow "null"
  if (origin && origin !== 'null' && CORS_ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin)
    res.setHeader('Vary', 'Origin')
    res.setHeader('Access-Control-Allow-Credentials', 'true')
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, Cookie, X-Request-ID, X-Correlation-ID'
  )
  res.setHeader(
    'Access-Control-Expose-Headers',
    'X-Request-ID, X-Correlation-ID'
  )
}

function sendJson(
  req: IncomingMessage,
  res: ServerResponse,
  status: number,
  body: unknown
) {
  setCorsHeaders(req, res)
  const json = JSON.stringify(body)
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Content-Length', Buffer.byteLength(json))
  res.end(json)
}

function badRequest(
  req: IncomingMessage,
  res: ServerResponse,
  message?: string
) {
  sendJson(req, res, 400, { error: message ?? 'Bad request' })
}

async function readBody(req: IncomingMessage): Promise<any> {
  const chunks: Buffer[] = []
  let size = 0
  await new Promise<void>((resolve, reject) => {
    req.on('data', (chunk: Buffer) => {
      chunks.push(chunk)
      size += chunk.length
      if (size > 1_000_000) {
        // 1MB limit
        reject(new Error('Payload too large'))
        req.destroy()
      }
    })
    req.on('end', () => resolve())
    req.on('error', (err) => reject(err))
  })

  const body = Buffer.concat(chunks).toString('utf-8')
  if (!body) {
    return null
  }
  try {
    return JSON.parse(body)
  } catch (e) {
    throw new Error('Invalid JSON')
  }
}

async function handleAddResponse(req: IncomingMessage, res: ServerResponse) {
  const request = requestFor(res)
  let payload: any
  try {
    payload = await readBody(req)
  } catch (err: any) {
    request.log.info(
      { event: 'response.rejected', reason: 'invalid_json' },
      'Response rejected'
    )
    return badRequest(req, res, err.message)
  }

  if (!payload || typeof payload !== 'object') {
    request.log.info(
      { event: 'response.rejected', reason: 'invalid_body' },
      'Response rejected'
    )
    return badRequest(req, res, 'Body must be a JSON object')
  }

  const { response, liveQuizId, instanceId } = payload
  if (!response || !liveQuizId || typeof instanceId === 'undefined') {
    request.log.info(
      { event: 'response.rejected', reason: 'missing_fields' },
      'Response rejected'
    )
    return badRequest(
      req,
      res,
      'Missing required fields: response, liveQuizId, instanceId'
    )
  }

  // Only forward participant-related cookies. If both exist, include both.
  let cookie: string | undefined
  if (typeof req.headers['cookie'] === 'string') {
    const raw = req.headers['cookie']
    const parts = raw.split(';').map((s) => s.trim())
    const participantPair = parts.find((p) =>
      p.startsWith('participant_token=')
    )
    const temporaryPair = parts.find((p) =>
      p.startsWith('temporary_participant_token=')
    )
    const forwarded: string[] = []
    if (participantPair) forwarded.push(participantPair)
    if (temporaryPair) forwarded.push(temporaryPair)
    if (forwarded.length > 0) {
      cookie = forwarded.join('; ')
    }
  }

  const responseTimestamp = Date.now()
  const message = {
    messageId: randomUUID(),
    sessionId: String(liveQuizId),
    instanceId: String(instanceId),
    response, // pass through as-is; worker validates
    cookie,
    responseTimestamp,
    loggingContext: {
      requestId: request.context.requestId,
      correlationId: request.context.correlationId,
    },
  }

  // determine if the participant is logged in with a valid student cookie (temporary or standard)
  const isAuthenticatedParticipant =
    cookie &&
    (cookie.includes('participant_token=') ||
      cookie.includes('temporary_participant_token='))

  // depending on the authentication state, add the response to the correct hatchet event queue
  const eventName = isAuthenticatedParticipant
    ? 'response-received:authenticated'
    : 'response-received:anonymous'
  request.log.info({ event: 'response.accepted' }, 'Response accepted')
  try {
    await hatchetClient.events.push(eventName, message)
  } catch {
    request.log.error(
      {
        event: 'response.publish.failed',
        err: toSafeError('Hatchet response publish failed'),
      },
      'Response could not be published'
    )
    throw new Error('Response publish failed')
  }
  return sendJson(req, res, 200, { status: 'ok', responseTimestamp })
}

async function handleAddAssessmentResponse(
  req: IncomingMessage,
  res: ServerResponse
) {
  const request = requestFor(res)
  // track the time where the response was received
  const responseTimestamp = Date.now()

  let payload: any
  try {
    payload = await readBody(req)
  } catch (err: any) {
    request.log.info(
      { event: 'response.rejected', reason: 'invalid_json' },
      'Assessment response rejected'
    )
    return badRequest(req, res, err.message)
  }

  if (!payload || typeof payload !== 'object') {
    request.log.info(
      { event: 'response.rejected', reason: 'invalid_body' },
      'Assessment response rejected'
    )
    return badRequest(req, res, 'submission_failure')
  }

  const { correlationKey, response, liveQuizId, instanceId } = payload
  if (
    !response ||
    !liveQuizId ||
    typeof instanceId === 'undefined' ||
    !correlationKey
  ) {
    request.log.info(
      { event: 'response.rejected', reason: 'missing_fields' },
      'Assessment response rejected'
    )

    return badRequest(req, res, 'missing_response')
  }

  // validate correlationKey (execution, quizId and instanceId same as passed arguments)
  let correlationData: JWTPayload | null = null
  try {
    correlationData = await verifyJWT(
      correlationKey,
      process.env.APP_SECRET as string,
      { issuer: process.env.APP_ORIGIN_ASSESSMENT_API }
    )
  } catch {
    request.log.info(
      { event: 'response.rejected', reason: 'invalid_submission' },
      'Assessment response rejected'
    )
    return badRequest(req, res, 'invalid_submission')
  }

  if (
    !correlationData ||
    correlationData.instanceId !== instanceId ||
    correlationData.liveQuizId !== liveQuizId
  ) {
    request.log.info(
      { event: 'response.rejected', reason: 'invalid_submission' },
      'Assessment response rejected'
    )
    return badRequest(req, res, 'invalid_submission')
  }

  const cookies =
    typeof req.headers['cookie'] === 'string'
      ? req.headers['cookie']
      : undefined

  // parse the cookies that are of the format key=value; key2=value2
  const parsedCookies: Record<string, string> = {}
  if (cookies) {
    cookies.split(';').forEach((cookie) => {
      const [key, value] = cookie.trim().split('=')
      if (key && value) parsedCookies[key] = value
    })
  }

  // check if the assessment cookie is present and valid
  let user: JWTPayload | null = null
  try {
    user = parsedCookies['next-auth.participant-session-token']
      ? await verifyJWT(
          parsedCookies['next-auth.participant-session-token'],
          process.env.APP_SECRET as string,
          { issuer: process.env.APP_ORIGIN_AUTH }
        )
      : null
  } catch {
    request.log.info(
      { event: 'response.rejected', reason: 'invalid_assessment_cookie' },
      'Assessment response rejected'
    )
    return sendJson(req, res, 401, { error: 'invalid_assessment_cookie' })
  }

  const isAssessmentCookieValid =
    !!user && user.role === 'PARTICIPANT' && user.scope === UserLoginScope.EDUID
  if (!user || !user.sub || !isAssessmentCookieValid) {
    request.log.info(
      {
        event: 'response.rejected',
        reason: 'missing_invalid_assessment_cookie',
      },
      'Assessment response rejected'
    )
    return sendJson(req, res, 401, {
      error: 'missing_invalid_assessment_cookie',
    })
  }

  // set up correlation id as an MD5 hash of correlationKey and participantId to obtain tracking id
  const combinedCorrelationKey = `${correlationKey}:${user.sub}`
  const MD5 = createHash('md5')
  MD5.update(combinedCorrelationKey)
  const assessmentSubmissionId = MD5.digest('hex')

  // audit log entry for received response
  hatchetClient.events.push('create-audit-log-entry', {
    correlationId: assessmentSubmissionId,
    info: '[AddResponse Assessment] Response received.',
    loggingContext: {
      requestId: request.context.requestId,
      correlationId: request.context.correlationId,
    },
  })

  // check if there already exists an entry in the votes table with the given correlationId
  const votes = await assessmentRedis.hget(
    `lq:${liveQuizId}:i:${instanceId}:votes`,
    assessmentSubmissionId
  )
  if (votes) {
    request.log.info(
      { event: 'response.duplicate' },
      'Assessment response already recorded'
    )
    hatchetClient.events.push('create-audit-log-entry', {
      correlationId: assessmentSubmissionId,
      info: '[AddResponse Assessment] Duplicate response received.',
      loggingContext: {
        requestId: request.context.requestId,
        correlationId: request.context.correlationId,
      },
    })

    // show success message that response was already recorded before and that first response counts
    return sendJson(req, res, 208, {
      status: 'response_recorded_before',
      responseTimestamp,
    })
  }

  const message = {
    correlationId: assessmentSubmissionId,
    participantId: user.sub,
    liveQuizId: String(liveQuizId),
    instanceId: String(instanceId),
    response, // pass through as-is; worker validates
    responseTimestamp,
    loggingContext: {
      requestId: request.context.requestId,
      correlationId: request.context.correlationId,
    },
  }

  // start the processing of an assessment response
  request.log.info(
    { event: 'response.accepted' },
    'Assessment response accepted'
  )

  try {
    await hatchetClient.events.push('response-received:assessment', message)
  } catch {
    request.log.error(
      {
        event: 'response.publish.failed',
        err: toSafeError('Hatchet assessment response publish failed'),
      },
      'Assessment response could not be published'
    )
  }

  return sendJson(req, res, 200, {
    status: 'response_submitted',
    responseTimestamp,
  })
}

const server = createServer(async (req, res) => {
  try {
    // handle CORS preflight requests
    if (req.method === 'OPTIONS') {
      startRequest(req, res, '/')
      setCorsHeaders(req, res)
      res.statusCode = 204
      return res.end()
    }

    const url = new URL(req.url || '/', 'http://localhost')

    // health check endpoint
    if (
      req.method === 'GET' &&
      (url.pathname === '/healthz' || url.pathname === '/')
    ) {
      startRequest(req, res, url.pathname === '/healthz' ? '/healthz' : '/')
      return sendJson(req, res, 200, { status: 'ok' })
    }

    // add response endpoint
    if (url.pathname === '/AddResponse' && req.method === 'POST') {
      startRequest(req, res, '/AddResponse')
      // if not in assessment mode, call standard processing logic
      if (process.env.ASSESSMENT_MODE === 'true') {
        return await handleAddAssessmentResponse(req, res)
      } else {
        // call the standard processing function, which will distinguish between authenticated and anonymous modes
        // if a valid cookie exists is not relevant at this point -> otherwise answers are simply treated as anonymous
        return await handleAddResponse(req, res)
      }
    }

    // fallback to 404 Not Found
    startRequest(req, res, '/')
    return sendJson(req, res, 404, { error: 'Not found' })
  } catch {
    const request = requests.get(res)
    request?.log.error(
      {
        event: 'http.request.failed',
        err: toSafeError('Unhandled response API request failure'),
      },
      'Response API request failed'
    )
    return sendJson(req, res, 500, { error: 'Internal server error' })
  }
})

async function initializeService() {
  // test connection to Redis cache for standard responses
  try {
    await redis.ping()
    logger.info(
      { event: 'dependency.connected', dependency: 'redis' },
      'Redis connected'
    )
  } catch {
    logger.error(
      {
        event: 'dependency.unavailable',
        dependency: 'redis',
        err: toSafeError('Redis connection failed'),
      },
      'Redis connection failed'
    )
    throw new Error('Redis connection failed')
  }

  // test connection to Redis cache for assessment responses
  try {
    await assessmentRedis.ping()
    logger.info(
      { event: 'dependency.connected', dependency: 'redis-assessment' },
      'Assessment Redis connected'
    )
  } catch {
    logger.error(
      {
        event: 'dependency.unavailable',
        dependency: 'redis-assessment',
        err: toSafeError('Assessment Redis connection failed'),
      },
      'Assessment Redis connection failed'
    )
    throw new Error('Assessment Redis connection failed')
  }
}

// initialize and start server
await initializeService()

server.listen(PORT, () => {
  logger.info(
    {
      event: 'service.started',
      port: PORT,
      assessment: process.env.ASSESSMENT_MODE === 'true',
    },
    'Response API is ready'
  )
})
