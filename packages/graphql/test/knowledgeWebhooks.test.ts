import {
  KBResourceStatus,
  KBResourceType,
  type PrismaClient,
} from '@klicker-uzh/prisma/client'
import {
  handleKBIngestionWebhook,
  signKBIngestionWebhook,
} from '../src/services/knowledgeWebhooks.js'
import { initializePrisma } from './helpers.js'

const SECRET = 'kb-webhook-test-secret'
const OWNER_ID = 'c08036f0-5354-47dc-aac0-408a89c251a5'

describe('KB ingestion webhook contract', () => {
  let prisma: PrismaClient
  let previousSecret: string | undefined
  let resourceId: string

  function createRequest(
    payload: Record<string, unknown>,
    timestamp: number | string = Math.floor(Date.now() / 1000)
  ) {
    const rawBody = Buffer.from(JSON.stringify(payload))
    return {
      rawBody,
      headers: signKBIngestionWebhook({
        rawBody,
        secret: SECRET,
        timestamp,
      }),
    }
  }

  async function getResource() {
    return prisma.kBResource.findUniqueOrThrow({ where: { id: resourceId } })
  }

  beforeAll(async () => {
    prisma = (await initializePrisma()).prisma
  })

  beforeEach(async () => {
    previousSecret = process.env.KB_WEBHOOK_SECRET
    process.env.KB_WEBHOOK_SECRET = SECRET

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
      },
    })
    resourceId = resource.id
  })

  afterEach(async () => {
    await prisma.user.deleteMany({ where: { id: OWNER_ID } })
    if (previousSecret === undefined) {
      delete process.env.KB_WEBHOOK_SECRET
    } else {
      process.env.KB_WEBHOOK_SECRET = previousSecret
    }
  })

  afterAll(async () => {
    await prisma.$disconnect()
  })

  it('accepts a valid signed PROCESSING transition', async () => {
    const request = createRequest({
      resourceId,
      status: 'PROCESSING',
    })

    await expect(
      handleKBIngestionWebhook({ prisma, ...request })
    ).resolves.toEqual({ statusCode: 200, body: { ok: true } })
    await expect(getResource()).resolves.toMatchObject({
      status: KBResourceStatus.PROCESSING,
      statusMessage: null,
    })
  })

  it('sets ingestedAt for a valid READY transition', async () => {
    await prisma.kBResource.update({
      where: { id: resourceId },
      data: { status: KBResourceStatus.PROCESSING },
    })
    const request = createRequest({
      resourceId,
      status: 'READY',
      statusMessage: 'Graph created',
    })

    await handleKBIngestionWebhook({ prisma, ...request })

    const resource = await getResource()
    expect(resource).toMatchObject({
      status: KBResourceStatus.READY,
      statusMessage: 'Graph created',
    })
    expect(resource.ingestedAt).toBeInstanceOf(Date)
  })

  it('persists the message for a valid FAILED transition', async () => {
    const request = createRequest({
      resourceId,
      status: 'FAILED',
      statusMessage: 'Source could not be read',
    })

    await handleKBIngestionWebhook({ prisma, ...request })

    await expect(getResource()).resolves.toMatchObject({
      status: KBResourceStatus.FAILED,
      statusMessage: 'Source could not be read',
      ingestedAt: null,
    })
  })

  it('rejects an invalid signature', async () => {
    const request = createRequest({ resourceId, status: 'PROCESSING' })

    await expect(
      handleKBIngestionWebhook({
        prisma,
        rawBody: request.rawBody,
        headers: { ...request.headers, 'x-kb-signature': '0'.repeat(64) },
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
    const request = createRequest(
      { resourceId, status: 'PROCESSING' },
      Math.floor(Date.now() / 1000) - 301
    )

    await expect(
      handleKBIngestionWebhook({ prisma, ...request })
    ).resolves.toEqual({
      statusCode: 401,
      body: { error: 'Unauthorized' },
    })
    await expect(getResource()).resolves.toMatchObject({
      status: KBResourceStatus.QUEUED,
    })
  })

  it('rejects a status outside the webhook allow-list', async () => {
    const request = createRequest({ resourceId, status: 'ADDED' })

    await expect(
      handleKBIngestionWebhook({ prisma, ...request })
    ).resolves.toEqual({
      statusCode: 400,
      body: { error: 'Invalid request' },
    })
    await expect(getResource()).resolves.toMatchObject({
      status: KBResourceStatus.QUEUED,
    })
  })

  it('returns a successful no-op for an illegal transition', async () => {
    await prisma.kBResource.update({
      where: { id: resourceId },
      data: { status: KBResourceStatus.ADDED },
    })
    const request = createRequest({ resourceId, status: 'READY' })

    await expect(
      handleKBIngestionWebhook({ prisma, ...request })
    ).resolves.toEqual({ statusCode: 200, body: { ok: true } })
    await expect(getResource()).resolves.toMatchObject({
      status: KBResourceStatus.ADDED,
      ingestedAt: null,
    })
  })

  it('does not let a concurrent PROCESSING callback regress READY', async () => {
    const processing = createRequest({ resourceId, status: 'PROCESSING' })
    const ready = createRequest({ resourceId, status: 'READY' })

    await Promise.all([
      handleKBIngestionWebhook({ prisma, ...processing }),
      handleKBIngestionWebhook({ prisma, ...ready }),
    ])

    await expect(getResource()).resolves.toMatchObject({
      status: KBResourceStatus.READY,
    })
  })

  it('rejects malformed resource identifiers before accessing Prisma', async () => {
    const request = createRequest({ resourceId: 'not-a-uuid', status: 'READY' })

    await expect(
      handleKBIngestionWebhook({ prisma, ...request })
    ).resolves.toEqual({
      statusCode: 400,
      body: { error: 'Invalid request' },
    })
  })

  it('returns 503 without revealing details when the secret is missing', async () => {
    delete process.env.KB_WEBHOOK_SECRET
    const request = createRequest({ resourceId, status: 'PROCESSING' })

    await expect(
      handleKBIngestionWebhook({ prisma, ...request })
    ).resolves.toEqual({
      statusCode: 503,
      body: { error: 'Service unavailable' },
    })
    await expect(getResource()).resolves.toMatchObject({
      status: KBResourceStatus.QUEUED,
    })
  })
})
