import {
  KBIngestionStatus,
  KBResourceStatus,
  type PrismaClient,
} from '@klicker-uzh/prisma/client'
import { createKBIngestionWebhookSignature } from '@klicker-uzh/util'
import { timingSafeEqual } from 'node:crypto'

export { signKBIngestionWebhook } from '@klicker-uzh/util'

const SIGNATURE_MAX_AGE_SECONDS = 300
const MAX_RESOURCE_VERSION = 2_147_483_647
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
const SHA256_PATTERN = /^[a-f0-9]{64}$/
const CANONICAL_TIMESTAMP_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/
const EVENT_TYPES = [
  'resource.processing_started',
  'resource.processing_progress',
  'resource.processing_succeeded',
  'resource.processing_failed',
  'resource.subresources_updated',
  'kb.metrics_updated',
] as const

type WebhookHeaders = Record<string, string | string[] | undefined>
type OperationStatusEventType = (typeof EVENT_TYPES)[number]

type OperationStatusEvent = {
  eventId: string
  eventType: OperationStatusEventType
  occurredAt: string
  operation_id: string
  external_resource_id: string
  resource_version: number
  serving: {
    active_resource_version: number | null
    active_sha256: string | null
  }
  error_code: string | null
  statusDetail: string | null
  correlation_id: string
}

type KBIngestionWebhookResult = {
  statusCode: number
  body: { ok: true } | { error: string }
}

function getHeader(headers: WebhookHeaders, name: string) {
  const value = headers[name]
  return typeof value === 'string' ? value : undefined
}

function hasExactKeys(value: Record<string, unknown>, keys: string[]) {
  const actualKeys = Object.keys(value).sort()
  const expectedKeys = [...keys].sort()
  return (
    actualKeys.length === expectedKeys.length &&
    actualKeys.every((key, index) => key === expectedKeys[index])
  )
}

function isString(value: unknown, minLength: number, maxLength: number) {
  return (
    typeof value === 'string' &&
    value.length >= minLength &&
    value.length <= maxLength
  )
}

function isResourceVersion(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isSafeInteger(value) &&
    value > 0 &&
    value <= MAX_RESOURCE_VERSION
  )
}

function isNullableResourceVersion(value: unknown): value is number | null {
  return value === null || isResourceVersion(value)
}

function isNullableSha256(value: unknown): value is string | null {
  return (
    value === null || (typeof value === 'string' && SHA256_PATTERN.test(value))
  )
}

function isCanonicalTimestamp(value: unknown): value is string {
  if (typeof value !== 'string' || !CANONICAL_TIMESTAMP_PATTERN.test(value)) {
    return false
  }
  const parsed = new Date(value)
  return (
    Number.isFinite(parsed.getTime()) &&
    parsed.toISOString().replace('.000Z', 'Z') === value
  )
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(',')}]`
  }
  if (value !== null && typeof value === 'object') {
    const record = value as Record<string, unknown>
    return `{${Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`)
      .join(',')}}`
  }
  return JSON.stringify(value) ?? 'null'
}

function parsePayload(rawBody: Buffer): OperationStatusEvent | null {
  let value: unknown
  try {
    value = JSON.parse(rawBody.toString('utf8'))
  } catch {
    return null
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null

  const payload = value as Record<string, unknown>
  if (
    !hasExactKeys(payload, [
      'eventId',
      'eventType',
      'occurredAt',
      'operation_id',
      'external_resource_id',
      'resource_version',
      'serving',
      'error_code',
      'statusDetail',
      'correlation_id',
    ]) ||
    typeof payload.eventId !== 'string' ||
    !UUID_PATTERN.test(payload.eventId) ||
    !EVENT_TYPES.includes(payload.eventType as OperationStatusEventType) ||
    !isCanonicalTimestamp(payload.occurredAt) ||
    !isString(payload.operation_id, 1, 255) ||
    !isString(payload.external_resource_id, 1, 512) ||
    !isResourceVersion(payload.resource_version) ||
    !payload.serving ||
    typeof payload.serving !== 'object' ||
    Array.isArray(payload.serving) ||
    !hasExactKeys(payload.serving as Record<string, unknown>, [
      'active_resource_version',
      'active_sha256',
    ]) ||
    !isNullableResourceVersion(
      (payload.serving as Record<string, unknown>).active_resource_version
    ) ||
    !isNullableSha256(
      (payload.serving as Record<string, unknown>).active_sha256
    ) ||
    (payload.error_code !== null && !isString(payload.error_code, 0, 128)) ||
    (payload.statusDetail !== null &&
      !isString(payload.statusDetail, 0, 512)) ||
    !isString(payload.correlation_id, 1, 255)
  ) {
    return null
  }

  const parsed = payload as OperationStatusEvent
  if (Buffer.from(canonicalJson(parsed), 'utf8').compare(rawBody) !== 0) {
    return null
  }
  return parsed
}

function signatureMatches({
  rawBody,
  signature,
  timestamp,
  secrets,
}: {
  rawBody: Buffer
  signature: string
  timestamp: string
  secrets: string[]
}) {
  const provided = Buffer.from(signature, 'hex')
  let matches = false
  for (const secret of secrets) {
    const expected = Buffer.from(
      createKBIngestionWebhookSignature({
        rawBody,
        secret,
        timestamp,
      }),
      'hex'
    )
    matches =
      (expected.length === provided.length &&
        timingSafeEqual(expected, provided)) ||
      matches
  }
  return matches
}

function transitionForEvent(payload: OperationStatusEvent) {
  switch (payload.eventType) {
    case 'resource.processing_started':
    case 'resource.processing_progress':
      return {
        resourceStatus: KBResourceStatus.PROCESSING,
        runStatus: KBIngestionStatus.PROCESSING,
        statusMessage: payload.statusDetail,
        finishedAt: undefined,
      }
    case 'resource.processing_succeeded':
      return {
        resourceStatus: KBResourceStatus.READY,
        runStatus: KBIngestionStatus.SUCCEEDED,
        statusMessage: payload.statusDetail,
        finishedAt: new Date(payload.occurredAt),
      }
    case 'resource.processing_failed':
      return {
        resourceStatus: KBResourceStatus.FAILED,
        runStatus: KBIngestionStatus.FAILED,
        statusMessage:
          payload.statusDetail ?? 'The ingestion operation failed.',
        finishedAt: new Date(payload.occurredAt),
      }
    case 'resource.subresources_updated':
    case 'kb.metrics_updated':
      return null
  }
}

export async function handleKBIngestionWebhook({
  prisma,
  rawBody,
  headers,
  env = process.env,
  now = () => new Date(),
}: {
  prisma: PrismaClient
  rawBody: Buffer
  headers: WebhookHeaders
  env?: NodeJS.ProcessEnv
  now?: () => Date
}): Promise<KBIngestionWebhookResult> {
  const currentSecret = env.KB_WEBHOOK_SECRET
  if (!currentSecret) {
    return { statusCode: 503, body: { error: 'Service unavailable' } }
  }
  const secrets = [
    currentSecret,
    ...(env.KB_WEBHOOK_PREVIOUS_SECRET ? [env.KB_WEBHOOK_PREVIOUS_SECRET] : []),
  ]

  const eventIdHeader = getHeader(headers, 'x-ingestion-event-id')
  const eventTypeHeader = getHeader(headers, 'x-ingestion-event-type')
  const timestampHeader = getHeader(headers, 'x-ingestion-timestamp')
  const signatureHeader = getHeader(headers, 'x-ingestion-signature')
  if (
    !eventIdHeader ||
    !UUID_PATTERN.test(eventIdHeader) ||
    !eventTypeHeader ||
    !EVENT_TYPES.includes(eventTypeHeader as OperationStatusEventType) ||
    !timestampHeader ||
    !/^(0|[1-9]\d*)$/.test(timestampHeader) ||
    !signatureHeader ||
    !/^[a-f\d]{64}$/.test(signatureHeader)
  ) {
    return { statusCode: 401, body: { error: 'Unauthorized' } }
  }

  const timestamp = Number(timestampHeader)
  const currentTimestamp = Math.floor(now().getTime() / 1000)
  if (
    !Number.isSafeInteger(timestamp) ||
    Math.abs(currentTimestamp - timestamp) > SIGNATURE_MAX_AGE_SECONDS ||
    !signatureMatches({
      rawBody,
      signature: signatureHeader,
      timestamp: timestampHeader,
      secrets,
    })
  ) {
    return { statusCode: 401, body: { error: 'Unauthorized' } }
  }

  const payload = parsePayload(rawBody)
  if (
    !payload ||
    payload.eventId !== eventIdHeader ||
    payload.eventType !== eventTypeHeader ||
    !UUID_PATTERN.test(payload.external_resource_id)
  ) {
    return { statusCode: 400, body: { error: 'Invalid request' } }
  }

  const transition = transitionForEvent(payload)
  await prisma.$transaction(async (tx) => {
    const resource = await tx.kBResource.findFirst({
      where: {
        id: payload.external_resource_id,
        resourceVersion: payload.resource_version,
        externalOperationId: payload.operation_id,
        ingestionAttemptId: { not: null },
        status: {
          in: [KBResourceStatus.QUEUED, KBResourceStatus.PROCESSING],
        },
      },
      select: {
        ingestionAttemptId: true,
        contentSha256: true,
      },
    })
    if (!resource?.ingestionAttemptId) {
      return
    }

    const servingMatchesCurrent =
      payload.serving.active_resource_version === payload.resource_version &&
      payload.serving.active_sha256 !== null &&
      payload.serving.active_sha256 === resource.contentSha256
    const servingState = {
      activeResourceVersion: payload.serving.active_resource_version,
      activeContentSha256: payload.serving.active_sha256,
    }

    if (!transition) {
      const run = await tx.kBIngestionRun.findUnique({
        where: { id: resource.ingestionAttemptId },
        select: { status: true },
      })
      await tx.kBResource.updateMany({
        where: {
          id: payload.external_resource_id,
          resourceVersion: payload.resource_version,
          externalOperationId: payload.operation_id,
          ingestionAttemptId: resource.ingestionAttemptId,
          status: {
            in: [KBResourceStatus.QUEUED, KBResourceStatus.PROCESSING],
          },
        },
        data:
          servingMatchesCurrent && run?.status === KBIngestionStatus.SUCCEEDED
            ? {
                ...servingState,
                status: KBResourceStatus.READY,
                statusMessage: null,
                errorCode: null,
                ingestedAt: new Date(payload.occurredAt),
              }
            : servingState,
      })
      return
    }

    const resourceStatus =
      payload.eventType === 'resource.processing_succeeded' &&
      !servingMatchesCurrent
        ? KBResourceStatus.PROCESSING
        : transition.resourceStatus
    const resourceUpdate = await tx.kBResource.updateMany({
      where: {
        id: payload.external_resource_id,
        resourceVersion: payload.resource_version,
        externalOperationId: payload.operation_id,
        ingestionAttemptId: resource.ingestionAttemptId,
        status: {
          in: [KBResourceStatus.QUEUED, KBResourceStatus.PROCESSING],
        },
      },
      data: {
        ...servingState,
        status: resourceStatus,
        statusMessage: transition.statusMessage,
        errorCode: payload.error_code,
        ...(resourceStatus === KBResourceStatus.READY
          ? { ingestedAt: new Date(payload.occurredAt) }
          : {}),
      },
    })
    if (resourceUpdate.count !== 1) {
      return
    }

    const sourceRunStatuses =
      transition.runStatus === KBIngestionStatus.SUCCEEDED
        ? [
            KBIngestionStatus.QUEUED,
            KBIngestionStatus.PROCESSING,
            KBIngestionStatus.SUCCEEDED,
          ]
        : [KBIngestionStatus.QUEUED, KBIngestionStatus.PROCESSING]
    const runUpdate = await tx.kBIngestionRun.updateMany({
      where: {
        id: resource.ingestionAttemptId,
        resourceId: payload.external_resource_id,
        resourceVersion: payload.resource_version,
        status: { in: sourceRunStatuses },
      },
      data: {
        status: transition.runStatus,
        statusMessage: transition.statusMessage,
        errorCode: payload.error_code,
        ...(payload.eventType === 'resource.processing_started'
          ? { startedAt: new Date(payload.occurredAt) }
          : {}),
        ...(transition.finishedAt ? { finishedAt: transition.finishedAt } : {}),
      },
    })
    if (runUpdate.count !== 1) {
      throw new Error('KB ingestion run transition could not be correlated')
    }
  })

  return { statusCode: 200, body: { ok: true } }
}
