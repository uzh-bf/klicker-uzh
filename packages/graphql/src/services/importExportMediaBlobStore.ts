import { mkdir, readFile, stat, unlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import {
  ImportExportDomainError,
  ImportExportErrorCode,
} from '../lib/importExportErrors.js'
import { MAX_IMPORT_EXPORT_MEDIA_BYTES } from '../lib/importExportPackageConfig.js'
import { isLocalImportExportPackageStorageEnabled } from './importExportPackageBlobStore.js'

const LOCAL_MEDIA_ROUTE = '/api/import-export-media'
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
const BLOB_PATTERN =
  /^imported\/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.[a-z0-9]{1,12}$/

export function isCanonicalImportedMediaTarget({
  ownerId,
  storageContainer,
  storageBlob,
}: {
  ownerId: string
  storageContainer: string
  storageBlob: string
}) {
  return (
    UUID_PATTERN.test(ownerId) &&
    storageContainer === ownerId &&
    BLOB_PATTERN.test(storageBlob)
  )
}

function assertCanonicalTarget(ownerId: string, storageBlob: string) {
  if (
    !isCanonicalImportedMediaTarget({
      ownerId,
      storageContainer: ownerId,
      storageBlob,
    })
  ) {
    throw new ImportExportDomainError(ImportExportErrorCode.UNSAFE_REFERENCE)
  }
}

function getLocalMediaRoot() {
  const packageRoot =
    process.env.LOCAL_IMPORT_EXPORT_PACKAGE_DIR ??
    path.join(tmpdir(), 'klicker-import-export-packages')
  return path.join(packageRoot, 'imported-media')
}

function getLocalMediaPath(ownerId: string, storageBlob: string) {
  assertCanonicalTarget(ownerId, storageBlob)
  const root = getLocalMediaRoot()
  const mediaPath = path.resolve(root, ownerId, storageBlob)
  if (!mediaPath.startsWith(`${path.resolve(root)}${path.sep}`)) {
    throw new ImportExportDomainError(ImportExportErrorCode.UNSAFE_REFERENCE)
  }
  return mediaPath
}

export function createImportedMediaHref(ownerId: string, storageBlob: string) {
  assertCanonicalTarget(ownerId, storageBlob)
  if (!isLocalImportExportPackageStorageEnabled()) {
    const accountName = process.env.BLOB_STORAGE_ACCOUNT_NAME
    if (!accountName) throw new Error('Blob storage account is not configured.')
    return `https://${accountName}.blob.core.windows.net/${ownerId}/${storageBlob}`
  }

  const apiOrigin = process.env.APP_ORIGIN_API ?? 'http://127.0.0.1:3000'
  return `${apiOrigin.replace(/\/$/, '')}${LOCAL_MEDIA_ROUTE}/${ownerId}/${storageBlob.slice('imported/'.length)}`
}

export function parseLocalImportedMediaHref(href: string) {
  if (!isLocalImportExportPackageStorageEnabled()) return null

  let url: URL
  try {
    url = new URL(href)
  } catch {
    return null
  }
  const apiOrigin = process.env.APP_ORIGIN_API ?? 'http://127.0.0.1:3000'
  if (url.origin !== new URL(apiOrigin).origin || url.search || url.hash)
    return null

  const match = url.pathname.match(
    /^\/api\/import-export-media\/([0-9a-f-]+)\/([^/]+)$/
  )
  if (!match) return null
  const ownerId = match[1]!
  const storageBlob = `imported/${match[2]}`
  return isCanonicalImportedMediaTarget({
    ownerId,
    storageContainer: ownerId,
    storageBlob,
  })
    ? { containerName: ownerId, blobName: storageBlob }
    : null
}

export async function writeLocalImportedMediaExclusive(
  ownerId: string,
  storageBlob: string,
  buffer: Buffer
) {
  if (buffer.length > MAX_IMPORT_EXPORT_MEDIA_BYTES) {
    throw new ImportExportDomainError(ImportExportErrorCode.PACKAGE_TOO_LARGE)
  }
  const mediaPath = getLocalMediaPath(ownerId, storageBlob)
  await mkdir(path.dirname(mediaPath), { recursive: true })
  try {
    await writeFile(mediaPath, buffer, { flag: 'wx' })
    return true
  } catch (error) {
    if (
      error &&
      typeof error === 'object' &&
      Reflect.get(error, 'code') === 'EEXIST'
    ) {
      return false
    }
    throw error
  }
}

export async function readLocalImportedMedia(
  ownerId: string,
  storageBlob: string
) {
  const buffer = await readFile(getLocalMediaPath(ownerId, storageBlob))
  if (buffer.length > MAX_IMPORT_EXPORT_MEDIA_BYTES) {
    throw new ImportExportDomainError(ImportExportErrorCode.PACKAGE_TOO_LARGE)
  }
  return buffer
}

export async function statLocalImportedMedia(
  ownerId: string,
  storageBlob: string
) {
  const properties = await stat(getLocalMediaPath(ownerId, storageBlob))
  return { contentLength: properties.size }
}

export async function deleteLocalImportedMediaIfExists(
  ownerId: string,
  storageBlob: string
) {
  try {
    await unlink(getLocalMediaPath(ownerId, storageBlob))
    return true
  } catch (error) {
    if (
      error &&
      typeof error === 'object' &&
      Reflect.get(error, 'code') === 'ENOENT'
    ) {
      return false
    }
    throw error
  }
}
