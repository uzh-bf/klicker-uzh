import { BlobServiceClient } from '@azure/storage-blob'
import { KBResourceStatus, KBResourceType } from '@klicker-uzh/prisma/client'
import { Readable } from 'node:stream'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { handleKBSourceGateway } from '../src/services/knowledgeSourceGateway.js'

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

  it('streams the exact active blob resource version', async () => {
    const stream = Readable.from([Buffer.from('lecture')])
    const download = vi.fn().mockResolvedValue({
      contentLength: 7,
      contentType: 'application/pdf',
      readableStreamBody: stream,
    })
    const getBlobClient = vi.fn().mockReturnValue({ download })
    const getContainerClient = vi.fn().mockReturnValue({ getBlobClient })
    vi.spyOn(
      BlobServiceClient.prototype,
      'getContainerClient'
    ).mockImplementation(getContainerClient)
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
      statusCode: 200,
      contentLength: 7,
      contentType: 'application/pdf',
      stream,
    })
    expect(prisma.kBResource.findFirst).toHaveBeenCalledWith({
      where: {
        id: RESOURCE_ID,
        resourceVersion: RESOURCE_VERSION,
        type: KBResourceType.BLOB,
        contentSha256: { not: null },
        status: {
          in: [KBResourceStatus.QUEUED, KBResourceStatus.PROCESSING],
        },
      },
      select: {
        blobName: true,
        mimeType: true,
        sizeBytes: true,
        kb: { select: { ownerId: true } },
      },
    })
    expect(getContainerClient).toHaveBeenCalledWith('kb-owner-id')
    expect(getBlobClient).toHaveBeenCalledWith(`${RESOURCE_ID}.pdf`)
  })

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
