import { createHash } from 'node:crypto'
import {
  computeElementDidacticFingerprint,
  type ElementDidacticFingerprintInput,
} from './importExportFingerprintCanonicalization.js'
import {
  collectElementMediaReferences,
  MediaReferenceKind,
} from './importExportMediaReferences.js'

/** Spreadsheet equality preserves URL identity, including unavailable images.
 * The media tokens below hash REFERENCES, not image bytes. They are only
 * inputs to this comparison and must never be stored as MediaFile hashes or
 * Element.importFingerprint values. Normal writes retain fingerprint v2. */
export function computeSpreadsheetElementIdentity(
  input: Omit<ElementDidacticFingerprintInput, 'media'>
) {
  const referenceTokens = new Map(
    collectElementMediaReferences(input)
      .filter((reference) => reference.kind === MediaReferenceKind.AUTO_LOAD)
      .map(
        ({ href }) =>
          [
            href,
            {
              sha256: createHash('sha256')
                .update('klicker-spreadsheet-url-v1\0')
                .update(href)
                .digest('hex'),
            },
          ] as const
      )
  )
  return (
    computeElementDidacticFingerprint({
      ...input,
      media: { verifiedByHref: referenceTokens },
    })?.fingerprint ?? null
  )
}
