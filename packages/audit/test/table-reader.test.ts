import type { TableEntityResult } from '@azure/data-tables'
import {
  type AuditTableReaderClientPort,
  AzureTableAuditReader,
  createCanonicalAuditEvent,
  createTrustedAuditContext,
  mapAuditRecordToTableEntities,
} from '../src/index.js'

const LIVE_QUIZ_ID = '11111111-1111-4111-8111-111111111111'
const USER_ID = '22222222-2222-4222-8222-222222222222'
const PARTICIPANT_ID = '33333333-3333-4333-8333-333333333333'
const CORRELATION_ID = '44444444-4444-4444-8444-444444444444'
const OTHER_PARTICIPANT_ID = '55555555-5555-4555-8555-555555555555'
const OTHER_CORRELATION_ID = '66666666-6666-4666-8666-666666666666'

function participantRecord(
  participantId = PARTICIPANT_ID,
  correlationId = CORRELATION_ID
) {
  return createCanonicalAuditEvent(
    createTrustedAuditContext({
      recordedVia: 'TRANSACTIONAL_OUTBOX',
      receivedAt: '2026-08-11T08:00:00.000Z',
      recordedAt: '2026-08-11T08:00:00.001Z',
      actor: { kind: 'PARTICIPANT', participantId },
      authorization: {
        decision: 'ALLOWED',
        authScope: 'PARTICIPANT',
        requiredPermission: 'ASSESSMENT_PARTICIPATE',
        resolvedObjectScope: { type: 'LIVE_QUIZ', id: LIVE_QUIZ_ID },
      },
      scope: { liveQuizId: LIVE_QUIZ_ID, lifecycleEpoch: 2 },
      correlationId,
    }),
    {
      eventType: 'ASSESSMENT_ACTION_REJECTED',
      producerOperationId: `${correlationId}:attempt`,
      scope: { participantId },
      payload: {
        actionType: 'SUBMIT_RESPONSE',
        reasonCode: 'INVALID_STATE',
      },
    }
  )
}

function sharedRecord() {
  return createCanonicalAuditEvent(
    createTrustedAuditContext({
      recordedVia: 'TRANSACTIONAL_OUTBOX',
      receivedAt: '2026-08-11T07:59:59.000Z',
      recordedAt: '2026-08-11T07:59:59.001Z',
      actor: { kind: 'USER', userId: USER_ID },
      authorization: {
        decision: 'ALLOWED',
        authScope: 'LECTURER',
        requiredPermission: 'LIVE_QUIZ_WRITE',
        resolvedObjectScope: { type: 'LIVE_QUIZ', id: LIVE_QUIZ_ID },
      },
      scope: { liveQuizId: LIVE_QUIZ_ID, lifecycleEpoch: 2 },
      correlationId: USER_ID,
    }),
    {
      eventType: 'ASSESSMENT_STARTED',
      producerOperationId: `${USER_ID}:start`,
      outcome: 'SUCCEEDED',
      payload: { fromState: 'PUBLISHED', toState: 'RUNNING' },
    }
  )
}

function unwrap(value: unknown): unknown {
  if (
    typeof value === 'object' &&
    value !== null &&
    'type' in value &&
    'value' in value
  ) {
    return unwrap(value.value)
  }
  return value
}

class MemoryReaderClient implements AuditTableReaderClientPort {
  readonly rows = new Map<string, Record<string, unknown>>()
  lastListOptions: unknown

  add(entity: Record<string, unknown>) {
    this.rows.set(
      `${entity.partitionKey}\u0000${entity.rowKey}`,
      Object.fromEntries(
        Object.entries(entity).map(([key, value]) => [key, unwrap(value)])
      )
    )
  }

  async getEntity<T extends object = Record<string, unknown>>(
    partitionKey: string,
    rowKey: string
  ): Promise<TableEntityResult<T>> {
    const entity = this.rows.get(`${partitionKey}\u0000${rowKey}`)
    if (entity === undefined) {
      throw Object.assign(new Error('NotFound'), { statusCode: 404 })
    }
    return { ...structuredClone(entity), etag: 'etag' } as TableEntityResult<T>
  }

  async *listEntities<T extends object = Record<string, unknown>>(
    options?: unknown
  ) {
    this.lastListOptions = options
    for (const entity of this.rows.values()) {
      yield { ...structuredClone(entity), etag: 'etag' } as TableEntityResult<T>
    }
  }
}

function readerFixture() {
  const auditRecord = participantRecord()
  const mapped = mapAuditRecordToTableEntities(auditRecord)
  const evidence = new MemoryReaderClient()
  const locator = new MemoryReaderClient()
  const retentionIndex = new MemoryReaderClient()
  for (const entity of mapped.evidence) {
    evidence.add(entity)
  }
  locator.add(mapped.locator)
  retentionIndex.add(mapped.retentionIndex)
  return {
    auditRecord,
    evidence,
    locator,
    retentionIndex,
    reader: new AzureTableAuditReader({ evidence, locator, retentionIndex }),
  }
}

describe('Azure Table audit reader', () => {
  it('reconstructs and verifies exact canonical event bytes through the locator', async () => {
    const { auditRecord, reader } = readerFixture()

    await expect(
      reader.verifyEvent(auditRecord.envelope.eventId)
    ).resolves.toEqual({
      envelope: auditRecord.envelope,
      canonicalEnvelope: auditRecord.canonicalEnvelope,
      status: 'VERIFIED',
      sealStatus: 'UNSEALED',
    })
  })

  it('detects modified chunk bytes', async () => {
    const { auditRecord, evidence, reader } = readerFixture()
    const chunk = [...evidence.rows.values()].find(
      (entity) => entity.recordKind === 'EVENT_CHUNK'
    )!
    chunk.content = Buffer.from('tampered')

    await expect(
      reader.verifyEvent(auditRecord.envelope.eventId)
    ).rejects.toThrow(/byte length|content hash/)
  })

  it('finds quiz evidence through the retention index', async () => {
    const { auditRecord, retentionIndex, reader } = readerFixture()

    await expect(
      reader.exportQuiz({
        liveQuizId: LIVE_QUIZ_ID,
        participantId: PARTICIPANT_ID,
      })
    ).resolves.toMatchObject([
      { envelope: { eventId: auditRecord.envelope.eventId } },
    ])
    expect(retentionIndex.lastListOptions).toMatchObject({
      queryOptions: {
        filter: expect.stringContaining("resourceKind eq 'EVENT'"),
      },
    })
  })

  it('keeps shared context and excludes other participants from a participant export', async () => {
    const { evidence, locator, retentionIndex, reader } = readerFixture()
    const shared = sharedRecord()
    const otherParticipant = participantRecord(
      OTHER_PARTICIPANT_ID,
      OTHER_CORRELATION_ID
    )
    for (const auditRecord of [shared, otherParticipant]) {
      const mapped = mapAuditRecordToTableEntities(auditRecord)
      for (const entity of mapped.evidence) {
        evidence.add(entity)
      }
      locator.add(mapped.locator)
      retentionIndex.add(mapped.retentionIndex)
    }

    const exported = await reader.exportQuiz({
      liveQuizId: LIVE_QUIZ_ID,
      participantId: PARTICIPANT_ID,
    })

    expect(exported.map(({ envelope }) => envelope.eventId)).toContain(
      shared.envelope.eventId
    )
    expect(
      exported.some(
        ({ envelope }) => envelope.scope.participantId === OTHER_PARTICIPANT_ID
      )
    ).toBe(false)
  })
})
