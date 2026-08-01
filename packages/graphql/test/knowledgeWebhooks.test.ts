import { prisma as prismaClient } from '@klicker-uzh/prisma'
import {
  KBIngestionOperation,
  KBIngestionStatus,
  KBResourceStatus,
  KBResourceType,
  type PrismaClient,
} from '@klicker-uzh/prisma/client'
import {
  handleKBIngestionWebhook,
  signKBIngestionWebhook,
} from '../src/services/knowledgeWebhooks.js'

const SECRET = 'kb-webhook-test-secret'
const PREVIOUS_SECRET = 'kb-webhook-previous-test-secret'
const OWNER_ID = 'c08036f0-5354-47dc-aac0-408a89c251a5'
const EVENT_ID = 'e8a1b2c3-d4e5-4f60-9a7b-8c9d0e1f2a3b'
const OTHER_EVENT_ID = 'f92f85a3-bbbc-47cb-8739-f93ed85bdce5'
const REFRESH_EVENT_ID = 'a2d2c4e8-8e04-49d7-9a5c-0cb485cf57c2'
const INGESTION_ATTEMPT_ID = 'e69e7cbd-c301-41d4-b653-bb645576d637'
const OPERATION_ID = 'op_01J2X8K3M9QZ4R7T6V5W1Y0BND'
const REFRESH_OPERATION_ID = 'op_01K2X8K3M9QZ4R7T6V5W1Y0BND'
const RESOURCE_VERSION = 3
const CONTENT_SHA256 =
  '9b74c9897bac770ffc029102a200c5de11ba9dbd0e0f28c991eb64b0fb54d96e'
const REFRESH_CONTENT_SHA256 = 'f'.repeat(64)
const OCCURRED_AT = '2026-07-12T14:04:52Z'

type EventType =
  | 'resource.processing_started'
  | 'resource.processing_progress'
  | 'resource.processing_succeeded'
  | 'resource.processing_failed'
  | 'resource.content_refreshed'
  | 'resource.subresources_updated'
  | 'kb.metrics_updated'

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

describe('KB ingestion webhook contract', () => {
  let prisma: PrismaClient
  let resourceId: string

  function event(
    eventType: EventType,
    overrides: Record<string, unknown> = {}
  ) {
    return {
      eventId: EVENT_ID,
      eventType,
      occurredAt: OCCURRED_AT,
      operation_id: OPERATION_ID,
      external_resource_id: resourceId,
      resource_version: RESOURCE_VERSION,
      serving: {
        active_resource_version:
          eventType === 'resource.processing_succeeded' ||
          eventType === 'resource.content_refreshed'
            ? RESOURCE_VERSION
            : null,
        active_sha256:
          eventType === 'resource.processing_succeeded' ||
          eventType === 'resource.content_refreshed'
            ? CONTENT_SHA256
            : null,
      },
      error_code:
        eventType === 'resource.processing_failed'
          ? 'source_fetch_failed'
          : null,
      statusDetail: null,
      correlation_id: INGESTION_ATTEMPT_ID,
      ...overrides,
    }
  }

  function createRequest(
    payload: Record<string, unknown>,
    {
      secret = SECRET,
      timestamp = Math.floor(Date.now() / 1000),
    }: { secret?: string; timestamp?: number | string } = {}
  ) {
    const rawBody = Buffer.from(canonicalJson(payload))
    return {
      rawBody,
      headers: signKBIngestionWebhook({
        eventId: String(payload.eventId),
        eventType: String(payload.eventType),
        rawBody,
        secret,
        timestamp,
      }),
    }
  }

  async function getResource() {
    return prisma.kBResource.findUniqueOrThrow({ where: { id: resourceId } })
  }

  async function getRun() {
    return prisma.kBIngestionRun.findUniqueOrThrow({
      where: { id: INGESTION_ATTEMPT_ID },
    })
  }

  async function getRunByExternalOperation(externalOperationId: string) {
    return prisma.kBIngestionRun.findFirstOrThrow({
      where: { resourceId, externalOperationId },
    })
  }

  beforeAll(async () => {
    prisma = prismaClient
  })

  beforeEach(async () => {
    await prisma.user.deleteMany({ where: { id: OWNER_ID } })
    await prisma.user.create({
      data: {
        id: OWNER_ID,
        email: 'kb-webhook@example.com',
        shortname: 'kb-webhook',
      },
    })
    const kb = await prisma.kB.create({
      data: { name: 'Webhook test KB', ownerId: OWNER_ID },
    })
    const resource = await prisma.kBResource.create({
      data: {
        kbId: kb.id,
        type: KBResourceType.URL,
        title: 'Webhook test resource',
        sourceUrl: 'https://example.com/resource',
        status: KBResourceStatus.QUEUED,
        ingestionAttemptId: INGESTION_ATTEMPT_ID,
        resourceVersion: RESOURCE_VERSION,
        contentSha256: CONTENT_SHA256,
        externalOperationId: OPERATION_ID,
      },
    })
    resourceId = resource.id
    await prisma.kBIngestionRun.create({
      data: {
        id: INGESTION_ATTEMPT_ID,
        resourceId,
        resourceVersion: RESOURCE_VERSION,
        contentSha256: CONTENT_SHA256,
        externalOperationId: OPERATION_ID,
      },
    })
  })

  afterEach(async () => {
    await prisma.user.deleteMany({ where: { id: OWNER_ID } })
  })

  afterAll(async () => {
    await prisma.$disconnect()
  })

  it('accepts the canonical processing-started event', async () => {
    const request = createRequest(event('resource.processing_started'))

    await expect(
      handleKBIngestionWebhook({
        prisma,
        ...request,
        env: { KB_WEBHOOK_SECRET: SECRET },
      })
    ).resolves.toEqual({ statusCode: 200, body: { ok: true } })
    await expect(getResource()).resolves.toMatchObject({
      status: KBResourceStatus.PROCESSING,
      statusMessage: null,
    })
    await expect(getRun()).resolves.toMatchObject({
      status: KBIngestionStatus.PROCESSING,
      startedAt: new Date(OCCURRED_AT),
    })
  })

  it('accepts progress and persists only its safe status detail', async () => {
    await prisma.kBResource.update({
      where: { id: resourceId },
      data: { status: KBResourceStatus.PROCESSING },
    })
    const request = createRequest(
      event('resource.processing_progress', {
        statusDetail: 'Extracting text',
      })
    )

    await handleKBIngestionWebhook({
      prisma,
      ...request,
      env: { KB_WEBHOOK_SECRET: SECRET },
    })

    await expect(getResource()).resolves.toMatchObject({
      status: KBResourceStatus.PROCESSING,
      statusMessage: 'Extracting text',
    })
    await expect(getRun()).resolves.toMatchObject({
      status: KBIngestionStatus.PROCESSING,
      statusMessage: 'Extracting text',
    })
  })

  it('marks the exact serving version and digest ready at occurredAt', async () => {
    await prisma.kBResource.update({
      where: { id: resourceId },
      data: { status: KBResourceStatus.PROCESSING },
    })
    const request = createRequest(event('resource.processing_succeeded'))

    await handleKBIngestionWebhook({
      prisma,
      ...request,
      env: { KB_WEBHOOK_SECRET: SECRET },
    })

    await expect(getResource()).resolves.toMatchObject({
      status: KBResourceStatus.READY,
      statusMessage: null,
      ingestedAt: new Date(OCCURRED_AT),
      activeResourceVersion: RESOURCE_VERSION,
      activeContentSha256: CONTENT_SHA256,
    })
    await expect(getRun()).resolves.toMatchObject({
      status: KBIngestionStatus.SUCCEEDED,
      finishedAt: new Date(OCCURRED_AT),
    })
  })

  it('marks a delete succeeded only when no resource remains served', async () => {
    await prisma.kBResource.update({
      where: { id: resourceId },
      data: {
        deletedAt: new Date(OCCURRED_AT),
        ingestionOperation: KBIngestionOperation.DELETE,
        contentSha256: null,
        activeResourceVersion: 2,
        activeContentSha256: 'a'.repeat(64),
      },
    })
    await prisma.kBIngestionRun.update({
      where: { id: INGESTION_ATTEMPT_ID },
      data: {
        operation: KBIngestionOperation.DELETE,
        contentSha256: null,
      },
    })
    const request = createRequest(
      event('resource.processing_succeeded', {
        serving: {
          active_resource_version: null,
          active_sha256: null,
        },
      })
    )

    await expect(
      handleKBIngestionWebhook({
        prisma,
        ...request,
        env: { KB_WEBHOOK_SECRET: SECRET },
      })
    ).resolves.toEqual({ statusCode: 200, body: { ok: true } })
    await expect(getResource()).resolves.toMatchObject({
      status: KBResourceStatus.READY,
      activeResourceVersion: null,
      activeContentSha256: null,
    })
    await expect(getRun()).resolves.toMatchObject({
      operation: KBIngestionOperation.DELETE,
      status: KBIngestionStatus.SUCCEEDED,
      finishedAt: new Date(OCCURRED_AT),
    })
  })

  it('records success while a different digest is still serving', async () => {
    const request = createRequest(
      event('resource.processing_succeeded', {
        serving: {
          active_resource_version: RESOURCE_VERSION,
          active_sha256: '0'.repeat(64),
        },
      })
    )

    await expect(
      handleKBIngestionWebhook({
        prisma,
        ...request,
        env: { KB_WEBHOOK_SECRET: SECRET },
      })
    ).resolves.toEqual({ statusCode: 200, body: { ok: true } })
    await expect(getResource()).resolves.toMatchObject({
      status: KBResourceStatus.PROCESSING,
      ingestedAt: null,
      activeResourceVersion: RESOURCE_VERSION,
      activeContentSha256: '0'.repeat(64),
    })
    await expect(getRun()).resolves.toMatchObject({
      status: KBIngestionStatus.SUCCEEDED,
      finishedAt: new Date(OCCURRED_AT),
    })
  })

  it('maps a failed event to a sanitized local failure', async () => {
    const request = createRequest(event('resource.processing_failed'))

    await handleKBIngestionWebhook({
      prisma,
      ...request,
      env: { KB_WEBHOOK_SECRET: SECRET },
    })

    await expect(getResource()).resolves.toMatchObject({
      status: KBResourceStatus.FAILED,
      statusMessage: 'The ingestion operation failed.',
      errorCode: 'source_fetch_failed',
      ingestedAt: null,
    })
    await expect(getRun()).resolves.toMatchObject({
      status: KBIngestionStatus.FAILED,
      errorCode: 'source_fetch_failed',
      finishedAt: new Date(OCCURRED_AT),
    })
  })

  it.each([
    'resource.subresources_updated',
    'kb.metrics_updated',
  ] satisfies EventType[])(
    'authenticates reserved %s events as successful no-ops',
    async (eventType) => {
      const request = createRequest(event(eventType))

      await expect(
        handleKBIngestionWebhook({
          prisma,
          ...request,
          env: { KB_WEBHOOK_SECRET: SECRET },
        })
      ).resolves.toEqual({ statusCode: 200, body: { ok: true } })
      await expect(getResource()).resolves.toMatchObject({
        status: KBResourceStatus.QUEUED,
      })
    }
  )

  it('marks a succeeded replacement ready when a later serving event cuts over', async () => {
    const succeeded = createRequest(
      event('resource.processing_succeeded', {
        serving: {
          active_resource_version: RESOURCE_VERSION - 1,
          active_sha256: 'a'.repeat(64),
        },
      })
    )
    await handleKBIngestionWebhook({
      prisma,
      ...succeeded,
      env: { KB_WEBHOOK_SECRET: SECRET },
    })
    await expect(getResource()).resolves.toMatchObject({
      status: KBResourceStatus.PROCESSING,
      activeResourceVersion: RESOURCE_VERSION - 1,
      activeContentSha256: 'a'.repeat(64),
    })

    const cutover = createRequest(
      event('resource.subresources_updated', {
        serving: {
          active_resource_version: RESOURCE_VERSION,
          active_sha256: CONTENT_SHA256,
        },
      })
    )
    await handleKBIngestionWebhook({
      prisma,
      ...cutover,
      env: { KB_WEBHOOK_SECRET: SECRET },
    })

    await expect(getResource()).resolves.toMatchObject({
      status: KBResourceStatus.READY,
      activeResourceVersion: RESOURCE_VERSION,
      activeContentSha256: CONTENT_SHA256,
      ingestedAt: new Date(OCCURRED_AT),
    })
  })

  it('records a platform refresh and advances only the serving identity', async () => {
    const candidateContentSha256 = 'c'.repeat(64)
    const candidateOperationId = 'op_01L2X8K3M9QZ4R7T6V5W1Y0BND'
    await prisma.kBResource.update({
      where: { id: resourceId },
      data: {
        status: KBResourceStatus.PROCESSING,
        resourceVersion: RESOURCE_VERSION + 1,
        contentSha256: candidateContentSha256,
        externalOperationId: candidateOperationId,
        activeResourceVersion: RESOURCE_VERSION,
        activeContentSha256: CONTENT_SHA256,
        ingestedAt: new Date('2026-07-11T14:04:52Z'),
      },
    })
    await prisma.kBIngestionRun.update({
      where: { id: INGESTION_ATTEMPT_ID },
      data: {
        status: KBIngestionStatus.PROCESSING,
        resourceVersion: RESOURCE_VERSION + 1,
        contentSha256: candidateContentSha256,
        externalOperationId: candidateOperationId,
      },
    })
    const request = createRequest(
      event('resource.content_refreshed', {
        eventId: REFRESH_EVENT_ID,
        operation_id: REFRESH_OPERATION_ID,
        serving: {
          active_resource_version: RESOURCE_VERSION,
          active_sha256: REFRESH_CONTENT_SHA256,
        },
        correlation_id: 'platform-weekly-refresh',
      })
    )

    await expect(
      handleKBIngestionWebhook({
        prisma,
        ...request,
        env: { KB_WEBHOOK_SECRET: SECRET },
      })
    ).resolves.toEqual({ statusCode: 200, body: { ok: true } })

    await expect(getResource()).resolves.toMatchObject({
      status: KBResourceStatus.PROCESSING,
      ingestionAttemptId: INGESTION_ATTEMPT_ID,
      resourceVersion: RESOURCE_VERSION + 1,
      contentSha256: candidateContentSha256,
      externalOperationId: candidateOperationId,
      activeResourceVersion: RESOURCE_VERSION,
      activeContentSha256: REFRESH_CONTENT_SHA256,
      ingestedAt: new Date(OCCURRED_AT),
    })
    await expect(getRun()).resolves.toMatchObject({
      status: KBIngestionStatus.PROCESSING,
      externalOperationId: candidateOperationId,
    })
    await expect(
      getRunByExternalOperation(REFRESH_OPERATION_ID)
    ).resolves.toMatchObject({
      id: REFRESH_EVENT_ID,
      operation: KBIngestionOperation.UPSERT,
      status: KBIngestionStatus.SUCCEEDED,
      resourceVersion: RESOURCE_VERSION,
      contentSha256: REFRESH_CONTENT_SHA256,
      finishedAt: new Date(OCCURRED_AT),
    })
  })

  it('deduplicates repeated platform refresh delivery by external operation', async () => {
    await prisma.kBResource.update({
      where: { id: resourceId },
      data: {
        status: KBResourceStatus.READY,
        activeResourceVersion: RESOURCE_VERSION,
        activeContentSha256: CONTENT_SHA256,
        ingestedAt: new Date('2026-07-11T14:04:52Z'),
      },
    })
    const request = createRequest(
      event('resource.content_refreshed', {
        eventId: REFRESH_EVENT_ID,
        operation_id: REFRESH_OPERATION_ID,
        serving: {
          active_resource_version: RESOURCE_VERSION,
          active_sha256: REFRESH_CONTENT_SHA256,
        },
        correlation_id: 'platform-weekly-refresh',
      })
    )

    await Promise.all(
      [request, request].map((refreshRequest) =>
        handleKBIngestionWebhook({
          prisma,
          ...refreshRequest,
          env: { KB_WEBHOOK_SECRET: SECRET },
        })
      )
    )

    await expect(
      prisma.kBIngestionRun.count({
        where: {
          resourceId,
          externalOperationId: REFRESH_OPERATION_ID,
        },
      })
    ).resolves.toBe(1)
    await expect(getResource()).resolves.toMatchObject({
      activeResourceVersion: RESOURCE_VERSION,
      activeContentSha256: REFRESH_CONTENT_SHA256,
      ingestedAt: new Date(OCCURRED_AT),
    })
  })

  it('records an older platform refresh as superseded without regressing serving', async () => {
    const currentServingSha256 = 'd'.repeat(64)
    await prisma.kBResource.update({
      where: { id: resourceId },
      data: {
        status: KBResourceStatus.READY,
        resourceVersion: RESOURCE_VERSION + 1,
        activeResourceVersion: RESOURCE_VERSION + 1,
        activeContentSha256: currentServingSha256,
        ingestedAt: new Date('2026-07-13T14:04:52Z'),
      },
    })
    const request = createRequest(
      event('resource.content_refreshed', {
        eventId: REFRESH_EVENT_ID,
        operation_id: REFRESH_OPERATION_ID,
        serving: {
          active_resource_version: RESOURCE_VERSION,
          active_sha256: REFRESH_CONTENT_SHA256,
        },
        correlation_id: 'platform-weekly-refresh',
      })
    )

    await expect(
      handleKBIngestionWebhook({
        prisma,
        ...request,
        env: { KB_WEBHOOK_SECRET: SECRET },
      })
    ).resolves.toEqual({ statusCode: 200, body: { ok: true } })

    await expect(getResource()).resolves.toMatchObject({
      activeResourceVersion: RESOURCE_VERSION + 1,
      activeContentSha256: currentServingSha256,
      ingestedAt: new Date('2026-07-13T14:04:52Z'),
    })
    await expect(
      getRunByExternalOperation(REFRESH_OPERATION_ID)
    ).resolves.toMatchObject({
      status: KBIngestionStatus.SUPERSEDED,
      statusMessage:
        'The platform refresh was superseded by a newer serving revision.',
    })
  })

  it('accepts the previous secret during key rotation', async () => {
    const request = createRequest(event('resource.processing_started'), {
      secret: PREVIOUS_SECRET,
    })

    await expect(
      handleKBIngestionWebhook({
        prisma,
        ...request,
        env: {
          KB_WEBHOOK_SECRET: SECRET,
          KB_WEBHOOK_PREVIOUS_SECRET: PREVIOUS_SECRET,
        },
      })
    ).resolves.toEqual({ statusCode: 200, body: { ok: true } })
    await expect(getResource()).resolves.toMatchObject({
      status: KBResourceStatus.PROCESSING,
    })
  })

  it('rejects an invalid signature', async () => {
    const request = createRequest(event('resource.processing_started'))

    await expect(
      handleKBIngestionWebhook({
        prisma,
        rawBody: request.rawBody,
        headers: {
          ...request.headers,
          'x-ingestion-signature': '0'.repeat(64),
        },
        env: { KB_WEBHOOK_SECRET: SECRET },
      })
    ).resolves.toEqual({
      statusCode: 401,
      body: { error: 'Unauthorized' },
    })
    await expect(getResource()).resolves.toMatchObject({
      status: KBResourceStatus.QUEUED,
    })
  })

  it('rejects a stale timestamp', async () => {
    const now = new Date('2026-07-26T18:00:00Z')
    const request = createRequest(event('resource.processing_started'), {
      timestamp: Math.floor(now.getTime() / 1000) - 301,
    })

    await expect(
      handleKBIngestionWebhook({
        prisma,
        ...request,
        env: { KB_WEBHOOK_SECRET: SECRET },
        now: () => now,
      })
    ).resolves.toEqual({
      statusCode: 401,
      body: { error: 'Unauthorized' },
    })
  })

  it('rejects header and payload envelope mismatches', async () => {
    const request = createRequest(event('resource.processing_started'))

    await expect(
      handleKBIngestionWebhook({
        prisma,
        rawBody: request.rawBody,
        headers: {
          ...request.headers,
          'x-ingestion-event-id': OTHER_EVENT_ID,
        },
        env: { KB_WEBHOOK_SECRET: SECRET },
      })
    ).resolves.toEqual({
      statusCode: 400,
      body: { error: 'Invalid request' },
    })
  })

  it('rejects non-canonical or extended payload bytes', async () => {
    const payload = event('resource.processing_started', {
      unexpected: true,
    })
    const rawBody = Buffer.from(JSON.stringify(payload, null, 2))
    const headers = signKBIngestionWebhook({
      eventId: EVENT_ID,
      eventType: 'resource.processing_started',
      rawBody,
      secret: SECRET,
      timestamp: Math.floor(Date.now() / 1000),
    })

    await expect(
      handleKBIngestionWebhook({
        prisma,
        rawBody,
        headers,
        env: { KB_WEBHOOK_SECRET: SECRET },
      })
    ).resolves.toEqual({
      statusCode: 400,
      body: { error: 'Invalid request' },
    })
  })

  it('does not let a stale version or operation mutate the current attempt', async () => {
    const request = createRequest(
      event('resource.processing_succeeded', {
        operation_id: 'op_stale',
        resource_version: RESOURCE_VERSION - 1,
        serving: {
          active_resource_version: RESOURCE_VERSION - 1,
          active_sha256: CONTENT_SHA256,
        },
      })
    )

    await expect(
      handleKBIngestionWebhook({
        prisma,
        ...request,
        env: { KB_WEBHOOK_SECRET: SECRET },
      })
    ).resolves.toEqual({ statusCode: 200, body: { ok: true } })
    await expect(getResource()).resolves.toMatchObject({
      status: KBResourceStatus.QUEUED,
      ingestedAt: null,
    })
  })

  it('does not let a racing started event regress ready', async () => {
    const started = createRequest(event('resource.processing_started'))
    const succeeded = createRequest(event('resource.processing_succeeded'))

    await Promise.all([
      handleKBIngestionWebhook({
        prisma,
        ...started,
        env: { KB_WEBHOOK_SECRET: SECRET },
      }),
      handleKBIngestionWebhook({
        prisma,
        ...succeeded,
        env: { KB_WEBHOOK_SECRET: SECRET },
      }),
    ])

    await expect(getResource()).resolves.toMatchObject({
      status: KBResourceStatus.READY,
    })
  })

  it('returns 503 without revealing details when the current secret is missing', async () => {
    const request = createRequest(event('resource.processing_started'))

    await expect(
      handleKBIngestionWebhook({
        prisma,
        ...request,
        env: {},
      })
    ).resolves.toEqual({
      statusCode: 503,
      body: { error: 'Service unavailable' },
    })
    await expect(getResource()).resolves.toMatchObject({
      status: KBResourceStatus.QUEUED,
    })
  })
})
