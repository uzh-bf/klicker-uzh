import type { NextApiRequest, NextApiResponse } from 'next'
import crypto from 'node:crypto'
import type { AppLogger } from './base'
import { getLogger } from './base'

export interface RequestLoggerContext {
  context?: string
}

export interface RequestLoggerResult {
  logger: AppLogger
  requestId: string
}

function extractRequestId(req: NextApiRequest): string {
  const header = req.headers['x-request-id']
  if (Array.isArray(header)) return header[0] ?? ''
  return header ?? ''
}

export function createRequestLogger(
  req: NextApiRequest,
  { context }: RequestLoggerContext = {}
): RequestLoggerResult {
  const incomingRequestId = extractRequestId(req)
  const requestId =
    incomingRequestId || `na-${crypto.randomBytes(6).toString('hex')}`

  const logger = getLogger().child({
    requestId,
    ...(context ? { context } : {}),
    method: req.method,
    url: req.url,
  })

  return { logger, requestId }
}

export type ApiHandler<T = unknown> = (
  req: NextApiRequest,
  res: NextApiResponse<T>
) => unknown | Promise<unknown>

export function withRequestLogging<T>(
  handler: ApiHandler<T>,
  context: RequestLoggerContext = {}
): ApiHandler<T> {
  return async function handlerWithLogging(req, res) {
    const { logger, requestId } = createRequestLogger(req, context)
    ;(req as any).logger = logger
    ;(req as any).requestId = requestId

    logger.info({ ua: req.headers['user-agent'] }, 'request:start')

    res.once('finish', () => {
      logger.info({ statusCode: res.statusCode }, 'request:finish')
    })

    try {
      return await handler(req, res)
    } catch (error) {
      logger.error({ err: error }, 'request:error')
      throw error
    }
  }
}
