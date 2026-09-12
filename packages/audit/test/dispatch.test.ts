import type { AssessmentAuditOutboxEvent } from '@klicker-uzh/prisma/client'
import {
  type AppendOnlyAuditSink,
  AuditAppendConflictError,
  type AuditOutboxRepository,
  auditRetryDelayMilliseconds,
  createCanonicalAuditEvent,
  createTrustedAuditContext,
  dispatchAssessmentAuditOutbox,
} from '../src/index.js'

const LIVE_QUIZ_ID = '11111111-1111-4111-8111-111111111111'
const USER_ID = '22222222-2222-4222-8222-222222222222'
const CORRELATION_ID = '33333333-3333-4333-8333-333333333333'

function outboxRow(): AssessmentAuditOutboxEvent {
  const record = createCanonicalAuditEvent(
    createTrustedAuditContext({
      recordedVia: 'TRANSACTIONAL_OUTBOX',
      receivedAt: '2026-08-11T08:00:00.000Z',
      recordedAt: '2026-08-11T08:00:00.001Z',
      actor: { kind: 'USER', userId: USER_ID },
      authorization: {
        decision: 'ALLOWED',
        authScope: 'LECTURER',
        requiredPermission: 'LIVE_QUIZ_WRITE',
        resolvedObjectScope: { type: 'LIVE_QUIZ', id: LIVE_QUIZ_ID },
      },
      scope: { liveQuizId: LIVE_QUIZ_ID, lifecycleEpoch: 1 },
      correlationId: CORRELATION_ID,
    }),
    {
      eventType: 'ASSESSMENT_STARTED',
      producerOperationId: `${CORRELATION_ID}:start`,
      outcome: 'SUCCEEDED',
      payload: { fromState: 'PUBLISHED', toState: 'RUNNING' },
    }
  )
  const { envelope } = record
  return {
    eventId: envelope.eventId,
    idempotencyKey: envelope.idempotencyKey,
    eventHash: envelope.eventHash,
    payloadHash: envelope.payloadHash,
    schemaVersion: envelope.schemaVersion,
    payloadSchemaVersion: envelope.payloadSchemaVersion,
    eventType: envelope.eventType,
    emissionPath: 'LANE_1_OUTBOX',
    evidenceClass: envelope.evidenceClass,
    criticality: envelope.criticality,
    recordedVia: envelope.recordedVia,
    liveQuizId: LIVE_QUIZ_ID,
    lifecycleEpoch: 1,
    courseId: null,
    participantId: null,
    correlationId: CORRELATION_ID,
    receivedAt: new Date(envelope.receivedAt),
    recordedAt: new Date(envelope.recordedAt),
    canonicalEnvelope: record.canonicalEnvelope,
    canonicalByteLength: Buffer.byteLength(record.canonicalEnvelope),
    deliveryState: 'LEASED',
    attemptCount: 1,
    nextAttemptAt: new Date(envelope.recordedAt),
    leaseOwner: 'worker-1',
    leaseExpiresAt: new Date('2026-08-11T08:02:00.000Z'),
    deliveredAt: null,
    sealedAt: null,
    quarantinedAt: null,
    quarantineReason: null,
    createdAt: new Date(envelope.recordedAt),
  }
}

class MemoryRepository implements AuditOutboxRepository {
  rows: AssessmentAuditOutboxEvent[]
  delivered: string[] = []
  retries: Array<{ eventId: string; at: Date }> = []
  quarantines: Array<{ eventId: string; reason: string }> = []
  claims = 0

  constructor(rows: AssessmentAuditOutboxEvent[]) {
    this.rows = rows
  }

  async claim() {
    this.claims += 1
    return this.claims === 1 ? this.rows : []
  }

  async markDelivered(eventId: string) {
    this.delivered.push(eventId)
  }

  async releaseForRetry(eventId: string, _workerId: string, at: Date) {
    this.retries.push({ eventId, at })
  }

  async quarantine(eventId: string, _workerId: string, reason: string) {
    this.quarantines.push({ eventId, reason })
  }
}

describe('assessment audit dispatcher', () => {
  it('delivers valid canonical rows and marks them delivered', async () => {
    const row = outboxRow()
    const repository = new MemoryRepository([row])
    const sink: AppendOnlyAuditSink = {
      append: async () => ({ outcome: 'CREATED', durableReceiptId: 'receipt' }),
    }

    await expect(
      dispatchAssessmentAuditOutbox({
        repository,
        sink,
        workerId: 'worker-1',
      })
    ).resolves.toMatchObject({ claimed: 1, delivered: 1 })
    expect(repository.delivered).toEqual([row.eventId])
  })

  it('quarantines canonical metadata mismatches without calling the sink', async () => {
    const row = { ...outboxRow(), eventHash: 'f'.repeat(64) }
    const repository = new MemoryRepository([row])
    const append = vi.fn()

    await dispatchAssessmentAuditOutbox({
      repository,
      sink: { append },
      workerId: 'worker-1',
    })

    expect(append).not.toHaveBeenCalled()
    expect(repository.quarantines).toEqual([
      { eventId: row.eventId, reason: 'OUTBOX_METADATA_MISMATCH' },
    ])
  })

  it('quarantines a different-value append conflict', async () => {
    const row = outboxRow()
    const repository = new MemoryRepository([row])

    await dispatchAssessmentAuditOutbox({
      repository,
      sink: {
        append: async () => {
          throw new AuditAppendConflictError(row.eventId)
        },
      },
      workerId: 'worker-1',
    })

    expect(repository.quarantines[0]?.reason).toBe('DIFFERENT_HASH_CONFLICT')
  })

  it('releases transient failures using capped full jitter', async () => {
    const row = { ...outboxRow(), attemptCount: 3 }
    const repository = new MemoryRepository([row])
    const now = () => new Date('2026-08-11T08:00:10.000Z')

    await dispatchAssessmentAuditOutbox({
      repository,
      sink: {
        append: async () => {
          throw new Error('ServerBusy')
        },
      },
      workerId: 'worker-1',
      now,
      random: () => 0.5,
    })

    expect(repository.retries[0]?.at.toISOString()).toBe(
      '2026-08-11T08:00:14.000Z'
    )
    expect(auditRetryDelayMilliseconds(40, () => 0.5)).toBe(150_000)
  })
})
