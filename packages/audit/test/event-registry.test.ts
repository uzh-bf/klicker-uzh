import {
  EVENT_REGISTRY,
  type EventPayload,
  type EventType,
  getEventPayloadSchema,
  getEventRegistration,
  STABLE_EVENT_TYPES,
} from '../src/index.js'

const expectedStableEventTypes = [
  'ASSESSMENT_AUDIT_ACTIVATED',
  'ASSESSMENT_ROLLOUT_BASELINE_RECORDED',
  'ASSESSMENT_BASELINE_ROOT_RECORDED',
  'ASSESSMENT_BASELINE_PART_RECORDED',
  'ASSESSMENT_MODE_CHANGED',
  'ASSESSMENT_COURSE_ASSIGNMENT_CHANGED',
  'ASSESSMENT_PUBLISHED',
  'ASSESSMENT_STARTED',
  'ASSESSMENT_PAUSED',
  'ASSESSMENT_RESUMED',
  'ASSESSMENT_COMPLETED',
  'ASSESSMENT_REOPENED',
  'ASSESSMENT_CANCELLED',
  'ASSESSMENT_RESET',
  'ASSESSMENT_COPIED',
  'ASSESSMENT_IMPORTED',
  'ASSESSMENT_DELETED',
  'ASSESSMENT_CONFIGURATION_CHANGED',
  'ASSESSMENT_BLOCK_CREATED',
  'ASSESSMENT_BLOCK_UPDATED',
  'ASSESSMENT_BLOCK_REORDERED',
  'ASSESSMENT_BLOCK_ACTIVATED',
  'ASSESSMENT_BLOCK_CLOSED',
  'ASSESSMENT_BLOCK_DELETED',
  'ASSESSMENT_ELEMENT_INSTANCE_ADDED',
  'ASSESSMENT_ELEMENT_INSTANCE_REFRESHED',
  'ASSESSMENT_ELEMENT_INSTANCE_UPDATED',
  'ASSESSMENT_ELEMENT_INSTANCE_REORDERED',
  'ASSESSMENT_ELEMENT_INSTANCE_REMOVED',
  'ASSESSMENT_SOURCE_ELEMENT_CHANGED',
  'ASSESSMENT_MEDIA_CAPTURED',
  'ASSESSMENT_MEDIA_REPLACED',
  'ASSESSMENT_PARTICIPANT_ELIGIBILITY_CHANGED',
  'ASSESSMENT_LECTURER_PERMISSION_CHANGED',
  'ASSESSMENT_SESSION_STARTED',
  'ASSESSMENT_SESSION_RESUMED',
  'ASSESSMENT_SESSION_ENDED',
  'ASSESSMENT_ACTION_REJECTED',
  'RESPONSE_ANSWER_CHANGED',
  'RESPONSE_ANSWER_CLEARED',
  'SUBMISSION_ATTEMPTED',
  'SUBMISSION_AUTO_TRIGGERED',
  'SUBMISSION_SERVER_ACCEPTED',
  'SUBMISSION_VALIDATED',
  'SUBMISSION_REJECTED',
  'SUBMISSION_DUPLICATE',
  'SUBMISSION_PERSISTED',
  'SUBMISSION_SCORED',
  'SUBMISSION_PROCESSING_FAILED',
  'SUBMISSION_PROCESSING_RECOVERED',
  'ASSESSMENT_POINTS_CORRECTED',
  'ASSESSMENT_PARTICIPANT_RESET',
  'ASSESSMENT_BULK_OPERATION_STARTED',
  'ASSESSMENT_BULK_ITEM_COMPLETED',
  'ASSESSMENT_BULK_OPERATION_COMPLETED',
  'ASSESSMENT_REPORT_ISSUED',
  'ASSESSMENT_REPORT_SUPERSEDED',
  'ASSESSMENT_REPORT_REVOKED',
  'EVIDENCE_ANNOTATION',
  'EVIDENCE_HOLD_PLACED',
  'EVIDENCE_HOLD_RELEASED',
  'AUDIT_GAP_DETECTED',
  'AUDIT_GAP_RESOLVED',
  'AUDIT_CLIENT_EVENT_REJECTED',
  'AUDIT_DELIVERY_DELAYED',
  'AUDIT_DELIVERY_CONFLICTED',
  'AUDIT_DELIVERY_QUARANTINED',
  'AUDIT_DELIVERY_RECOVERED',
  'AUDIT_MANIFEST_SEALED',
  'AUDIT_MANIFEST_FAILED',
  'AUDIT_RETENTION_COMPLETED',
  'AUDIT_RETENTION_FAILED',
] as const

describe('assessment audit event registry', () => {
  it('contains every stable revision 7 event exactly once', () => {
    type UnmappedEvent = {
      [T in EventType]: [EventPayload<T>] extends [never] ? T : never
    }[EventType]
    expectTypeOf<UnmappedEvent>().toEqualTypeOf<never>()

    expect([...STABLE_EVENT_TYPES].sort()).toEqual(
      [...expectedStableEventTypes].sort()
    )
    expect(Object.keys(EVENT_REGISTRY)).toHaveLength(
      expectedStableEventTypes.length
    )
  })

  it('assigns each event one schema, tier, owner, producer and durability point', () => {
    for (const eventType of STABLE_EVENT_TYPES) {
      const entry = EVENT_REGISTRY[eventType]
      expect(entry.payloadSchemaVersion).toBe(1)
      expect(entry.payloadSchemas[1]).toBeDefined()
      expect(['LAUNCH', 'FAST_FOLLOW', 'STACK_2']).toContain(entry.tier)
      expect(entry.ownerPackage).not.toBe('')
      expect(entry.producer).not.toBe('')
      expect(entry.durabilityPoint).not.toBe('')
      expect(entry.allowedRecordedVia.length).toBeGreaterThan(0)
    }
  })

  it('rejects unknown event names', () => {
    type UnknownIsEventType = 'ASSESSMENT_SOMETHING_HAPPENED' extends EventType
      ? true
      : false
    expectTypeOf<UnknownIsEventType>().toEqualTypeOf<false>()

    expect(() => getEventRegistration('ASSESSMENT_SOMETHING_HAPPENED')).toThrow(
      'Unknown audit event type'
    )
  })

  it('dispatches payload schemas by event type and historical version', () => {
    expect(getEventPayloadSchema('ASSESSMENT_STARTED', 1)).toBe(
      EVENT_REGISTRY.ASSESSMENT_STARTED.payloadSchemas[1]
    )
    expect(() => getEventPayloadSchema('ASSESSMENT_STARTED', 2)).toThrow(
      'Unknown payload schema version 2'
    )
  })

  it('declares participant, submission, Hatchet, and client provenance requirements', () => {
    expect(EVENT_REGISTRY.RESPONSE_ANSWER_CHANGED).toMatchObject({
      requiresParticipantScope: true,
      requiresClientProvenance: true,
    })
    expect(EVENT_REGISTRY.SUBMISSION_PERSISTED).toMatchObject({
      requiresParticipantScope: true,
      requiresSubmissionId: true,
      requiresHatchetEventId: true,
      requiresClientProvenance: false,
    })
    expect(EVENT_REGISTRY.ASSESSMENT_STARTED).toMatchObject({
      requiresParticipantScope: false,
      requiresSubmissionId: false,
      requiresHatchetEventId: false,
      requiresClientProvenance: false,
    })
    expect(EVENT_REGISTRY.ASSESSMENT_SESSION_STARTED).toMatchObject({
      requiresParticipantScope: false,
      requiresSubmissionId: false,
    })
  })

  it('keeps launch lifecycle and session transitions launch-gating', () => {
    for (const eventType of [
      'ASSESSMENT_PUBLISHED',
      'ASSESSMENT_STARTED',
      'ASSESSMENT_PAUSED',
      'ASSESSMENT_RESUMED',
      'ASSESSMENT_COMPLETED',
      'ASSESSMENT_REOPENED',
      'ASSESSMENT_CANCELLED',
      'ASSESSMENT_RESET',
      'ASSESSMENT_SESSION_STARTED',
      'ASSESSMENT_SESSION_RESUMED',
      'ASSESSMENT_SESSION_ENDED',
    ] as const) {
      expect(EVENT_REGISTRY[eventType].tier).toBe('LAUNCH')
    }
    for (const eventType of [
      'ASSESSMENT_PUBLISHED',
      'ASSESSMENT_STARTED',
      'ASSESSMENT_PAUSED',
      'ASSESSMENT_RESUMED',
      'ASSESSMENT_COMPLETED',
      'ASSESSMENT_REOPENED',
      'ASSESSMENT_CANCELLED',
      'ASSESSMENT_RESET',
    ] as const) {
      expect(EVENT_REGISTRY[eventType]).toMatchObject({
        evidenceClass: 'AUTHORITATIVE',
        criticality: 'CRITICAL',
      })
    }
  })
})
