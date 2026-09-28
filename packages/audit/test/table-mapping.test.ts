import {
  AUDIT_CANONICAL_CHUNK_BYTES,
  auditEvidencePartitionKey,
  auditLocatorPartitionKey,
  auditRetentionPartitionKey,
  createCanonicalAuditEvent,
  createTrustedAuditContext,
  mapAuditRecordToTableEntities,
} from '../src/index.js'

const LIVE_QUIZ_ID = '11111111-1111-4111-8111-111111111111'
const USER_ID = '22222222-2222-4222-8222-222222222222'
const PARTICIPANT_ID = '33333333-3333-4333-8333-333333333333'
const CORRELATION_ID = '44444444-4444-4444-8444-444444444444'

function recordWithPayload(reasonCode: string) {
  return createCanonicalAuditEvent(
    createTrustedAuditContext({
      recordedVia: 'TRANSACTIONAL_OUTBOX',
      receivedAt: '2026-08-11T23:59:59.111Z',
      recordedAt: '2026-08-12T00:00:00.222Z',
      actor: { kind: 'USER', userId: USER_ID },
      authorization: {
        decision: 'ALLOWED',
        authScope: 'LECTURER',
        requiredPermission: 'LIVE_QUIZ_WRITE',
        resolvedObjectScope: { type: 'LIVE_QUIZ', id: LIVE_QUIZ_ID },
      },
      scope: {
        liveQuizId: LIVE_QUIZ_ID,
        lifecycleEpoch: 2,
      },
      correlationId: CORRELATION_ID,
    }),
    {
      eventType: 'ASSESSMENT_ACTION_REJECTED',
      producerOperationId: `${CORRELATION_ID}:rejected`,
      scope: { participantId: PARTICIPANT_ID },
      payload: { actionType: 'START_ASSESSMENT', reasonCode },
    }
  )
}

function assessmentState(description: string | null) {
  return {
    name: 'Assessment',
    displayName: 'Assessment',
    description,
    accessMode: 'PUBLIC' as const,
    publicationStatus: 'DRAFT',
    reviewStatus: 'INCOMPLETE',
    availableFrom: null,
    isLiveQAEnabled: false,
    isConfusionFeedbackEnabled: true,
    isModerationEnabled: true,
    isGamificationEnabled: false,
    isAssessmentEnabled: true,
    areInstancesOutdated: false,
    pointsMultiplier: 1,
    defaultPoints: 10,
    defaultCorrectPoints: 5,
    maximumBonusPoints: 45,
    secondsToZeroBonus: 20,
    activeBlockId: null,
  }
}

function recordWithLargeDescription() {
  return createCanonicalAuditEvent(
    createTrustedAuditContext({
      recordedVia: 'TRANSACTIONAL_OUTBOX',
      receivedAt: '2026-08-11T23:59:59.111Z',
      recordedAt: '2026-08-12T00:00:00.222Z',
      actor: { kind: 'USER', userId: USER_ID },
      authorization: {
        decision: 'ALLOWED',
        authScope: 'LECTURER',
        requiredPermission: 'LIVE_QUIZ_WRITE',
        resolvedObjectScope: { type: 'LIVE_QUIZ', id: LIVE_QUIZ_ID },
      },
      scope: { liveQuizId: LIVE_QUIZ_ID, lifecycleEpoch: 2 },
      correlationId: CORRELATION_ID,
    }),
    {
      eventType: 'ASSESSMENT_CONFIGURATION_CHANGED',
      producerOperationId: `${CORRELATION_ID}:large`,
      payload: {
        entityType: 'ASSESSMENT',
        entityId: LIVE_QUIZ_ID,
        before: assessmentState(null),
        after: assessmentState('ü'.repeat(30_000)),
      },
    }
  )
}

function mediaBaselineRecord() {
  const contentHash = 'a'.repeat(64)
  return createCanonicalAuditEvent(
    createTrustedAuditContext({
      recordedVia: 'TRANSACTIONAL_OUTBOX',
      receivedAt: '2026-08-12T00:00:00.000Z',
      actor: { kind: 'USER', userId: USER_ID },
      authorization: {
        decision: 'ALLOWED',
        authScope: 'LECTURER',
        requiredPermission: 'LIVE_QUIZ_WRITE',
      },
      scope: { liveQuizId: LIVE_QUIZ_ID, lifecycleEpoch: 2 },
      correlationId: CORRELATION_ID,
    }),
    {
      eventType: 'ASSESSMENT_BASELINE_PART_RECORDED',
      producerOperationId: `${CORRELATION_ID}:media`,
      payload: {
        baselineId: '55555555-5555-4555-8555-555555555555',
        baselineKind: 'CREATION',
        baselineSchemaVersion: 1,
        capturedAt: '2026-08-12T00:00:00.000Z',
        partKey: 'MEDIA_REFERENCE|66666666-6666-4666-8666-666666666666',
        content: {
          kind: 'MEDIA_REFERENCE',
          media: {
            mediaId: '66666666-6666-4666-8666-666666666666',
            sourceUrl:
              'https://media.blob.core.windows.net/77777777-7777-4777-8777-777777777777/image.png',
            contentHash,
            byteLength: 42,
            mimeType: 'image/png',
            blobName: `sha256/${contentHash}`,
            sourceReferenceHash: 'b'.repeat(64),
          },
        },
        contentHash: 'c'.repeat(64),
      },
    }
  )
}

function mediaCapturedRecord() {
  const contentHash = 'd'.repeat(64)
  const mediaId = '88888888-8888-4888-8888-888888888888'
  return createCanonicalAuditEvent(
    createTrustedAuditContext({
      recordedVia: 'TRANSACTIONAL_OUTBOX',
      receivedAt: '2026-08-12T01:00:00.000Z',
      actor: { kind: 'USER', userId: USER_ID },
      authorization: {
        decision: 'ALLOWED',
        authScope: 'LECTURER',
        requiredPermission: 'LIVE_QUIZ_WRITE',
      },
      scope: { liveQuizId: LIVE_QUIZ_ID, lifecycleEpoch: 2 },
      correlationId: CORRELATION_ID,
    }),
    {
      eventType: 'ASSESSMENT_MEDIA_CAPTURED',
      producerOperationId: `${CORRELATION_ID}:captured-media`,
      payload: {
        entityType: 'MEDIA',
        entityId: mediaId,
        before: null,
        after: {
          mediaId,
          sourceUrl:
            'https://media.blob.core.windows.net/77777777-7777-4777-8777-777777777777/new.png',
          contentHash,
          byteLength: 64,
          mimeType: 'image/png',
          blobName: `sha256/${contentHash}`,
          sourceReferenceHash: 'e'.repeat(64),
        },
        reasonCode: 'ASSESSMENT_SOURCE_MEDIA_MUTATION',
      },
    }
  )
}

describe('Azure Table audit mapping', () => {
  it('derives deterministic sharded keys without participant identifiers in keys', () => {
    const record = recordWithPayload('NOT_AUTHORIZED')
    const shard = record.envelope.eventId[0]

    expect(auditEvidencePartitionKey(record)).toBe(
      `v1|${LIVE_QUIZ_ID}|2|20260812|${shard}`
    )
    expect(auditLocatorPartitionKey(record.envelope.eventId)).toBe(
      `v1|${shard}`
    )
    expect(auditRetentionPartitionKey(record)).toBe(
      `v1|${LIVE_QUIZ_ID}|2|${shard}`
    )
    expect(auditEvidencePartitionKey(record)).not.toContain(PARTICIPANT_ID)
  })

  it('maps exact canonical bytes into deterministic binary chunks and indexes', () => {
    const record = recordWithPayload('NOT_AUTHORIZED')
    const mapped = mapAuditRecordToTableEntities(record)
    const root = mapped.evidence.at(-1)
    const chunks = mapped.evidence.slice(0, -1)

    expect(root).toMatchObject({
      rowKey: `e|${record.envelope.eventId}`,
      recordKind: 'EVENT_ROOT',
      eventHash: record.envelope.eventHash,
      participantId: PARTICIPANT_ID,
      chunkBytes: { value: AUDIT_CANONICAL_CHUNK_BYTES, type: 'Int32' },
    })
    expect(mapped.locator).toMatchObject({
      rowKey: record.envelope.eventId,
      evidencePartitionKey: root?.partitionKey,
      evidenceRootRowKey: root?.rowKey,
    })
    expect(mapped.retentionIndex).toMatchObject({
      rowKey: `event|${record.envelope.eventId}`,
      evidencePartitionKey: root?.partitionKey,
      locatorPartitionKey: mapped.locator.partitionKey,
    })

    const reconstructed = Buffer.concat(
      chunks.map((chunk) => Buffer.from(chunk.content as Uint8Array))
    ).toString('utf8')
    expect(reconstructed).toBe(record.canonicalEnvelope)
  })

  it('splits records larger than one chunk without splitting UTF-8 code points logically', () => {
    const record = recordWithLargeDescription()
    const mapped = mapAuditRecordToTableEntities(record)
    const chunks = mapped.evidence.slice(0, -1)

    expect(chunks.length).toBeGreaterThan(1)
    expect(
      Buffer.concat(
        chunks.map((chunk) => Buffer.from(chunk.content as Uint8Array))
      ).toString('utf8')
    ).toBe(record.canonicalEnvelope)
  })

  it('adds a reverse retention index for immutable media references', () => {
    const record = mediaBaselineRecord()
    const mapped = mapAuditRecordToTableEntities(record)

    expect(mapped.reverseRetentionIndexes).toEqual([
      expect.objectContaining({
        partitionKey: `media|a|${'a'.repeat(64)}`,
        rowKey: `${LIVE_QUIZ_ID}|0000000002|${record.envelope.eventId}`,
        resourceKind: 'MEDIA',
        blobName: `sha256/${'a'.repeat(64)}`,
      }),
    ])
  })

  it('adds a reverse retention index for media captured after activation', () => {
    const record = mediaCapturedRecord()
    const mapped = mapAuditRecordToTableEntities(record)

    expect(mapped.reverseRetentionIndexes).toEqual([
      expect.objectContaining({
        partitionKey: `media|d|${'d'.repeat(64)}`,
        rowKey: `${LIVE_QUIZ_ID}|0000000002|${record.envelope.eventId}`,
        resourceKind: 'MEDIA',
        blobName: `sha256/${'d'.repeat(64)}`,
      }),
    ])
  })

  it('rejects a canonical envelope that does not match the supplied envelope', () => {
    const record = recordWithPayload('NOT_AUTHORIZED')
    const otherRecord = recordWithPayload('INVALID_STATE')
    expect(() =>
      mapAuditRecordToTableEntities({
        ...record,
        canonicalEnvelope: otherRecord.canonicalEnvelope,
      })
    ).toThrow('Append-only audit conflict')
  })
})
