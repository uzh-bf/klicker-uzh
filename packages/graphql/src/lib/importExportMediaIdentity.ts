import { IMPORT_EXPORT_PACKAGE_CONTAINER } from './importExportCapabilities.js'

const LOCAL_MEDIA_ROUTE = '/api/import-export-media'
export const DIRECT_UPLOAD_PENDING_ORIGINAL_ID_PREFIX = 'direct-upload-pending:'
export const DIRECT_UPLOAD_CLEANUP_ORIGINAL_ID_PREFIX = 'direct-upload-cleanup:'
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
const IMPORTED_BLOB_PATTERN =
  /^imported\/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.[a-z0-9]{1,12}$/

export type KlickerMediaLocation = Readonly<{
  containerName: string
  blobName: string
}>

export type ResolvedKlickerMediaHref = Readonly<{
  canonicalHref: string
  location: KlickerMediaLocation
  ownerId: string
  storage: 'azure' | 'local'
  storageIdentity: string
}>

type DirectUploadLifecycleMedia = Readonly<{
  id: string
  originalId: string | null
}>

export function createPendingDirectUploadOriginalId(mediaFileId: string) {
  return `${DIRECT_UPLOAD_PENDING_ORIGINAL_ID_PREFIX}${mediaFileId}`
}

export function createDirectUploadCleanupOriginalId(mediaFileId: string) {
  return `${DIRECT_UPLOAD_CLEANUP_ORIGINAL_ID_PREFIX}${mediaFileId}`
}

export function isPendingDirectUploadMedia(
  mediaFile: DirectUploadLifecycleMedia
) {
  return (
    mediaFile.originalId === createPendingDirectUploadOriginalId(mediaFile.id)
  )
}

export function isDirectUploadCleanupMedia(
  mediaFile: DirectUploadLifecycleMedia
) {
  return (
    mediaFile.originalId === createDirectUploadCleanupOriginalId(mediaFile.id)
  )
}

export function hasDirectUploadLifecycleMarker(originalId: string | null) {
  return Boolean(
    originalId?.startsWith(DIRECT_UPLOAD_PENDING_ORIGINAL_ID_PREFIX) ||
      originalId?.startsWith(DIRECT_UPLOAD_CLEANUP_ORIGINAL_ID_PREFIX)
  )
}

function resolveLocalMediaHref(
  href: string,
  url: URL
): ResolvedKlickerMediaHref | null {
  let apiOrigin: URL
  try {
    apiOrigin = new URL(process.env.APP_ORIGIN_API ?? 'http://127.0.0.1:3000')
  } catch {
    return null
  }
  if (url.origin !== apiOrigin.origin || url.search || url.hash) return null

  const match = url.pathname.match(
    /^\/api\/import-export-media\/([0-9a-f-]+)\/([^/]+)$/
  )
  if (!match) return null
  const ownerId = match[1]!
  const blobName = `imported/${match[2]}`
  if (!UUID_PATTERN.test(ownerId) || !IMPORTED_BLOB_PATTERN.test(blobName)) {
    return null
  }

  const location = { containerName: ownerId, blobName }
  const canonicalHref = `${apiOrigin.origin}${LOCAL_MEDIA_ROUTE}/${ownerId}/${match[2]}`
  if (href !== canonicalHref) return null
  return {
    canonicalHref,
    location,
    ownerId,
    storage: 'local',
    storageIdentity: `${ownerId}\0${blobName}`,
  }
}

function resolveAzureMediaHref(
  href: string,
  url: URL
): ResolvedKlickerMediaHref | null {
  const accountName = process.env.BLOB_STORAGE_ACCOUNT_NAME
  if (
    !accountName ||
    url.origin !== `https://${accountName}.blob.core.windows.net`
  ) {
    return null
  }

  const [containerName, ...blobParts] = url.pathname.split('/').filter(Boolean)
  if (
    !containerName ||
    containerName === IMPORT_EXPORT_PACKAGE_CONTAINER ||
    blobParts.length === 0
  ) {
    return null
  }

  const blobName = blobParts.join('/')
  const location = { containerName, blobName }
  const canonicalHref = `${url.origin}/${containerName}/${blobName}`
  const suffixIndex = href.search(/[?#]/)
  const authoredBase = suffixIndex === -1 ? href : href.slice(0, suffixIndex)
  // Query and fragment aliases retain the canonical href as an exact prefix,
  // which keeps database invalidation exact. Structurally different URL
  // aliases are treated as external content instead of first-party media.
  if (authoredBase !== canonicalHref) return null
  return {
    canonicalHref,
    location,
    ownerId: containerName,
    storage: 'azure',
    storageIdentity: `${containerName}\0${blobName}`,
  }
}

export function resolveKlickerMediaHref(
  href: string
): ResolvedKlickerMediaHref | null {
  let url: URL
  try {
    url = new URL(href)
  } catch {
    return null
  }

  return resolveLocalMediaHref(href, url) ?? resolveAzureMediaHref(href, url)
}
