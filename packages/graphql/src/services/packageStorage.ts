import {
  BlobSASPermissions,
  BlobServiceClient,
  generateBlobSASQueryParameters,
  StorageSharedKeyCredential,
  type ContainerClient,
} from '@azure/storage-blob'
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

const PACKAGE_CONTAINER_NAME = 'klicker-import-export'
const ZIP_CONTENT_TYPE = 'application/zip'
const LOCAL_PACKAGE_ROUTE = '/api/import-export-packages'
const PACKAGE_TTL_HOURS_ENV = 'IMPORT_EXPORT_PACKAGE_TTL_HOURS'
const PACKAGE_PREFIXES = ['imports/', 'exports/'] as const

export function isLocalImportExportPackageStorageEnabled() {
  return (
    process.env.NODE_ENV === 'test' &&
    process.env.IMPORT_EXPORT_PACKAGE_STORAGE !== 'azure'
  )
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
}: {
  now?: Date
  ttlHours?: number
} = {}) {
  const cutoffMs = dayjs(now).subtract(ttlHours, 'hours').valueOf()

  if (isLocalImportExportPackageStorageEnabled()) {
    return {
      deletedPackages: await cleanupLocalImportExportPackages(cutoffMs),
    }
  }

  const containerClient = await getExistingPackageContainerClient()
  if (!containerClient) {
    return { deletedPackages: 0 }
  }

  return {
    deletedPackages: await cleanupAzureImportExportPackages(
      containerClient,
      cutoffMs
    ),
  }
}

export const handleCleanupImportExportPackages: HatchetHandlers['handleCleanupImportExportPackages'] =
  async (_, __, executionCtx) => {
    const result = await cleanupImportExportPackages()
    executionCtx.logger.info(
      `[INFO] [CleanupImportExportPackages] Deleted ${result.deletedPackages} temporary import/export packages`
    )

    return true
  }

function getStorageAccount() {
  return `https://${
    process.env.BLOB_STORAGE_ACCOUNT_NAME as string
  }.blob.core.windows.net`
}

function getSharedKeyCredential() {
  return new StorageSharedKeyCredential(
    process.env.BLOB_STORAGE_ACCOUNT_NAME as string,
    process.env.BLOB_STORAGE_ACCESS_KEY as string
  )
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

function readPositiveIntegerEnv(name: string, fallback: number) {
  const value = Number(process.env[name])
  return Number.isInteger(value) && value > 0 ? value : fallback
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

export async function downloadElementImportPackage(
  { blobName }: { blobName: string },
  ctx: ContextWithUser
) {
  assertUserPackageBlob(blobName, ctx)

  if (isLocalImportExportPackageStorageEnabled()) {
    return await readLocalImportExportPackageBlob(blobName)
  }

  const containerClient = await getPackageContainerClient()
  const blobClient = containerClient.getBlobClient(blobName)
  const exists = await blobClient.exists()

  if (!exists) {
    throw new Error('Import package could not be found.')
  }

  return await blobClient.downloadToBuffer()
}
