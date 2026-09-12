import { randomUUID } from 'node:crypto'
import { UserLoginScope } from '@klicker-uzh/prisma/client'
import { toSafeError } from '@klicker-uzh/logging/node'
import type {
  AssessmentResponseCommand,
  AssessmentResponseReceipt,
  HatchetLoggingContext,
} from '@klicker-uzh/types'
import type { JWTPayload } from '@klicker-uzh/util'
import { createServer, type IncomingMessage, type ServerResponse } from 'http'
import { beginNodeRequest, type NodeRequestLog } from './requestLogging.js'

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
  logger: NodeRequestLog['log']
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
  dependencies: ResponseServerDependencies,
  requestLog: NodeRequestLog
) {
  let payload: unknown
  try {
    payload = await readBody(req)
  } catch (error) {
    requestLog.log.info(
      { event: 'response.rejected', reason: 'invalid_json' },
      'Response rejected'
    )
    return badRequest(
      req,
      res,
      dependencies.allowedOrigins,
      error instanceof Error ? error.message : undefined
    )
  }

  if (!isObject(payload)) {
    requestLog.log.info(
      { event: 'response.rejected', reason: 'invalid_body' },
      'Response rejected'
    )
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
    requestLog.log.info(
      { event: 'response.rejected', reason: 'missing_fields' },
      'Response rejected'
    )
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
    loggingContext: {
      requestId: requestLog.context.requestId,
      correlationId: requestLog.context.correlationId,
    } satisfies HatchetLoggingContext,
  }
  const eventName =
    cookie === undefined
      ? 'response-received:anonymous'
      : 'response-received:authenticated'

  try {
    await dependencies.pushEvent(eventName, message)
  } catch {
    requestLog.log.error(
      {
        event: 'response.publish.failed',
        err: toSafeError('Hatchet response publish failed'),
      },
      'Hatchet response publish failed'
    )
    throw new Error('Hatchet response publish failed')
  }
  requestLog.log.info(
    { event: 'response.accepted', liveQuizId: message.sessionId, instanceId: message.instanceId },
    'Response accepted'
  )
  return sendJson(req, res, dependencies.allowedOrigins, 200, {
    status: 'ok',
    responseTimestamp,
  })
}

async function handleAddAssessmentResponse(
  req: IncomingMessage,
  res: ServerResponse,
  dependencies: ResponseServerDependencies,
  requestLog: NodeRequestLog
) {
  const receivedAt = dependencies.now?.() ?? new Date()
  let payload: unknown
  try {
    payload = await readBody(req)
  } catch (error) {
    requestLog.log.info(
      { event: 'response.rejected', reason: 'invalid_json' },
      'Assessment response rejected'
    )
    return badRequest(
      req,
      res,
      dependencies.allowedOrigins,
      error instanceof Error ? error.message : undefined
    )
  }

  if (!isObject(payload)) {
    requestLog.log.info(
      { event: 'response.rejected', reason: 'invalid_body' },
      'Assessment response rejected'
    )
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
    requestLog.log.info(
      { event: 'response.rejected', reason: 'missing_response' },
      'Assessment response rejected'
    )
    return badRequest(req, res, dependencies.allowedOrigins, 'missing_response')
  }
  if (!UUID_PATTERN.test(submissionId)) {
    requestLog.log.info(
      { event: 'response.rejected', reason: 'invalid_submission_id' },
      'Assessment response rejected'
    )
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
    requestLog.log.info(
      { event: 'response.rejected', reason: 'invalid_submission' },
      'Assessment response rejected'
    )
    return badRequest(
      req,
      res,
      dependencies.allowedOrigins,
      'invalid_submission'
    )
  }

  if (
    correlationData.instanceId !== instanceId ||
    correlationData.liveQuizId !== liveQuizId ||
    typeof correlationData.execution !== 'number' ||
    !Number.isSafeInteger(correlationData.execution) ||
    correlationData.execution < 0
  ) {
    requestLog.log.info(
      { event: 'response.rejected', reason: 'invalid_submission' },
      'Assessment response rejected'
    )
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
    requestLog.log.info(
      { event: 'response.rejected', reason: 'invalid_assessment_cookie' },
      'Assessment response rejected'
    )
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
    requestLog.log.info(
      { event: 'response.rejected', reason: 'missing_invalid_assessment_cookie' },
      'Assessment response rejected'
    )
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
    blockExecution: correlationData.execution,
    response,
    responseTimestamp: receivedAt.getTime(),
    receivedAt: receivedAt.toISOString(),
    transportAttemptedAt: transportAttemptedAt.toISOString(),
    loggingContext: {
      requestId: requestLog.context.requestId,
      correlationId: requestLog.context.correlationId,
    },
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
    requestLog.log.info(
      { event: 'response.accepted', liveQuizId, instanceId: String(instanceId) },
      'Assessment response accepted'
    )
    return sendJson(req, res, dependencies.allowedOrigins, 200, responseBody)
  } catch {
    requestLog.log.error(
      {
        event: 'response.publish.failed',
        err: toSafeError('Assessment submission transport failed'),
      },
      'Assessment submission transport failed'
    )
    return sendJson(req, res, dependencies.allowedOrigins, 503, {
      error: 'submission_transport_unavailable',
      submissionId,
    })
  }
}

const REQUEST_LOG_ROUTES = [
  '/AddResponse',
  '/AddAssessmentResponse',
  '/healthz',
  '/',
] as const

function resolveRequestLogRoute(
  pathname: string
): '/AddResponse' | '/AddAssessmentResponse' | '/healthz' | '/' | '/unmatched' {
  return (REQUEST_LOG_ROUTES as readonly string[]).includes(pathname)
    ? (pathname as '/AddResponse' | '/AddAssessmentResponse' | '/healthz' | '/')
    : '/unmatched'
}

export function createResponseServer(dependencies: ResponseServerDependencies) {
  return createServer(async (req, res) => {
    let requestLog: NodeRequestLog | undefined
    try {
      if (req.method === 'OPTIONS') {
        setCorsHeaders(req, res, dependencies.allowedOrigins)
        res.statusCode = 204
        return res.end()
      }

      requestLog = beginNodeRequest(
        req,
        res,
        dependencies.logger,
        resolveRequestLogRoute(new URL(req.url || '/', 'http://localhost').pathname)
      )
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
          ? handleAddAssessmentResponse(req, res, dependencies, requestLog)
          : handleAddResponse(req, res, dependencies, requestLog)
      }
      return sendJson(req, res, dependencies.allowedOrigins, 404, {
        error: 'Not found',
      })
    } catch {
      requestLog?.log.error(
        {
          event: 'http.request.failed',
          err: toSafeError('Unhandled response API request failure'),
        },
        'Unhandled response API request failure'
      )
      return sendJson(req, res, dependencies.allowedOrigins, 500, {
        error: 'Internal server error',
      })
    }
  })
}
