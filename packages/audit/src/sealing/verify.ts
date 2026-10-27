import type { VerifiedAuditEvidence } from '../azure/table-reader.js'
import { sha256Hex } from '../canonical/hash.js'
import type { StoredAuditManifest } from './manifest.js'

/**
 * Check membership independently of the mutable Table discovery indexes.
 * By default every manifest member must be present in `evidence`. With
 * `onlyLoadedMembers`, members whose evidence was not loaded are skipped, so a
 * caller that read only some events verifies exactly those; manifest scope and
 * duplicate membership are still checked for every member.
 */
export function verifyManifestEvidence(
  manifests: StoredAuditManifest[],
  evidence: VerifiedAuditEvidence[],
  liveQuizId: string,
  options: { onlyLoadedMembers?: boolean } = {}
): Set<string> {
  const byId = new Map(evidence.map((item) => [item.envelope.eventId, item]))
  const sealed = new Set<string>()
  const listed = new Set<string>()
  for (const { manifest } of manifests) {
    if (manifest.liveQuizId !== liveQuizId) {
      throw new Error('Manifest assessment scope mismatch')
    }
    for (const entry of manifest.events) {
      const item = byId.get(entry.eventId)
      if (listed.has(entry.eventId)) {
        throw new Error(`Duplicate sealed event ${entry.eventId}`)
      }
      listed.add(entry.eventId)
      if (item === undefined && options.onlyLoadedMembers) continue
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
