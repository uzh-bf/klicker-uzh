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

function classifyKlickerMediaHref(href: string) {
  const location = parseKlickerMediaUrl(href)
  return location
    ? {
        storageIdentity: `${location.containerName}\0${location.blobName}`,
      }
    : null
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
    if (
      !metadata ||
      !Number.isSafeInteger(metadata.bytes) ||
      metadata.bytes <= 0 ||
      !isSupportedPackageMediaContentType(metadata.contentType) ||
      metadata.bytes > MAX_IMPORT_EXPORT_MEDIA_BYTES
    ) {
      return {
        storageIdentity: candidate.storageIdentity,
        status: PortableExportMediaOutcomeStatus.OMITTED,
      }
    }

    return {
      storageIdentity: candidate.storageIdentity,
      status: PortableExportMediaOutcomeStatus.INCLUDED,
      filename: metadata.filename,
      contentType: metadata.contentType,
      bytes: metadata.bytes,
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

  for (const candidate of plan.mediaInventory.firstParty) {
    const metadata = metadataByStorageIdentity.get(candidate.storageIdentity)
    if (
      !metadata ||
      metadata.status === PortableExportMediaOutcomeStatus.OMITTED
    ) {
      outcomes.push({
        storageIdentity: candidate.storageIdentity,
        status: PortableExportMediaOutcomeStatus.OMITTED,
      })
      continue
    }

    try {
      const media = await downloadKlickerMediaFile(candidate.href, ctx)
      if (
        !media ||
        media.buffer.length !== metadata.bytes ||
        media.contentType !== metadata.contentType ||
        !isSupportedPackageMediaContentType(media.contentType) ||
        media.buffer.length > MAX_IMPORT_EXPORT_MEDIA_BYTES
      ) {
        outcomes.push({
          storageIdentity: candidate.storageIdentity,
          status: PortableExportMediaOutcomeStatus.OMITTED,
        })
        continue
      }

      outcomes.push({
        storageIdentity: candidate.storageIdentity,
        status: PortableExportMediaOutcomeStatus.INCLUDED,
        filename: metadata.filename,
        contentType: metadata.contentType,
        bytes: metadata.bytes,
        data: media.buffer,
      })
    } catch (error) {
      if (error instanceof ImportExportDomainError) throw error
      if (!(error instanceof MediaExportOmissionError)) throw error

      outcomes.push({
        storageIdentity: candidate.storageIdentity,
        status: PortableExportMediaOutcomeStatus.OMITTED,
      })
    }
  }

  return outcomes
}
