// TODO: ugly AI implementation, to be replaced with a go service for optimized performance

import { hatchetClient } from '@klicker-uzh/hatchet'
import { randomUUID } from 'crypto'
import { createServer, IncomingMessage, ServerResponse } from 'http'

const PORT = Number(process.env.PORT ?? 7078)
const CORS_ALLOWED_ORIGINS = (process.env.CORS_ALLOWED_ORIGINS || '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean)

/**
 * Sets CORS headers for the response.
 * @param req - The incoming message.
 * @param res - The server response.
 */
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

/**
 * Sends a JSON response.
 * @param req - The incoming message.
 * @param res - The server response.
 * @param status - The HTTP status code.
 * @param body - The response body.
 */
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

/**
 * Sends a 404 Not Found response.
 * @param req - The incoming message.
 * @param res - The server response.
 */
function notFound(req: IncomingMessage, res: ServerResponse) {
  sendJson(req, res, 404, { error: 'Not found' })
}

/**
 * Sends a 400 Bad Request response.
 * @param req - The incoming message.
 * @param res - The server response.
 * @param message - The error message.
 */
function badRequest(
  req: IncomingMessage,
  res: ServerResponse,
  message?: string
) {
  sendJson(req, res, 400, { error: message ?? 'Bad request' })
}

/**
 * Reads the request body and parses it as JSON.
 * @param req - The incoming message.
 * @returns The parsed JSON payload.
 */
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

/**
 * Handles the /AddResponse endpoint.
 * @param req - The incoming message.
 * @param res - The server response.
 */
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

  const message = {
    messageId: randomUUID(),
    sessionId: String(sessionId),
    instanceId: String(instanceId),
    response: response, // pass through as-is; worker validates
    cookie,
    responseTimestamp: Date.now(),
  }

  const eventName = cookie
    ? 'response-received:authenticated'
    : 'response-received:anonymous'
  console.log(`Pushing event ${eventName} with payload`, message)
  await hatchetClient.event.push(eventName, message)

  return sendJson(req, res, 200, { status: 'ok' })
}

const server = createServer(async (req, res) => {
  try {
    // Handle CORS preflight requests
    if (req.method === 'OPTIONS') {
      setCorsHeaders(req, res)
      res.statusCode = 204
      return res.end()
    }

    const url = new URL(req.url || '/', 'http://localhost')

    // Health check endpoint
    if (
      req.method === 'GET' &&
      (url.pathname === '/healthz' || url.pathname === '/')
    ) {
      return sendJson(req, res, 200, { status: 'ok' })
    }

    // Route for adding a response
    if (url.pathname === '/AddResponse' && req.method === 'POST') {
      return await handleAddResponse(req, res)
    }

    // Fallback to 404 Not Found
    return notFound(req, res)
  } catch (err: any) {
    console.error('Server error', err)
    return sendJson(req, res, 500, { error: 'Internal server error' })
  }
})

server.listen(PORT, () => {
  console.log(`[response-api] Listening on http://localhost:${PORT}`)
})
