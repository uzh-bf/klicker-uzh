import { createHash } from 'node:crypto'
import type { ContextWithUser } from '../lib/context.js'
import {
  ImportExportDomainError,
  ImportExportErrorCode,
} from '../lib/importExportErrors.js'
import {
  MAX_IMPORT_EXPORT_MEDIA_BYTES,
  MAX_IMPORT_EXPORT_MEDIA_FILES,
} from '../lib/importExportPackageConfig.js'
import { isSupportedPackageMediaContentType } from '../lib/importExportPackageContract.js'
import { MediaExportOmissionError } from '../lib/mediaErrors.js'
import type { ElementExportSnapshot } from './elementExportSnapshot.js'
import {
  downloadKlickerMediaFile,
  getKlickerMediaFilesExportMetadata,
  parseKlickerMediaUrl,
} from './mediaStorage.js'
import {
  createPortableExportPlan,
  PortableExportMediaOutcomeStatus,
  renderPortableExportPackage,
  type PortableExportMediaOutcome,
  type PortableExportPlan,
} from './portableExportPlan.js'

const EXPORT_PREFLIGHT_CREATED_AT = new Date(0).toISOString()
const EXPORT_MEDIA_DOWNLOAD_CONCURRENCY = 4

function classifyKlickerMediaHref(href: string) {
  const location = parseKlickerMediaUrl(href)
  return location
    ? {
        storageIdentity: `${location.containerName}\0${location.blobName}`,
      }
    : null
}

function mediaIntegrityFailure(cause?: unknown): never {
  throw new ImportExportDomainError(
    ImportExportErrorCode.INFRASTRUCTURE_FAILURE,
    cause
  )
}

export function createStorageAwarePortableExportPlan(
  snapshot: ElementExportSnapshot
) {
  return createPortableExportPlan(snapshot, {
    classifyMediaHref: classifyKlickerMediaHref,
  })
}

export async function loadPortableExportPreviewMediaOutcomes(
  plan: PortableExportPlan,
  ctx: ContextWithUser,
  assertLease: () => void = () => {}
): Promise<PortableExportMediaOutcome[]> {
  assertLease()
  if (plan.mediaInventory.firstParty.length > MAX_IMPORT_EXPORT_MEDIA_FILES) {
    throw new ImportExportDomainError(
      ImportExportErrorCode.EXPORT_PACKAGE_TOO_LARGE
    )
  }
  if (plan.mediaInventory.firstParty.length === 0) return []

  assertLease()
  const metadataByHref = await getKlickerMediaFilesExportMetadata(
    plan.mediaInventory.firstParty.map(({ href }) => href),
    ctx,
    assertLease
  )
  assertLease()

  const outcomes = plan.mediaInventory.firstParty.map((candidate) => {
    assertLease()
    const metadata = metadataByHref.get(candidate.href)
    if (!metadata) {
      return {
        storageIdentity: candidate.storageIdentity,
        status: PortableExportMediaOutcomeStatus.OMITTED,
      }
    }
    if (
      !Number.isSafeInteger(metadata.bytes) ||
      metadata.bytes <= 0 ||
      !isSupportedPackageMediaContentType(metadata.contentType) ||
      metadata.bytes > MAX_IMPORT_EXPORT_MEDIA_BYTES ||
      !/^[a-f0-9]{64}$/.test(metadata.sha256)
    ) {
      mediaIntegrityFailure()
    }

    return {
      storageIdentity: candidate.storageIdentity,
      status: PortableExportMediaOutcomeStatus.INCLUDED,
      filename: metadata.filename,
      contentType: metadata.contentType,
      bytes: metadata.bytes,
      sha256: metadata.sha256,
    }
  })
  assertLease()
  return outcomes
}

export async function hydratePortableExportMediaOutcomes(
  plan: PortableExportPlan,
  ctx: ContextWithUser
): Promise<PortableExportMediaOutcome[]> {
  if (plan.mediaInventory.firstParty.length > MAX_IMPORT_EXPORT_MEDIA_FILES) {
    throw new ImportExportDomainError(
      ImportExportErrorCode.EXPORT_PACKAGE_TOO_LARGE
    )
  }
  const metadataOutcomes = await loadPortableExportPreviewMediaOutcomes(
    plan,
    ctx
  )
  const metadataByStorageIdentity = new Map(
    metadataOutcomes.map((outcome) => [outcome.storageIdentity, outcome])
  )
  if (
    !metadataOutcomes.some(
      (outcome) => outcome.status === PortableExportMediaOutcomeStatus.INCLUDED
    )
  ) {
    return metadataOutcomes
  }
  const preflight = renderPortableExportPackage({
    plan,
    mediaOutcomes: metadataOutcomes,
    createdAt: EXPORT_PREFLIGHT_CREATED_AT,
  })
  if (preflight.exceedsPackageLimit) {
    throw new ImportExportDomainError(
      ImportExportErrorCode.EXPORT_PACKAGE_TOO_LARGE
    )
  }

  const outcomes: PortableExportMediaOutcome[] = []
  for (
    let offset = 0;
    offset < plan.mediaInventory.firstParty.length;
    offset += EXPORT_MEDIA_DOWNLOAD_CONCURRENCY
  ) {
    const batch = plan.mediaInventory.firstParty.slice(
      offset,
      offset + EXPORT_MEDIA_DOWNLOAD_CONCURRENCY
    )
    const hydrated = await Promise.all(
      batch.map(async (candidate): Promise<PortableExportMediaOutcome> => {
        const metadata = metadataByStorageIdentity.get(
          candidate.storageIdentity
        )
        if (
          !metadata ||
          metadata.status === PortableExportMediaOutcomeStatus.OMITTED
        ) {
          return {
            storageIdentity: candidate.storageIdentity,
            status: PortableExportMediaOutcomeStatus.OMITTED,
          }
        }

        try {
          const media = await downloadKlickerMediaFile(candidate.href, ctx)
          if (
            !media ||
            media.buffer.length !== metadata.bytes ||
            media.contentType !== metadata.contentType ||
            !isSupportedPackageMediaContentType(media.contentType) ||
            media.buffer.length > MAX_IMPORT_EXPORT_MEDIA_BYTES ||
            createHash('sha256').update(media.buffer).digest('hex') !==
              metadata.sha256
          ) {
            mediaIntegrityFailure()
          }

          return {
            storageIdentity: candidate.storageIdentity,
            status: PortableExportMediaOutcomeStatus.INCLUDED,
            filename: metadata.filename,
            contentType: metadata.contentType,
            bytes: metadata.bytes,
            sha256: metadata.sha256,
            data: media.buffer,
          }
        } catch (error) {
          if (error instanceof ImportExportDomainError) throw error
          if (error instanceof MediaExportOmissionError) {
            mediaIntegrityFailure(error)
          }
          throw error
        }
      })
    )
    outcomes.push(...hydrated)
  }

  return outcomes
}
