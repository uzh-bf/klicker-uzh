import { createHash } from 'node:crypto'
import { mkdtemp, open, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileTypeFromFile } from 'file-type'
import type { OwnedBaselineMediaReference } from '../baseline/media-references.js'
import { hashCanonicalValue } from '../canonical/hash.js'
import { mediaStateSchema } from '../contract/payloads/assessment.js'
import {
  assertAllowedKlickerMediaSource,
  auditMediaContentAddress,
} from './content-address.js'

export type AuditMediaSourceResult = {
  body: AsyncIterable<Uint8Array>
  mimeType: string
  contentLength?: number
}

export interface AuditMediaSource {
  open(reference: OwnedBaselineMediaReference): Promise<AuditMediaSourceResult>
}

export type ImmutableAuditMedia = {
  blobName: string
  contentHash: string
  byteLength: number
  mimeType: string
  versionId: string
  retainUntil: Date
  outcome: 'CREATED' | 'IDENTICAL_REPLAY'
}

export interface ImmutableAuditMediaStore {
  createFromFile(input: {
    filePath: string
    blobName: string
    contentHash: string
    byteLength: number
    mimeType: string
    retainUntil: Date
  }): Promise<ImmutableAuditMedia>
}

export async function captureAssessmentMedia(input: {
  reference: OwnedBaselineMediaReference
  source: AuditMediaSource
  store: ImmutableAuditMediaStore
  allowedHosts: readonly string[]
  retainUntil: Date
}): Promise<{
  media: ReturnType<typeof mediaStateSchema.parse>
  versionId: string
  retainUntil: Date
  outcome: ImmutableAuditMedia['outcome']
}> {
  const sourceUrl = assertAllowedKlickerMediaSource(
    input.reference.sourceUrl,
    input.allowedHosts
  )
  const tempDirectory = await mkdtemp(join(tmpdir(), 'klicker-audit-media-'))
  const tempFile = join(tempDirectory, 'capture')

  try {
    const source = await input.source.open({
      ...input.reference,
      sourceUrl,
    })
    const detectImageType =
      source.mimeType === 'application/octet-stream' &&
      input.reference.mimeType.startsWith('image/')
    if (source.mimeType !== input.reference.mimeType && !detectImageType) {
      throw new Error('Klicker media MIME type changed during capture')
    }

    const file = await open(tempFile, 'wx', 0o600)
    const hash = createHash('sha256')
    let byteLength = 0
    try {
      for await (const value of source.body) {
        const chunk = Buffer.from(value)
        if (chunk.byteLength === 0) continue
        let offset = 0
        while (offset < chunk.byteLength) {
          const { bytesWritten } = await file.write(
            chunk,
            offset,
            chunk.byteLength - offset
          )
          if (bytesWritten === 0) {
            throw new Error(
              'Klicker media capture could not write source bytes'
            )
          }
          offset += bytesWritten
        }
        hash.update(chunk)
        byteLength += chunk.byteLength
      }
      await file.sync()
    } finally {
      await file.close()
    }

    if (byteLength === 0) {
      throw new Error('Klicker media capture returned no bytes')
    }
    if (
      source.contentLength !== undefined &&
      source.contentLength !== byteLength
    ) {
      throw new Error('Klicker media length changed during capture')
    }

    // Existing uploads may have generic Blob metadata. Detect from the staged
    // bytes, never the URL/extension, before creating any immutable evidence.
    // Signature detection is a format hint, not full decoding or a safety scan.
    if (detectImageType) {
      const detected = await fileTypeFromFile(tempFile)
      if (detected?.mime !== input.reference.mimeType) {
        throw new Error(
          'Klicker media detected MIME type does not match reference'
        )
      }
    }

    const mimeType = input.reference.mimeType
    const contentHash = hash.digest('hex')
    const blobName = auditMediaContentAddress(contentHash)
    const stored = await input.store.createFromFile({
      filePath: tempFile,
      blobName,
      contentHash,
      byteLength,
      mimeType,
      retainUntil: input.retainUntil,
    })
    if (
      stored.blobName !== blobName ||
      stored.contentHash !== contentHash ||
      stored.byteLength !== byteLength ||
      stored.mimeType !== mimeType ||
      stored.retainUntil.getTime() < input.retainUntil.getTime()
    ) {
      throw new Error('Immutable audit media store returned unverifiable data')
    }

    return {
      media: mediaStateSchema.parse({
        mediaId: input.reference.mediaId,
        sourceUrl,
        contentHash,
        byteLength,
        mimeType,
        blobName,
        sourceReferenceHash: hashCanonicalValue({
          mediaId: input.reference.mediaId,
          sourceUrl,
        }),
      }),
      versionId: stored.versionId,
      retainUntil: stored.retainUntil,
      outcome: stored.outcome,
    }
  } finally {
    await rm(tempDirectory, { recursive: true, force: true })
  }
}
