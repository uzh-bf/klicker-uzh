import { verifyJWT } from '@klicker-uzh/util'
import { randomUUID } from 'crypto'
import { createServer, IncomingMessage, ServerResponse } from 'http'
import { Redis } from 'ioredis'
import { hatchet } from './hatchet-client.js'

const redis = new Redis({
  family: 4,
  host: process.env.REDIS_HOST,
  password: process.env.REDIS_PASS ?? '',
  port: Number(process.env.REDIS_PORT) ?? 6379,
  tls: process.env.REDIS_TLS ? {} : undefined,
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

  const { response, sessionId, instanceId } = payload
  if (!response || !sessionId || typeof instanceId === 'undefined') {
    return badRequest(
      req,
      res,
      'Missing required fields: response, sessionId, instanceId'
    )
  }

  const cookie =
    typeof req.headers['cookie'] === 'string'
      ? req.headers['cookie']
      : undefined

  const message = {
    messageId: randomUUID(),
    sessionId: String(sessionId),
    instanceId: String(instanceId),
    response: response, // pass through as-is; worker validates
    cookie,
    responseTimestamp: Date.now(),
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

  await hatchet.events.push(eventName, message)
  return sendJson(req, res, 200, { status: 'ok' })
}

async function handleAddAssessmentResponse(
  req: IncomingMessage,
  res: ServerResponse
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

  const { response, sessionId, instanceId, correlationId } = payload
  if (
    !response ||
    !sessionId ||
    typeof instanceId === 'undefined' ||
    !correlationId
  ) {
    return badRequest(
      req,
      res,
      'Missing required fields: response, sessionId, instanceId, correlationId'
    )
  }

  // TODO: validate correlationId?

  // check if there already exists an entry in the votes table with the given correlationId
  redis
    .hget(`lq:${sessionId}:i:${instanceId}:votes`, correlationId)
    .then((existing) => {
      if (existing && existing === 'true') {
        console.log(
          `Participant with correlationId ${correlationId} already answered instance ${instanceId} in session ${sessionId}`
        )
        hatchet.events.push('create-audit-log-entry', {
          correlationId,
          info: `[AddResponse Assessment] Participant with correlationId ${correlationId} already tried to answer instance ${instanceId} in session ${sessionId} again.`,
        })

        // TODO: should we return a bad request or a success message, because the answer is already there?
        return badRequest(req, res, 'Response already recorded')
      }
    })

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

  // TODO: add some verification mechanism that student did not set a regular participant cookie as their assessment cookie
  // check if the assessment cookie is present and valid
  const user = parsedCookies['next-auth.participant-session-token']
    ? await verifyJWT(
        parsedCookies['next-auth.participant-session-token'],
        process.env.APP_SECRET as string
      )
    : null
  const isAssessmentCookieValid = !!user && user.role === 'PARTICIPANT'

  if (!isAssessmentCookieValid) {
    return sendJson(req, res, 401, {
      error: 'Missing or invalid assessment cookie',
    })
  }

  const message = {
    correlationId,
    participantId: user.sub,
    sessionId: String(sessionId),
    instanceId: String(instanceId),
    response, // pass through as-is; worker validates
    responseTimestamp: Date.now(),
  }

  // start the processing of an assessment response
  console.log(
    `Pushing event ${'response-received:assessment'} with payload`,
    message
  )

  await hatchet.events.push('response-received:assessment', message)
  return sendJson(req, res, 200, { status: 'ok' })
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

server.listen(PORT, () => {
  console.log(`[response-api] Listening on http://localhost:${PORT}`)
})
