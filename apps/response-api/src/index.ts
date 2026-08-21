import { hatchetClient } from '@klicker-uzh/hatchet'
import { prisma } from '@klicker-uzh/prisma'
import {
  Prisma,
  ResponseCorrectness,
  UserLoginScope,
} from '@klicker-uzh/prisma/client'
import { verifyJWT, type JWTPayload } from '@klicker-uzh/util'
import { randomUUID } from 'crypto'
import { createServer, IncomingMessage, ServerResponse } from 'http'
import { Redis } from 'ioredis'
import { createHash } from 'node:crypto'

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

async function handleAddResponse(req: IncomingMessage, res: ServerResponse) {
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
  console.log(`Pushing event ${eventName} with payload`, message)

  await hatchetClient.events.push(eventName, message)
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

  const instance = await prisma.elementInstance.findUnique({
    where: {
      id: Number(instanceId),
      elementBlock: { liveQuizId: String(liveQuizId) },
    },
    select: {
      id: true,
      elementBlock: { select: { execution: true, liveQuizId: true } },
    },
  })

  const elementBlock = instance?.elementBlock
  if (!elementBlock) {
    return badRequest(req, res, 'invalid_submission')
  }

  // Serialize acceptance with correction-audience snapshots. The snapshot
  // acquires the same quiz-level lock before reading acceptedAt markers.
  const acceptance = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw(
      Prisma.sql`
        SELECT pg_advisory_xact_lock(
          hashtextextended(${`assessment-audience:${liveQuizId}`}, 0)
        )
      `
    )

    const existingResponse = await tx.liveQuizResponse.findUnique({
      where: {
        instanceId_elementBlockExecution_participantId: {
          instanceId: instance.id,
          elementBlockExecution: elementBlock.execution,
          participantId: user.sub,
        },
      },
      select: { id: true, correctionOnly: true, correlationId: true },
    })

    if (existingResponse && !existingResponse.correctionOnly) {
      return { status: 'duplicate' as const }
    }

    if (
      existingResponse?.correlationId &&
      existingResponse.correlationId !== correlationId
    ) {
      return { status: 'duplicate' as const }
    }

    if (existingResponse) {
      await tx.liveQuizResponse.update({
        where: { id: existingResponse.id },
        data: {
          acceptedAt: { set: new Date() },
          correlationId,
        },
      })
      return { status: 'retry' as const }
    }

    await tx.liveQuizResponse.create({
      data: {
        submittedAt: new Date(responseTimestamp),
        acceptedAt: new Date(),
        correlationId,
        timeSpent: -1,
        correctness: ResponseCorrectness.CORRECT,
        basePoints: 0,
        correctnessPoints: 0,
        bonusPoints: 0,
        correctionOnly: true,
        elementBlockExecution: elementBlock.execution,
        instance: { connect: { id: instance.id } },
        participant: { connect: { id: user.sub } },
      },
    })

    return { status: 'accepted' as const }
  })

  if (acceptance.status === 'duplicate') {
    hatchetClient.events.push('create-audit-log-entry', {
      correlationId,
      info: `[AddResponse Assessment] Participant with correlationId ${correlationId} tried to answer instance ${instanceId} in live quiz ${liveQuizId} again.`,
    })

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

  // Start the processing workflow and wait for persistence plus the pending
  // Redis effect. A failed workflow is retryable; it must never be reported as
  // a successful submission.
  console.log('Starting assessment response workflow with payload', message)

  try {
    await hatchetClient.runAndWait(
      'process-assessment-response-workflow',
      message
    )
  } catch (error) {
    try {
      await hatchetClient.events.push('create-audit-log-entry', {
        correlationId,
        info: `[ERROR] [AddResponse Assessment] Failed to complete response processing workflow for correlationId ${correlationId}: ${error}`,
      })
    } catch (loggingError) {
      // TODO: send error directly to audit-logging service through network request
      console.error('Failed to push create-audit-log-entry event', {
        originalError: error,
        loggingError,
      })
    }

    return sendJson(req, res, 503, {
      error: 'response_processing_unavailable',
      responseTimestamp,
    })
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

    // add response endpoint
    if (url.pathname === '/AddResponse' && req.method === 'POST') {
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

  console.log('All connections established successfully')
}

// initialize and start server
await initializeService()

server.listen(PORT, () => {
  console.log(`[response-api] Ready and listening on http://localhost:${PORT}`)
})
