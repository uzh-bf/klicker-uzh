import { KBResourceStatus, type PrismaClient } from '@klicker-uzh/prisma/client'
import { signKBIngestionWebhook } from '@klicker-uzh/util'
import { timingSafeEqual } from 'node:crypto'

export { signKBIngestionWebhook } from '@klicker-uzh/util'

const SIGNATURE_MAX_AGE_SECONDS = 300
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

type WebhookHeaders = Record<string, string | string[] | undefined>

type KBIngestionWebhookPayload = {
  resourceId: string
  ingestionAttemptId: string
  status:
    | typeof KBResourceStatus.PROCESSING
    | typeof KBResourceStatus.READY
    | typeof KBResourceStatus.FAILED
  statusMessage?: string
}

type KBIngestionWebhookResult = {
  statusCode: number
  body: { ok: true } | { error: string }
}

function getHeader(headers: WebhookHeaders, name: string) {
  const value = headers[name]
  return typeof value === 'string' ? value : undefined
}

function parsePayload(rawBody: Buffer): KBIngestionWebhookPayload | null {
  let value: unknown
  try {
    value = JSON.parse(rawBody.toString('utf8'))
  } catch {
    return null
  }

  if (!value || typeof value !== 'object' || Array.isArray(value)) return null

  const payload = value as Record<string, unknown>
  if (
    typeof payload.resourceId !== 'string' ||
    !UUID_PATTERN.test(payload.resourceId) ||
    typeof payload.ingestionAttemptId !== 'string' ||
    !UUID_PATTERN.test(payload.ingestionAttemptId) ||
    (payload.status !== KBResourceStatus.PROCESSING &&
      payload.status !== KBResourceStatus.READY &&
      payload.status !== KBResourceStatus.FAILED) ||
    (payload.statusMessage !== undefined &&
      typeof payload.statusMessage !== 'string')
  ) {
    return null
  }

  return {
    resourceId: payload.resourceId,
    ingestionAttemptId: payload.ingestionAttemptId,
    status: payload.status,
    ...(payload.statusMessage === undefined
      ? {}
      : { statusMessage: payload.statusMessage }),
  }
}

export async function handleKBIngestionWebhook({
  prisma,
  rawBody,
  headers,
}: {
  prisma: PrismaClient
  rawBody: Buffer
  headers: WebhookHeaders
}): Promise<KBIngestionWebhookResult> {
  const secret = process.env.KB_WEBHOOK_SECRET
  if (!secret) {
    return { statusCode: 503, body: { error: 'Service unavailable' } }
  }

  const timestampHeader = getHeader(headers, 'x-kb-timestamp')
  const signatureHeader = getHeader(headers, 'x-kb-signature')
  if (
    !timestampHeader ||
    !/^\d+$/.test(timestampHeader) ||
    !signatureHeader ||
    !/^[a-f\d]{64}$/i.test(signatureHeader)
  ) {
    return { statusCode: 401, body: { error: 'Unauthorized' } }
  }

  const timestamp = Number(timestampHeader)
  const now = Math.floor(Date.now() / 1000)
  if (
    !Number.isSafeInteger(timestamp) ||
    Math.abs(now - timestamp) > SIGNATURE_MAX_AGE_SECONDS
  ) {
    return { statusCode: 401, body: { error: 'Unauthorized' } }
  }

  const expectedSignature = signKBIngestionWebhook({
    rawBody,
    secret,
    timestamp: timestampHeader,
  })['x-kb-signature']
  const expectedBuffer = Buffer.from(expectedSignature, 'hex')
  const providedBuffer = Buffer.from(signatureHeader, 'hex')
  if (
    expectedBuffer.length !== providedBuffer.length ||
    !timingSafeEqual(expectedBuffer, providedBuffer)
  ) {
    return { statusCode: 401, body: { error: 'Unauthorized' } }
  }

  const payload = parsePayload(rawBody)
  if (!payload) {
    return { statusCode: 400, body: { error: 'Invalid request' } }
  }

  const allowedSources: KBResourceStatus[] = [
    KBResourceStatus.QUEUED,
    KBResourceStatus.PROCESSING,
  ]

  await prisma.kBResource.updateMany({
    where: {
      id: payload.resourceId,
      ingestionAttemptId: payload.ingestionAttemptId,
      status: { in: allowedSources },
    },
    data: {
      status: payload.status,
      statusMessage: payload.statusMessage ?? null,
      ...(payload.status === KBResourceStatus.READY
        ? { ingestedAt: new Date() }
        : {}),
    },
  })

  return { statusCode: 200, body: { ok: true } }
}
