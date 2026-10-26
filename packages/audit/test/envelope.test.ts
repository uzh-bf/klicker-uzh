import {
  canonicalizeJson,
  createCanonicalAuditEvent,
  createTrustedAuditContext,
  hashCanonicalValue,
  parseCanonicalAuditEnvelope,
} from '../src/index.js'

const liveQuizId = '11111111-1111-4111-8111-111111111111'
const correlationId = '22222222-2222-4222-8222-222222222222'
const actorId = '33333333-3333-4333-8333-333333333333'
const participantId = '55555555-5555-4555-8555-555555555555'
const submissionId = '66666666-6666-4666-8666-666666666666'
const baselineId = '77777777-7777-4777-8777-777777777777'
const mediaId = '88888888-8888-4888-8888-888888888888'
const sha256 = 'a'.repeat(64)

function context(
  options: {
    recordedVia?: 'TRANSACTIONAL_OUTBOX' | 'HATCHET_PROCESSOR'
    transportAttemptedAt?: string
    courseId?: string
  } = {}
) {
  return createTrustedAuditContext({
    recordedVia: options.recordedVia ?? 'TRANSACTIONAL_OUTBOX',
    receivedAt: '2026-08-11T08:00:00.123Z',
    recordedAt: '2026-08-11T08:00:00.456Z',
    transportAttemptedAt: options.transportAttemptedAt,
    actor: { kind: 'USER', userId: actorId },
    authorization: {
      decision: 'ALLOWED',
      authScope: 'LECTURER',
      requiredPermission: 'LIVE_QUIZ_WRITE',
      resolvedObjectScope: { type: 'LIVE_QUIZ', id: liveQuizId },
    },
    scope: {
      liveQuizId,
      lifecycleEpoch: 1,
      ...(options.courseId === undefined ? {} : { courseId: options.courseId }),
    },
    correlationId,
  })
}

function startEvent(producerOperationId: string) {
  return createCanonicalAuditEvent(context(), {
    eventType: 'ASSESSMENT_STARTED',
    producerOperationId,
    outcome: 'SUCCEEDED',
    payload: {
      fromState: 'PUBLISHED',
      toState: 'RUNNING',
    },
  })
}

function assessmentState(name: string) {
  return {
    name,
    displayName: name,
    description: null,
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

function elementInstanceState() {
  return {
    elementInstanceId: 44,
    blockId: 1,
    order: 0,
    sourceElementId: 9,
    sourceElementVersion: 1,
    isVersionOutdated: false,
    effectiveElement: {
      content: {
        elementType: 'SC' as const,
        name: 'Question',
        content: 'Prompt',
        explanation: null,
        hasSampleSolution: false,
        hasAnswerFeedbacks: false,
        contentOptions: {
          kind: 'SC' as const,
          displayMode: 'LIST' as const,
          options: [],
        },
      },
      scoring: {
        elementType: 'SC' as const,
        basePointsEnabled: true,
        pointsMultiplier: 1,
        scoringRules: { kind: 'SC' as const, correctOptionIds: [] },
      },
    },
    effectiveContentHash: sha256,
    effectiveSolutionHash: sha256,
  }
}

describe('canonical audit envelope', () => {
  it('constructs and verifies a registered launch event', () => {
    const event = startEvent(`${correlationId}:0`)

    expect(event.envelope.criticality).toBe('CRITICAL')
    expect(event.envelope.evidenceClass).toBe('AUTHORITATIVE')
    expect(event.envelope.payloadSchemaVersion).toBe(1)
    expect(event.envelope.recordedAt).toBe('2026-08-11T08:00:00.456Z')
    expect(parseCanonicalAuditEnvelope(event.canonicalEnvelope)).toEqual(
      event.envelope
    )
  })

  it('records an explicit, complete baseline root and configuration part', () => {
    const root = createCanonicalAuditEvent(context(), {
      eventType: 'ASSESSMENT_BASELINE_ROOT_RECORDED',
      producerOperationId: `${baselineId}:root`,
      payload: {
        baselineId,
        baselineKind: 'CREATION',
        baselineSchemaVersion: 1,
        capturedAt: '2026-08-11T08:00:00.123Z',
        expectedPartCounts: {
          configuration: 1,
          blocks: 0,
          elementInstances: 0,
          solutionsAndScoring: 0,
          participantEligibility: 0,
          lecturerPermissions: 1,
          mediaReferences: 0,
          limitations: 0,
        },
        aggregateHash: sha256,
      },
    })
    const part = createCanonicalAuditEvent(context(), {
      eventType: 'ASSESSMENT_BASELINE_PART_RECORDED',
      producerOperationId: `${baselineId}:configuration`,
      payload: {
        baselineId,
        baselineKind: 'CREATION',
        baselineSchemaVersion: 1,
        capturedAt: '2026-08-11T08:00:00.123Z',
        partKey: 'ASSESSMENT_CONFIGURATION|ROOT',
        content: {
          kind: 'ASSESSMENT_CONFIGURATION',
          courseId: null,
          configuration: assessmentState('Assessment'),
        },
        contentHash: sha256,
      },
    })

    expect(parseCanonicalAuditEnvelope(root.canonicalEnvelope)).toEqual(
      root.envelope
    )
    expect(parseCanonicalAuditEnvelope(part.canonicalEnvelope)).toEqual(
      part.envelope
    )
  })

  it('rejects contradictory, raw, and secret-bearing payload shapes', () => {
    expect(() =>
      createCanonicalAuditEvent(context(), {
        eventType: 'ASSESSMENT_STARTED',
        producerOperationId: `${correlationId}:1`,
        payload: {
          fromState: 'PUBLISHED',
          toState: 'PAUSED',
        } as never,
      })
    ).toThrow()

    expect(() =>
      createCanonicalAuditEvent(context(), {
        eventType: 'ASSESSMENT_CONFIGURATION_CHANGED',
        producerOperationId: `${correlationId}:secret-value`,
        payload: {
          entityType: 'ASSESSMENT',
          entityId: liveQuizId,
          before: assessmentState('Assessment'),
          after: {
            ...assessmentState('Assessment'),
            description: 'Bearer abc.def.ghi',
          },
        },
      })
    ).toThrow('Forbidden audit evidence value')

    expect(() =>
      createCanonicalAuditEvent(context(), {
        eventType: 'ASSESSMENT_CONFIGURATION_CHANGED',
        producerOperationId: `${correlationId}:2`,
        payload: {
          entityType: 'ASSESSMENT',
          entityId: liveQuizId,
          before: assessmentState('Assessment'),
          after: assessmentState('Assessment 2'),
          rawPrismaRecord: { pinCode: '1234' },
        } as never,
      })
    ).toThrow()

    expect(() =>
      createCanonicalAuditEvent(context(), {
        eventType: 'ASSESSMENT_MEDIA_CAPTURED',
        producerOperationId: `${correlationId}:media`,
        payload: {
          entityType: 'MEDIA',
          entityId: mediaId,
          before: null,
          after: {
            mediaId,
            sourceUrl: 'https://assessment.example.invalid/media/image.png',
            contentHash: sha256,
            byteLength: 10,
            mimeType: 'image/png',
            blobName: `sha256/${sha256}?sig=secret`,
            sourceReferenceHash: sha256,
          },
        },
      })
    ).toThrow()
  })

  it('keeps deferred tiers unavailable to callers', () => {
    expect(() =>
      createCanonicalAuditEvent(context(), {
        eventType: 'AUDIT_MANIFEST_SEALED',
        producerOperationId: `${correlationId}:fast-follow`,
        payload: { operation: 'AUDIT_MANIFEST_SEALED' },
      })
    ).toThrow('disabled delivery tier FAST_FOLLOW')

    expect(() =>
      createCanonicalAuditEvent(context(), {
        eventType: 'RESPONSE_ANSWER_CHANGED',
        producerOperationId: `${correlationId}:stack-2`,
        payload: {
          elementInstanceId: 44,
          elementInstanceVersion: 1,
          effectiveContentHash: sha256,
          answer: { kind: 'MC', selectedOptionIds: [0] },
          trigger: 'IDLE',
        },
      })
    ).toThrow('disabled delivery tier STACK_2')

    expect(() =>
      createTrustedAuditContext({
        recordedVia: 'TRANSACTIONAL_OUTBOX',
        receivedAt: '2026-08-11T08:00:00.123Z',
        actor: { kind: 'USER', userId: actorId },
        authorization: {
          decision: 'ALLOWED',
          authScope: 'LECTURER',
        },
        scope: { liveQuizId, lifecycleEpoch: 1 },
        correlationId,
        enabledTiers: ['STACK_2'],
      } as never)
    ).toThrow()
  })

  it('requires Hatchet identity and trusted transport chronology', () => {
    const draft = {
      eventType: 'SUBMISSION_SERVER_ACCEPTED' as const,
      producerOperationId: `${correlationId}:hatchet`,
      scope: { participantId },
      submissionId,
      hatchetEventId: 'hatchet-event-1',
      payload: {
        submissionId,
        stage: 'SERVER_ACCEPTED' as const,
        answerStateHash: sha256,
      },
    }

    expect(() =>
      createCanonicalAuditEvent(
        context({ recordedVia: 'HATCHET_PROCESSOR' }),
        draft
      )
    ).toThrow('requires transportAttemptedAt')

    const event = createCanonicalAuditEvent(
      context({
        recordedVia: 'HATCHET_PROCESSOR',
        transportAttemptedAt: '2026-08-11T08:00:00.234Z',
      }),
      draft
    )
    expect(parseCanonicalAuditEnvelope(event.canonicalEnvelope)).toEqual(
      event.envelope
    )

    expect(() =>
      createCanonicalAuditEvent(
        context({
          recordedVia: 'HATCHET_PROCESSOR',
          transportAttemptedAt: '2026-08-11T08:00:00.234Z',
        }),
        {
          ...draft,
          eventType: 'SUBMISSION_SCORED',
          producerOperationId: `${correlationId}:scored-incomplete`,
          payload: { submissionId, stage: 'SCORED' },
        }
      )
    ).toThrow('SCORED requires')
  })

  it('rejects contradictory rollout outcomes and block transitions', () => {
    expect(() =>
      createCanonicalAuditEvent(context(), {
        eventType: 'ASSESSMENT_ROLLOUT_BASELINE_RECORDED',
        producerOperationId: `${correlationId}:rollout`,
        payload: {
          scanId: baselineId,
          observedAt: '2026-08-11T08:00:00.123Z',
          observedLifecycleState: 'DRAFT',
          lifecycleEpoch: 0,
          outcome: 'ACTIVATED',
          coverageState: 'EXCLUDED_TERMINAL',
          baselineId,
          terminalAt: null,
          retentionAnchorAt: null,
          reasonCode: null,
        },
      })
    ).toThrow('activated rollout evidence must be covered')

    const before = {
      blockId: 1,
      order: 0,
      timeLimitSeconds: null,
      expiresAt: null,
      randomSelectionCount: null,
      execution: 0,
      status: 'SCHEDULED' as const,
      startedAt: null,
      closedAt: null,
    }
    expect(() =>
      createCanonicalAuditEvent(context(), {
        eventType: 'ASSESSMENT_BLOCK_ACTIVATED',
        producerOperationId: `${correlationId}:block`,
        payload: {
          entityType: 'BLOCK',
          entityId: '1',
          before,
          after: { ...before, order: 1 },
        },
      })
    ).toThrow()

    expect(() =>
      createCanonicalAuditEvent(context(), {
        eventType: 'ASSESSMENT_ROLLOUT_BASELINE_RECORDED',
        producerOperationId: `${correlationId}:terminal-draft`,
        payload: {
          scanId: baselineId,
          observedAt: '2026-08-11T08:00:00.123Z',
          observedLifecycleState: 'DRAFT',
          lifecycleEpoch: 0,
          outcome: 'EXCLUDED_TERMINAL',
          coverageState: 'EXCLUDED_TERMINAL',
          baselineId: null,
          terminalAt: '2026-08-10T08:00:00.123Z',
          retentionAnchorAt: '2026-08-10T08:00:00.123Z',
          reasonCode: 'TERMINAL_BEFORE_ROLLOUT',
        },
      })
    ).toThrow('terminal exclusion requires')

    expect(() =>
      createCanonicalAuditEvent(context(), {
        eventType: 'ASSESSMENT_ROLLOUT_BASELINE_RECORDED',
        producerOperationId: `${correlationId}:failed-terminal`,
        payload: {
          scanId: baselineId,
          observedAt: '2026-08-11T08:00:00.123Z',
          observedLifecycleState: 'RUNNING',
          lifecycleEpoch: 0,
          outcome: 'FAILED',
          coverageState: 'UNCOVERED',
          baselineId: null,
          terminalAt: '2026-08-10T08:00:00.123Z',
          retentionAnchorAt: null,
          reasonCode: 'BASELINE_FAILED',
        },
      })
    ).toThrow('failed rollout evidence')
  })

  it('requires canonical entity identities to agree with scope and snapshots', () => {
    const courseId = '99999999-9999-4999-8999-999999999999'
    expect(() =>
      createCanonicalAuditEvent(context(), {
        eventType: 'ASSESSMENT_COURSE_ASSIGNMENT_CHANGED',
        producerOperationId: `${correlationId}:course-scope`,
        payload: {
          courseIdBefore: null,
          courseIdAfter: courseId,
        },
      })
    ).toThrow('requires scope.courseId')

    const before = {
      blockId: 1,
      order: 0,
      timeLimitSeconds: null,
      expiresAt: null,
      randomSelectionCount: null,
      execution: 0,
      status: 'SCHEDULED' as const,
      startedAt: null,
      closedAt: null,
    }
    expect(() =>
      createCanonicalAuditEvent(context(), {
        eventType: 'ASSESSMENT_BLOCK_UPDATED',
        producerOperationId: `${correlationId}:block-scope`,
        scope: { blockId: 2 },
        payload: {
          entityType: 'BLOCK',
          entityId: '1',
          before,
          after: { ...before, timeLimitSeconds: 60 },
        },
      })
    ).toThrow('scope.blockId does not match')

    expect(() =>
      createCanonicalAuditEvent(context(), {
        eventType: 'ASSESSMENT_BLOCK_UPDATED',
        producerOperationId: `${correlationId}:block-snapshot`,
        scope: { blockId: 1 },
        payload: {
          entityType: 'BLOCK',
          entityId: '1',
          before,
          after: { ...before, blockId: 2, timeLimitSeconds: 60 },
        },
      })
    ).toThrow('snapshot identity must match entityId')

    const elementBefore = elementInstanceState()
    expect(() =>
      createCanonicalAuditEvent(context(), {
        eventType: 'ASSESSMENT_ELEMENT_INSTANCE_UPDATED',
        producerOperationId: `${correlationId}:element-scope`,
        scope: { elementInstanceId: 44, blockId: 1 },
        payload: {
          entityType: 'ELEMENT_INSTANCE',
          entityId: '44',
          before: elementBefore,
          after: { ...elementBefore, order: 1 },
        },
      })
    ).toThrow('requires scope.elementId')

    const event = createCanonicalAuditEvent(context({ courseId }), {
      eventType: 'ASSESSMENT_COURSE_ASSIGNMENT_CHANGED',
      producerOperationId: `${correlationId}:course-scope-valid`,
      payload: {
        courseIdBefore: null,
        courseIdAfter: courseId,
      },
    })
    expect(parseCanonicalAuditEnvelope(event.canonicalEnvelope)).toEqual(
      event.envelope
    )
  })

  it('rejects participant identities that contradict the trusted scope', () => {
    expect(() =>
      createCanonicalAuditEvent(context(), {
        eventType: 'ASSESSMENT_PARTICIPANT_ELIGIBILITY_CHANGED',
        producerOperationId: `${correlationId}:participant`,
        scope: { participantId },
        payload: {
          subjectType: 'PARTICIPANT',
          subjectId: '77777777-7777-4777-8777-777777777777',
          change: 'ADDED',
        },
      })
    ).toThrow('Payload participant subject does not match audit scope')
  })

  it('rejects canonical envelopes with tampered contract metadata', () => {
    const event = startEvent(`${correlationId}:5`)
    const { eventHash: _eventHash, ...tampered } = {
      ...event.envelope,
      payloadSchemaVersion: 2,
    }
    const canonical = canonicalizeJson({
      ...tampered,
      eventHash: hashCanonicalValue(tampered),
    })

    expect(() => parseCanonicalAuditEnvelope(canonical)).toThrow(
      'Unknown payload schema version 2'
    )
  })
})
