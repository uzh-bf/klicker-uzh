import { BlobServiceClient } from '@azure/storage-blob'
import type { Hatchet } from '@hatchet-dev/typescript-sdk'
import { prisma as prismaClient } from '@klicker-uzh/prisma'
import {
  KBResourceStatus,
  KBResourceType,
  PrismaClient,
} from '@klicker-uzh/prisma/client'
import { randomUUID } from 'crypto'
import { EventEmitter } from 'events'
import { Readable } from 'node:stream'
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from 'vitest'
import type { ContextWithUser } from '../src/lib/context.js'
import { handleKBSourceGateway } from '../src/services/knowledgeSourceGateway.js'
import { testCleanup, testInitialization } from './helpers.js'

const RESOURCE_ID = '7f3e2a10-9c4b-4d8e-b1a6-5e0f9d2c7b3a'
const RESOURCE_VERSION = 3
const env = {
  KB_SOURCE_GATEWAY_KEY: 'gateway-key',
  BLOB_STORAGE_ACCOUNT_NAME: 'kbaccount',
  BLOB_STORAGE_ACCESS_KEY: Buffer.alloc(32).toString('base64'),
}

function prismaWithResource(resource: Record<string, unknown> | null) {
  return {
    kBResource: {
      findFirst: vi.fn().mockResolvedValue(resource),
    },
  }
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('KB source gateway', () => {
  it('fails closed when gateway configuration is incomplete', async () => {
    const prisma = prismaWithResource(null)

    await expect(
      handleKBSourceGateway({
        prisma: prisma as never,
        resourceId: RESOURCE_ID,
        resourceVersion: RESOURCE_VERSION,
        authorization: 'Bearer gateway-key',
        env: {},
      })
    ).resolves.toEqual({
      statusCode: 503,
      body: { error: 'Service unavailable' },
    })
    expect(prisma.kBResource.findFirst).not.toHaveBeenCalled()
  })

  it('rejects unauthorized callers before looking up source metadata', async () => {
    const prisma = prismaWithResource(null)

    await expect(
      handleKBSourceGateway({
        prisma: prisma as never,
        resourceId: RESOURCE_ID,
        resourceVersion: RESOURCE_VERSION,
        authorization: 'Bearer wrong-key',
        env,
      })
    ).resolves.toEqual({
      statusCode: 401,
      body: { error: 'Unauthorized' },
    })
    expect(prisma.kBResource.findFirst).not.toHaveBeenCalled()
  })

  // NOTE: a prior test here ("streams the exact active blob resource
  // version") mirror-asserted the implementation's `findFirst` where-clause
  // against a fully mocked Prisma client via `toHaveBeenCalledWith`. That
  // proved only that the code passes the literal object it always would --
  // it never ran against real rows, so a broken filter (e.g. wrong status
  // set, missing a clause) would still pass. It has been replaced by the
  // real-PostgreSQL "KB source gateway authz filter (real database)" suite
  // below, which seeds actual KBResource rows and proves each clause one at
  // a time. The streaming-layer concerns that test also touched (blob
  // client wiring, container-name derivation) are re-proven there against a
  // real DB-joined owner id.

  it('does not expose an unavailable resource version', async () => {
    const prisma = prismaWithResource(null)
    const getContainerClient = vi.spyOn(
      BlobServiceClient.prototype,
      'getContainerClient'
    )

    await expect(
      handleKBSourceGateway({
        prisma: prisma as never,
        resourceId: RESOURCE_ID,
        resourceVersion: RESOURCE_VERSION,
        authorization: 'Bearer gateway-key',
        env,
      })
    ).resolves.toEqual({
      statusCode: 404,
      body: { error: 'Resource not found' },
    })
    expect(getContainerClient).not.toHaveBeenCalled()
  })

  it('rejects blob metadata drift instead of streaming changed bytes', async () => {
    const download = vi.fn().mockResolvedValue({
      contentLength: 8,
      contentType: 'application/pdf',
      readableStreamBody: Readable.from([Buffer.from('changed!')]),
    })
    vi.spyOn(BlobServiceClient.prototype, 'getContainerClient').mockReturnValue(
      {
        getBlobClient: vi.fn().mockReturnValue({ download }),
      } as never
    )
    const prisma = prismaWithResource({
      blobName: `${RESOURCE_ID}.pdf`,
      mimeType: 'application/pdf',
      sizeBytes: 7,
      kb: { ownerId: 'owner-id' },
    })

    await expect(
      handleKBSourceGateway({
        prisma: prisma as never,
        resourceId: RESOURCE_ID,
        resourceVersion: RESOURCE_VERSION,
        authorization: 'Bearer gateway-key',
        env,
      })
    ).resolves.toEqual({
      statusCode: 502,
      body: { error: 'Source unavailable' },
    })
  })
})

// The mocked-Prisma tests above cover the gateway's non-DB concerns (fail
// closed on missing config, HMAC authorization, blob metadata drift). The
// suite below seeds real rows in Postgres and proves the `findFirst`
// where-clause's actual semantics, one clause at a time:
//   id === resourceId
//   resourceVersion === resourceVersion (exact, not >=)
//   deletedAt is null (tombstoned resources are excluded)
//   type === BLOB (URL resources are excluded)
//   contentSha256 is not null (digest has been computed)
//   status in [QUEUED, PROCESSING] (READY/FAILED/ADDED are excluded)
// There is no owner/foreign-KB clause at all -- the function takes no
// caller identity to check against an owner in the first place. The test near
// the end documents this system-to-system gateway-key trust model explicitly.
describe('KB source gateway authz filter (real database)', () => {
  let prisma: PrismaClient
  let userOneCtx: ContextWithUser
  let userTwoCtx: ContextWithUser
  let kbId: string

  const authorization = 'Bearer gateway-key'

  beforeAll(async () => {
    prisma = prismaClient
    await testCleanup(prisma)
    const hatchet = {
      task: vi.fn(() => ({ runNoWait: vi.fn() })),
    } as unknown as Hatchet
    const initialized = await testInitialization(
      prisma,
      hatchet,
      new EventEmitter()
    )
    userOneCtx = initialized.userOneCtx
    userTwoCtx = initialized.userTwoCtx
    const kb = await prisma.kB.create({
      data: { name: 'Gateway fixture', ownerId: userOneCtx.user.sub },
    })
    kbId = kb.id
  })

  afterAll(async () => {
    await testCleanup(prisma)
    await prisma.$disconnect()
  })

  function mockBlobDownload(bytes: string, mimeType: string) {
    const download = vi.fn().mockResolvedValue({
      contentLength: Buffer.byteLength(bytes),
      contentType: mimeType,
      readableStreamBody: Readable.from([Buffer.from(bytes)]),
    })
    const getBlobClient = vi.fn().mockReturnValue({ download })
    const getContainerClient = vi.fn().mockReturnValue({ getBlobClient })
    vi.spyOn(
      BlobServiceClient.prototype,
      'getContainerClient'
    ).mockImplementation(getContainerClient)
    return { getContainerClient, getBlobClient }
  }

  async function createGatewayResource({
    status = KBResourceStatus.QUEUED,
    type = KBResourceType.BLOB,
    resourceVersion = 3,
    contentSha256 = 'f'.repeat(64),
    kbId: kbIdOverride,
  }: {
    status?: KBResourceStatus
    type?: KBResourceType
    resourceVersion?: number
    contentSha256?: string | null
    kbId?: string
  } = {}) {
    return prisma.kBResource.create({
      data: {
        kbId: kbIdOverride ?? kbId,
        type,
        title: 'Lecture',
        blobName: `${randomUUID()}.pdf`,
        mimeType: 'application/pdf',
        sizeBytes: 7,
        contentSha256,
        status,
        resourceVersion,
      },
    })
  }

  it('serves the blob when every clause of the filter is satisfied, deriving the container from the real owner join', async () => {
    const resource = await createGatewayResource({
      status: KBResourceStatus.QUEUED,
      resourceVersion: 3,
    })
    const { getContainerClient, getBlobClient } = mockBlobDownload(
      'lecture',
      'application/pdf'
    )

    await expect(
      handleKBSourceGateway({
        prisma,
        resourceId: resource.id,
        resourceVersion: 3,
        authorization,
        env,
      })
    ).resolves.toMatchObject({
      statusCode: 200,
      contentLength: 7,
      contentType: 'application/pdf',
    })
    expect(getContainerClient).toHaveBeenCalledWith(`kb-${userOneCtx.user.sub}`)
    expect(getBlobClient).toHaveBeenCalledWith(resource.blobName)
  })

  it('also serves a resource that is still PROCESSING -- the other allowed status value', async () => {
    const resource = await createGatewayResource({
      status: KBResourceStatus.PROCESSING,
    })
    mockBlobDownload('lecture', 'application/pdf')

    await expect(
      handleKBSourceGateway({
        prisma,
        resourceId: resource.id,
        resourceVersion: resource.resourceVersion,
        authorization,
        env,
      })
    ).resolves.toMatchObject({ statusCode: 200 })
  })

  it.each([
    KBResourceStatus.ADDED,
    KBResourceStatus.READY,
    KBResourceStatus.FAILED,
  ])('rejects status %s even though every other clause matches', async (status) => {
    const resource = await createGatewayResource({ status })
    const getContainerClient = vi.spyOn(
      BlobServiceClient.prototype,
      'getContainerClient'
    )

    await expect(
      handleKBSourceGateway({
        prisma,
        resourceId: resource.id,
        resourceVersion: resource.resourceVersion,
        authorization,
        env,
      })
    ).resolves.toEqual({
      statusCode: 404,
      body: { error: 'Resource not found' },
    })
    expect(getContainerClient).not.toHaveBeenCalled()
  })

  it('rejects a resource whose content digest has not been computed yet', async () => {
    const resource = await createGatewayResource({ contentSha256: null })

    await expect(
      handleKBSourceGateway({
        prisma,
        resourceId: resource.id,
        resourceVersion: resource.resourceVersion,
        authorization,
        env,
      })
    ).resolves.toEqual({
      statusCode: 404,
      body: { error: 'Resource not found' },
    })
  })

  it('rejects a URL-type resource even if every other clause matches', async () => {
    const resource = await createGatewayResource({ type: KBResourceType.URL })

    await expect(
      handleKBSourceGateway({
        prisma,
        resourceId: resource.id,
        resourceVersion: resource.resourceVersion,
        authorization,
        env,
      })
    ).resolves.toEqual({
      statusCode: 404,
      body: { error: 'Resource not found' },
    })
  })

  it('rejects a stale resource-version request once the row has moved on to a newer version', async () => {
    const resource = await createGatewayResource({ resourceVersion: 5 })
    const getContainerClient = vi.spyOn(
      BlobServiceClient.prototype,
      'getContainerClient'
    )

    await expect(
      handleKBSourceGateway({
        prisma,
        resourceId: resource.id,
        resourceVersion: 3,
        authorization,
        env,
      })
    ).resolves.toEqual({
      statusCode: 404,
      body: { error: 'Resource not found' },
    })
    expect(getContainerClient).not.toHaveBeenCalled()

    mockBlobDownload('lecture', 'application/pdf')
    await expect(
      handleKBSourceGateway({
        prisma,
        resourceId: resource.id,
        resourceVersion: 5,
        authorization,
        env,
      })
    ).resolves.toMatchObject({ statusCode: 200 })
  })

  it('rejects a request for an id with no matching resource row', async () => {
    await createGatewayResource()

    await expect(
      handleKBSourceGateway({
        prisma,
        resourceId: randomUUID(),
        resourceVersion: 3,
        authorization,
        env,
      })
    ).resolves.toEqual({
      statusCode: 404,
      body: { error: 'Resource not found' },
    })
  })

  it('derives the blob container from the resource owner under the system-to-system gateway-key trust model', async () => {
    const otherOwnerKb = await prisma.kB.create({
      data: { name: 'Different owner', ownerId: userTwoCtx.user.sub },
    })
    const resource = await createGatewayResource({
      kbId: otherOwnerKb.id,
    })
    const { getContainerClient } = mockBlobDownload(
      'lecture',
      'application/pdf'
    )

    await expect(
      handleKBSourceGateway({
        prisma,
        resourceId: resource.id,
        resourceVersion: resource.resourceVersion,
        authorization,
        env,
      })
    ).resolves.toMatchObject({ statusCode: 200 })
    expect(getContainerClient).toHaveBeenCalledWith(`kb-${userTwoCtx.user.sub}`)
  })

  it('rejects a tombstoned resource before accessing blob storage', async () => {
    const resource = await createGatewayResource()
    await prisma.kBResource.update({
      where: { id: resource.id },
      data: { deletedAt: new Date(), deletedById: userOneCtx.user.sub },
    })
    const getContainerClient = vi.spyOn(
      BlobServiceClient.prototype,
      'getContainerClient'
    )

    await expect(
      handleKBSourceGateway({
        prisma,
        resourceId: resource.id,
        resourceVersion: resource.resourceVersion,
        authorization,
        env,
      })
    ).resolves.toEqual({
      statusCode: 404,
      body: { error: 'Resource not found' },
    })
    expect(getContainerClient).not.toHaveBeenCalled()
  })
})
