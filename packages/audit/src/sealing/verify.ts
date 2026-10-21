import type { VerifiedAuditEvidence } from '../azure/table-reader.js'
import { sha256Hex } from '../canonical/hash.js'
import type { StoredAuditManifest } from './manifest.js'

/** Check membership independently of the mutable Table discovery indexes. */
export function verifyManifestEvidence(
  manifests: StoredAuditManifest[],
  evidence: VerifiedAuditEvidence[],
  liveQuizId: string
): Set<string> {
  const byId = new Map(evidence.map((item) => [item.envelope.eventId, item]))
  const sealed = new Set<string>()
  for (const { manifest } of manifests) {
    if (manifest.liveQuizId !== liveQuizId) {
      throw new Error('Manifest assessment scope mismatch')
    }
    for (const entry of manifest.events) {
      const item = byId.get(entry.eventId)
      if (sealed.has(entry.eventId)) {
        throw new Error(`Duplicate sealed event ${entry.eventId}`)
      }
      if (
        !item ||
        item.envelope.scope.liveQuizId !== liveQuizId ||
        item.envelope.scope.lifecycleEpoch !== manifest.lifecycleEpoch ||
        item.envelope.eventHash !== entry.eventHash ||
        sha256Hex(item.canonicalEnvelope) !== entry.canonicalHash
      ) {
        throw new Error(
          `Sealed evidence is missing or changed: ${entry.eventId}`
        )
      }
      sealed.add(entry.eventId)
    }
  }
  return sealed
}
