import type {
  AzureTableAuditReader,
  VerifiedAuditEvidence,
} from '../azure/table-reader.js'
import { sha256Hex } from '../canonical/hash.js'
import { retentionBatchFor } from '../media/retention-horizon.js'
import type { AuditManifestStore, StoredAuditManifest } from './manifest.js'
import { verifyManifestEvidence } from './verify.js'

export interface AuditSealRepository {
  listQuizIds(): Promise<string[]>
  markSealed(evidence: VerifiedAuditEvidence[], sealedAt: Date): Promise<number>
}

const MAX_BATCH_EVENTS = 100
const MAX_BATCHES_PER_QUIZ = 10

/** Azure manifests are the durable checkpoint; a failed DB update is replayable. */
export async function sealAssessmentAudit(input: {
  repository: AuditSealRepository
  reader: Pick<AzureTableAuditReader, 'exportQuizWithFailures'>
  manifests: AuditManifestStore
  now?: () => Date
}) {
  const clock = input.now ?? (() => new Date())
  const now = clock()
  const retainUntil = retentionBatchFor(now)
  let sealedCount = 0
  let manifestCount = 0
  let deferredCount = 0
  const failures: { liveQuizId: string; detail: string }[] = []
  for (const liveQuizId of await input.repository.listQuizIds()) {
    try {
      const manifests = await input.manifests.list(liveQuizId, {
        repairPending: true,
        minimumRetainUntil: retainUntil,
      })
      const read = async () => {
        const result = await input.reader.exportQuizWithFailures({ liveQuizId })
        if (result.failures.length > 0) {
          throw new Error(
            `Assessment has ${result.failures.length} evidence verification failures`
          )
        }
        return result.verified
      }
      let evidence = await read()
      let sealed = verifyManifestEvidence(manifests, evidence, liveQuizId)
      // Recover a crash after immutable publication and before the DB transition.
      sealedCount += await input.repository.markSealed(
        evidence.filter((item) => sealed.has(item.envelope.eventId)),
        clock()
      )
      for (let batch = 0; batch < MAX_BATCHES_PER_QUIZ; batch += 1) {
        const remaining = evidence
          .filter((item) => !sealed.has(item.envelope.eventId))
          .sort(
            (a, b) =>
              a.envelope.recordedAt.localeCompare(b.envelope.recordedAt) ||
              a.envelope.eventId.localeCompare(b.envelope.eventId)
          )
        // Keep each batch in one lifecycle, prioritizing its oldest pending event.
        const epoch = remaining[0]?.envelope.scope.lifecycleEpoch
        if (epoch === undefined) break
        const previous = manifests
          .filter((item) => item.manifest.lifecycleEpoch === epoch)
          .at(-1)
        const winner: StoredAuditManifest = await input.manifests.create({
          format: 'KLICKER_ASSESSMENT_AUDIT_MANIFEST',
          formatVersion: 1,
          liveQuizId,
          lifecycleEpoch: epoch,
          sequence: (previous?.manifest.sequence ?? 0) + 1,
          previousManifestHash: previous?.manifestHash ?? null,
          createdAt: now.toISOString(),
          retainUntil: retainUntil.toISOString(),
          events: remaining
            .filter((item) => item.envelope.scope.lifecycleEpoch === epoch)
            .slice(0, MAX_BATCH_EVENTS)
            .sort((a, b) =>
              a.envelope.eventId.localeCompare(b.envelope.eventId)
            )
            .map((item) => ({
              eventId: item.envelope.eventId,
              eventHash: item.envelope.eventHash,
              canonicalHash: sha256Hex(item.canonicalEnvelope),
            })),
        })
        if (
          winner.manifest.sequence !== (previous?.manifest.sequence ?? 0) + 1 ||
          winner.manifest.previousManifestHash !==
            (previous?.manifestHash ?? null)
        ) {
          throw new Error(
            'Concurrent manifest does not extend the expected chain'
          )
        }
        manifests.push(winner)
        // Re-read after publication; never trust a pre-upload snapshot for SEALED.
        evidence = await read()
        sealed = verifyManifestEvidence(manifests, evidence, liveQuizId)
        const members = new Set(
          winner.manifest.events.map((event) => event.eventId)
        )
        sealedCount += await input.repository.markSealed(
          evidence.filter((item) => members.has(item.envelope.eventId)),
          clock()
        )
        manifestCount += 1
      }
      deferredCount += evidence.filter(
        (item) => !sealed.has(item.envelope.eventId)
      ).length
    } catch (error) {
      failures.push({
        liveQuizId,
        detail: error instanceof Error ? error.message : String(error),
      })
    }
  }
  return { sealedCount, manifestCount, deferredCount, failures }
}
