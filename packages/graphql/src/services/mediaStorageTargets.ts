import path from 'node:path'
import type {
  ContextWithUser,
  PrismaTransactionContextWithUser,
} from '../lib/context.js'
import { MAX_IMPORT_EXPORT_MEDIA_BYTES } from '../lib/importExportPackageConfig.js'
import { DEFAULT_MEDIA_CONTENT_TYPE } from '../lib/mediaContentTypes.js'
import { MediaExportOmissionError } from '../lib/mediaErrors.js'
import {
  deleteAzureImportedMediaIfExists,
  getAzureImportedMediaProperties,
  getAzureImportExportStorageAccountUrl,
  isAzureImportExportStorageConfigured,
  readAzureImportedMedia,
} from './importExportAzureBlobStorage.js'
import {
  createImportedMediaHref,
  deleteLocalImportedMediaIfExists,
  parseLocalImportedMediaHref,
  readLocalImportedMedia,
  statLocalImportedMedia,
} from './importExportMediaBlobStore.js'
import { isLocalImportExportPackageStorageEnabled } from './importExportPackageBlobStore.js'

const PACKAGE_CONTAINER_NAME = 'klicker-import-export'

type BlobLocation = {
  containerName: string
  blobName: string
}

type ParsedMediaTarget = {
  location: BlobLocation
  storage: 'azure' | 'local'
}

type MediaContext = Pick<
  ContextWithUser | PrismaTransactionContextWithUser,
  'prisma'
>

export function isImportExportMediaStorageConfigured() {
  return (
    isLocalImportExportPackageStorageEnabled() ||
    isAzureImportExportStorageConfigured()
  )
}

function getStorageAccount() {
  return getAzureImportExportStorageAccountUrl()
}

function isBlobNotFoundError(error: unknown) {
  if (!error || typeof error !== 'object') return false

  const statusCode = Reflect.get(error, 'statusCode')
  const code = Reflect.get(error, 'code')
  const details = Reflect.get(error, 'details')
  const detailCode =
    details && typeof details === 'object'
      ? Reflect.get(details, 'errorCode')
      : undefined

  return (
    statusCode === 404 ||
    code === 'ENOENT' ||
    code === 'BlobNotFound' ||
    detailCode === 'BlobNotFound'
  )
}

export function isBlobAlreadyExistsError(error: unknown) {
  if (!error || typeof error !== 'object') return false

  const statusCode = Reflect.get(error, 'statusCode')
  const code = Reflect.get(error, 'code')
  const details = Reflect.get(error, 'details')
  const detailCode =
    details && typeof details === 'object'
      ? Reflect.get(details, 'errorCode')
      : undefined

  return (
    statusCode === 409 ||
    statusCode === 412 ||
    code === 'BlobAlreadyExists' ||
    code === 'ConditionNotMet' ||
    detailCode === 'BlobAlreadyExists' ||
    detailCode === 'ConditionNotMet'
  )
}

function parseKlickerMediaTarget(href: string): ParsedMediaTarget | null {
  const localLocation = parseLocalImportedMediaHref(href)
  if (localLocation) {
    return { location: localLocation, storage: 'local' }
  }

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
    location: {
      containerName,
      blobName: blobParts.join('/'),
    },
    storage: 'azure',
  }
}

export function parseKlickerMediaUrl(href: string): BlobLocation | null {
  return parseKlickerMediaTarget(href)?.location ?? null
}

function getCanonicalImportedMediaHref(target: ParsedMediaTarget) {
  const { location } = target
  return target.storage === 'local'
    ? createImportedMediaHref(location.containerName, location.blobName)
    : `${getStorageAccount()}/${location.containerName}/${location.blobName}`
}

async function readParsedMediaTarget(target: ParsedMediaTarget) {
  const { location } = target
  if (target.storage === 'local') {
    return await readLocalImportedMedia(
      location.containerName,
      location.blobName
    )
  }

  return await readAzureImportedMedia(location, MAX_IMPORT_EXPORT_MEDIA_BYTES)
}

async function getParsedMediaTargetProperties(target: ParsedMediaTarget) {
  const { location } = target
  if (target.storage === 'local') {
    return await statLocalImportedMedia(
      location.containerName,
      location.blobName
    )
  }
  return await getAzureImportedMediaProperties(location)
}

export async function deleteImportedMediaTarget(location: BlobLocation) {
  if (isLocalImportExportPackageStorageEnabled()) {
    return await deleteLocalImportedMediaIfExists(
      location.containerName,
      location.blobName
    )
  }
  return await deleteAzureImportedMediaIfExists(location)
}

export async function downloadKlickerMediaFile(
  href: string,
  ctx: MediaContext
) {
  const target = parseKlickerMediaTarget(href)
  if (!target) return null

  const { location } = target
  const canonicalHref = getCanonicalImportedMediaHref(target)
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

  let properties
  try {
    properties = await getParsedMediaTargetProperties(target)
  } catch (error) {
    if (isBlobNotFoundError(error)) return null
    throw error
  }
  const contentLength = properties.contentLength
  if (
    typeof contentLength !== 'number' ||
    !Number.isSafeInteger(contentLength) ||
    contentLength <= 0
  ) {
    throw new MediaExportOmissionError('unknown-size')
  }
  if (contentLength > MAX_IMPORT_EXPORT_MEDIA_BYTES) {
    throw new MediaExportOmissionError('too-large')
  }

  let buffer
  try {
    buffer = await readParsedMediaTarget(target)
  } catch (error) {
    if (isBlobNotFoundError(error)) return null
    throw error
  }
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
  const target = parseKlickerMediaTarget(href)
  if (!target) return false

  const { location } = target
  const canonicalHref = getCanonicalImportedMediaHref(target)
  const mediaFile = await ctx.prisma.mediaFile.findUnique({
    where: { href: canonicalHref },
    select: { ownerId: true },
  })

  return Boolean(mediaFile && mediaFile.ownerId === location.containerName)
}

async function mapMediaMetadataWithConcurrency<T, Result>(
  values: readonly T[],
  callback: (value: T) => Promise<Result>
) {
  const results = new Array<Result>(values.length)
  let nextIndex = 0
  let stopped = false
  let hasError = false
  let firstError: unknown

  await Promise.all(
    Array.from({ length: Math.min(4, values.length) }, async () => {
      while (!stopped && nextIndex < values.length) {
        const index = nextIndex++
        try {
          results[index] = await callback(values[index]!)
        } catch (error) {
          stopped = true
          if (!hasError) {
            hasError = true
            firstError = error
          }
        }
      }
    })
  )

  if (hasError) throw firstError
  return results
}

export async function getKlickerMediaFilesExportMetadata(
  hrefs: string[],
  ctx: MediaContext,
  assertLease: () => void = () => {}
) {
  assertLease()
  const requested = hrefs.flatMap((href) => {
    const target = parseKlickerMediaTarget(href)
    return target
      ? [
          {
            href,
            target,
            canonicalHref: getCanonicalImportedMediaHref(target),
          },
        ]
      : []
  })
  if (requested.length === 0) return new Map()
  assertLease()
  const mediaFiles = await ctx.prisma.mediaFile.findMany({
    where: { href: { in: requested.map((item) => item.canonicalHref) } },
    select: {
      id: true,
      href: true,
      name: true,
      originalId: true,
      ownerId: true,
      type: true,
    },
  })
  assertLease()
  const mediaFileByHref = new Map(
    mediaFiles.map((mediaFile) => [mediaFile.href, mediaFile])
  )
  const metadata = await mapMediaMetadataWithConcurrency(
    requested,
    async ({ href, target, canonicalHref }) => {
      assertLease()
      const { location } = target
      const mediaFile = mediaFileByHref.get(canonicalHref)
      if (!mediaFile || mediaFile.ownerId !== location.containerName) {
        return [href, null] as const
      }

      let properties
      try {
        properties = await getParsedMediaTargetProperties(target)
        assertLease()
      } catch (error) {
        assertLease()
        if (isBlobNotFoundError(error)) return [href, null] as const
        throw error
      }
      const bytes = properties.contentLength
      if (
        typeof bytes !== 'number' ||
        !Number.isSafeInteger(bytes) ||
        bytes <= 0
      ) {
        return [href, null] as const
      }

      return [
        href,
        {
          bytes,
          contentType:
            mediaFile.type ??
            properties.contentType ??
            DEFAULT_MEDIA_CONTENT_TYPE,
          filename:
            mediaFile.name || path.basename(location.blobName) || 'media',
          originalId: mediaFile.originalId ?? mediaFile.id,
        },
      ] as const
    }
  )

  assertLease()
  return new Map(metadata)
}

export async function getKlickerMediaFileExportMetadata(
  href: string,
  ctx: MediaContext
) {
  return (
    (await getKlickerMediaFilesExportMetadata([href], ctx)).get(href) ?? null
  )
}

export async function deleteImportedMediaFile(href: string) {
  const target = parseKlickerMediaTarget(href)
  if (!target) return

  if (target.storage === 'local') {
    await deleteLocalImportedMediaIfExists(
      target.location.containerName,
      target.location.blobName
    )
    return
  }

  await deleteAzureImportedMediaIfExists(target.location)
}

export async function getLocalImportedMediaDownload(
  {
    ownerId,
    filename,
  }: {
    ownerId: string
    filename: string
  },
  ctx: MediaContext
) {
  const storageBlob = `imported/${filename}`
  const href = createImportedMediaHref(ownerId, storageBlob)
  const mediaFile = await ctx.prisma.mediaFile.findFirst({
    where: { ownerId, href },
    select: { type: true },
  })
  if (!mediaFile) return null

  return {
    buffer: await readLocalImportedMedia(ownerId, storageBlob),
    contentType: mediaFile.type,
  }
}
