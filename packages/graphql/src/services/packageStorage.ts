import {
  BlobSASPermissions,
  BlobServiceClient,
  generateBlobSASQueryParameters,
  StorageSharedKeyCredential,
  type ContainerClient,
} from '@azure/storage-blob'
import type { PrismaClient } from '@klicker-uzh/prisma/client'
import type { HatchetHandlers } from '@klicker-uzh/types'
import dayjs from 'dayjs'
import { randomUUID } from 'node:crypto'
import {
  mkdir,
  readdir,
  readFile,
  rmdir,
  stat,
  unlink,
  writeFile,
} from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import type { ContextWithUser } from '../lib/context.js'
import {
  isImportExportLocalRuntime,
  MAX_IMPORT_EXPORT_PACKAGE_BYTES,
  readPositiveIntegerEnv,
} from '../lib/importExportPackageConfig.js'
import { cleanupOrphanedImportedMediaFiles } from './mediaStorage.js'

const PACKAGE_CONTAINER_NAME = 'klicker-import-export'
const ZIP_CONTENT_TYPE = 'application/zip'
const LOCAL_PACKAGE_ROUTE = '/api/import-export-packages'
const PACKAGE_TTL_HOURS_ENV = 'IMPORT_EXPORT_PACKAGE_TTL_HOURS'
const PACKAGE_PREFIXES = ['imports/', 'exports/'] as const

export function isLocalImportExportPackageStorageEnabled() {
  assertImportExportPackageStorageConfig()

  return (
    process.env.IMPORT_EXPORT_PACKAGE_STORAGE === 'local' ||
    (process.env.NODE_ENV === 'test' &&
      process.env.IMPORT_EXPORT_PACKAGE_STORAGE !== 'azure')
  )
}

export function assertImportExportPackageStorageConfig() {
  if (isImportExportLocalRuntime()) {
    return
  }

  if (
    process.env.IMPORT_EXPORT_PACKAGE_STORAGE &&
    process.env.IMPORT_EXPORT_PACKAGE_STORAGE !== 'azure'
  ) {
    throw new Error(
      'Local import/export package storage must not be enabled outside development and test.'
    )
  }

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
    throw new Error('Invalid package reference.')
  }

  return blobPath
}

function encodeLocalPackageBlobName(blobName: string) {
  return Buffer.from(blobName, 'utf8').toString('base64url')
}

export function decodeLocalImportExportPackageBlobName(
  encodedBlobName: string
) {
  return Buffer.from(encodedBlobName, 'base64url').toString('utf8')
}

function getLocalPackageUrl(blobName: string) {
  const apiOrigin = process.env.APP_ORIGIN_API ?? 'http://127.0.0.1:3000'
  return `${apiOrigin.replace(/\/$/, '')}${LOCAL_PACKAGE_ROUTE}/${encodeLocalPackageBlobName(
    blobName
  )}`
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

async function readStreamWithLimit(
  stream: NodeJS.ReadableStream | undefined,
  maxBytes: number
) {
  if (!stream) {
    throw new Error('Import package could not be downloaded.')
  }

  const chunks: Buffer[] = []
  let totalBytes = 0

  for await (const chunk of stream) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    totalBytes += buffer.length

    if (totalBytes > maxBytes) {
      throw new Error('Import package is too large.')
    }

    chunks.push(buffer)
  }

  return Buffer.concat(chunks, totalBytes)
}

async function cleanupLocalDirectory(directory: string, cutoffMs: number) {
  let entries

  try {
    entries = await readdir(directory, { withFileTypes: true })
  } catch (error: any) {
    if (error?.code === 'ENOENT') {
      return 0
    }

    throw error
  }

  let deleted = 0

  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name)

    if (entry.isDirectory()) {
      deleted += await cleanupLocalDirectory(entryPath, cutoffMs)
      await rmdir(entryPath).catch(() => undefined)
      continue
    }

    if (!entry.isFile()) {
      continue
    }

    const stats = await stat(entryPath)
    if (stats.mtimeMs < cutoffMs) {
      await unlink(entryPath)
      deleted++
    }
  }

  return deleted
}

async function cleanupLocalImportExportPackages(cutoffMs: number) {
  const root = getLocalPackageRoot()
  let deleted = 0

  for (const prefix of PACKAGE_PREFIXES) {
    deleted += await cleanupLocalDirectory(
      path.join(root, prefix.replace(/\/$/, '')),
      cutoffMs
    )
  }

  return deleted
}

async function cleanupAzureImportExportPackages(
  containerClient: ContainerClient,
  cutoffMs: number
) {
  let deleted = 0

  for (const prefix of PACKAGE_PREFIXES) {
    for await (const blob of containerClient.listBlobsFlat({ prefix })) {
      const lastModified = blob.properties.lastModified
      if (!lastModified || lastModified.getTime() >= cutoffMs) {
        continue
      }

      await containerClient.deleteBlob(blob.name)
      deleted++
    }
  }

  return deleted
}

export async function cleanupImportExportPackages({
  now = new Date(),
  ttlHours = getImportExportPackageTtlHours(),
  prisma,
}: {
  now?: Date
  ttlHours?: number
  prisma?: PrismaClient
} = {}) {
  const cutoffMs = dayjs(now).subtract(ttlHours, 'hours').valueOf()
  let deletedPackages = 0

  if (isLocalImportExportPackageStorageEnabled()) {
    deletedPackages = await cleanupLocalImportExportPackages(cutoffMs)
  } else {
    const containerClient = await getExistingPackageContainerClient()
    if (containerClient) {
      deletedPackages = await cleanupAzureImportExportPackages(
        containerClient,
        cutoffMs
      )
    }
  }

  const { deletedMediaFiles } = prisma
    ? await cleanupOrphanedImportedMediaFiles({ prisma, now, ttlHours })
    : { deletedMediaFiles: 0 }

  return {
    deletedPackages,
    deletedMediaFiles,
  }
}

export const handleCleanupImportExportPackages: HatchetHandlers['handleCleanupImportExportPackages'] =
  async (_, globalCtx, executionCtx) => {
    const result = await cleanupImportExportPackages({
      prisma: globalCtx.prisma,
    })
    executionCtx.logger.info(
      `[INFO] [CleanupImportExportPackages] Deleted ${result.deletedPackages} temporary import/export packages and ${result.deletedMediaFiles} orphaned imported media files`
    )

    return true
  }

function getStorageAccount() {
  const accountName = process.env.BLOB_STORAGE_ACCOUNT_NAME
  if (!accountName) {
    throw new Error('Blob storage account name is not configured.')
  }

  return `https://${accountName}.blob.core.windows.net`
}

function getSharedKeyCredential() {
  const accountName = process.env.BLOB_STORAGE_ACCOUNT_NAME
  const accessKey = process.env.BLOB_STORAGE_ACCESS_KEY
  if (!accountName || !accessKey) {
    throw new Error('Blob storage credentials are not configured.')
  }

  return new StorageSharedKeyCredential(accountName, accessKey)
}

function getPackageBlobServiceClient() {
  return new BlobServiceClient(getStorageAccount(), getSharedKeyCredential())
}

async function getPackageContainerClient() {
  const client = getPackageBlobServiceClient()
  const containerClient = client.getContainerClient(PACKAGE_CONTAINER_NAME)

  if (!(await containerClient.exists())) {
    await containerClient.create()
  }

  return containerClient
}

async function getExistingPackageContainerClient() {
  const containerClient = getPackageBlobServiceClient().getContainerClient(
    PACKAGE_CONTAINER_NAME
  )

  if (!(await containerClient.exists())) {
    return null
  }

  return containerClient
}

function getImportExportPackageTtlHours() {
  return readPositiveIntegerEnv(PACKAGE_TTL_HOURS_ENV, 24)
}

function sanitizeFilename(filename: string) {
  const sanitized = filename
    .toLowerCase()
    .replace(/[^a-z0-9_.-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')

  return sanitized.endsWith('.zip')
    ? sanitized
    : `${sanitized || 'package'}.zip`
}

function sanitizeBlobFilename(filename: string) {
  const sanitized = filename
    .toLowerCase()
    .replace(/[^a-z0-9_.-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')

  return sanitized || 'download'
}

function assertUserPackageBlob(blobName: string, ctx: ContextWithUser) {
  const importPrefix = `imports/${ctx.user.sub}/`
  const exportPrefix = `exports/${ctx.user.sub}/`

  if (
    !blobName.startsWith(importPrefix) &&
    !blobName.startsWith(exportPrefix)
  ) {
    throw new Error('Invalid package reference.')
  }
}

function createBlobSasUrl({
  blobName,
  permissions,
  contentType,
  expiresOn,
}: {
  blobName: string
  permissions: string
  contentType?: string
  expiresOn: Date
}) {
  const queryParams = generateBlobSASQueryParameters(
    {
      containerName: PACKAGE_CONTAINER_NAME,
      permissions: BlobSASPermissions.parse(permissions),
      expiresOn,
      blobName,
      contentType,
    },
    getSharedKeyCredential()
  )

  return `${getStorageAccount()}/${PACKAGE_CONTAINER_NAME}/${blobName}?${queryParams}`
}

export async function prepareElementImportPackageUpload(
  { filename }: { filename: string },
  ctx: ContextWithUser
) {
  const expiresAt = dayjs().add(15, 'minutes')
  const blobName = `imports/${ctx.user.sub}/${randomUUID()}-${sanitizeFilename(
    filename
  )}`

  if (isLocalImportExportPackageStorageEnabled()) {
    return {
      uploadSasURL: getLocalPackageUrl(blobName),
      blobName,
      expiresAt: expiresAt.toDate(),
    }
  }

  await getPackageContainerClient()

  return {
    uploadSasURL: createBlobSasUrl({
      blobName,
      permissions: 'cw',
      contentType: ZIP_CONTENT_TYPE,
      expiresOn: expiresAt.toDate(),
    }),
    blobName,
    expiresAt: expiresAt.toDate(),
  }
}

export async function uploadPrivateImportExportBlob(
  {
    filename,
    buffer,
    contentType,
  }: {
    filename: string
    buffer: Buffer
    contentType: string
  },
  ctx: ContextWithUser
) {
  const blobName = `exports/${ctx.user.sub}/${randomUUID()}-${sanitizeBlobFilename(
    filename
  )}`

  if (isLocalImportExportPackageStorageEnabled()) {
    await writeLocalImportExportPackageBlob(blobName, buffer)

    const expiresAt = dayjs().add(15, 'minutes')
    return {
      downloadLink: getLocalPackageUrl(blobName),
      filename: sanitizeBlobFilename(filename),
      expiresAt: expiresAt.toDate(),
    }
  }

  const containerClient = await getPackageContainerClient()
  const blockBlobClient = containerClient.getBlockBlobClient(blobName)

  await blockBlobClient.uploadData(buffer, {
    blobHTTPHeaders: {
      blobContentType: contentType,
    },
  })

  const expiresAt = dayjs().add(15, 'minutes')
  return {
    downloadLink: createBlobSasUrl({
      blobName,
      permissions: 'r',
      contentType,
      expiresOn: expiresAt.toDate(),
    }),
    filename: sanitizeBlobFilename(filename),
    expiresAt: expiresAt.toDate(),
  }
}

export async function uploadElementExportPackage(
  {
    filename,
    buffer,
  }: {
    filename: string
    buffer: Buffer
  },
  ctx: ContextWithUser
) {
  return await uploadPrivateImportExportBlob(
    {
      filename: sanitizeFilename(filename),
      buffer,
      contentType: ZIP_CONTENT_TYPE,
    },
    ctx
  )
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

  const containerClient = await getPackageContainerClient()
  const result = {
    containerName: PACKAGE_CONTAINER_NAME,
    sasRoundTrip,
  }

  if (!sasRoundTrip) {
    return result
  }

  const blobName = `preflight/${randomUUID()}-import-export-preflight.txt`
  const contentType = 'text/plain'
  const body = 'klicker import/export preflight'
  const expiresOn = dayjs().add(15, 'minutes').toDate()

  const uploadUrl = createBlobSasUrl({
    blobName,
    permissions: 'cw',
    contentType,
    expiresOn,
  })
  const uploadResponse = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      'x-ms-blob-type': 'BlockBlob',
      'Content-Type': contentType,
    },
    body,
  })

  if (!uploadResponse.ok) {
    throw new Error(
      `Import/export package SAS upload preflight failed with HTTP ${uploadResponse.status}.`
    )
  }

  try {
    const downloadUrl = createBlobSasUrl({
      blobName,
      permissions: 'r',
      contentType,
      expiresOn,
    })
    const downloadResponse = await fetch(downloadUrl)

    if (!downloadResponse.ok) {
      throw new Error(
        `Import/export package SAS download preflight failed with HTTP ${downloadResponse.status}.`
      )
    }

    if ((await downloadResponse.text()) !== body) {
      throw new Error('Import/export package SAS preflight payload mismatch.')
    }
  } finally {
    await containerClient.deleteBlob(blobName).catch((error) => {
      console.error(
        '[ImportExportPackageStorage] Failed to delete package storage preflight blob',
        error
      )
    })
  }

  return result
}

export async function downloadElementImportPackage(
  { blobName }: { blobName: string },
  ctx: ContextWithUser
) {
  assertUserPackageBlob(blobName, ctx)

  if (isLocalImportExportPackageStorageEnabled()) {
    const buffer = await readLocalImportExportPackageBlob(blobName)
    if (buffer.length > MAX_IMPORT_EXPORT_PACKAGE_BYTES) {
      throw new Error('Import package is too large.')
    }

    return buffer
  }

  const containerClient = await getPackageContainerClient()
  const blobClient = containerClient.getBlobClient(blobName)
  let properties

  try {
    properties = await blobClient.getProperties()
  } catch {
    throw new Error('Import package could not be found.')
  }

  if (
    typeof properties.contentLength === 'number' &&
    properties.contentLength > MAX_IMPORT_EXPORT_PACKAGE_BYTES
  ) {
    await blobClient.deleteIfExists().catch((error) => {
      console.error(
        '[ImportExportPackageStorage] Failed to delete oversized import/export package blob',
        error
      )
    })
    throw new Error('Import package is too large.')
  }

  const response = await blobClient.download()
  return await readStreamWithLimit(
    response.readableStreamBody,
    MAX_IMPORT_EXPORT_PACKAGE_BYTES
  )
}
