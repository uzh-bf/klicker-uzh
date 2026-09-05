import { ImportMediaStagingState } from '@klicker-uzh/prisma/client'
import { randomUUID } from 'node:crypto'

const azure = vi.hoisted(() => ({
  create: vi.fn<(...args: unknown[]) => Promise<unknown>>(async () => ({})),
  deleteIfExists: vi.fn<(...args: unknown[]) => Promise<unknown>>(async () => ({
    succeeded: true,
  })),
  download: vi.fn<(...args: unknown[]) => Promise<unknown>>(async () => ({
    readableStreamBody: (async function* () {
      yield Buffer.from('stored bytes')
    })(),
  })),
  exists: vi.fn<(...args: unknown[]) => Promise<unknown>>(async () => true),
  getAccessPolicy: vi.fn<(...args: unknown[]) => Promise<unknown>>(
    async () => ({ blobPublicAccess: undefined })
  ),
  getProperties: vi.fn<(...args: unknown[]) => Promise<unknown>>(async () => ({
    contentLength: 12,
    contentType: 'image/png',
  })),
  uploadData: vi.fn<(...args: unknown[]) => Promise<unknown>>(async () => ({})),
}))

vi.mock('@azure/storage-blob', () => ({
  BlobSASPermissions: { parse: vi.fn(() => 'read') },
  BlobServiceClient: class {
    getContainerClient(containerName: string) {
      return {
        create: (options?: unknown) => azure.create(containerName, options),
        createIfNotExists: (options?: unknown) =>
          azure.create(containerName, options),
        exists: (options?: unknown) => azure.exists(containerName, options),
        getAccessPolicy: (options?: unknown) =>
          azure.getAccessPolicy(containerName, options),
        getBlobClient(blobName: string) {
          return {
            deleteIfExists: (options?: unknown) =>
              azure.deleteIfExists(containerName, blobName, options),
            download: (offset?: number, count?: number, options?: unknown) =>
              azure.download(containerName, blobName, offset, count, options),
            getProperties: (options?: unknown) =>
              azure.getProperties(containerName, blobName, options),
          }
        },
        getBlockBlobClient(blobName: string) {
          return {
            uploadData: (buffer: Buffer, options?: unknown) =>
              azure.uploadData(containerName, blobName, buffer, options),
          }
        },
      }
    }
  },
  generateBlobSASQueryParameters: vi.fn(() => 'sig=test'),
  SASProtocol: { Https: 'https' },
  StorageSharedKeyCredential: class {},
}))

import { ImportExportErrorCode } from '../src/lib/importExportErrors.js'
import {
  deleteAzureImportedMediaIfExists,
  getAzureImportedMediaProperties,
  readAzurePackageBlob,
  writeAzurePackageBlobExclusive,
} from '../src/services/importExportAzureBlobStorage.js'
import { backfillMediaHashBatch } from '../src/services/importExportFingerprintMaintenance.js'
import { checkImportExportPackageStorageReadiness } from '../src/services/importExportPackageBlobStore.js'
import { cleanupOrphanedImportedMediaFiles } from '../src/services/mediaStorage.js'

const OWNER_ID = '11111111-1111-4111-8111-111111111111'
const BLOB_NAME = 'imported/22222222-2222-4222-8222-222222222222.png'
const LOCATION = { containerName: OWNER_ID, blobName: BLOB_NAME }
const PREVIOUS_ENV = {
  account: process.env.BLOB_STORAGE_ACCOUNT_NAME,
  key: process.env.BLOB_STORAGE_ACCESS_KEY,
  metadataTimeout: process.env.IMPORT_EXPORT_AZURE_METADATA_TIMEOUT_MS,
  nodeEnv: process.env.NODE_ENV,
  storage: process.env.IMPORT_EXPORT_PACKAGE_STORAGE,
  transferTimeout: process.env.IMPORT_EXPORT_AZURE_TRANSFER_TIMEOUT_MS,
}

function never(..._args: unknown[]) {
  return new Promise<never>(() => undefined)
}

async function settleDeadline<T>(operation: Promise<T>) {
  const observed = operation.catch((error: unknown) => error)
  await vi.advanceTimersByTimeAsync(1_001)
  return await observed
}

function expectInfrastructureDeadline(error: unknown) {
  expect(error).toMatchObject({
    code: ImportExportErrorCode.INFRASTRUCTURE_FAILURE,
    name: 'ImportExportStorageDeadlineError',
  })
}

function restoreEnv(name: string, value: string | undefined) {
  if (typeof value === 'undefined') delete process.env[name]
  else process.env[name] = value
}

describe('import/export Azure storage deadlines', () => {
  beforeAll(() => {
    process.env.NODE_ENV = 'test'
    process.env.IMPORT_EXPORT_PACKAGE_STORAGE = 'azure'
    process.env.BLOB_STORAGE_ACCOUNT_NAME = 'testaccount'
    process.env.BLOB_STORAGE_ACCESS_KEY = 'test-key'
    process.env.IMPORT_EXPORT_AZURE_METADATA_TIMEOUT_MS = '1000'
    process.env.IMPORT_EXPORT_AZURE_TRANSFER_TIMEOUT_MS = '1000'
  })

  beforeEach(() => {
    vi.useFakeTimers()
    azure.create.mockReset().mockResolvedValue({})
    azure.deleteIfExists.mockReset().mockResolvedValue({ succeeded: true })
    azure.download.mockReset().mockResolvedValue({
      readableStreamBody: (async function* () {
        yield Buffer.from('stored bytes')
      })(),
    })
    azure.exists.mockReset().mockResolvedValue(true)
    azure.getAccessPolicy
      .mockReset()
      .mockResolvedValue({ blobPublicAccess: undefined })
    azure.getProperties.mockReset().mockResolvedValue({
      contentLength: 12,
      contentType: 'image/png',
    })
    azure.uploadData.mockReset().mockResolvedValue({})
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  afterAll(() => {
    restoreEnv('BLOB_STORAGE_ACCOUNT_NAME', PREVIOUS_ENV.account)
    restoreEnv('BLOB_STORAGE_ACCESS_KEY', PREVIOUS_ENV.key)
    restoreEnv(
      'IMPORT_EXPORT_AZURE_METADATA_TIMEOUT_MS',
      PREVIOUS_ENV.metadataTimeout
    )
    restoreEnv('NODE_ENV', PREVIOUS_ENV.nodeEnv)
    restoreEnv('IMPORT_EXPORT_PACKAGE_STORAGE', PREVIOUS_ENV.storage)
    restoreEnv(
      'IMPORT_EXPORT_AZURE_TRANSFER_TIMEOUT_MS',
      PREVIOUS_ENV.transferTimeout
    )
  })

  it('aborts a hung exclusive package write with a stable infrastructure error', async () => {
    azure.uploadData.mockImplementationOnce(never)

    const error = await settleDeadline(
      writeAzurePackageBlobExclusive('exports/owner/artifact.zip', Buffer.of(1))
    )

    expectInfrastructureDeadline(error)
    const options = azure.uploadData.mock.calls[0]?.[3] as {
      abortSignal?: AbortSignal
    }
    expect(options.abortSignal?.aborted).toBe(true)
  })

  it('aborts hung package reads, metadata, deletes, and SAS fetches', async () => {
    azure.download.mockImplementationOnce(never)
    expectInfrastructureDeadline(
      await settleDeadline(readAzurePackageBlob('imports/owner/artifact.zip'))
    )
    expect(
      (azure.download.mock.calls[0]?.[4] as { abortSignal?: AbortSignal })
        .abortSignal?.aborted
    ).toBe(true)

    azure.getProperties.mockImplementationOnce(never)
    expectInfrastructureDeadline(
      await settleDeadline(getAzureImportedMediaProperties(LOCATION))
    )
    expect(
      (
        azure.getProperties.mock.calls[0]?.[2] as {
          abortSignal?: AbortSignal
        }
      ).abortSignal?.aborted
    ).toBe(true)

    azure.deleteIfExists.mockImplementationOnce(never)
    expectInfrastructureDeadline(
      await settleDeadline(deleteAzureImportedMediaIfExists(LOCATION))
    )
    expect(
      (
        azure.deleteIfExists.mock.calls[0]?.[2] as {
          abortSignal?: AbortSignal
        }
      ).abortSignal?.aborted
    ).toBe(true)

    const fetchMock = vi.fn<
      (input: string | URL | Request, init?: RequestInit) => Promise<Response>
    >(() => never())
    vi.stubGlobal('fetch', fetchMock)
    const deleteCallsBeforePreflight = azure.deleteIfExists.mock.calls.length
    expectInfrastructureDeadline(
      await settleDeadline(
        checkImportExportPackageStorageReadiness({ sasRoundTrip: true })
      )
    )
    expect(
      (fetchMock.mock.calls[0]?.[1] as { signal?: AbortSignal }).signal?.aborted
    ).toBe(true)
    expect(azure.deleteIfExists).toHaveBeenCalledTimes(
      deleteCallsBeforePreflight + 1
    )
  })

  it('fails a media-hash backfill on storage timeout without persisting a false hash', async () => {
    const href = `https://testaccount.blob.core.windows.net/${OWNER_ID}/${BLOB_NAME}`
    const mediaId = randomUUID()
    azure.getProperties.mockImplementationOnce(never)
    const updateMany = vi.fn()
    const executeRaw = vi.fn(async () => 1)
    const error = await settleDeadline(
      backfillMediaHashBatch({}, {
        $executeRaw: executeRaw,
        mediaFile: {
          findMany: vi.fn(async () => [{ id: mediaId, href }]),
          findUnique: vi.fn(async () => ({
            id: mediaId,
            name: 'media.png',
            originalId: null,
            ownerId: OWNER_ID,
            type: 'image/png',
          })),
          updateMany,
        },
      } as any)
    )

    expectInfrastructureDeadline(error)
    expect(executeRaw).toHaveBeenCalledTimes(1)
    expect(updateMany).not.toHaveBeenCalled()
  })

  it('keeps a cleanup ledger when blob deletion times out', async () => {
    azure.deleteIfExists.mockImplementationOnce(never)
    const stagingId = randomUUID()
    const updateMany = vi.fn(async () => ({ count: 1 }))
    const deleteMany = vi.fn(async () => ({ count: 1 }))
    const findMany = vi
      .fn()
      .mockResolvedValueOnce([
        {
          id: stagingId,
          ownerId: OWNER_ID,
          state: ImportMediaStagingState.RESERVED,
          storageContainer: OWNER_ID,
          storageBlob: BLOB_NAME,
          createdBlob: false,
          expiresAt: new Date(0),
        },
      ])
      .mockResolvedValue([])

    const result = await settleDeadline(
      cleanupOrphanedImportedMediaFiles({
        now: new Date(),
        prisma: {
          importMediaStaging: { findMany, updateMany, deleteMany },
        } as any,
      })
    )

    expect(result).toMatchObject({
      failedMediaCleanups: 1,
      deletedStagingRecords: 0,
    })
    expect(updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { state: ImportMediaStagingState.CLEANUP_PENDING },
      })
    )
    expect(deleteMany).not.toHaveBeenCalled()
  })
})
