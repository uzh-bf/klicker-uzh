import type {
  AssessmentAuditOutboxEvent,
  PrismaClient,
} from '@klicker-uzh/prisma/client'
import { canonicalByteLength } from '../canonical/canonicalize.js'
import {
  type AuditEnvelope,
  parseCanonicalAuditEnvelope,
} from '../contract/envelope.js'
import { getEventRegistration } from '../contract/event-registry.js'
import {
  claimAuditOutboxEvents,
  markAuditOutboxDelivered,
  quarantineAuditOutboxEvent,
  releaseAuditOutboxForRetry,
} from '../outbox/claim.js'
import {
  type AppendOnlyAuditSink,
  AuditAppendConflictError,
} from '../ports/append-sink.js'

export const AUDIT_DISPATCH_MAX_BATCHES = 20
export const AUDIT_DISPATCH_CONCURRENCY = 8
export const AUDIT_RETRY_BASE_MILLISECONDS = 2_000
export const AUDIT_RETRY_CAP_MILLISECONDS = 5 * 60 * 1_000

export type AuditDispatchSummary = {
  claimed: number
  delivered: number
  identicalReplays: number
  quarantined: number
  retried: number
  batches: number
}

export interface AuditOutboxRepository {
  claim(workerId: string, now: Date): Promise<AssessmentAuditOutboxEvent[]>
  markDelivered(eventId: string, workerId: string, now: Date): Promise<void>
  releaseForRetry(
    eventId: string,
    workerId: string,
    nextAttemptAt: Date
  ): Promise<void>
  quarantine(
    eventId: string,
    workerId: string,
    reasonCode: string,
    now: Date
  ): Promise<void>
}

export class PrismaAuditOutboxRepository implements AuditOutboxRepository {
  private readonly client: Pick<PrismaClient, '$transaction'>

  constructor(client: Pick<PrismaClient, '$transaction'>) {
    this.client = client
  }

  claim(workerId: string, now: Date) {
    return claimAuditOutboxEvents(this.client, workerId, now)
  }

  markDelivered(eventId: string, workerId: string, now: Date) {
    return markAuditOutboxDelivered(this.client, eventId, workerId, now)
  }

  releaseForRetry(eventId: string, workerId: string, nextAttemptAt: Date) {
    return releaseAuditOutboxForRetry(
      this.client,
      eventId,
      workerId,
      nextAttemptAt
    )
  }

  quarantine(eventId: string, workerId: string, reasonCode: string, now: Date) {
    return quarantineAuditOutboxEvent(
      this.client,
      eventId,
      workerId,
      reasonCode,
      now
    )
  }
}

class AuditOutboxValidationError extends Error {
  readonly reasonCode: string

  constructor(reasonCode: string, message: string) {
    super(message)
    this.name = 'AuditOutboxValidationError'
    this.reasonCode = reasonCode
  }
}

function assertOutboxMatchesCanonical(row: AssessmentAuditOutboxEvent) {
  let envelope: AuditEnvelope
  try {
    envelope = parseCanonicalAuditEnvelope(row.canonicalEnvelope)
  } catch (error) {
    throw new AuditOutboxValidationError(
      'INVALID_CANONICAL_ENVELOPE',
      error instanceof Error ? error.message : 'Invalid canonical envelope'
    )
  }

  const registration = getEventRegistration(envelope.eventType)
  const expected: ReadonlyArray<[unknown, unknown]> = [
    [row.eventId, envelope.eventId],
    [row.idempotencyKey, envelope.idempotencyKey],
    [row.eventHash, envelope.eventHash],
    [row.payloadHash, envelope.payloadHash],
    [row.schemaVersion, envelope.schemaVersion],
    [row.payloadSchemaVersion, envelope.payloadSchemaVersion],
    [row.eventType, envelope.eventType],
    [row.emissionPath, registration.emissionPath],
    [row.evidenceClass, envelope.evidenceClass],
    [row.criticality, envelope.criticality],
    [row.recordedVia, envelope.recordedVia],
    [row.liveQuizId, envelope.scope.liveQuizId],
    [row.lifecycleEpoch, envelope.scope.lifecycleEpoch],
    [row.courseId ?? undefined, envelope.scope.courseId],
    [row.participantId ?? undefined, envelope.scope.participantId],
    [row.correlationId, envelope.correlationId],
    [row.receivedAt.toISOString(), envelope.receivedAt],
    [row.recordedAt.toISOString(), envelope.recordedAt],
    [row.canonicalByteLength, canonicalByteLength(row.canonicalEnvelope)],
  ]
  if (expected.some(([left, right]) => left !== right)) {
    throw new AuditOutboxValidationError(
      'OUTBOX_METADATA_MISMATCH',
      'Audit outbox metadata does not match the canonical envelope'
    )
  }
  return envelope
}

export function auditRetryDelayMilliseconds(
  attemptCount: number,
  random: () => number = Math.random
): number {
  if (!Number.isInteger(attemptCount) || attemptCount < 1) {
    throw new TypeError('Audit attemptCount must be a positive integer')
  }
  const ceiling = Math.min(
    AUDIT_RETRY_CAP_MILLISECONDS,
    AUDIT_RETRY_BASE_MILLISECONDS * 2 ** Math.min(attemptCount - 1, 31)
  )
  return Math.floor(Math.max(0, Math.min(random(), 0.999_999_999)) * ceiling)
}

async function inParallel<T>(
  values: readonly T[],
  concurrency: number,
  callback: (value: T) => Promise<void>
): Promise<void> {
  let next = 0
  const workers = Array.from(
    { length: Math.min(concurrency, values.length) },
    async () => {
      while (next < values.length) {
        const index = next
        next += 1
        await callback(values[index]!)
      }
    }
  )
  await Promise.all(workers)
}

export async function dispatchAssessmentAuditOutbox(input: {
  repository: AuditOutboxRepository
  sink: AppendOnlyAuditSink
  workerId: string
  now?: () => Date
  random?: () => number
  maxBatches?: number
  concurrency?: number
}): Promise<AuditDispatchSummary> {
  const now = input.now ?? (() => new Date())
  const random = input.random ?? Math.random
  const maxBatches = input.maxBatches ?? AUDIT_DISPATCH_MAX_BATCHES
  const concurrency = input.concurrency ?? AUDIT_DISPATCH_CONCURRENCY
  if (!Number.isInteger(maxBatches) || maxBatches < 1) {
    throw new TypeError('Audit dispatcher maxBatches must be positive')
  }
  if (!Number.isInteger(concurrency) || concurrency < 1) {
    throw new TypeError('Audit dispatcher concurrency must be positive')
  }

  const summary: AuditDispatchSummary = {
    claimed: 0,
    delivered: 0,
    identicalReplays: 0,
    quarantined: 0,
    retried: 0,
    batches: 0,
  }

  for (let batchNumber = 0; batchNumber < maxBatches; batchNumber += 1) {
    const claimedAt = now()
    const rows = await input.repository.claim(input.workerId, claimedAt)
    if (rows.length === 0) {
      break
    }
    summary.batches += 1
    summary.claimed += rows.length

    await inParallel(rows, concurrency, async (row) => {
      try {
        const envelope = assertOutboxMatchesCanonical(row)
        const result = await input.sink.append({
          envelope,
          canonicalEnvelope: row.canonicalEnvelope,
        })
        await input.repository.markDelivered(row.eventId, input.workerId, now())
        summary.delivered += 1
        if (result.outcome === 'IDENTICAL_REPLAY') {
          summary.identicalReplays += 1
        }
      } catch (error) {
        const reasonCode =
          error instanceof AuditAppendConflictError
            ? 'DIFFERENT_HASH_CONFLICT'
            : error instanceof AuditOutboxValidationError
              ? error.reasonCode
              : undefined
        if (reasonCode !== undefined) {
          await input.repository.quarantine(
            row.eventId,
            input.workerId,
            reasonCode,
            now()
          )
          summary.quarantined += 1
          return
        }

        const retryAt = now()
        retryAt.setTime(
          retryAt.getTime() +
            auditRetryDelayMilliseconds(row.attemptCount, random)
        )
        await input.repository.releaseForRetry(
          row.eventId,
          input.workerId,
          retryAt
        )
        summary.retried += 1
      }
    })
  }

  return summary
}
