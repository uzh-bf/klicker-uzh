import { createHash } from 'node:crypto'
import { IMPORT_EXPORT_MEDIA_FINGERPRINT_VERSION } from '../src/lib/importExportFingerprintCanonicalization.js'
import {
  finalizeStagedImportedMediaFile,
  stageImportedMediaFile,
} from '../src/services/mediaStorage.js'

const azureBlobMock = vi.hoisted(() => ({ body: Buffer.alloc(0) }))

vi.mock('@azure/storage-blob', () => ({
  BlobServiceClient: class {
    getContainerClient() {
      return {
        getBlobClient() {
          return {
            async getProperties() {
              return { contentLength: azureBlobMock.body.length }
            },
            async download() {
              return {
                readableStreamBody: {
                  async *[Symbol.asyncIterator]() {
                    yield azureBlobMock.body
                  },
                },
              }
            },
          }
        },
      }
    }
  },
  StorageSharedKeyCredential: class {},
}))

const OWNER_ID = '11111111-1111-4111-8111-111111111111'
const MEDIA_ID = '22222222-2222-4222-8222-222222222222'
const HREF =
  'https://testaccount.blob.core.windows.net/11111111-1111-4111-8111-111111111111/imported/media.png'

function mediaHash(buffer: Buffer) {
  return createHash('sha256').update(buffer).digest('hex')
}

describe('imported media content-hash persistence', () => {
  it('carries a verified manifest hash when reusing an unhashed media row', async () => {
    const buffer = Buffer.from('verified imported media')
    const contentHash = mediaHash(buffer)
    azureBlobMock.body = buffer
    const previousAccount = process.env.BLOB_STORAGE_ACCOUNT_NAME
    const previousKey = process.env.BLOB_STORAGE_ACCESS_KEY
    const previousStorage = process.env.IMPORT_EXPORT_PACKAGE_STORAGE
    process.env.BLOB_STORAGE_ACCOUNT_NAME = 'testaccount'
    process.env.BLOB_STORAGE_ACCESS_KEY = 'test-key'
    process.env.IMPORT_EXPORT_PACKAGE_STORAGE = 'azure'
    let persistedHash: string | null = null
    let persistedVersion: number | null = null
    const queryRaw = vi.fn(async () => [])
    const executeRaw = vi.fn(async () => 0)
    const transactionClient = {
      $queryRaw: queryRaw,
      $executeRaw: executeRaw,
      mediaFile: {
        findUnique: vi.fn(async () => ({
          id: MEDIA_ID,
          href: HREF,
          ownerId: OWNER_ID,
          type: 'image/png',
          name: 'media.png',
          originalId: `import-media:${contentHash}`,
          contentHash: persistedHash,
          importFingerprintVersion: persistedVersion,
        })),
        updateMany: vi.fn(async ({ data }) => {
          persistedHash = data.contentHash
          persistedVersion = data.importFingerprintVersion
          return { count: 1 }
        }),
      },
    }
    const transaction = vi.fn(
      async (action: (prisma: typeof transactionClient) => Promise<unknown>) =>
        await action(transactionClient)
    )
    const ctx = {
      user: { sub: OWNER_ID },
      prisma: {
        ...transactionClient,
        $transaction: transaction,
      },
    }

    try {
      await expect(
        stageImportedMediaFile(
          {
            buffer,
            contentType: 'image/png',
            filename: 'media.png',
            originalId: `import-media:${contentHash}`,
            contentHash,
          },
          ctx as any
        )
      ).resolves.toMatchObject({
        id: MEDIA_ID,
        contentHash,
        createdBlob: false,
      })
      expect(persistedHash).toBe(contentHash)
      expect(persistedVersion).toBe(IMPORT_EXPORT_MEDIA_FINGERPRINT_VERSION)
      expect(transaction).toHaveBeenCalledTimes(1)
      expect(queryRaw).toHaveBeenCalledTimes(1)
      expect(executeRaw).not.toHaveBeenCalled()
    } finally {
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
    }
  })

  it('persists the verified hash on both create and reuse upsert paths', async () => {
    const contentHash = 'a'.repeat(64)
    const upsert = vi.fn(async () => ({
      id: MEDIA_ID,
      href: HREF,
      contentHash,
      importFingerprintVersion: IMPORT_EXPORT_MEDIA_FINGERPRINT_VERSION,
    }))
    const staged = {
      id: MEDIA_ID,
      href: HREF,
      ownerId: OWNER_ID,
      contentType: 'image/png',
      filename: 'media.png',
      originalId: `import-media:${contentHash}`,
      contentHash,
      createdBlob: false,
    }

    await expect(
      finalizeStagedImportedMediaFile(staged, {
        prisma: { mediaFile: { upsert } },
      } as any)
    ).resolves.toEqual({ href: HREF, unusedStagedHref: null })
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          contentHash,
          importFingerprintVersion: IMPORT_EXPORT_MEDIA_FINGERPRINT_VERSION,
        }),
        update: {},
      })
    )
  })

  it('rejects byte/hash mismatches before storage access', async () => {
    const findUnique = vi.fn()
    await expect(
      stageImportedMediaFile(
        {
          buffer: Buffer.from('different bytes'),
          contentType: 'image/png',
          filename: 'media.png',
          originalId: `import-media:${'b'.repeat(64)}`,
          contentHash: 'b'.repeat(64),
        },
        {
          user: { sub: OWNER_ID },
          prisma: { mediaFile: { findUnique } },
        } as any
      )
    ).rejects.toThrow(/content hash/i)
    expect(findUnique).not.toHaveBeenCalled()
  })
})
