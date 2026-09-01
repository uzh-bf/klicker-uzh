import { randomUUID } from 'node:crypto'
import {
  createCanonicalAuditEvent,
  createTrustedAuditContext,
  hashCanonicalValue,
} from '@klicker-uzh/audit'
import * as DB from '@klicker-uzh/prisma/client'
import { DisplayMode, type ElementData } from '@klicker-uzh/types'
import type { ContextWithUser } from '../src/lib/context.js'
import type { AssessmentBaselineSnapshot } from '../src/services/assessmentAuditBaseline.js'
import {
  assessmentAuditSystemOperation,
  assessmentLecturerPermissionChangeDrafts,
  assessmentMediaChangeDrafts,
  assessmentParticipantResetDrafts,
  assessmentResponseSnapshot,
  buildAssessmentMutationAuditDrafts,
} from '../src/services/assessmentAuditProducers.js'
import { withPermission } from '../src/services/sharing.js'

function snapshot(): AssessmentBaselineSnapshot {
  return {
    id: randomUUID(),
    name: 'Internal assessment',
    displayName: 'Assessment',
    description: null,
    accessMode: DB.AccessMode.PUBLIC,
    status: DB.PublicationStatus.DRAFT,
    reviewStatus: DB.ReviewStatus.INCOMPLETE,
    availableFrom: null,
    isLiveQAEnabled: false,
    isConfusionFeedbackEnabled: false,
    isModerationEnabled: true,
    isGamificationEnabled: false,
    isAssessmentEnabled: true,
    isDeleted: false,
    areInstancesOutdated: false,
    pointsMultiplier: 1,
    defaultPoints: 10,
    defaultCorrectPoints: 5,
    maxBonusPoints: 45,
    timeToZeroBonus: 20,
    activeBlockId: null,
    courseId: randomUUID(),
    pinCode: 'MUST_NOT_LEAK',
    blocks: [
      {
        id: 11,
        order: 0,
        timeLimit: 60,
        expiresAt: null,
        randomSelection: null,
        execution: 0,
        status: DB.ElementBlockStatus.SCHEDULED,
        startedAt: null,
        closedAt: null,
        elements: [
          {
            id: 21,
            order: 0,
            elementId: 31,
            isVersionOutdated: false,
            options: { basePoints: true, pointsMultiplier: 1 },
            elementData: {
              id: '31-v1',
              elementId: 31,
              type: DB.ElementType.SC,
              name: 'Question',
              content: 'Question content',
              explanation: null,
              basePoints: true,
              pointsMultiplier: 1,
              options: {
                hasSampleSolution: true,
                hasAnswerFeedbacks: false,
                displayMode: DisplayMode.LIST,
                choices: [
                  { ix: 0, value: 'Correct', correct: true, feedback: null },
                  { ix: 1, value: 'Wrong', correct: false, feedback: null },
                ],
              },
            } as unknown as ElementData,
          },
        ],
      },
    ],
    participations: [],
    permissions: [],
  }
}

function validateDrafts(
  liveQuizId: string,
  drafts: ReturnType<typeof buildAssessmentMutationAuditDrafts>
) {
  const context = createTrustedAuditContext({
    recordedVia: 'TRANSACTIONAL_OUTBOX',
    receivedAt: '2026-08-12T08:00:00.000Z',
    actor: { kind: 'USER', userId: randomUUID() },
    authorization: {
      decision: 'ALLOWED',
      authScope: 'AS_USER_FULL_ACCESS',
      requiredPermission: 'WRITE',
      resolvedObjectScope: { type: 'LIVE_QUIZ', id: liveQuizId },
    },
    scope: { liveQuizId, lifecycleEpoch: 1 },
    correlationId: randomUUID(),
  })
  return drafts.map((draft) => createCanonicalAuditEvent(context, draft))
}

describe('assessment lecturer and system producer snapshots', () => {
  it('emits exact staged block changes and a complete instance change', () => {
    const before = snapshot()
    const after: AssessmentBaselineSnapshot = {
      ...before,
      displayName: 'Renamed assessment',
      blocks: [
        {
          ...before.blocks[0]!,
          order: 1,
          timeLimit: 90,
          elements: [
            {
              ...before.blocks[0]!.elements[0]!,
              order: 1,
              isVersionOutdated: true,
            },
          ],
        },
      ],
    }
    const drafts = buildAssessmentMutationAuditDrafts({
      before,
      after,
      producerOperationId: randomUUID(),
    })

    expect(drafts.map((draft) => draft.eventType)).toEqual([
      'ASSESSMENT_CONFIGURATION_CHANGED',
      'ASSESSMENT_BLOCK_UPDATED',
      'ASSESSMENT_BLOCK_REORDERED',
      'ASSESSMENT_ELEMENT_INSTANCE_UPDATED',
    ])
    const blockUpdated = drafts.find(
      (draft) => draft.eventType === 'ASSESSMENT_BLOCK_UPDATED'
    )
    const blockReordered = drafts.find(
      (draft) => draft.eventType === 'ASSESSMENT_BLOCK_REORDERED'
    )
    expect(blockUpdated?.payload).toMatchObject({
      before: { order: 0, timeLimitSeconds: 60 },
      after: { order: 0, timeLimitSeconds: 90 },
    })
    expect(blockReordered?.payload).toMatchObject({
      before: { order: 0, timeLimitSeconds: 90 },
      after: { order: 1, timeLimitSeconds: 90 },
    })
    expect(() => validateDrafts(before.id, drafts)).not.toThrow()
    expect(JSON.stringify(drafts)).not.toContain('MUST_NOT_LEAK')
  })

  it('records scheduled and unpublished states as exact configuration changes', () => {
    const before = snapshot()
    const scheduled = {
      ...before,
      status: DB.PublicationStatus.SCHEDULED,
      availableFrom: new Date('2026-09-14T08:00:00.000Z'),
    }
    const unpublished = {
      ...scheduled,
      status: DB.PublicationStatus.DRAFT,
      availableFrom: null,
    }

    const scheduledDrafts = buildAssessmentMutationAuditDrafts({
      before,
      after: scheduled,
      producerOperationId: randomUUID(),
    })
    const unpublishedDrafts = buildAssessmentMutationAuditDrafts({
      before: scheduled,
      after: unpublished,
      producerOperationId: randomUUID(),
    })

    expect(scheduledDrafts).toMatchObject([
      {
        eventType: 'ASSESSMENT_CONFIGURATION_CHANGED',
        payload: {
          before: { publicationStatus: DB.PublicationStatus.DRAFT },
          after: {
            publicationStatus: DB.PublicationStatus.SCHEDULED,
            availableFrom: '2026-09-14T08:00:00.000Z',
          },
        },
      },
    ])
    expect(unpublishedDrafts).toMatchObject([
      {
        eventType: 'ASSESSMENT_CONFIGURATION_CHANGED',
        payload: {
          before: { publicationStatus: DB.PublicationStatus.SCHEDULED },
          after: {
            publicationStatus: DB.PublicationStatus.DRAFT,
            availableFrom: null,
          },
        },
      },
    ])
  })

  it('normalizes response evidence and hashes participant resets deterministically', () => {
    const participantId = randomUUID()
    const response = {
      id: 7,
      submittedAt: new Date('2026-08-12T08:00:00.123Z'),
      submissionId: null,
      response: {
        choices: [
          { ix: 2, selected: true },
          { ix: 0, selected: true },
          { ix: 1, selected: false },
        ],
      },
      timeSpent: 4.5,
      correctness: DB.ResponseCorrectness.PARTIAL,
      basePoints: 1,
      correctnessPoints: 2,
      bonusPoints: 3,
      instanceId: 21,
      elementBlockExecution: 0,
      participantId,
      correctionOnly: false,
      createdAt: new Date('2026-08-12T08:00:00.123Z'),
      updatedAt: new Date('2026-08-12T08:00:00.123Z'),
    } satisfies DB.LiveQuizResponse
    const responseSnapshot = assessmentResponseSnapshot({
      response,
      elementType: DB.ElementType.MC,
    })
    expect(responseSnapshot.answer).toEqual({
      kind: 'MC',
      selectedOptionIds: [0, 2],
    })

    const drafts = assessmentParticipantResetDrafts({
      producerOperationId: randomUUID(),
      responses: [{ participantId, snapshot: responseSnapshot }],
    })
    expect(drafts).toHaveLength(1)
    expect(drafts[0]?.payload).toEqual({
      participantId,
      affectedResponseIds: [7],
      beforeAggregateHash: hashCanonicalValue([responseSnapshot]),
      afterAggregateHash: null,
      reasonCode: 'COURSE_ADMIN_ASSESSMENT_RESET',
    })
  })

  it('emits media capture, replacement, and no event for an identical replay', () => {
    const mediaId = randomUUID()
    const initial = {
      mediaId,
      sourceUrl:
        'https://media.blob.core.windows.net/owner/assessment-image.png',
      contentHash: 'a'.repeat(64),
      byteLength: 10,
      mimeType: 'image/png',
      blobName: `sha256/${'a'.repeat(64)}`,
      sourceReferenceHash: 'b'.repeat(64),
    }
    const replaced = {
      ...initial,
      contentHash: 'c'.repeat(64),
      byteLength: 11,
      blobName: `sha256/${'c'.repeat(64)}`,
    }
    const operationId = randomUUID()

    expect(
      assessmentMediaChangeDrafts({
        before: new Map(),
        after: [initial],
        producerOperationId: operationId,
      })
    ).toMatchObject([{ eventType: 'ASSESSMENT_MEDIA_CAPTURED' }])
    expect(
      assessmentMediaChangeDrafts({
        before: new Map([[mediaId, initial]]),
        after: [initial],
        producerOperationId: operationId,
      })
    ).toEqual([])
    expect(
      assessmentMediaChangeDrafts({
        before: new Map([[mediaId, initial]]),
        after: [replaced],
        producerOperationId: operationId,
      })
    ).toMatchObject([{ eventType: 'ASSESSMENT_MEDIA_REPLACED' }])
  })

  it('records only effective lecturer permission changes', () => {
    const liveQuizId = randomUUID()
    const subjectId = randomUUID()
    const operationId = randomUUID()

    expect(
      assessmentLecturerPermissionChangeDrafts({
        liveQuizId,
        before: new Map([[subjectId, DB.PermissionLevel.OWNER]]),
        after: new Map([[subjectId, DB.PermissionLevel.OWNER]]),
        producerOperationId: operationId,
        operationSuffix: 'unchanged-direct-share',
      })
    ).toEqual([])
    expect(
      assessmentLecturerPermissionChangeDrafts({
        liveQuizId,
        before: new Map([[subjectId, DB.PermissionLevel.READ]]),
        after: new Map([[subjectId, DB.PermissionLevel.WRITE]]),
        producerOperationId: operationId,
        operationSuffix: 'effective-change',
      })
    ).toMatchObject([
      {
        payload: {
          subjectId,
          change: 'REVOKED',
          permission: DB.PermissionLevel.READ,
        },
      },
      {
        payload: {
          subjectId,
          change: 'GRANTED',
          permission: DB.PermissionLevel.WRITE,
        },
      },
    ])
  })

  it('attributes scheduled work to the system and retains its initiator', () => {
    const initiatedByUserId = randomUUID()
    expect(
      assessmentAuditSystemOperation({
        initiatedByUserId,
        correlationId: '44444444-4444-4444-8444-444444444444',
        occurredAt: new Date('2026-08-12T08:00:00.000Z'),
      })
    ).toEqual({
      actor: { kind: 'SYSTEM' },
      initiatedBy: { userId: initiatedByUserId },
      authorization: {
        decision: 'NOT_APPLICABLE',
        authScope: 'SYSTEM_ASSESSMENT_OPERATION',
      },
      correlationId: '44444444-4444-4444-8444-444444444444',
      occurredAt: new Date('2026-08-12T08:00:00.000Z'),
    })
  })

  it('records an authenticated rejection at the permission boundary', async () => {
    const liveQuizId = randomUUID()
    const userId = randomUUID()
    const courseId = randomUUID()
    type StoredAuditRow = { canonicalEnvelope: string }
    const rows: StoredAuditRow[] = []
    const outbox = {
      createMany: async ({ data }: { data: StoredAuditRow[] }) => {
        rows.push(...data)
      },
      findMany: async () => rows,
    }
    const prisma = {
      derivedPermission: { findUnique: async () => null },
      assessmentAuditScope: {
        findFirst: async () => ({ lifecycleEpoch: 3 }),
      },
      liveQuiz: { findUnique: async () => ({ courseId }) },
      $transaction: async (
        callback: (tx: {
          assessmentAuditOutboxEvent: typeof outbox
        }) => Promise<unknown>
      ) => callback({ assessmentAuditOutboxEvent: outbox }),
    }
    const resolver = withPermission(
      () => ({ liveQuizId }),
      DB.PermissionLevel.ADMIN,
      async () => {
        throw new Error('the protected resolver must not run')
      },
      { actionType: 'ASSESSMENT_DELETE' }
    )

    const result = await resolver(undefined, {}, {
      user: { sub: userId },
      prisma,
    } as unknown as ContextWithUser)

    expect(result).toBeNull()
    expect(rows).toHaveLength(1)
    const envelope = JSON.parse(rows[0].canonicalEnvelope)
    expect(envelope).toMatchObject({
      eventType: 'ASSESSMENT_ACTION_REJECTED',
      actor: { kind: 'USER', userId },
      authorization: {
        decision: 'DENIED',
        resolvedObjectScope: { type: 'LIVE_QUIZ', id: liveQuizId },
      },
      scope: { liveQuizId, lifecycleEpoch: 3, courseId },
      payload: {
        actionType: 'ASSESSMENT_DELETE',
        reasonCode: 'INSUFFICIENT_PERMISSION',
      },
    })
  })
})
