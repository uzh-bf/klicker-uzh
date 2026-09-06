import {
  BlobSASPermissions,
  generateBlobSASQueryParameters,
  SASProtocol,
} from '@azure/storage-blob'
import dayjs from 'dayjs'
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { IMPORT_EXPORT_PACKAGE_CONTAINER } from '../lib/importExportCapabilities.js'
import {
  ImportExportDomainError,
  ImportExportErrorCode,
} from '../lib/importExportErrors.js'
import {
  isImportExportLocalRuntime,
  MAX_IMPORT_EXPORT_PACKAGE_BYTES,
} from '../lib/importExportPackageConfig.js'
import { getImportExportRuntimeConfig } from '../lib/importExportRuntimeConfig.js'
import {
  deleteAzurePackageBlobIfExists,
  fetchAzurePreflightBlob,
  getAzureImportExportSharedKeyCredential,
  getAzureImportExportStorageAccountUrl,
  getAzurePackageBlobProperties,
  readAzurePackageBlob,
  writeAzurePackageBlobExclusive,
  writeAzurePreflightBlob,
} from './importExportAzureBlobStorage.js'

const PACKAGE_CONTAINER_NAME = IMPORT_EXPORT_PACKAGE_CONTAINER

export function isLocalImportExportPackageStorageEnabled() {
  assertImportExportPackageStorageConfig()
  return getImportExportRuntimeConfig().packageStorage === 'local'
}

export function assertImportExportPackageStorageConfig() {
  if (isImportExportLocalRuntime()) {
    return
  }

  getImportExportRuntimeConfig()

  if (
    !process.env.BLOB_STORAGE_ACCOUNT_NAME ||
    !process.env.BLOB_STORAGE_ACCESS_KEY
  ) {
    throw new Error(
      'Azure blob storage credentials must be configured for import/export packages in production.'
    )
  }
}

function getLocalPackageRoot() {
  return (
    process.env.LOCAL_IMPORT_EXPORT_PACKAGE_DIR ??
    path.join(tmpdir(), 'klicker-import-export-packages')
  )
}

function getLocalPackagePath(blobName: string) {
  const root = getLocalPackageRoot()
  const blobPath = path.resolve(root, blobName)

  if (!blobPath.startsWith(`${path.resolve(root)}${path.sep}`)) {
    throw new ImportExportDomainError(ImportExportErrorCode.UNSAFE_REFERENCE)
  }

  return blobPath
}

export async function writeLocalImportExportPackageBlob(
  blobName: string,
  buffer: Buffer
) {
  const blobPath = getLocalPackagePath(blobName)
  await mkdir(path.dirname(blobPath), { recursive: true })
  await writeFile(blobPath, buffer)
}

export async function readLocalImportExportPackageBlob(blobName: string) {
  return await readFile(getLocalPackagePath(blobName))
}

export function createPackageReadSasUrl({
  blobName,
  contentType,
  expiresOn,
}: {
  blobName: string
  contentType?: string
  expiresOn: Date
}) {
  const queryParams = generateBlobSASQueryParameters(
    {
      containerName: PACKAGE_CONTAINER_NAME,
      permissions: BlobSASPermissions.parse('r'),
      protocol: SASProtocol.Https,
      expiresOn,
      blobName,
      contentType,
      cacheControl: 'private, no-store',
    },
    getAzureImportExportSharedKeyCredential()
  )

  return `${getAzureImportExportStorageAccountUrl()}/${PACKAGE_CONTAINER_NAME}/${blobName}?${queryParams}`
}

export async function writePackageArtifactBlobExclusive(
  blobName: string,
  buffer: Buffer
) {
  if (isLocalImportExportPackageStorageEnabled()) {
    const blobPath = getLocalPackagePath(blobName)
    await mkdir(path.dirname(blobPath), { recursive: true })
    await writeFile(blobPath, buffer, { flag: 'wx' })
    return
  }

  await writeAzurePackageBlobExclusive(blobName, buffer)
}

export async function deletePackageArtifactBlobIfExists(blobName: string) {
  if (isLocalImportExportPackageStorageEnabled()) {
    try {
      await unlink(getLocalPackagePath(blobName))
    } catch (error: unknown) {
      if (
        !error ||
        typeof error !== 'object' ||
        Reflect.get(error, 'code') !== 'ENOENT'
      ) {
        throw error
      }
    }
    return
  }

  await deleteAzurePackageBlobIfExists(blobName)
}

export async function readPackageArtifactBlob(
  blobName: string,
  { deleteOversized = false }: { deleteOversized?: boolean } = {}
) {
  if (isLocalImportExportPackageStorageEnabled()) {
    const buffer = await readLocalImportExportPackageBlob(blobName)
    if (buffer.length > MAX_IMPORT_EXPORT_PACKAGE_BYTES) {
      throw new ImportExportDomainError(ImportExportErrorCode.PACKAGE_TOO_LARGE)
    }
    return buffer
  }

  const properties = await getAzurePackageBlobProperties(blobName)
  if (
    typeof properties.contentLength === 'number' &&
    properties.contentLength > MAX_IMPORT_EXPORT_PACKAGE_BYTES
  ) {
    if (deleteOversized) {
      // Do not mask an indeterminate cleanup as a package-validation result.
      // The caller's durable artifact ledger must remain for later cleanup.
      await deleteAzurePackageBlobIfExists(blobName)
    }
    throw new ImportExportDomainError(ImportExportErrorCode.PACKAGE_TOO_LARGE)
  }

  return await readAzurePackageBlob(blobName)
}

export async function checkImportExportPackageStorageReadiness({
  sasRoundTrip = false,
}: {
  sasRoundTrip?: boolean
} = {}) {
  assertImportExportPackageStorageConfig()

  if (isLocalImportExportPackageStorageEnabled()) {
    throw new Error(
      'Import/export production readiness requires Azure package storage.'
    )
  }

  const result = {
    containerName: PACKAGE_CONTAINER_NAME,
    sasRoundTrip,
  }

  if (!sasRoundTrip) {
    return result
  }

  // One stable private target makes an interrupted preflight recoverable by
  // the next run instead of accumulating untracked random blobs.
  const blobName = 'preflight/import-export-preflight.txt'
  const contentType = 'text/plain'
  const body = 'klicker import/export preflight'
  const expiresOn = dayjs().add(15, 'minutes').toDate()

  try {
    await writeAzurePreflightBlob({
      blobName,
      body,
      contentType,
    })

    const downloadUrl = createPackageReadSasUrl({
      blobName,
      contentType,
      expiresOn,
    })
    const downloadResponse = await fetchAzurePreflightBlob(downloadUrl)

    if (!downloadResponse.ok) {
      throw new Error(
        `Import/export package SAS download preflight failed with HTTP ${downloadResponse.status}.`
      )
    }

    if (downloadResponse.body !== body) {
      throw new Error('Import/export package SAS preflight payload mismatch.')
    }
  } finally {
    // A deletion timeout is an infrastructure failure. Do not report a green
    // readiness check while the state of the preflight target is unknown.
    await deleteAzurePackageBlobIfExists(blobName)
  }

  return result
}
