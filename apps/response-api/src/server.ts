import { randomUUID } from 'node:crypto'
import { UserLoginScope } from '@klicker-uzh/prisma/client'
import type {
  AssessmentResponseCommand,
  AssessmentResponseReceipt,
} from '@klicker-uzh/types'
import type { JWTPayload } from '@klicker-uzh/util'
import { createServer, type IncomingMessage, type ServerResponse } from 'http'

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

type HatchetEventReceipt = {
  eventId: string
}

type PushEvent = (
  name: string,
  payload: unknown,
  options?: { additionalMetadata?: Record<string, string> }
) => Promise<HatchetEventReceipt>

type VerifyToken = (
  token: string,
  secret: string,
  options: { issuer?: string }
) => Promise<JWTPayload>

export interface ResponseServerDependencies {
  assessmentMode: boolean
  allowedOrigins: string[]
  appSecret: string
  assessmentApiOrigin?: string
  authOrigin?: string
  pushEvent: PushEvent
  verifyToken: VerifyToken
  now?: () => Date
}

export function validateResponseServerConfig(
  dependencies: Pick<
    ResponseServerDependencies,
    | 'assessmentMode'
    | 'allowedOrigins'
    | 'appSecret'
    | 'assessmentApiOrigin'
    | 'authOrigin'
  >
) {
  if (!dependencies.assessmentMode) return

  const missing = [
    dependencies.appSecret.trim() === '' ? 'APP_SECRET' : undefined,
    dependencies.assessmentApiOrigin?.trim()
      ? undefined
      : 'APP_ORIGIN_ASSESSMENT_API',
    dependencies.authOrigin?.trim() ? undefined : 'APP_ORIGIN_AUTH',
    dependencies.allowedOrigins.length === 0
      ? 'CORS_ALLOWED_ORIGINS'
      : undefined,
  ].filter((value): value is string => value !== undefined)

  if (missing.length > 0) {
    throw new Error(
      `Assessment response API configuration is incomplete: ${missing.join(', ')}`
    )
  }
}

function setCorsHeaders(
  req: IncomingMessage,
  res: ServerResponse,
  allowedOrigins: string[]
) {
  const origin = req.headers.origin
  if (origin && origin !== 'null' && allowedOrigins.includes(origin)) {
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
  allowedOrigins: string[],
  status: number,
  body: unknown
) {
  setCorsHeaders(req, res, allowedOrigins)
  const json = JSON.stringify(body)
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Content-Length', Buffer.byteLength(json))
  res.end(json)
}

function badRequest(
  req: IncomingMessage,
  res: ServerResponse,
  allowedOrigins: string[],
  message?: string
) {
  sendJson(req, res, allowedOrigins, 400, {
    error: message ?? 'Bad request',
  })
}

async function readBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = []
  let size = 0
  await new Promise<void>((resolve, reject) => {
    req.on('data', (chunk: Buffer) => {
      chunks.push(chunk)
      size += chunk.length
      if (size > 1_000_000) {
        reject(new Error('Payload too large'))
        req.destroy()
      }
    })
    req.on('end', () => resolve())
    req.on('error', reject)
  })

  const body = Buffer.concat(chunks).toString('utf-8')
  if (!body) return null
  try {
    return JSON.parse(body)
  } catch {
    throw new Error('Invalid JSON')
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function parseCookies(header: string | undefined): Record<string, string> {
  if (header === undefined) return {}
  return Object.fromEntries(
    header.split(';').flatMap((entry) => {
      const separator = entry.indexOf('=')
      if (separator < 1) return []
      const key = entry.slice(0, separator).trim()
      const value = entry.slice(separator + 1)
      return key === '' || value === '' ? [] : [[key, value]]
    })
  )
}

async function handleAddResponse(
  req: IncomingMessage,
  res: ServerResponse,
  dependencies: ResponseServerDependencies
) {
  let payload: unknown
  try {
    payload = await readBody(req)
  } catch (error) {
    return badRequest(
      req,
      res,
      dependencies.allowedOrigins,
      error instanceof Error ? error.message : undefined
    )
  }

  if (!isObject(payload)) {
    return badRequest(
      req,
      res,
      dependencies.allowedOrigins,
      'Body must be a JSON object'
    )
  }

  const { response, liveQuizId, instanceId } = payload
  if (
    response === undefined ||
    response === null ||
    !liveQuizId ||
    instanceId === undefined
  ) {
    return badRequest(
      req,
      res,
      dependencies.allowedOrigins,
      'Missing required fields: response, liveQuizId, instanceId'
    )
  }

  const parsedCookies = parseCookies(
    typeof req.headers.cookie === 'string' ? req.headers.cookie : undefined
  )
  const forwardedCookies = [
    parsedCookies.participant_token === undefined
      ? undefined
      : `participant_token=${parsedCookies.participant_token}`,
    parsedCookies.temporary_participant_token === undefined
      ? undefined
      : `temporary_participant_token=${parsedCookies.temporary_participant_token}`,
  ].filter((value): value is string => value !== undefined)
  const cookie =
    forwardedCookies.length === 0 ? undefined : forwardedCookies.join('; ')
  const responseTimestamp = dependencies.now?.().getTime() ?? Date.now()
  const message = {
    messageId: randomUUID(),
    sessionId: String(liveQuizId),
    instanceId: String(instanceId),
    response,
    cookie,
    responseTimestamp,
  }
  const eventName =
    cookie === undefined
      ? 'response-received:anonymous'
      : 'response-received:authenticated'

  console.info('Forwarding live-quiz response', {
    eventName,
    messageId: message.messageId,
    liveQuizId: message.sessionId,
    instanceId: message.instanceId,
  })
  await dependencies.pushEvent(eventName, message)
  return sendJson(req, res, dependencies.allowedOrigins, 200, {
    status: 'ok',
    responseTimestamp,
  })
}

async function handleAddAssessmentResponse(
  req: IncomingMessage,
  res: ServerResponse,
  dependencies: ResponseServerDependencies
) {
  const receivedAt = dependencies.now?.() ?? new Date()
  let payload: unknown
  try {
    payload = await readBody(req)
  } catch (error) {
    return badRequest(
      req,
      res,
      dependencies.allowedOrigins,
      error instanceof Error ? error.message : undefined
    )
  }

  if (!isObject(payload)) {
    return badRequest(
      req,
      res,
      dependencies.allowedOrigins,
      'submission_failure'
    )
  }

  const { correlationKey, response, liveQuizId, instanceId, submissionId } =
    payload
  if (
    response === undefined ||
    response === null ||
    typeof liveQuizId !== 'string' ||
    !UUID_PATTERN.test(liveQuizId) ||
    typeof instanceId !== 'number' ||
    !Number.isSafeInteger(instanceId) ||
    instanceId <= 0 ||
    typeof correlationKey !== 'string' ||
    correlationKey === '' ||
    typeof submissionId !== 'string'
  ) {
    return badRequest(req, res, dependencies.allowedOrigins, 'missing_response')
  }
  if (!UUID_PATTERN.test(submissionId)) {
    return badRequest(
      req,
      res,
      dependencies.allowedOrigins,
      'invalid_submission_id'
    )
  }

  let correlationData: JWTPayload
  try {
    correlationData = await dependencies.verifyToken(
      correlationKey,
      dependencies.appSecret,
      { issuer: dependencies.assessmentApiOrigin }
    )
  } catch {
    return badRequest(
      req,
      res,
      dependencies.allowedOrigins,
      'invalid_submission'
    )
  }

  if (
    correlationData.instanceId !== instanceId ||
    correlationData.liveQuizId !== liveQuizId
  ) {
    return badRequest(
      req,
      res,
      dependencies.allowedOrigins,
      'invalid_submission'
    )
  }

  const cookies = parseCookies(
    typeof req.headers.cookie === 'string' ? req.headers.cookie : undefined
  )
  const participantToken = cookies['next-auth.participant-session-token']
  let participant: JWTPayload | null = null
  try {
    participant = participantToken
      ? await dependencies.verifyToken(
          participantToken,
          dependencies.appSecret,
          { issuer: dependencies.authOrigin }
        )
      : null
  } catch {
    return sendJson(req, res, dependencies.allowedOrigins, 401, {
      error: 'invalid_assessment_cookie',
    })
  }

  if (
    participant?.sub === undefined ||
    participant.role !== 'PARTICIPANT' ||
    participant.scope !== UserLoginScope.EDUID ||
    !UUID_PATTERN.test(participant.sub)
  ) {
    return sendJson(req, res, dependencies.allowedOrigins, 401, {
      error: 'missing_invalid_assessment_cookie',
    })
  }

  const transportAttemptedAt = dependencies.now?.() ?? new Date()
  const message: AssessmentResponseCommand = {
    submissionId,
    correlationId: submissionId,
    participantId: participant.sub,
    liveQuizId,
    instanceId: String(instanceId),
    response,
    responseTimestamp: receivedAt.getTime(),
    receivedAt: receivedAt.toISOString(),
    transportAttemptedAt: transportAttemptedAt.toISOString(),
  }

  try {
    const receipt = await dependencies.pushEvent(
      'response-received:assessment',
      message,
      { additionalMetadata: { submissionId } }
    )
    if (receipt.eventId.trim() === '')
      throw new Error('Hatchet receipt has no event ID')
    const responseBody: AssessmentResponseReceipt = {
      status: 'response_submitted',
      submissionId,
      responseTimestamp: receivedAt.getTime(),
      hatchetEventId: receipt.eventId,
    }
    return sendJson(req, res, dependencies.allowedOrigins, 200, responseBody)
  } catch {
    console.error('Assessment submission transport failed', {
      submissionId,
      liveQuizId,
      instanceId: String(instanceId),
    })
    return sendJson(req, res, dependencies.allowedOrigins, 503, {
      error: 'submission_transport_unavailable',
      submissionId,
    })
  }
}

export function createResponseServer(dependencies: ResponseServerDependencies) {
  return createServer(async (req, res) => {
    try {
      if (req.method === 'OPTIONS') {
        setCorsHeaders(req, res, dependencies.allowedOrigins)
        res.statusCode = 204
        return res.end()
      }

      const url = new URL(req.url || '/', 'http://localhost')
      if (
        req.method === 'GET' &&
        (url.pathname === '/healthz' || url.pathname === '/')
      ) {
        return sendJson(req, res, dependencies.allowedOrigins, 200, {
          status: 'ok',
        })
      }
      if (url.pathname === '/AddResponse' && req.method === 'POST') {
        return dependencies.assessmentMode
          ? handleAddAssessmentResponse(req, res, dependencies)
          : handleAddResponse(req, res, dependencies)
      }
      return sendJson(req, res, dependencies.allowedOrigins, 404, {
        error: 'Not found',
      })
    } catch {
      console.error('Unhandled response API request failure')
      return sendJson(req, res, dependencies.allowedOrigins, 500, {
        error: 'Internal server error',
      })
    }
  })
}
