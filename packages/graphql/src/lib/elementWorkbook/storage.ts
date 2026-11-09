import { randomUUID } from 'node:crypto'
import {
  BlobSASPermissions,
  BlobServiceClient,
  type ContainerClient,
  generateBlobSASQueryParameters,
  StorageSharedKeyCredential,
} from '@azure/storage-blob'
import { getBlobStorageAccountUrl } from '@klicker-uzh/util'

/** Private: workbooks are only reachable through short-lived signed links. */
export const ELEMENT_WORKBOOK_CONTAINER = 'element-workbooks'
const LINK_TTL_MS = 15 * 60 * 1000
const RETENTION_MS = 24 * 60 * 60 * 1000
const XLSX_TYPE =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

export class ElementWorkbookStorageError extends Error {
  constructor(readonly code: 'UPLOAD_NOT_FOUND' | 'WORKBOOK_TOO_LARGE') {
    super(code)
  }
}

export type BlobStorage = {
  credential: StorageSharedKeyCredential
  /** Browser-facing account URL, as stored in authored image links. */
  publicUrl: string
  /** Backend-facing account URL; differs from publicUrl only locally. */
  service: BlobServiceClient
}

let storage: BlobStorage | undefined

export function getBlobStorage(): BlobStorage {
  if (storage) return storage
  const accountName = process.env.BLOB_STORAGE_ACCOUNT_NAME?.trim()
  const accessKey = process.env.BLOB_STORAGE_ACCESS_KEY?.trim()
  if (!accountName || !accessKey)
    throw new Error('Blob storage is not configured')
  const credential = new StorageSharedKeyCredential(accountName, accessKey)
  const publicUrl = getBlobStorageAccountUrl(
    accountName,
    process.env.BLOB_STORAGE_ACCOUNT_URL
  )
  const internalUrl = getBlobStorageAccountUrl(
    accountName,
    process.env.BLOB_STORAGE_INTERNAL_ACCOUNT_URL ?? publicUrl
  )
  storage = {
    credential,
    publicUrl,
    service: new BlobServiceClient(internalUrl, credential),
  }
  return storage
}

let containerReady: Promise<ContainerClient> | undefined

async function workbookContainer() {
  containerReady ??= (async () => {
    const container = getBlobStorage().service.getContainerClient(
      ELEMENT_WORKBOOK_CONTAINER
    )
    await container.createIfNotExists()
    return container
  })().catch((error) => {
    containerReady = undefined
    throw error
  })
  return containerReady
}

function signedUrl(
  blobName: string,
  permissions: string,
  responseHeaders: { contentDisposition?: string; contentType?: string } = {}
) {
  const { credential, publicUrl } = getBlobStorage()
  const sas = generateBlobSASQueryParameters(
    {
      containerName: ELEMENT_WORKBOOK_CONTAINER,
      blobName,
      permissions: BlobSASPermissions.parse(permissions),
      expiresOn: new Date(Date.now() + LINK_TTL_MS),
      ...responseHeaders,
    },
    credential
  )
  return `${publicUrl}/${ELEMENT_WORKBOOK_CONTAINER}/${blobName}?${sas}`
}

// Upload ids are namespaced by owner, so one user can never read another
// user's upload even when guessing its id.
const uploadBlobName = (userId: string, uploadId: string) =>
  `imports/${userId}/${uploadId}.xlsx`

/**
 * Deletes the user's own workbook files older than a day: abandoned uploads
 * and expired exports. Best effort; an Azure lifecycle rule on the container
 * is the recommended backstop for users who never return.
 */
async function pruneOldWorkbooks(container: ContainerClient, userId: string) {
  const cutoff = Date.now() - RETENTION_MS
  try {
    for (const prefix of [`imports/${userId}/`, `exports/${userId}/`]) {
      for await (const blob of container.listBlobsFlat({ prefix })) {
        if (blob.properties.lastModified.getTime() < cutoff)
          await container.getBlockBlobClient(blob.name).deleteIfExists()
      }
    }
  } catch {
    // Cleanup must never block an upload or export.
  }
}

/** Create-only link: the browser can write the file once, never read it. */
export async function createWorkbookUpload(userId: string) {
  await pruneOldWorkbooks(await workbookContainer(), userId)
  const uploadId = randomUUID()
  return {
    uploadId,
    uploadUrl: signedUrl(uploadBlobName(userId, uploadId), 'c'),
  }
}

export async function readWorkbookUpload(
  userId: string,
  uploadId: string,
  maxBytes: number
) {
  if (!UUID_PATTERN.test(uploadId))
    throw new ElementWorkbookStorageError('UPLOAD_NOT_FOUND')
  const blob = (await workbookContainer()).getBlockBlobClient(
    uploadBlobName(userId, uploadId)
  )
  let size: number
  try {
    size = (await blob.getProperties()).contentLength ?? 0
  } catch {
    throw new ElementWorkbookStorageError('UPLOAD_NOT_FOUND')
  }
  // Signed links cannot limit size; check before reading the bytes.
  if (size > maxBytes)
    throw new ElementWorkbookStorageError('WORKBOOK_TOO_LARGE')
  return blob.downloadToBuffer()
}

export async function deleteWorkbookUpload(userId: string, uploadId: string) {
  if (!UUID_PATTERN.test(uploadId)) return
  await (await workbookContainer())
    .getBlockBlobClient(uploadBlobName(userId, uploadId))
    .deleteIfExists()
}

/** Stores a generated workbook and returns a short-lived download link. */
export async function storeWorkbookDownload(
  userId: string,
  buffer: Buffer,
  filename: string
) {
  const blobName = `exports/${userId}/${randomUUID()}.xlsx`
  const container = await workbookContainer()
  await pruneOldWorkbooks(container, userId)
  await container
    .getBlockBlobClient(blobName)
    .uploadData(buffer, { blobHTTPHeaders: { blobContentType: XLSX_TYPE } })
  return signedUrl(blobName, 'r', {
    contentDisposition: `attachment; filename="${filename}"`,
    contentType: XLSX_TYPE,
  })
}
