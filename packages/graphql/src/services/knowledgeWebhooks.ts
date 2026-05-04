import {
  KBIngestionStatus,
  KBStatus,
  Prisma,
  PrismaClient,
} from '@klicker-uzh/prisma/client'
import type { KBWebhookPayload } from '@klicker-uzh/types'
import crypto from 'node:crypto'

export type KBWebhookDestination = 'INGESTION' | 'GRAPH'

export type KBWebhookEventType =
  | 'resource.created'
  | 'resource.updated'
  | 'resource.deleted'
  | 'catalog.resource.created'
  | 'catalog.resource.updated'
  | 'catalog.resource.deleted'

export interface SignKBWebhookPayloadInput {
  secret: string
  timestamp: string
  rawBody: string
}

export function signKBWebhookPayload({
  secret,
  timestamp,
  rawBody,
}: SignKBWebhookPayloadInput) {
  return crypto
    .createHmac('sha256', secret)
    .update(`${timestamp}.${rawBody}`)
    .digest('hex')
}

export interface VerifyKBWebhookSignatureInput
  extends SignKBWebhookPayloadInput {
  signature?: string | null
  toleranceSeconds: number
}

export function verifyKBWebhookSignature({
  secret,
  timestamp,
  rawBody,
  signature,
  toleranceSeconds,
}: VerifyKBWebhookSignatureInput) {
  if (!signature || !timestamp) return false
  if (!/^[0-9a-f]{64}$/i.test(signature)) return false

  const timestampSeconds = Number(timestamp)
  if (!Number.isFinite(timestampSeconds)) return false

  const nowSeconds = Math.floor(Date.now() / 1000)
  if (Math.abs(nowSeconds - timestampSeconds) > toleranceSeconds) return false

  const expected = signKBWebhookPayload({ secret, timestamp, rawBody })
  const expectedBuffer = Buffer.from(expected, 'hex')
  const signatureBuffer = Buffer.from(signature, 'hex')
  if (expectedBuffer.length !== signatureBuffer.length) return false

  return crypto.timingSafeEqual(expectedBuffer, signatureBuffer)
}

function getWebhookTimeoutMs() {
  const timeout = Number(process.env.KB_WEBHOOK_TIMEOUT_MS)
  return Number.isFinite(timeout) && timeout > 0 ? timeout : 5000
}

function getWebhookSignatureToleranceSeconds() {
  const tolerance = Number(process.env.KB_WEBHOOK_SIGNATURE_TOLERANCE_SECONDS)
  return Number.isFinite(tolerance) && tolerance > 0 ? tolerance : 300
}

function getDestinationConfig(destination: KBWebhookDestination) {
  if (destination === 'INGESTION') {
    return {
      url: process.env.KB_INGESTION_WEBHOOK_URL,
      secret: process.env.KB_INGESTION_WEBHOOK_SECRET,
    }
  }

  return {
    url: process.env.KB_GRAPH_WEBHOOK_URL,
    secret: process.env.KB_GRAPH_WEBHOOK_SECRET,
  }
}

function shouldPersistPayload() {
  const env = process.env.NODE_ENV ?? 'development'
  return env !== 'production'
}

export interface DispatchKBWebhookInput {
  destination: KBWebhookDestination
  eventType: KBWebhookEventType
  payload: KBWebhookPayload
}

export interface DispatchKBWebhookResult {
  ok: boolean
  eventId: string
  statusCode?: number
  error?: string
}

export async function dispatchKBWebhook({
  destination,
  eventType,
  payload,
}: DispatchKBWebhookInput): Promise<DispatchKBWebhookResult> {
  const eventId = crypto.randomUUID()
  const payloadWithEvent: KBWebhookPayload = {
    ...payload,
    eventId,
    eventType,
    occurredAt: new Date().toISOString(),
  }

  const { url, secret } = getDestinationConfig(destination)
  if (!url || !secret) {
    return {
      ok: false,
      eventId,
      error: 'Webhook destination is not configured',
    }
  }

  const rawBody = JSON.stringify(payloadWithEvent)
  const timestamp = String(Math.floor(Date.now() / 1000))
  const signature = signKBWebhookPayload({ secret, timestamp, rawBody })
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), getWebhookTimeoutMs())

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Klicker-Event-Id': eventId,
        'X-Klicker-Event-Type': eventType,
        'X-Klicker-Timestamp': timestamp,
        'X-Klicker-Signature': signature,
      },
      body: rawBody,
      signal: controller.signal,
    })

    if (!response.ok) {
      return {
        ok: false,
        eventId,
        statusCode: response.status,
        error: `Webhook responded with HTTP ${response.status}`,
      }
    }

    return { ok: true, eventId, statusCode: response.status }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return { ok: false, eventId, error: message }
  } finally {
    clearTimeout(timeout)
  }
}

type IncomingKBWebhookPayload = KBWebhookPayload & {
  kbId?: string
  resourceId?: string
  ingestionRunId?: string
  statusDetail?: string
  externalResourceId?: string
  chunkCount?: number
  sizeBytes?: number
}

const INCOMING_RESOURCE_STATUS: Record<string, KBStatus | undefined> = {
  'resource.processing_started': KBStatus.INDEXING,
  'resource.processing_progress': KBStatus.INDEXING,
  'resource.processing_succeeded': KBStatus.READY,
  'resource.processing_failed': KBStatus.ERROR,
  'resource.subresources_updated': KBStatus.READY,
}

const INCOMING_RUN_STATUS: Record<string, KBIngestionStatus | undefined> = {
  'resource.processing_started': KBIngestionStatus.RUNNING,
  'resource.processing_succeeded': KBIngestionStatus.SUCCEEDED,
  'resource.processing_failed': KBIngestionStatus.FAILED,
}

function getStringHeader(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}

function getDirectPayloadString(
  payload: IncomingKBWebhookPayload,
  key: string
) {
  const direct = payload[key as keyof IncomingKBWebhookPayload]
  if (typeof direct === 'string') return direct

  return null
}

function getRecordString(
  record: Record<string, unknown> | undefined,
  key: string
) {
  const value = record?.[key]
  return typeof value === 'string' ? value : null
}

export function resolveIncomingKBWebhookIds(payload: IncomingKBWebhookPayload) {
  return {
    kbId:
      getDirectPayloadString(payload, 'kbId') ??
      getRecordString(payload.kb, 'id'),
    resourceId:
      getDirectPayloadString(payload, 'resourceId') ??
      getRecordString(payload.resource, 'id'),
    ingestionRunId:
      getDirectPayloadString(payload, 'ingestionRunId') ??
      getRecordString(payload.ingestionRun, 'id'),
  }
}

export interface HandleKBIngestionWebhookInput {
  prisma: PrismaClient
  rawBody: string
  headers: Record<string, string | string[] | undefined>
}

export async function handleKBIngestionWebhook({
  prisma,
  rawBody,
  headers,
}: HandleKBIngestionWebhookInput) {
  const secret = process.env.KB_INGESTION_WEBHOOK_SECRET
  if (!secret) {
    return {
      statusCode: 401,
      body: { ok: false, error: 'Webhook secret is not configured' },
    }
  }

  const eventId = getStringHeader(headers['x-klicker-event-id'])
  const eventType = getStringHeader(headers['x-klicker-event-type'])
  const timestamp = getStringHeader(headers['x-klicker-timestamp'])
  const signature = getStringHeader(headers['x-klicker-signature'])

  if (!eventId || !eventType) {
    return { statusCode: 400, body: { ok: false, error: 'Missing event id' } }
  }

  const validSignature = verifyKBWebhookSignature({
    secret,
    timestamp: timestamp ?? '',
    rawBody,
    signature,
    toleranceSeconds: getWebhookSignatureToleranceSeconds(),
  })

  if (!validSignature) {
    return { statusCode: 401, body: { ok: false, error: 'Invalid signature' } }
  }

  const existingEvent = await prisma.kBWebhookInbox.findUnique({
    where: { eventId },
  })
  if (existingEvent) {
    return { statusCode: 200, body: { ok: true, duplicate: true } }
  }

  let payload: IncomingKBWebhookPayload
  try {
    payload = JSON.parse(rawBody) as IncomingKBWebhookPayload
  } catch {
    return { statusCode: 400, body: { ok: false, error: 'Malformed payload' } }
  }

  const { kbId, resourceId, ingestionRunId } =
    resolveIncomingKBWebhookIds(payload)

  if (!resourceId && !kbId) {
    return {
      statusCode: 400,
      body: { ok: false, error: 'Missing KB or resource identifier' },
    }
  }

  const resource = resourceId
    ? await prisma.kBResource.findUnique({
        where: { id: resourceId },
        select: { id: true, kbId: true, metadata: true },
      })
    : null

  if (resourceId && !resource) {
    return { statusCode: 404, body: { ok: false, error: 'Resource not found' } }
  }

  const resolvedKbId = resource?.kbId ?? kbId

  if (!resolvedKbId) {
    return { statusCode: 404, body: { ok: false, error: 'Resource not found' } }
  }

  const kb = await prisma.kB.findUnique({
    where: { id: resolvedKbId },
    select: { id: true },
  })
  if (!kb) {
    return {
      statusCode: 404,
      body: { ok: false, error: 'Knowledge base not found' },
    }
  }

  if (ingestionRunId) {
    const ingestionRun = await prisma.kBIngestionRun.findFirst({
      where: {
        id: ingestionRunId,
        kbId: resolvedKbId,
        resourceId: resource?.id ?? undefined,
      },
      select: { id: true },
    })

    if (!ingestionRun) {
      return {
        statusCode: 404,
        body: { ok: false, error: 'Ingestion run not found' },
      }
    }
  }

  const persistPayload = shouldPersistPayload()

  await prisma.$transaction(async (tx) => {
    await tx.kBWebhookInbox.create({
      data: {
        eventId,
        eventType,
        payload: persistPayload
          ? (payload as Prisma.InputJsonObject)
          : Prisma.DbNull,
      },
    })

    if (resource) {
      const status = INCOMING_RESOURCE_STATUS[eventType]
      const nextMetadata = mergeResourceMetadata(resource.metadata, payload)

      await tx.kBResource.update({
        where: { id: resource.id },
        data: {
          ...(status ? { status } : {}),
          statusDetail: payload.statusDetail ?? undefined,
          externalResourceId: payload.externalResourceId ?? undefined,
          metadata:
            nextMetadata != null
              ? (nextMetadata as Prisma.InputJsonObject)
              : undefined,
          lastIndexedAt:
            eventType === 'resource.processing_succeeded'
              ? new Date()
              : undefined,
        },
      })
    }

    const runStatus = INCOMING_RUN_STATUS[eventType]
    if (ingestionRunId && runStatus) {
      await tx.kBIngestionRun.updateMany({
        where: { id: ingestionRunId },
        data: {
          status: runStatus,
          startedAt:
            runStatus === KBIngestionStatus.RUNNING ? new Date() : undefined,
          finishedAt:
            runStatus === KBIngestionStatus.SUCCEEDED ||
            runStatus === KBIngestionStatus.FAILED
              ? new Date()
              : undefined,
          errorMessage:
            eventType === 'resource.processing_failed'
              ? String(payload.error?.message ?? payload.statusDetail ?? '')
              : undefined,
        },
      })
    }

    if (eventType === 'kb.metrics_updated') {
      await tx.kB.update({
        where: { id: resolvedKbId },
        data: {
          chunkCount:
            typeof payload.kb?.chunkCount === 'number'
              ? payload.kb.chunkCount
              : undefined,
          sizeBytes:
            typeof payload.kb?.sizeBytes === 'number'
              ? BigInt(payload.kb.sizeBytes)
              : undefined,
          lastIndexedAt: new Date(),
        },
      })
    }
  })

  return { statusCode: 200, body: { ok: true } }
}

function mergeResourceMetadata(
  existing: unknown,
  payload: IncomingKBWebhookPayload
) {
  const isPlainObject =
    existing != null && typeof existing === 'object' && !Array.isArray(existing)
  const base = isPlainObject ? { ...(existing as Record<string, unknown>) } : {}

  if (typeof payload.chunkCount === 'number') {
    base.chunkCount = payload.chunkCount
  }
  if (typeof payload.sizeBytes === 'number') {
    base.sizeBytes = payload.sizeBytes
  }
  if (Array.isArray(payload.subresources)) {
    base.subresources = payload.subresources
  }

  return Object.keys(base).length > 0 ? base : null
}
