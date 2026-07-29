import { hatchetClient } from '@klicker-uzh/hatchet'
import { prisma } from '@klicker-uzh/prisma'
import {
  LiveQuizResponseCollectionMode,
  UserLoginScope,
} from '@klicker-uzh/prisma/client'
import {
  CORRELATED_RESPONSE_EVENT,
  createLiveQuizRespondentToken,
  getLiveQuizRespondentCookieName,
  resolveLiveQuizResponseIdentity,
  validateStudentResponse,
  verifyJWT,
  type AcceptedCorrelatedResponseIdentity,
  type CorrelatedResponseClaim,
  type CorrelatedResponseDeliveryMessage,
  type CorrelatedResponseEventMessage,
  type JWTPayload,
  type LiveQuizResponseEventMessage,
  type LiveQuizResponseIdentity,
} from '@klicker-uzh/util'
import { randomUUID } from 'crypto'
import { createServer, IncomingMessage, ServerResponse } from 'http'
import { Redis } from 'ioredis'
import { createHash } from 'node:crypto'
import {
  dispatchPendingCorrelatedResponses,
  encryptCorrelatedResponseEvent,
  getCorrelatedResponseAdmission,
  hasJsonContentType,
  isAllowedCorsOrigin,
  prepareCorrelatedResponseSubmission,
  registerPendingCorrelatedResponse,
  resolveResponseCollectionMode,
  responseEndpointMatchesCollectionMode,
  serializeLiveQuizRespondentCookie,
} from './correlatedResponses.js'

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
const CORRELATED_OUTBOX_POLL_INTERVAL_MS = 5_000

function setCorsHeaders(req: IncomingMessage, res: ServerResponse) {
  const origin = req.headers.origin
  if (
    origin &&
    isAllowedCorsOrigin({ origin, allowedOrigins: CORS_ALLOWED_ORIGINS })
  ) {
    res.setHeader('Access-Control-Allow-Origin', origin)
    res.setHeader('Vary', 'Origin')
    res.setHeader('Access-Control-Allow-Credentials', 'true')
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Cookie')
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

function getResponseIdentityConfig() {
  const secret = process.env.APP_SECRET
  const issuer = process.env.APP_ORIGIN_API
  if (!secret || !issuer) {
    throw new Error(
      'APP_SECRET and APP_ORIGIN_API are required for correlated live quiz responses'
    )
  }

  return { secret, issuer }
}

async function ensureCorrelatedResponseIdentity({
  req,
  res,
  liveQuizId,
}: {
  req: IncomingMessage
  res: ServerResponse
  liveQuizId: string
}): Promise<LiveQuizResponseIdentity> {
  const { secret, issuer } = getResponseIdentityConfig()
  const cookieHeader =
    typeof req.headers.cookie === 'string' ? req.headers.cookie : undefined
  const existingIdentity = await resolveLiveQuizResponseIdentity({
    cookieHeader,
    liveQuizId,
    secret,
    issuer,
  })
  if (existingIdentity) {
    return existingIdentity
  }

  const respondentId = randomUUID()
  const token = await createLiveQuizRespondentToken({
    respondentId,
    liveQuizId,
    secret,
    issuer,
  })
  const identity: LiveQuizResponseIdentity = {
    kind: 'anonymous',
    id: respondentId,
    liveQuizId,
    token,
    cookieName: getLiveQuizRespondentCookieName(liveQuizId),
  }

  res.setHeader(
    'Set-Cookie',
    serializeLiveQuizRespondentCookie({
      token,
      liveQuizId,
      secure:
        process.env.NODE_ENV === 'production' &&
        process.env.COOKIE_DOMAIN !== '127.0.0.1',
    })
  )
  return identity
}

async function resolveCorrelatedResponseIdentity({
  req,
  liveQuizId,
}: {
  req: IncomingMessage
  liveQuizId: string
}) {
  const { secret, issuer } = getResponseIdentityConfig()

  return resolveLiveQuizResponseIdentity({
    cookieHeader:
      typeof req.headers.cookie === 'string' ? req.headers.cookie : undefined,
    liveQuizId,
    secret,
    issuer,
  })
}

async function handleInitializeLiveQuizResponseIdentity(
  req: IncomingMessage,
  res: ServerResponse
) {
  if (process.env.ASSESSMENT_MODE === 'true') {
    return sendJson(req, res, 200, { status: 'not_required' })
  }

  const payload = await readBody(req)
  if (!payload || typeof payload.liveQuizId !== 'string') {
    return badRequest(req, res, 'Missing required field: liveQuizId')
  }

  const admission = await getCorrelatedResponseAdmission({
    database: prisma,
    liveQuizId: payload.liveQuizId,
    cookieHeader:
      typeof req.headers.cookie === 'string' ? req.headers.cookie : undefined,
  })
  if (admission === 'not_found') {
    return sendJson(req, res, 404, { error: 'Live quiz not found' })
  }
  if (admission === 'not_required') {
    return sendJson(req, res, 200, { status: 'not_required' })
  }
  if (admission === 'pin_required') {
    return sendJson(req, res, 403, { error: 'Live quiz PIN required' })
  }
  await ensureCorrelatedResponseIdentity({
    req,
    res,
    liveQuizId: payload.liveQuizId,
  })
  return sendJson(req, res, 200, { status: 'ready' })
}

async function handleAddResponse(
  req: IncomingMessage,
  res: ServerResponse,
  endpointMode: 'aggregate' | 'correlated'
) {
  let payload: any
  try {
    payload = await readBody(req)
  } catch (err: any) {
    return badRequest(req, res, err.message)
  }

  if (!payload || typeof payload !== 'object') {
    return badRequest(req, res, 'Body must be a JSON object')
  }

  const { response, liveQuizId, instanceId } = payload
  if (!response || !liveQuizId || typeof instanceId === 'undefined') {
    return badRequest(
      req,
      res,
      'Missing required fields: response, liveQuizId, instanceId'
    )
  }

  const liveQuizIdString = String(liveQuizId)
  const instanceIdString = String(instanceId)
  const rawCookie =
    typeof req.headers['cookie'] === 'string'
      ? req.headers['cookie']
      : undefined

  const responseTimestamp = Date.now()
  const messageId = randomUUID()
  const instanceInfoKey = `lq:${liveQuizIdString}:i:${instanceIdString}:info`
  const instanceInfo = await redis.hgetall(instanceInfoKey)
  const responseCollectionMode = await resolveResponseCollectionMode({
    cachedMode: instanceInfo.responseCollectionMode,
    liveQuizId: liveQuizIdString,
    lookupMode: async (id) =>
      (
        await prisma.liveQuiz.findUnique({
          where: { id },
          select: { responseCollectionMode: true },
        })
      )?.responseCollectionMode ?? null,
  })
  const isCorrelated =
    responseCollectionMode === LiveQuizResponseCollectionMode.CORRELATED_EXPORT
  if (
    !responseEndpointMatchesCollectionMode({
      endpointMode,
      responseCollectionMode,
    })
  ) {
    return sendJson(req, res, 409, {
      error: 'Response endpoint does not match live quiz collection mode',
    })
  }

  let cookie: string | undefined
  let eventName: string
  let acceptedIdentity: AcceptedCorrelatedResponseIdentity | undefined
  let claim: CorrelatedResponseClaim | undefined

  if (isCorrelated) {
    const admission = await getCorrelatedResponseAdmission({
      database: prisma,
      liveQuizId: liveQuizIdString,
      cookieHeader: rawCookie,
    })
    if (admission === 'not_found' || admission === 'not_required') {
      return sendJson(req, res, 404, { error: 'Live quiz not found' })
    }
    if (admission === 'pin_required') {
      return sendJson(req, res, 403, { error: 'Live quiz PIN required' })
    }
    const identity = await resolveCorrelatedResponseIdentity({
      req,
      liveQuizId: liveQuizIdString,
    })
    if (!identity) {
      return sendJson(req, res, 401, {
        error: 'Live quiz response identity required',
      })
    }

    let restrictions: unknown
    try {
      restrictions = instanceInfo.restrictions
        ? JSON.parse(instanceInfo.restrictions)
        : undefined
    } catch (error) {
      throw new Error(
        `Invalid response restrictions for live quiz ${liveQuizIdString}, instance ${instanceIdString}: ${String(error)}`
      )
    }
    const validation = validateStudentResponse({
      type: instanceInfo.type,
      response,
      restrictions:
        typeof restrictions === 'object' && restrictions !== null
          ? restrictions
          : undefined,
    })
    if (!validation.valid) {
      return badRequest(req, res, validation.message)
    }

    const preparation = await prepareCorrelatedResponseSubmission({
      database: prisma,
      identity,
      liveQuizId: liveQuizIdString,
      instanceId: instanceIdString,
      blockExecution: instanceInfo.blockExecution,
    })
    if (preparation.status === 'invalid_metadata') {
      return badRequest(req, res, 'Invalid correlated response metadata')
    }
    if (preparation.status === 'invalid_identity') {
      return sendJson(req, res, 401, {
        error: 'Live quiz response identity is no longer active',
      })
    }
    if (preparation.status === 'duplicate') {
      return sendJson(req, res, 208, {
        status: 'response_recorded_before',
        responseTimestamp,
      })
    }

    acceptedIdentity = preparation.acceptedIdentity
    claim = preparation.claim
    eventName = CORRELATED_RESPONSE_EVENT
  } else {
    // Preserve aggregate-mode behavior: forward participant cookies based on
    // their presence and let the worker validate them.
    if (rawCookie) {
      const parts = rawCookie.split(';').map((part) => part.trim())
      const participantPair = parts.find((part) =>
        part.startsWith('participant_token=')
      )
      const temporaryPair = parts.find((part) =>
        part.startsWith('temporary_participant_token=')
      )
      const forwarded = [participantPair, temporaryPair].filter(
        (pair): pair is string => Boolean(pair)
      )
      cookie = forwarded.length > 0 ? forwarded.join('; ') : undefined
    }

    const isAuthenticatedParticipant =
      cookie &&
      (cookie.includes('participant_token=') ||
        cookie.includes('temporary_participant_token='))
    eventName = isAuthenticatedParticipant
      ? 'response-received:authenticated'
      : 'response-received:anonymous'
  }

  const message: LiveQuizResponseEventMessage = {
    messageId,
    sessionId: liveQuizIdString,
    instanceId: instanceIdString,
    response, // pass through as-is; worker validates
    cookie,
    responseTimestamp,
  }
  let eventMessage:
    | LiveQuizResponseEventMessage
    | CorrelatedResponseDeliveryMessage = message

  if (isCorrelated) {
    if (!claim || !acceptedIdentity) {
      throw new Error('Missing accepted correlated response identity')
    }
    const correlatedMessage: CorrelatedResponseEventMessage = {
      messageId,
      sessionId: liveQuizIdString,
      instanceId: instanceIdString,
      response,
      responseTimestamp,
      acceptedIdentity,
      correlatedClaim: claim,
      instanceInfo,
    }
    eventMessage = { messageId }
    let pendingResponseRegistration: 'registered' | 'duplicate' | 'not_found'
    pendingResponseRegistration = await registerPendingCorrelatedResponse({
      database: prisma,
      liveQuizId: liveQuizIdString,
      messageId,
      responseKey: claim.key,
      eventPayload: encryptCorrelatedResponseEvent({
        message: correlatedMessage,
        secret: getResponseIdentityConfig().secret,
      }),
    })
    if (pendingResponseRegistration !== 'registered') {
      return pendingResponseRegistration === 'duplicate'
        ? sendJson(req, res, 208, {
            status: 'response_recorded_before',
            responseTimestamp,
          })
        : sendJson(req, res, 404, { error: 'Live quiz not found' })
    }
  }

  console.log(`Pushing event ${eventName}`, {
    messageId,
    sessionId: liveQuizIdString,
    instanceId: instanceIdString,
    responseTimestamp,
  })

  try {
    await hatchetClient.events.push(eventName, eventMessage)
  } catch (error) {
    if (isCorrelated) {
      console.error('Immediate correlated response delivery failed', {
        messageId,
        error,
      })
      return sendJson(req, res, 200, {
        status: 'queued',
        responseTimestamp,
      })
    }
    throw error
  }

  return sendJson(req, res, 200, { status: 'ok', responseTimestamp })
}

async function handleAddAssessmentResponse(
  req: IncomingMessage,
  res: ServerResponse
) {
  // track the time where the response was received
  const responseTimestamp = Date.now()

  let payload: any
  try {
    payload = await readBody(req)
  } catch (err: any) {
    hatchetClient.events.push('create-audit-log-entry', {
      info: `[ERROR] [AddResponse Assessment] Failed to read request body: ${err.message} for request ${JSON.stringify(req)}`,
    })
    return badRequest(req, res, err.message)
  }

  if (!payload || typeof payload !== 'object') {
    hatchetClient.events.push('create-audit-log-entry', {
      info: `[ERROR] [AddResponse Assessment] Invalid request body: ${JSON.stringify(payload)}`,
    })
    return badRequest(req, res, 'submission_failure')
  }

  const { correlationKey, response, liveQuizId, instanceId } = payload
  if (
    !response ||
    !liveQuizId ||
    typeof instanceId === 'undefined' ||
    !correlationKey
  ) {
    hatchetClient.events.push('create-audit-log-entry', {
      info: `[ERROR] [AddResponse Assessment] Missing required fields in request body: ${JSON.stringify(
        payload
      )}`,
    })

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
  } catch (err) {
    hatchetClient.events.push('create-audit-log-entry', {
      info: `[ERROR] [AddResponse Assessment] Failed to verify correlationKey: ${err} for response ${JSON.stringify(
        payload
      )}`,
    })
    return badRequest(req, res, 'invalid_submission')
  }

  if (
    !correlationData ||
    correlationData.instanceId !== instanceId ||
    correlationData.liveQuizId !== liveQuizId
  ) {
    hatchetClient.events.push('create-audit-log-entry', {
      info: `[ERROR] [AddResponse Assessment] Invalid correlationKey in request body: ${correlationKey} for response ${JSON.stringify(payload)}`,
    })
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
  } catch (err) {
    hatchetClient.events.push('create-audit-log-entry', {
      info: `[ERROR] [AddResponse Assessment] Failed to verify assessment cookie JWT: ${err} for response ${JSON.stringify(
        payload
      )}`,
    })
    return sendJson(req, res, 401, { error: 'invalid_assessment_cookie' })
  }

  const isAssessmentCookieValid =
    !!user && user.role === 'PARTICIPANT' && user.scope === UserLoginScope.EDUID
  if (!user || !user.sub || !isAssessmentCookieValid) {
    hatchetClient.events.push('create-audit-log-entry', {
      info: `[ERROR] [AddResponse Assessment] Missing or invalid assessment cookie: ${cookies} for response ${JSON.stringify(payload)}`,
    })
    return sendJson(req, res, 401, {
      error: 'missing_invalid_assessment_cookie',
    })
  }

  // set up correlation id as an MD5 hash of correlationKey and participantId to obtain tracking id
  const combinedCorrelationKey = `${correlationKey}:${user.sub}`
  const MD5 = createHash('md5')
  MD5.update(combinedCorrelationKey)
  const correlationId = MD5.digest('hex')

  // audit log entry for received response
  hatchetClient.events.push('create-audit-log-entry', {
    correlationId,
    info: `[AddResponse Assessment] Response-API received response for instance ${instanceId} in live quiz ${liveQuizId} from participant ${user.sub}: ${JSON.stringify(
      response
    )}`,
  })

  // check if there already exists an entry in the votes table with the given correlationId
  const votes = await assessmentRedis.hget(
    `lq:${liveQuizId}:i:${instanceId}:votes`,
    correlationId
  )
  if (votes) {
    console.log(
      `Participant with correlationId ${correlationId} already answered instance ${instanceId} in live quiz ${liveQuizId}`
    )
    hatchetClient.events.push('create-audit-log-entry', {
      correlationId,
      info: `[AddResponse Assessment] Participant with correlationId ${correlationId} tried to answer instance ${instanceId} in live quiz ${liveQuizId} again.`,
    })

    // show success message that response was already recorded before and that first response counts
    return sendJson(req, res, 208, {
      status: 'response_recorded_before',
      responseTimestamp,
    })
  }

  const message = {
    correlationId,
    participantId: user.sub,
    liveQuizId: String(liveQuizId),
    instanceId: String(instanceId),
    response, // pass through as-is; worker validates
    responseTimestamp,
  }

  // start the processing of an assessment response
  console.log(
    `Pushing event ${'response-received:assessment'} with payload`,
    message
  )

  try {
    await hatchetClient.events.push('response-received:assessment', message)
  } catch (error) {
    try {
      await hatchetClient.events.push('create-audit-log-entry', {
        correlationId,
        info: `[ERROR] [AddResponse Assessment] Failed to push response-received:assessment event for correlationId ${correlationId}: ${error}`,
      })
    } catch (loggingError) {
      // TODO: send error directly to audit-logging service through network request
      console.error('Failed to push create-audit-log-entry event', {
        originalError: error,
        loggingError,
      })
    }
  }

  return sendJson(req, res, 200, {
    status: 'response_submitted',
    responseTimestamp,
  })
}

const server = createServer(async (req, res) => {
  try {
    if (
      !isAllowedCorsOrigin({
        origin: req.headers.origin,
        allowedOrigins: CORS_ALLOWED_ORIGINS,
      })
    ) {
      return sendJson(req, res, 403, { error: 'Origin not allowed' })
    }

    // handle CORS preflight requests
    if (req.method === 'OPTIONS') {
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
      return sendJson(req, res, 200, { status: 'ok' })
    }

    if (
      req.method === 'POST' &&
      !hasJsonContentType(
        typeof req.headers['content-type'] === 'string'
          ? req.headers['content-type']
          : undefined
      )
    ) {
      return sendJson(req, res, 415, {
        error: 'Content-Type must be application/json',
      })
    }

    // add response endpoint
    if (url.pathname === '/AddResponse' && req.method === 'POST') {
      // if not in assessment mode, call standard processing logic
      if (process.env.ASSESSMENT_MODE === 'true') {
        return await handleAddAssessmentResponse(req, res)
      } else {
        // call the standard processing function, which will distinguish between authenticated and anonymous modes
        // if a valid cookie exists is not relevant at this point -> otherwise answers are simply treated as anonymous
        return await handleAddResponse(req, res, 'aggregate')
      }
    }

    if (
      url.pathname === '/AddCorrelatedResponse' &&
      req.method === 'POST' &&
      process.env.ASSESSMENT_MODE !== 'true'
    ) {
      return await handleAddResponse(req, res, 'correlated')
    }

    if (
      url.pathname === '/InitializeLiveQuizResponseIdentity' &&
      req.method === 'POST'
    ) {
      return await handleInitializeLiveQuizResponseIdentity(req, res)
    }

    // fallback to 404 Not Found
    return sendJson(req, res, 404, { error: 'Not found' })
  } catch (err: any) {
    console.error('Server error', err)
    return sendJson(req, res, 500, { error: 'Internal server error' })
  }
})

async function initializeService() {
  console.log('Starting response-api service...')
  console.log(`Port: ${PORT}`)
  console.log(
    `Assessment mode: ${process.env.ASSESSMENT_MODE === 'true' ? 'enabled' : 'disabled'}`
  )
  console.log(`CORS origins: ${CORS_ALLOWED_ORIGINS.join(', ')}`)

  // test connection to Redis cache for standard responses
  console.log('Testing Redis (standard responses) connection...')
  try {
    await redis.ping()
    console.log('Redis connection established')
  } catch (error) {
    console.error('Failed to connect to Redis:', error)
    throw error
  }

  // test connection to Redis cache for assessment responses
  console.log('Testing Redis (assessment responses) connection...')
  try {
    await assessmentRedis.ping()
    console.log('Assessment Redis connection established')
  } catch (error) {
    console.error('Failed to connect to assessment Redis:', error)
    throw error
  }

  if (process.env.ASSESSMENT_MODE !== 'true') {
    const dispatchPending = async () => {
      const result = await dispatchPendingCorrelatedResponses({
        database: prisma,
        pushEvent: (eventName, message) =>
          hatchetClient.events.push(eventName, message),
      })
      if (result.failed > 0) {
        console.error('Correlated response outbox delivery failures', result)
      }
    }

    const scheduleNextDispatch = () => {
      const outboxTimer = setTimeout(() => {
        void dispatchPending()
          .catch((error) => {
            console.error('Correlated response outbox dispatch failed', error)
          })
          .finally(scheduleNextDispatch)
      }, CORRELATED_OUTBOX_POLL_INTERVAL_MS)
      outboxTimer.unref()
    }

    void dispatchPending()
      .catch((error) => {
        console.error('Correlated response outbox dispatch failed', error)
      })
      .finally(scheduleNextDispatch)
  }

  console.log('All connections established successfully')
}

// initialize and start server
await initializeService()

server.listen(PORT, () => {
  console.log(`[response-api] Ready and listening on http://localhost:${PORT}`)
})
