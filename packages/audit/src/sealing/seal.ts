import type {
  AzureTableAuditReader,
  VerifiedAuditEvidence,
} from '../azure/table-reader.js'
import { compareAuditText } from '../canonical/compare.js'
import { sha256Hex } from '../canonical/hash.js'
import { retentionBatchFor } from '../media/retention-horizon.js'
import type { AuditManifestStore, StoredAuditManifest } from './manifest.js'
import { verifyManifestEvidence } from './verify.js'

/** Outbox delivery states that decide which Table evidence may be sealed. */
export type AuditSealingState = {
  /** DELIVERED_UNSEALED: delivery finished, so the event may enter a manifest. */
  sealable: ReadonlySet<string>
  /** PENDING or LEASED: Table rows may still be incomplete; wait for delivery. */
  inFlight: ReadonlySet<string>
  /** SEALED: must be a member of a published manifest. */
  sealed: ReadonlySet<string>
}

export interface AuditSealRepository {
  listQuizIds(): Promise<string[]>
  getSealingState(liveQuizId: string): Promise<AuditSealingState>
  markSealed(evidence: VerifiedAuditEvidence[], sealedAt: Date): Promise<number>
}

const DEFAULT_MAX_BATCH_EVENTS = 100
const DEFAULT_MAX_BATCHES_PER_QUIZ = 10

/** Azure manifests are the durable checkpoint; a failed DB update is replayable. */
export async function sealAssessmentAudit(input: {
  repository: AuditSealRepository
  reader: Pick<AzureTableAuditReader, 'exportQuizWithFailures'>
  manifests: AuditManifestStore
  now?: () => Date
  maxBatchEvents?: number
  maxBatchesPerQuiz?: number
}) {
  const clock = input.now ?? (() => new Date())
  const maxBatchEvents = input.maxBatchEvents ?? DEFAULT_MAX_BATCH_EVENTS
  const maxBatchesPerQuiz =
    input.maxBatchesPerQuiz ?? DEFAULT_MAX_BATCHES_PER_QUIZ
  if (
    !Number.isSafeInteger(maxBatchEvents) ||
    maxBatchEvents < 1 ||
    !Number.isSafeInteger(maxBatchesPerQuiz) ||
    maxBatchesPerQuiz < 1
  ) {
    throw new TypeError('Sealing batch limits must be positive integers')
  }
  const minimumRetainUntil = retentionBatchFor(clock())
  let sealedCount = 0
  let manifestCount = 0
  let deferredCount = 0
  let awaitingDeliveryCount = 0
  const failures: { liveQuizId: string; detail: string }[] = []
  // Every retained scope is visited, including finished ones, because listing
  // renews manifest retention; quizzes without sealable rows skip the evidence read.
  for (const liveQuizId of await input.repository.listQuizIds()) {
    try {
      const state = await input.repository.getSealingState(liveQuizId)
      awaitingDeliveryCount += state.inFlight.size
      const manifests = await input.manifests.list(liveQuizId, {
        repairPending: true,
        minimumRetainUntil,
      })
      // PostgreSQL is an independent checkpoint: an event it marked SEALED must
      // still be listed by a manifest, so losing whole manifests is detected.
      const members = new Set(
        manifests.flatMap(({ manifest }) =>
          manifest.events.map(({ eventId }) => eventId)
        )
      )
      const unlisted = [...state.sealed].filter((id) => !members.has(id))
      if (unlisted.length > 0) {
        throw new Error(
          `${unlisted.length} events are SEALED in PostgreSQL but absent from every manifest`
        )
      }
      if (state.sealable.size === 0) continue

      const read = async () => {
        const result = await input.reader.exportQuizWithFailures({ liveQuizId })
        // Events still being delivered have incomplete Table rows by design.
        const blocking = result.failures.filter(
          ({ eventId }) => !state.inFlight.has(eventId)
        )
        if (blocking.length > 0) {
          throw new Error(
            `Assessment has ${blocking.length} evidence verification failures`
          )
        }
        return result.verified
      }
      const isPending =
        (sealed: Set<string>) => (item: VerifiedAuditEvidence) =>
          !sealed.has(item.envelope.eventId) &&
          state.sealable.has(item.envelope.eventId)
      let evidence = await read()
      let sealed = verifyManifestEvidence(manifests, evidence, liveQuizId)
      // Recover a crash after immutable publication and before the DB transition.
      sealedCount += await input.repository.markSealed(
        evidence.filter(
          (item) =>
            sealed.has(item.envelope.eventId) &&
            state.sealable.has(item.envelope.eventId)
        ),
        clock()
      )
      for (let batch = 0; batch < maxBatchesPerQuiz; batch += 1) {
        const remaining = evidence
          .filter(isPending(sealed))
          .sort(
            (a, b) =>
              compareAuditText(a.envelope.recordedAt, b.envelope.recordedAt) ||
              compareAuditText(a.envelope.eventId, b.envelope.eventId)
          )
        // Keep each batch in one lifecycle, prioritizing its oldest pending event.
        const epoch = remaining[0]?.envelope.scope.lifecycleEpoch
        if (epoch === undefined) break
        const previous = manifests
          .filter((item) => item.manifest.lifecycleEpoch === epoch)
          .at(-1)
        const createdAt = clock()
        const winner: StoredAuditManifest = await input.manifests.create({
          format: 'KLICKER_ASSESSMENT_AUDIT_MANIFEST',
          formatVersion: 1,
          liveQuizId,
          lifecycleEpoch: epoch,
          sequence: (previous?.manifest.sequence ?? 0) + 1,
          previousManifestHash: previous?.manifestHash ?? null,
          createdAt: createdAt.toISOString(),
          retainUntil: retentionBatchFor(createdAt).toISOString(),
          events: remaining
            .filter((item) => item.envelope.scope.lifecycleEpoch === epoch)
            .slice(0, maxBatchEvents)
            // validateAuditManifest requires code-unit order of event IDs
            .sort((a, b) =>
              a.envelope.eventId < b.envelope.eventId
                ? -1
                : a.envelope.eventId > b.envelope.eventId
                  ? 1
                  : 0
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
        const batchMembers = new Set(
          winner.manifest.events.map((event) => event.eventId)
        )
        sealedCount += await input.repository.markSealed(
          evidence.filter((item) => batchMembers.has(item.envelope.eventId)),
          clock()
        )
        manifestCount += 1
      }
      deferredCount += evidence.filter(isPending(sealed)).length
    } catch (error) {
      failures.push({
        liveQuizId,
        detail: error instanceof Error ? error.message : String(error),
      })
    }
  }
  return {
    sealedCount,
    manifestCount,
    deferredCount,
    awaitingDeliveryCount,
    failures,
  }
}
