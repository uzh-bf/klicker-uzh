import {
  BlobServiceClient,
  StorageSharedKeyCredential,
} from '@azure/storage-blob'
import type { PrismaClient } from '@klicker-uzh/prisma/client'
import { randomUUID } from 'node:crypto'
import path from 'node:path'
import type {
  ContextWithUser,
  PrismaTransactionContextWithUser,
} from '../lib/context.js'
import { MAX_IMPORT_EXPORT_MEDIA_BYTES } from '../lib/importExportPackageConfig.js'
import {
  DEFAULT_MEDIA_CONTENT_TYPE,
  inferMediaFileExtension,
} from '../lib/mediaContentTypes.js'

const PACKAGE_CONTAINER_NAME = 'klicker-import-export'
const IMPORTED_MEDIA_PREFIX = 'imported/'

type BlobLocation = {
  containerName: string
  blobName: string
}

type MediaContext = ContextWithUser | PrismaTransactionContextWithUser

export type StagedImportedMediaFile = {
  id: string
  href: string
  ownerId: string
  contentType: string
  filename: string
  originalId: string
  createdBlob: boolean
}

function getStorageAccountName() {
  return process.env.BLOB_STORAGE_ACCOUNT_NAME
}

function getStorageAccessKey() {
  return process.env.BLOB_STORAGE_ACCESS_KEY
}

export function isImportExportMediaStorageConfigured() {
  return Boolean(getStorageAccountName() && getStorageAccessKey())
}

function getStorageAccount() {
  const accountName = getStorageAccountName()
  if (!accountName) {
    throw new Error('Blob storage account name is not configured.')
  }

  return `https://${accountName}.blob.core.windows.net`
}

function getSharedKeyCredential() {
  const accountName = getStorageAccountName()
  const accessKey = getStorageAccessKey()

  if (!accountName || !accessKey) {
    throw new Error('Blob storage credentials are not configured.')
  }

  return new StorageSharedKeyCredential(accountName, accessKey)
}

function getBlobServiceClient() {
  return new BlobServiceClient(getStorageAccount(), getSharedKeyCredential())
}

async function readStreamWithLimit(
  stream: NodeJS.ReadableStream | undefined,
  maxBytes: number
) {
  if (!stream) {
    throw new Error('Media file could not be downloaded.')
  }

  const chunks: Buffer[] = []
  let totalBytes = 0

  for await (const chunk of stream) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    totalBytes += buffer.length

    if (totalBytes > maxBytes) {
      throw new Error('Media file is too large.')
    }

    chunks.push(buffer)
  }

  return Buffer.concat(chunks, totalBytes)
}

export function parseKlickerMediaUrl(href: string): BlobLocation | null {
  let url: URL

  try {
    url = new URL(href)
  } catch {
    return null
  }

  let storageAccount: string
  try {
    storageAccount = getStorageAccount()
  } catch {
    return null
  }

  if (url.origin !== storageAccount) {
    return null
  }

  const [containerName, ...blobParts] = url.pathname.split('/').filter(Boolean)

  if (
    !containerName ||
    containerName === PACKAGE_CONTAINER_NAME ||
    blobParts.length === 0
  ) {
    return null
  }

  return {
    containerName,
    blobName: blobParts.join('/'),
  }
}

export async function downloadKlickerMediaFile(
  href: string,
  ctx: MediaContext
) {
  const location = parseKlickerMediaUrl(href)
  if (!location) return null

  const canonicalHref = `${getStorageAccount()}/${location.containerName}/${location.blobName}`
  const mediaFile = await ctx.prisma.mediaFile.findUnique({
    where: { href: canonicalHref },
    select: {
      id: true,
      name: true,
      originalId: true,
      ownerId: true,
      type: true,
    },
  })

  if (!mediaFile || mediaFile.ownerId !== location.containerName) {
    return null
  }

  const blobClient = getBlobServiceClient()
    .getContainerClient(location.containerName)
    .getBlobClient(location.blobName)

  const properties = await blobClient.getProperties()
  const contentLength = properties.contentLength ?? 0
  if (contentLength > MAX_IMPORT_EXPORT_MEDIA_BYTES) {
    throw new Error('Media file is too large.')
  }

  const response = await blobClient.download()
  const buffer = await readStreamWithLimit(
    response.readableStreamBody,
    MAX_IMPORT_EXPORT_MEDIA_BYTES
  )

  return {
    buffer,
    contentType:
      mediaFile.type ?? properties.contentType ?? DEFAULT_MEDIA_CONTENT_TYPE,
    filename: mediaFile.name || path.basename(location.blobName) || 'media',
    originalId: mediaFile.originalId ?? mediaFile.id,
  }
}

export async function isKlickerMediaFileExportable(
  href: string,
  ctx: MediaContext
) {
  const location = parseKlickerMediaUrl(href)
  if (!location) return false

  const canonicalHref = `${getStorageAccount()}/${location.containerName}/${location.blobName}`
  const mediaFile = await ctx.prisma.mediaFile.findUnique({
    where: { href: canonicalHref },
    select: { ownerId: true },
  })

  return Boolean(mediaFile && mediaFile.ownerId === location.containerName)
}

export async function deleteImportedMediaFile(href: string) {
  const location = parseKlickerMediaUrl(href)
  if (!location) return

  await getBlobServiceClient()
    .getContainerClient(location.containerName)
    .getBlobClient(location.blobName)
    .deleteIfExists()
}

export async function stageImportedMediaFile(
  {
    buffer,
    contentType,
    filename,
    originalId,
  }: {
    buffer: Buffer
    contentType: string
    filename: string
    originalId: string
  },
  ctx: ContextWithUser
) {
  if (buffer.length > MAX_IMPORT_EXPORT_MEDIA_BYTES) {
    throw new Error('Media file is too large.')
  }

  const existing = await ctx.prisma.mediaFile.findUnique({
    where: {
      ownerId_originalId: {
        ownerId: ctx.user.sub,
        originalId,
      },
    },
  })

  if (existing) {
    return {
      id: existing.id,
      href: existing.href,
      ownerId: existing.ownerId,
      contentType: existing.type,
      filename: existing.name,
      originalId: existing.originalId ?? originalId,
      createdBlob: false,
    }
  }

  const client = getBlobServiceClient()
  const containerClient = client.getContainerClient(ctx.user.sub)
  if (!(await containerClient.exists())) {
    await containerClient.create({ access: 'blob' })
  }

  const id = randomUUID()
  const extension = inferMediaFileExtension(contentType, filename)
  const blobName = `${IMPORTED_MEDIA_PREFIX}${id}.${extension}`
  const href = `${getStorageAccount()}/${ctx.user.sub}/${blobName}`

  await containerClient.getBlockBlobClient(blobName).uploadData(buffer, {
    blobHTTPHeaders: {
      blobContentType: contentType,
    },
  })

  return {
    id,
    href,
    ownerId: ctx.user.sub,
    contentType,
    filename,
    originalId,
    createdBlob: true,
  }
}

export async function finalizeStagedImportedMediaFile(
  staged: StagedImportedMediaFile,
  ctx: PrismaTransactionContextWithUser
) {
  if (!staged.createdBlob) {
    return {
      href: staged.href,
      unusedStagedHref: null,
    }
  }

  const mediaFile = await ctx.prisma.mediaFile.upsert({
    where: {
      ownerId_originalId: {
        ownerId: staged.ownerId,
        originalId: staged.originalId,
      },
    },
    create: {
      id: staged.id,
      ownerId: staged.ownerId,
      type: staged.contentType,
      name: staged.filename,
      href: staged.href,
      originalId: staged.originalId,
    },
    update: {},
    select: {
      href: true,
    },
  })

  return {
    href: mediaFile.href,
    unusedStagedHref: mediaFile.href === staged.href ? null : staged.href,
  }
}

export async function cleanupOrphanedImportedMediaFiles({
  prisma,
  now = new Date(),
  ttlHours,
}: {
  prisma: PrismaClient
  now?: Date
  ttlHours: number
}) {
  if (!isImportExportMediaStorageConfigured()) {
    return { deletedMediaFiles: 0 }
  }

  const cutoffMs = now.getTime() - ttlHours * 60 * 60 * 1000
  const client = getBlobServiceClient()
  let deletedMediaFiles = 0

  for await (const container of client.listContainers()) {
    if (container.name === PACKAGE_CONTAINER_NAME) {
      continue
    }

    const containerClient = client.getContainerClient(container.name)

    for await (const blob of containerClient.listBlobsFlat({
      prefix: IMPORTED_MEDIA_PREFIX,
    })) {
      const lastModified = blob.properties.lastModified
      if (!lastModified || lastModified.getTime() >= cutoffMs) {
        continue
      }

      const href = `${getStorageAccount()}/${container.name}/${blob.name}`
      const mediaFile = await prisma.mediaFile.findUnique({
        where: { href },
        select: { id: true },
      })

      if (mediaFile) {
        continue
      }

      await containerClient.deleteBlob(blob.name)
      deletedMediaFiles++
    }
  }

  return { deletedMediaFiles }
}
