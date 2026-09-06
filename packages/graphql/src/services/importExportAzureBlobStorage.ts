import {
  BlobServiceClient,
  StorageSharedKeyCredential,
} from '@azure/storage-blob'
import { IMPORT_EXPORT_PACKAGE_CONTAINER } from '../lib/importExportCapabilities.js'
import {
  ImportExportDomainError,
  ImportExportErrorCode,
} from '../lib/importExportErrors.js'
import { MAX_IMPORT_EXPORT_PACKAGE_BYTES } from '../lib/importExportPackageConfig.js'
import { MediaExportOmissionError } from '../lib/mediaErrors.js'
import { withImportExportStorageDeadline } from './importExportStorageDeadline.js'

const ZIP_CONTENT_TYPE = 'application/zip'

export type AzureImportedMediaLocation = Readonly<{
  containerName: string
  blobName: string
}>

function getStorageAccountName() {
  return process.env.BLOB_STORAGE_ACCOUNT_NAME
}

function getStorageAccessKey() {
  return process.env.BLOB_STORAGE_ACCESS_KEY
}

export function isAzureImportExportStorageConfigured() {
  return Boolean(getStorageAccountName() && getStorageAccessKey())
}

export function getAzureImportExportStorageAccountUrl() {
  const accountName = getStorageAccountName()
  if (!accountName) {
    throw new Error('Blob storage account name is not configured.')
  }

  return `https://${accountName}.blob.core.windows.net`
}

export function getAzureImportExportSharedKeyCredential() {
  const accountName = getStorageAccountName()
  const accessKey = getStorageAccessKey()

  if (!accountName || !accessKey) {
    throw new Error('Blob storage credentials are not configured.')
  }

  return new StorageSharedKeyCredential(accountName, accessKey)
}

function getBlobServiceClient() {
  return new BlobServiceClient(
    getAzureImportExportStorageAccountUrl(),
    getAzureImportExportSharedKeyCredential()
  )
}

async function getOrCreatePackageContainer() {
  const containerClient = getBlobServiceClient().getContainerClient(
    IMPORT_EXPORT_PACKAGE_CONTAINER
  )

  await withImportExportStorageDeadline('metadata', async (abortSignal) => {
    if (!(await containerClient.exists({ abortSignal }))) {
      await containerClient.createIfNotExists({ abortSignal })
    }

    const accessPolicy = await containerClient.getAccessPolicy({ abortSignal })
    if (accessPolicy.blobPublicAccess) {
      throw new Error('Import/export package storage must be private.')
    }
  })

  return containerClient
}

async function getExistingPackageContainer() {
  const containerClient = getBlobServiceClient().getContainerClient(
    IMPORT_EXPORT_PACKAGE_CONTAINER
  )
  const exists = await withImportExportStorageDeadline(
    'metadata',
    async (abortSignal) => await containerClient.exists({ abortSignal })
  )
  return exists ? containerClient : null
}

async function readStreamWithLimit(
  stream: NodeJS.ReadableStream | undefined,
  maxBytes: number,
  tooLarge: () => Error
) {
  if (!stream) {
    throw new ImportExportDomainError(
      ImportExportErrorCode.INFRASTRUCTURE_FAILURE
    )
  }

  const chunks: Buffer[] = []
  let totalBytes = 0

  for await (const chunk of stream) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    totalBytes += buffer.length
    if (totalBytes > maxBytes) throw tooLarge()
    chunks.push(buffer)
  }

  return Buffer.concat(chunks, totalBytes)
}

export async function writeAzurePackageBlobExclusive(
  blobName: string,
  buffer: Buffer
) {
  const containerClient = await getOrCreatePackageContainer()
  await withImportExportStorageDeadline('transfer', async (abortSignal) => {
    await containerClient.getBlockBlobClient(blobName).uploadData(buffer, {
      abortSignal,
      conditions: { ifNoneMatch: '*' },
      blobHTTPHeaders: {
        blobContentType: ZIP_CONTENT_TYPE,
        blobCacheControl: 'private, no-store',
      },
    })
  })
}

export async function deleteAzurePackageBlobIfExists(blobName: string) {
  const containerClient = await getExistingPackageContainer()
  if (!containerClient) return false

  return await withImportExportStorageDeadline(
    'transfer',
    async (abortSignal) =>
      (
        await containerClient
          .getBlobClient(blobName)
          .deleteIfExists({ abortSignal })
      ).succeeded
  )
}

export async function getAzurePackageBlobProperties(blobName: string) {
  const containerClient = await getOrCreatePackageContainer()
  return await withImportExportStorageDeadline(
    'metadata',
    async (abortSignal) =>
      await containerClient
        .getBlobClient(blobName)
        .getProperties({ abortSignal })
  )
}

export async function readAzurePackageBlob(blobName: string) {
  const containerClient = await getOrCreatePackageContainer()
  const blobClient = containerClient.getBlobClient(blobName)

  return await withImportExportStorageDeadline(
    'transfer',
    async (abortSignal) => {
      const response = await blobClient.download(0, undefined, { abortSignal })
      return await readStreamWithLimit(
        response.readableStreamBody,
        MAX_IMPORT_EXPORT_PACKAGE_BYTES,
        () =>
          new ImportExportDomainError(ImportExportErrorCode.PACKAGE_TOO_LARGE)
      )
    }
  )
}

export async function writeAzurePreflightBlob({
  blobName,
  body,
  contentType,
}: {
  blobName: string
  body: string
  contentType: string
}) {
  const containerClient = await getOrCreatePackageContainer()
  await withImportExportStorageDeadline('transfer', async (abortSignal) => {
    await containerClient
      .getBlockBlobClient(blobName)
      .uploadData(Buffer.from(body), {
        abortSignal,
        blobHTTPHeaders: {
          blobContentType: contentType,
          blobCacheControl: 'private, no-store',
        },
      })
  })
}

export async function fetchAzurePreflightBlob(downloadUrl: string) {
  return await withImportExportStorageDeadline(
    'transfer',
    async (abortSignal) => {
      const response = await fetch(downloadUrl, { signal: abortSignal })
      return {
        ok: response.ok,
        status: response.status,
        body: await response.text(),
      }
    }
  )
}

async function getOrCreateImportedMediaContainer(containerName: string) {
  const containerClient =
    getBlobServiceClient().getContainerClient(containerName)
  await withImportExportStorageDeadline('metadata', async (abortSignal) => {
    if (!(await containerClient.exists({ abortSignal }))) {
      await containerClient.createIfNotExists({
        access: 'blob',
        abortSignal,
      })
    }
  })
  return containerClient
}

function getImportedMediaBlobClient(location: AzureImportedMediaLocation) {
  return getBlobServiceClient()
    .getContainerClient(location.containerName)
    .getBlobClient(location.blobName)
}

export async function getAzureImportedMediaProperties(
  location: AzureImportedMediaLocation
) {
  const blobClient = getImportedMediaBlobClient(location)
  return await withImportExportStorageDeadline(
    'metadata',
    async (abortSignal) => await blobClient.getProperties({ abortSignal })
  )
}

export async function readAzureImportedMedia(
  location: AzureImportedMediaLocation,
  maxBytes: number
) {
  const blobClient = getImportedMediaBlobClient(location)
  return await withImportExportStorageDeadline(
    'transfer',
    async (abortSignal) => {
      const response = await blobClient.download(0, undefined, { abortSignal })
      return await readStreamWithLimit(
        response.readableStreamBody,
        maxBytes,
        () => new MediaExportOmissionError('too-large')
      )
    }
  )
}

export async function deleteAzureImportedMediaIfExists(
  location: AzureImportedMediaLocation
) {
  const blobClient = getImportedMediaBlobClient(location)
  return await withImportExportStorageDeadline(
    'transfer',
    async (abortSignal) =>
      (await blobClient.deleteIfExists({ abortSignal })).succeeded
  )
}

export async function writeAzureImportedMediaExclusive({
  location,
  buffer,
  contentType,
  contentHash,
}: {
  location: AzureImportedMediaLocation
  buffer: Buffer
  contentType: string
  contentHash: string
}) {
  const containerClient = await getOrCreateImportedMediaContainer(
    location.containerName
  )
  await withImportExportStorageDeadline('transfer', async (abortSignal) => {
    await containerClient
      .getBlockBlobClient(location.blobName)
      .uploadData(buffer, {
        abortSignal,
        blobHTTPHeaders: { blobContentType: contentType },
        conditions: { ifNoneMatch: '*' },
        metadata: { sha256: contentHash },
      })
  })
}
