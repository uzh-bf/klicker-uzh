import { ImportMediaStagingState } from '@klicker-uzh/prisma/client'
import { createHash, randomUUID } from 'node:crypto'

const azure = vi.hoisted(() => ({
  deleteIfExists: vi.fn(async () => ({ succeeded: true })),
  downloadBody: Buffer.alloc(0),
  getProperties: vi.fn(
    async (
      _blobName?: string
    ): Promise<{ contentLength: number | undefined; contentType: string }> => ({
      contentLength: 1,
      contentType: 'image/png',
    })
  ),
  uploadData: vi.fn(async () => ({})),
}))

vi.mock('@azure/storage-blob', () => ({
  BlobServiceClient: class {
    getContainerClient() {
      return {
        async exists() {
          return true
        },
        async create() {},
        getBlockBlobClient() {
          return {
            uploadData: azure.uploadData,
            async download() {
              return {
                readableStreamBody: {
                  async *[Symbol.asyncIterator]() {
                    yield azure.downloadBody
                  },
                },
              }
            },
          }
        },
        getBlobClient(blobName: string) {
          return {
            deleteIfExists: azure.deleteIfExists,
            async download() {
              return {
                readableStreamBody: {
                  async *[Symbol.asyncIterator]() {
                    yield azure.downloadBody
                  },
                },
              }
            },
            getProperties: () => azure.getProperties(blobName),
          }
        },
      }
    }
  },
  StorageSharedKeyCredential: class {},
}))

import {
  cleanupOrphanedImportedMediaFiles,
  downloadKlickerMediaFile,
  finalizeStagedImportedMediaFile,
  getKlickerMediaFilesExportMetadata,
  reconcileAbandonedImportMediaStaging,
  stageImportedMediaFile,
} from '../src/services/mediaStorage.js'

const OWNER_ID = '11111111-1111-4111-8111-111111111111'
const RECEIPT_ID = '22222222-2222-4222-8222-222222222222'
const OPERATION_ID = '33333333-3333-4333-8333-333333333333'

describe('durable imported-media staging', () => {
  const previousAccount = process.env.BLOB_STORAGE_ACCOUNT_NAME
  const previousKey = process.env.BLOB_STORAGE_ACCESS_KEY
  const previousStorage = process.env.IMPORT_EXPORT_PACKAGE_STORAGE

  beforeAll(() => {
    process.env.BLOB_STORAGE_ACCOUNT_NAME = 'testaccount'
    process.env.BLOB_STORAGE_ACCESS_KEY = 'test-key'
    process.env.IMPORT_EXPORT_PACKAGE_STORAGE = 'azure'
  })

  beforeEach(() => {
    azure.deleteIfExists.mockClear()
    azure.uploadData.mockClear()
    azure.getProperties.mockClear()
    azure.getProperties.mockResolvedValue({
      contentLength: 1,
      contentType: 'image/png',
    })
    azure.uploadData.mockResolvedValue({})
    azure.downloadBody = Buffer.alloc(0)
  })

  afterAll(() => {
    if (previousAccount === undefined) {
      delete process.env.BLOB_STORAGE_ACCOUNT_NAME
    } else {
      process.env.BLOB_STORAGE_ACCOUNT_NAME = previousAccount
    }
    if (previousKey === undefined) {
      delete process.env.BLOB_STORAGE_ACCESS_KEY
    } else {
      process.env.BLOB_STORAGE_ACCESS_KEY = previousKey
    }
    if (previousStorage === undefined) {
      delete process.env.IMPORT_EXPORT_PACKAGE_STORAGE
    } else {
      process.env.IMPORT_EXPORT_PACKAGE_STORAGE = previousStorage
    }
  })

  it('records the exact target before copying and then CASes it to COPIED', async () => {
    const calls: string[] = []
    const buffer = Buffer.from('durably staged media')
    const contentHash = createHash('sha256').update(buffer).digest('hex')
    const stagingId = randomUUID()
    const storageBlob = `imported/${stagingId}.png`
    const staging = {
      id: stagingId,
      operationId: OPERATION_ID,
      receiptId: RECEIPT_ID,
      ownerId: OWNER_ID,
      packageMediaRef: 'media-1',
      contentHash,
      storageContainer: OWNER_ID,
      storageBlob,
      state: ImportMediaStagingState.RESERVED,
      createdBlob: false,
      expiresAt: new Date(Date.now() + 60_000),
      mediaFileId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    azure.uploadData.mockImplementationOnce(async () => {
      calls.push('copy')
      return {}
    })
    const updateMany = vi.fn(async ({ data }) => {
      if (data.state === ImportMediaStagingState.COPIED) {
        calls.push('copied')
      }
      return { count: 1 }
    })
    const prisma: any = {
      mediaFile: { findUnique: vi.fn(async () => null) },
      importMediaStaging: {
        findUnique: vi.fn(async () => null),
        create: vi.fn(async () => {
          calls.push('reserved')
          return staging
        }),
        updateMany,
      },
      $queryRaw: vi.fn(async () => [{ id: RECEIPT_ID }]),
    }
    prisma.$transaction = vi.fn(async (callback: (tx: any) => unknown) =>
      callback(prisma)
    )

    await expect(
      stageImportedMediaFile(
        {
          buffer,
          contentType: 'image/png',
          filename: 'media.png',
          originalId: `import-media:${contentHash}`,
          contentHash,
          durableOperation: {
            receiptId: RECEIPT_ID,
            operationId: OPERATION_ID,
            packageMediaRef: 'media-1',
            expiresAt: staging.expiresAt,
          },
        },
        { user: { sub: OWNER_ID }, prisma } as any
      )
    ).resolves.toMatchObject({
      stagingId,
      operationId: OPERATION_ID,
      createdBlob: true,
    })
    expect(calls).toEqual(['reserved', 'copy', 'copied'])
  })

  it('batches media rows, bounds property I/O, and rejects unknown byte lengths', async () => {
    const hrefs = Array.from(
      { length: 6 },
      (_, index) =>
        `https://testaccount.blob.core.windows.net/${OWNER_ID}/imported/media-${index + 1}.png`
    )
    let active = 0
    let maximumActive = 0
    azure.getProperties.mockImplementation(async (blobName?: string) => {
      active++
      maximumActive = Math.max(maximumActive, active)
      await Promise.resolve()
      active--
      return {
        contentLength: blobName?.endsWith('media-6.png') ? undefined : 10,
        contentType: 'image/png',
      }
    })
    const findMany = vi.fn(async () =>
      hrefs.map((href, index) => ({
        id: randomUUID(),
        href,
        name: `media-${index + 1}.png`,
        originalId: null,
        ownerId: OWNER_ID,
        type: 'image/png',
      }))
    )

    const result = await getKlickerMediaFilesExportMetadata(hrefs, {
      prisma: { mediaFile: { findMany } },
    } as any)

    expect(findMany).toHaveBeenCalledTimes(1)
    expect(maximumActive).toBe(4)
    expect(result.get(hrefs[0]!)).toMatchObject({ bytes: 10 })
    expect(result.get(hrefs[5]!)).toBeNull()
  })

  it('omits unknown-length media from final export just as preview does', async () => {
    const href = `https://testaccount.blob.core.windows.net/${OWNER_ID}/imported/unknown-size.png`
    azure.getProperties.mockResolvedValue({
      contentLength: undefined,
      contentType: 'image/png',
    })

    await expect(
      downloadKlickerMediaFile(href, {
        prisma: {
          mediaFile: {
            findUnique: vi.fn(async () => ({
              id: randomUUID(),
              name: 'unknown-size.png',
              originalId: null,
              ownerId: OWNER_ID,
              type: 'image/png',
            })),
          },
        },
      } as any)
    ).rejects.toMatchObject({ kind: 'unknown-size' })
  })

  it('keeps the RESERVED ledger recoverable when copying fails', async () => {
    const buffer = Buffer.from('copy failure remains recoverable')
    const contentHash = createHash('sha256').update(buffer).digest('hex')
    const stagingId = randomUUID()
    const staging = {
      id: stagingId,
      operationId: OPERATION_ID,
      receiptId: RECEIPT_ID,
      ownerId: OWNER_ID,
      packageMediaRef: 'media-copy-failure',
      contentHash,
      storageContainer: OWNER_ID,
      storageBlob: `imported/${stagingId}.png`,
      state: ImportMediaStagingState.RESERVED,
      createdBlob: false,
      expiresAt: new Date(Date.now() + 60_000),
      mediaFileId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    const copyError = new Error('blob copy unavailable')
    azure.uploadData.mockRejectedValueOnce(copyError)
    const updateMany = vi.fn(async () => ({ count: 1 }))
    const prisma: any = {
      mediaFile: { findUnique: vi.fn(async () => null) },
      importMediaStaging: {
        findUnique: vi.fn(async () => null),
        create: vi.fn(async ({ data }) => Object.assign(staging, data)),
        updateMany,
      },
      $queryRaw: vi.fn(async () => [{ id: RECEIPT_ID }]),
    }
    prisma.$transaction = vi.fn(async (callback: (tx: any) => unknown) =>
      callback(prisma)
    )

    await expect(
      stageImportedMediaFile(
        {
          buffer,
          contentType: 'image/png',
          filename: 'media.png',
          originalId: `import-media:${contentHash}`,
          contentHash,
          durableOperation: {
            receiptId: RECEIPT_ID,
            operationId: OPERATION_ID,
            packageMediaRef: staging.packageMediaRef,
            expiresAt: staging.expiresAt,
          },
        },
        { user: { sub: OWNER_ID }, prisma } as any
      )
    ).rejects.toBe(copyError)

    const reserved = prisma.importMediaStaging.create.mock.calls[0][0].data
    expect(reserved).toMatchObject({
      storageContainer: OWNER_ID,
      storageBlob: `imported/${reserved.id}.png`,
    })
    expect(reserved).not.toHaveProperty('state')
    expect(updateMany).toHaveBeenCalledTimes(1)
    expect(updateMany).not.toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          state: ImportMediaStagingState.COPIED,
        }),
      })
    )
    expect(staging.state).toBe(ImportMediaStagingState.RESERVED)
  })

  it('keeps the exact RESERVED ledger recoverable when COPIED recording loses its lease', async () => {
    const buffer = Buffer.from('copied bytes with fenced ledger transition')
    const contentHash = createHash('sha256').update(buffer).digest('hex')
    const stagingId = randomUUID()
    const staging = {
      id: stagingId,
      operationId: OPERATION_ID,
      receiptId: RECEIPT_ID,
      ownerId: OWNER_ID,
      packageMediaRef: 'media-copied-cas-failure',
      contentHash,
      storageContainer: OWNER_ID,
      storageBlob: `imported/${stagingId}.png`,
      state: ImportMediaStagingState.RESERVED,
      createdBlob: false,
      expiresAt: new Date(Date.now() + 60_000),
      mediaFileId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    const updateMany = vi.fn(async ({ data }) => ({
      count: data.state === ImportMediaStagingState.COPIED ? 0 : 1,
    }))
    const prisma: any = {
      mediaFile: { findUnique: vi.fn(async () => null) },
      importMediaStaging: {
        findUnique: vi.fn(async () => null),
        create: vi.fn(async ({ data }) => Object.assign(staging, data)),
        updateMany,
      },
      $queryRaw: vi.fn(async () => [{ id: RECEIPT_ID }]),
    }
    prisma.$transaction = vi.fn(async (callback: (tx: any) => unknown) =>
      callback(prisma)
    )

    await expect(
      stageImportedMediaFile(
        {
          buffer,
          contentType: 'image/png',
          filename: 'media.png',
          originalId: `import-media:${contentHash}`,
          contentHash,
          durableOperation: {
            receiptId: RECEIPT_ID,
            operationId: OPERATION_ID,
            packageMediaRef: staging.packageMediaRef,
            expiresAt: staging.expiresAt,
          },
        },
        { user: { sub: OWNER_ID }, prisma } as any
      )
    ).rejects.toThrow('Copied import media staging could not be recorded.')

    expect(azure.uploadData).toHaveBeenCalledTimes(1)
    const reserved = prisma.importMediaStaging.create.mock.calls[0][0].data
    expect(updateMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: reserved.id,
          operationId: OPERATION_ID,
          state: {
            in: [
              ImportMediaStagingState.RESERVED,
              ImportMediaStagingState.COPIED,
            ],
          },
        }),
        data: {
          state: ImportMediaStagingState.COPIED,
          createdBlob: true,
        },
      })
    )
    expect(staging.state).toBe(ImportMediaStagingState.RESERVED)
  })

  it('atomically finalizes an adopted staged target with its media row', async () => {
    const contentHash = 'a'.repeat(64)
    const stagingId = randomUUID()
    const staged = {
      id: stagingId,
      href: `https://testaccount.blob.core.windows.net/${OWNER_ID}/imported/${stagingId}.png`,
      ownerId: OWNER_ID,
      contentType: 'image/png',
      filename: 'media.png',
      originalId: `import-media:${contentHash}`,
      contentHash,
      createdBlob: true,
      stagingId,
      operationId: OPERATION_ID,
    }
    const updateMany = vi.fn(async () => ({ count: 1 }))

    await expect(
      finalizeStagedImportedMediaFile(staged, {
        prisma: {
          mediaFile: {
            upsert: vi.fn(async () => ({
              id: stagingId,
              href: staged.href,
              contentHash,
            })),
          },
          importMediaStaging: { updateMany },
        },
      } as any)
    ).resolves.toEqual({ href: staged.href, unusedStagedHref: null })
    expect(updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: stagingId,
          operationId: OPERATION_ID,
          state: ImportMediaStagingState.COPIED,
        }),
        data: {
          state: ImportMediaStagingState.FINALIZED,
          mediaFileId: stagingId,
        },
      })
    )
  })

  it('fences abandoned attempt targets without deleting them inline', async () => {
    const stagingId = randomUUID()
    const oldOperationId = randomUUID()
    const updateMany = vi.fn(async () => ({ count: 1 }))
    const prisma: any = {
      importMediaStaging: {
        findMany: vi.fn(async () => [
          { id: stagingId, operationId: oldOperationId },
        ]),
        updateMany,
      },
      $queryRaw: vi.fn(async () => [{ id: RECEIPT_ID }]),
    }
    prisma.$transaction = vi.fn(async (callback: (tx: any) => unknown) =>
      callback(prisma)
    )
    await reconcileAbandonedImportMediaStaging({
      receiptId: RECEIPT_ID,
      ownerId: OWNER_ID,
      operationId: OPERATION_ID,
      prisma,
    })

    expect(updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          packageMediaRef: `orphan:${stagingId}`,
          state: ImportMediaStagingState.CLEANUP_PENDING,
          mediaFileId: null,
        },
      })
    )
    expect(azure.deleteIfExists).not.toHaveBeenCalled()
  })

  it('claims and deletes a RESERVED exact target even when createdBlob is false', async () => {
    const stagingId = randomUUID()
    const calls: string[] = []
    azure.deleteIfExists.mockImplementationOnce(async () => {
      calls.push('delete-blob')
      return { succeeded: true }
    })
    const updateMany = vi.fn(async () => {
      calls.push('claim-cleanup')
      return { count: 1 }
    })
    const deleteMany = vi.fn(async () => {
      calls.push('delete-ledger')
      return { count: 1 }
    })
    const now = new Date()
    const result = await cleanupOrphanedImportedMediaFiles({
      now,
      prisma: {
        importMediaStaging: {
          findMany: vi.fn(async () => [
            {
              id: stagingId,
              ownerId: OWNER_ID,
              state: ImportMediaStagingState.RESERVED,
              storageContainer: OWNER_ID,
              storageBlob: `imported/${stagingId}.png`,
              createdBlob: false,
              expiresAt: new Date(now.getTime() - 1),
            },
          ]),
          updateMany,
          deleteMany,
        },
      } as any,
    })

    expect(result).toMatchObject({
      deletedMediaFiles: 1,
      deletedStagingRecords: 1,
      failedMediaCleanups: 0,
    })
    expect(calls).toEqual(['claim-cleanup', 'delete-blob', 'delete-ledger'])
  })
})
