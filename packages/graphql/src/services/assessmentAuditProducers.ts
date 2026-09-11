import { randomUUID } from 'node:crypto'
import {
  type AssessmentBaselineContent,
  type AuditActor,
  type AuditAuthorization,
  type AuditEventDraft,
  type AuditTransactionClient,
  canonicalizeJson,
  createTrustedAuditContext,
  type EventPayload,
  emitAuditEvents,
  hashCanonicalValue,
  type NormalizedAnswer,
  parseCanonicalAuditEnvelope,
  recordStandaloneAuditEvents,
} from '@klicker-uzh/audit'
import type { Prisma } from '@klicker-uzh/prisma/client'
import * as DB from '@klicker-uzh/prisma/client'
import type { SingleQuestionResponseLiveQuiz } from '@klicker-uzh/types'
import {
  type AssessmentBaselineSnapshot,
  assessmentBlockState,
  assessmentConfigurationState,
  assessmentElementInstanceState,
} from './assessmentAuditBaseline.js'

export type AssessmentAuditOperation = Readonly<{
  actor: Extract<AuditActor, { kind: 'USER' | 'PARTICIPANT' | 'SYSTEM' }>
  initiatedBy?: { userId: string }
  authorization: AuditAuthorization
  correlationId: string
  occurredAt: Date
}>

export function assessmentAuditUserOperation(input: {
  userId: string
  requiredPermission: string
  correlationId?: string
  occurredAt?: Date
}): AssessmentAuditOperation {
  return {
    actor: { kind: 'USER', userId: input.userId },
    authorization: {
      decision: 'ALLOWED',
      authScope: 'AS_USER_FULL_ACCESS',
      requiredPermission: input.requiredPermission,
    },
    correlationId: input.correlationId ?? randomUUID(),
    occurredAt: input.occurredAt ?? new Date(),
  }
}

export function assessmentAuditParticipantOperation(input: {
  participantId: string
  correlationId?: string
  occurredAt?: Date
}): AssessmentAuditOperation {
  return {
    actor: { kind: 'PARTICIPANT', participantId: input.participantId },
    authorization: {
      decision: 'ALLOWED',
      authScope: 'PARTICIPANT_ASSESSMENT_ACCESS',
      requiredPermission: 'PARTICIPATE',
    },
    correlationId: input.correlationId ?? randomUUID(),
    occurredAt: input.occurredAt ?? new Date(),
  }
}

export function assessmentAuditSystemOperation(input?: {
  initiatedByUserId?: string
  correlationId?: string
  occurredAt?: Date
}): AssessmentAuditOperation {
  return {
    actor: { kind: 'SYSTEM' },
    ...(input?.initiatedByUserId === undefined
      ? {}
      : { initiatedBy: { userId: input.initiatedByUserId } }),
    authorization: {
      decision: 'NOT_APPLICABLE',
      authScope: 'SYSTEM_ASSESSMENT_OPERATION',
    },
    correlationId: input?.correlationId ?? randomUUID(),
    occurredAt: input?.occurredAt ?? new Date(),
  }
}

type CoveredScope = {
  liveQuizId: string
  lifecycleEpoch: number
  completedAt: Date | null
  retentionAnchorAt: Date | null
}

export type AssessmentAuditMediaState = Extract<
  AssessmentBaselineContent,
  { kind: 'MEDIA_REFERENCE' }
>['media']

async function coveredScope(
  tx: Pick<Prisma.TransactionClient, 'assessmentAuditScope'>,
  liveQuizId: string
): Promise<CoveredScope | null> {
  return tx.assessmentAuditScope.findFirst({
    where: {
      liveQuizId,
      coverageState: DB.AssessmentAuditCoverageState.COVERED,
    },
    orderBy: { lifecycleEpoch: 'desc' },
    select: {
      liveQuizId: true,
      lifecycleEpoch: true,
      completedAt: true,
      retentionAnchorAt: true,
    },
  })
}

export async function loadCoveredAssessmentMediaStates(
  tx: Pick<
    Prisma.TransactionClient,
    'assessmentAuditScope' | 'assessmentAuditOutboxEvent'
  >,
  liveQuizId: string
): Promise<Map<string, AssessmentAuditMediaState> | null> {
  const scope = await coveredScope(tx, liveQuizId)
  if (scope === null) return null
  const rows = await tx.assessmentAuditOutboxEvent.findMany({
    where: {
      liveQuizId,
      lifecycleEpoch: scope.lifecycleEpoch,
      eventType: {
        in: [
          'ASSESSMENT_BASELINE_PART_RECORDED',
          'ASSESSMENT_MEDIA_CAPTURED',
          'ASSESSMENT_MEDIA_REPLACED',
        ],
      },
    },
    orderBy: [{ recordedAt: 'asc' }, { eventId: 'asc' }],
    select: { canonicalEnvelope: true },
  })
  const states = new Map<string, AssessmentAuditMediaState>()
  for (const row of rows) {
    const envelope = parseCanonicalAuditEnvelope(row.canonicalEnvelope)
    if (envelope.eventType === 'ASSESSMENT_BASELINE_PART_RECORDED') {
      const payload =
        envelope.payload as EventPayload<'ASSESSMENT_BASELINE_PART_RECORDED'>
      if (payload.content.kind === 'MEDIA_REFERENCE') {
        states.set(payload.content.media.mediaId, payload.content.media)
      }
      continue
    }
    const payload = envelope.payload as EventPayload<
      'ASSESSMENT_MEDIA_CAPTURED' | 'ASSESSMENT_MEDIA_REPLACED'
    >
    if (
      payload.entityType === 'MEDIA' &&
      payload.after !== null &&
      'mediaId' in payload.after
    ) {
      states.set(
        payload.after.mediaId,
        payload.after as AssessmentAuditMediaState
      )
    }
  }
  return states
}

export function assessmentMediaChangeDrafts(input: {
  before: ReadonlyMap<string, AssessmentAuditMediaState>
  after: readonly AssessmentAuditMediaState[]
  producerOperationId: string
}): AuditEventDraft<
  'ASSESSMENT_MEDIA_CAPTURED' | 'ASSESSMENT_MEDIA_REPLACED'
>[] {
  return [...input.after]
    .sort((left, right) => left.mediaId.localeCompare(right.mediaId))
    .flatMap((media) => {
      const previous = input.before.get(media.mediaId)
      if (previous !== undefined && !differs(previous, media)) {
        return []
      }
      const eventType =
        previous === undefined
          ? 'ASSESSMENT_MEDIA_CAPTURED'
          : 'ASSESSMENT_MEDIA_REPLACED'
      return [
        {
          eventType,
          producerOperationId: `${input.producerOperationId}:media:${media.mediaId}:${eventType.toLowerCase()}`,
          payload: {
            entityType: 'MEDIA',
            entityId: media.mediaId,
            before: previous ?? null,
            after: media,
            reasonCode: 'ASSESSMENT_SOURCE_MEDIA_MUTATION',
          },
        },
      ]
    })
}

export async function emitCoveredAssessmentAuditEvents(input: {
  tx: Pick<Prisma.TransactionClient, 'assessmentAuditScope'>
  auditTx: AuditTransactionClient
  liveQuizId: string
  courseId?: string | null
  operation: AssessmentAuditOperation
  drafts: readonly AuditEventDraft[]
}) {
  if (input.drafts.length === 0) return []
  const scope = await coveredScope(input.tx, input.liveQuizId)
  if (scope === null) return []

  const context = createTrustedAuditContext({
    recordedVia: 'TRANSACTIONAL_OUTBOX',
    receivedAt: input.operation.occurredAt,
    recordedAt: input.operation.occurredAt,
    actor: input.operation.actor,
    ...(input.operation.initiatedBy === undefined
      ? {}
      : { initiatedBy: input.operation.initiatedBy }),
    authorization: {
      ...input.operation.authorization,
      resolvedObjectScope: { type: 'LIVE_QUIZ', id: input.liveQuizId },
    },
    scope: {
      liveQuizId: scope.liveQuizId,
      lifecycleEpoch: scope.lifecycleEpoch,
      ...(input.courseId === null || input.courseId === undefined
        ? {}
        : { courseId: input.courseId }),
    },
    correlationId: input.operation.correlationId,
  })
  return emitAuditEvents(input.auditTx, context, input.drafts)
}

export async function recordCoveredAssessmentActionRejected(input: {
  client: Pick<
    DB.PrismaClient,
    '$transaction' | 'assessmentAuditScope' | 'liveQuiz'
  >
  liveQuizId: string
  operation: AssessmentAuditOperation
  actionType: string
  reasonCode: string
  targetType?: string
  targetId?: string
}) {
  const [scope, liveQuiz] = await Promise.all([
    input.client.assessmentAuditScope.findFirst({
      where: {
        liveQuizId: input.liveQuizId,
        coverageState: DB.AssessmentAuditCoverageState.COVERED,
      },
      orderBy: { lifecycleEpoch: 'desc' },
      select: { lifecycleEpoch: true },
    }),
    input.client.liveQuiz.findUnique({
      where: { id: input.liveQuizId },
      select: { courseId: true },
    }),
  ])
  if (scope === null) return []
  const context = createTrustedAuditContext({
    recordedVia: 'TRANSACTIONAL_OUTBOX',
    receivedAt: input.operation.occurredAt,
    actor: input.operation.actor,
    authorization: {
      decision: 'DENIED',
      authScope: input.operation.authorization.authScope,
      ...(input.operation.authorization.requiredPermission === undefined
        ? {}
        : {
            requiredPermission:
              input.operation.authorization.requiredPermission,
          }),
      resolvedObjectScope: { type: 'LIVE_QUIZ', id: input.liveQuizId },
    },
    scope: {
      liveQuizId: input.liveQuizId,
      lifecycleEpoch: scope.lifecycleEpoch,
      ...(liveQuiz?.courseId === null || liveQuiz?.courseId === undefined
        ? {}
        : { courseId: liveQuiz.courseId }),
    },
    correlationId: input.operation.correlationId,
  })
  return recordStandaloneAuditEvents(input.client, context, [
    {
      eventType: 'ASSESSMENT_ACTION_REJECTED',
      producerOperationId: `${input.operation.correlationId}:rejected:${input.reasonCode}`,
      outcome: 'REJECTED',
      payload: {
        actionType: input.actionType,
        reasonCode: input.reasonCode,
        ...(input.targetType === undefined
          ? {}
          : { targetType: input.targetType }),
        ...(input.targetId === undefined ? {} : { targetId: input.targetId }),
      },
    },
  ])
}

export async function recordAssessmentActionRejectedForUser(input: {
  client: Pick<
    DB.PrismaClient,
    '$transaction' | 'assessmentAuditScope' | 'liveQuiz'
  >
  liveQuizId: string
  userId: string
  requiredPermission: string
  actionType: string
  reasonCode: string
  targetType?: string
  targetId?: string
}) {
  return recordCoveredAssessmentActionRejected({
    client: input.client,
    liveQuizId: input.liveQuizId,
    operation: assessmentAuditUserOperation({
      userId: input.userId,
      requiredPermission: input.requiredPermission,
    }),
    actionType: input.actionType,
    reasonCode: input.reasonCode,
    ...(input.targetType === undefined ? {} : { targetType: input.targetType }),
    ...(input.targetId === undefined ? {} : { targetId: input.targetId }),
  })
}

export async function emitCoveredCourseAssessmentAuditEvents(input: {
  tx: Pick<Prisma.TransactionClient, 'liveQuiz' | 'assessmentAuditScope'>
  auditTx: AuditTransactionClient
  courseId: string
  operation: AssessmentAuditOperation
  drafts: readonly AuditEventDraft[]
}) {
  const liveQuizzes = await input.tx.liveQuiz.findMany({
    where: { courseId: input.courseId, isAssessmentEnabled: true },
    orderBy: { id: 'asc' },
    select: { id: true },
  })
  const events: Awaited<ReturnType<typeof emitCoveredAssessmentAuditEvents>> =
    []
  for (const liveQuiz of liveQuizzes) {
    events.push(
      ...(await emitCoveredAssessmentAuditEvents({
        tx: input.tx,
        auditTx: input.auditTx,
        liveQuizId: liveQuiz.id,
        courseId: input.courseId,
        operation: input.operation,
        drafts: input.drafts,
      }))
    )
  }
  return events
}

export type AssessmentLecturerPermissionState = Map<
  string,
  {
    courseId: string | null
    permissions: Map<string, string>
  }
>

export async function loadAssessmentLecturerPermissionState(input: {
  tx: Pick<Prisma.TransactionClient, 'liveQuiz'>
  liveQuizId?: string
  liveQuizIds?: readonly string[]
  courseId?: string
  courseIds?: readonly string[]
  subjectUserIds: readonly string[]
}): Promise<AssessmentLecturerPermissionState> {
  const subjectUserIds = [...new Set(input.subjectUserIds)].sort()
  if (subjectUserIds.length === 0) return new Map()
  const liveQuizIds = [...new Set(input.liveQuizIds ?? [])]
  const courseIds = [...new Set(input.courseIds ?? [])]
  const targetFilter = [
    ...(input.liveQuizId === undefined ? [] : [{ id: input.liveQuizId }]),
    ...(liveQuizIds.length === 0 ? [] : [{ id: { in: liveQuizIds } }]),
    ...(input.courseId === undefined ? [] : [{ courseId: input.courseId }]),
    ...(courseIds.length === 0 ? [] : [{ courseId: { in: courseIds } }]),
  ]
  const liveQuizzes = await input.tx.liveQuiz.findMany({
    where: {
      isAssessmentEnabled: true,
      ...(targetFilter.length === 0 ? {} : { OR: targetFilter }),
    },
    orderBy: { id: 'asc' },
    select: {
      id: true,
      courseId: true,
      permissions: {
        where: { userId: { in: subjectUserIds } },
        orderBy: { userId: 'asc' },
        select: { userId: true, permissionLevel: true },
      },
    },
  })
  return new Map(
    liveQuizzes.map((liveQuiz) => [
      liveQuiz.id,
      {
        courseId: liveQuiz.courseId,
        permissions: new Map(
          liveQuiz.permissions.map((permission) => [
            permission.userId,
            permission.permissionLevel,
          ])
        ),
      },
    ])
  )
}

export function permissionTargetIds(
  permissions: readonly Pick<DB.Permission, 'liveQuizId' | 'courseId'>[]
) {
  return {
    liveQuizIds: [
      ...new Set(
        permissions.flatMap((permission) =>
          permission.liveQuizId === null ? [] : [permission.liveQuizId]
        )
      ),
    ],
    courseIds: [
      ...new Set(
        permissions.flatMap((permission) =>
          permission.courseId === null ? [] : [permission.courseId]
        )
      ),
    ],
  }
}

export async function emitAssessmentLecturerPermissionChanges(input: {
  tx: Pick<Prisma.TransactionClient, 'assessmentAuditScope'>
  auditTx: AuditTransactionClient
  operation: AssessmentAuditOperation
  before: AssessmentLecturerPermissionState
  after: AssessmentLecturerPermissionState
  operationSuffix: string
}) {
  const events: Awaited<ReturnType<typeof emitCoveredAssessmentAuditEvents>> =
    []
  const liveQuizIds = [
    ...new Set([...input.before.keys(), ...input.after.keys()]),
  ].sort()
  for (const liveQuizId of liveQuizIds) {
    const before = input.before.get(liveQuizId)
    const after = input.after.get(liveQuizId)
    const drafts = assessmentLecturerPermissionChangeDrafts({
      liveQuizId,
      before: before?.permissions ?? new Map(),
      after: after?.permissions ?? new Map(),
      producerOperationId: input.operation.correlationId,
      operationSuffix: input.operationSuffix,
    })
    events.push(
      ...(await emitCoveredAssessmentAuditEvents({
        tx: input.tx,
        auditTx: input.auditTx,
        liveQuizId,
        courseId: after?.courseId ?? before?.courseId,
        operation: input.operation,
        drafts,
      }))
    )
  }
  return events
}

export function assessmentLecturerPermissionChangeDrafts(input: {
  liveQuizId: string
  before: ReadonlyMap<string, string>
  after: ReadonlyMap<string, string>
  producerOperationId: string
  operationSuffix: string
}): AuditEventDraft<'ASSESSMENT_LECTURER_PERMISSION_CHANGED'>[] {
  const subjectIds = [
    ...new Set([...input.before.keys(), ...input.after.keys()]),
  ].sort()
  const drafts: AuditEventDraft<'ASSESSMENT_LECTURER_PERMISSION_CHANGED'>[] = []
  for (const subjectId of subjectIds) {
    const oldPermission = input.before.get(subjectId)
    const newPermission = input.after.get(subjectId)
    if (oldPermission === newPermission) continue
    if (oldPermission !== undefined) {
      drafts.push({
        eventType: 'ASSESSMENT_LECTURER_PERMISSION_CHANGED',
        producerOperationId: `${input.producerOperationId}:permission:${input.liveQuizId}:${subjectId}:${input.operationSuffix}:revoked`,
        payload: {
          subjectType: 'USER',
          subjectId,
          change: 'REVOKED',
          permission: oldPermission,
          reasonCode: 'EFFECTIVE_LECTURER_PERMISSION_MUTATION',
        },
      })
    }
    if (newPermission !== undefined) {
      drafts.push({
        eventType: 'ASSESSMENT_LECTURER_PERMISSION_CHANGED',
        producerOperationId: `${input.producerOperationId}:permission:${input.liveQuizId}:${subjectId}:${input.operationSuffix}:granted`,
        payload: {
          subjectType: 'USER',
          subjectId,
          change: 'GRANTED',
          permission: newPermission,
          reasonCode: 'EFFECTIVE_LECTURER_PERMISSION_MUTATION',
        },
      })
    }
  }
  return drafts
}

export async function anchorCoveredAssessmentAuditScope(input: {
  tx: Pick<Prisma.TransactionClient, 'assessmentAuditScope'>
  liveQuizId: string
  terminalState: 'COMPLETED' | 'CANCELLED' | 'DELETED'
  terminalAt: Date
}): Promise<void> {
  const scope = await coveredScope(input.tx, input.liveQuizId)
  if (scope === null) return
  const timestampField =
    input.terminalState === 'COMPLETED'
      ? { completedAt: input.terminalAt }
      : input.terminalState === 'CANCELLED'
        ? { cancelledAt: input.terminalAt }
        : { deletedAt: input.terminalAt }
  await input.tx.assessmentAuditScope.update({
    where: {
      liveQuizId_lifecycleEpoch: {
        liveQuizId: scope.liveQuizId,
        lifecycleEpoch: scope.lifecycleEpoch,
      },
    },
    data: {
      ...timestampField,
      retentionAnchorAt:
        input.terminalState === 'COMPLETED' || scope.completedAt === null
          ? input.terminalAt
          : scope.retentionAnchorAt,
    },
  })
}

function normalizedLiveQuizAnswer(
  response: SingleQuestionResponseLiveQuiz | null,
  elementType: DB.ElementType
): NormalizedAnswer | null {
  if (response === null) return null
  switch (elementType) {
    case DB.ElementType.SC:
    case DB.ElementType.MC:
    case DB.ElementType.KPRIM:
      if (!('choices' in response)) return null
      return {
        kind: elementType,
        selectedOptionIds: response.choices
          .filter((choice) => choice.selected)
          .map((choice) => choice.ix)
          .sort((left, right) => left - right),
      }
    case DB.ElementType.FREE_TEXT:
      return 'value' in response
        ? { kind: 'FREE_TEXT', value: response.value }
        : null
    case DB.ElementType.NUMERICAL: {
      if (!('value' in response)) return null
      const value = Number(response.value)
      if (!Number.isFinite(value)) return null
      return {
        kind: 'NUMERICAL',
        value,
        restriction: { minimum: null, maximum: null, precision: null },
      }
    }
    case DB.ElementType.SELECTION:
      return 'selection' in response
        ? {
            kind: 'SELECTION',
            selectedItemIds: response.selection
              .filter((itemId) => Number.isInteger(itemId) && itemId > 0)
              .sort((left, right) => left - right),
          }
        : null
    case DB.ElementType.CASE_STUDY:
      if (!('assessment' in response)) return null
      return {
        kind: 'CASE_STUDY',
        cases: Object.entries(response.assessment)
          .sort(([left], [right]) => left.localeCompare(right))
          .map(([caseId, itemResponses]) => ({
            caseId,
            items: Object.entries(itemResponses)
              .sort(([left], [right]) => Number(left) - Number(right))
              .map(([itemId, criterionResponses]) => ({
                itemId: Number(itemId),
                criteria: Object.entries(criterionResponses)
                  .sort(([left], [right]) => left.localeCompare(right))
                  .map(([criterionId, criterionResponse]) => ({
                    criterionId,
                    response: criterionResponse,
                  })),
              })),
          })),
      }
    case DB.ElementType.CONTENT:
      return 'viewed' in response
        ? { kind: 'CONTENT', viewed: response.viewed }
        : null
    case DB.ElementType.FLASHCARD:
      return 'correctness' in response
        ? { kind: 'FLASHCARD', correctness: response.correctness }
        : null
  }
}

export function assessmentResponseSnapshot(input: {
  response: DB.LiveQuizResponse
  elementType: DB.ElementType
}) {
  const answer = normalizedLiveQuizAnswer(
    input.response.response,
    input.elementType
  )
  return {
    responseId: input.response.id,
    elementInstanceId: input.response.instanceId,
    elementBlockExecution: input.response.elementBlockExecution,
    submittedAt: input.response.submittedAt.toISOString(),
    answer,
    answerHash: hashCanonicalValue(answer),
    correctness: input.response.correctness as 'CORRECT' | 'PARTIAL' | 'WRONG',
    basePoints: input.response.basePoints,
    correctnessPoints: input.response.correctnessPoints,
    bonusPoints: input.response.bonusPoints,
    timeSpentSeconds: Math.max(input.response.timeSpent, 0),
  }
}

export function assessmentParticipantResetDrafts(input: {
  responses: readonly {
    participantId: string
    snapshot: ReturnType<typeof assessmentResponseSnapshot>
  }[]
  producerOperationId: string
}): AuditEventDraft<'ASSESSMENT_PARTICIPANT_RESET'>[] {
  const snapshotsByParticipant = new Map<
    string,
    ReturnType<typeof assessmentResponseSnapshot>[]
  >()
  for (const response of input.responses) {
    const snapshots = snapshotsByParticipant.get(response.participantId) ?? []
    snapshots.push(response.snapshot)
    snapshotsByParticipant.set(response.participantId, snapshots)
  }

  return [...snapshotsByParticipant.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([participantId, snapshots]) => {
      const orderedSnapshots = [...snapshots].sort(
        (left, right) => left.responseId - right.responseId
      )
      return {
        eventType: 'ASSESSMENT_PARTICIPANT_RESET',
        producerOperationId: `${input.producerOperationId}:participant:${participantId}:reset`,
        scope: { participantId },
        payload: {
          participantId,
          affectedResponseIds: orderedSnapshots.map(
            (snapshot) => snapshot.responseId
          ),
          beforeAggregateHash: hashCanonicalValue(orderedSnapshots),
          afterAggregateHash: null,
          reasonCode: 'COURSE_ADMIN_ASSESSMENT_RESET',
        },
      }
    })
}

function differs(left: unknown, right: unknown): boolean {
  return canonicalizeJson(left) !== canonicalizeJson(right)
}

function changedKeys(
  before: Record<string, unknown>,
  after: Record<string, unknown>
): string[] {
  return Object.keys(before).filter((key) => differs(before[key], after[key]))
}

function instanceMap(snapshot: AssessmentBaselineSnapshot) {
  return new Map(
    snapshot.blocks.flatMap((block) =>
      block.elements.map((element) => [
        element.id,
        assessmentElementInstanceState(block.id, element),
      ])
    )
  )
}

const CONFIGURATION_LIFECYCLE_FIELDS = new Set(['activeBlockId'])

export function buildAssessmentMutationAuditDrafts(input: {
  before: AssessmentBaselineSnapshot
  after: AssessmentBaselineSnapshot
  producerOperationId: string
}): AuditEventDraft[] {
  const drafts: AuditEventDraft[] = []
  const { before, after, producerOperationId } = input
  const beforeConfiguration = assessmentConfigurationState(before)
  const afterConfiguration = assessmentConfigurationState(after)
  const configurationChanges = changedKeys(
    beforeConfiguration,
    afterConfiguration
  )

  if (before.isAssessmentEnabled !== after.isAssessmentEnabled) {
    drafts.push({
      eventType: 'ASSESSMENT_MODE_CHANGED',
      producerOperationId: `${producerOperationId}:assessment-mode`,
      payload: {
        assessmentEnabledBefore: before.isAssessmentEnabled,
        assessmentEnabledAfter: after.isAssessmentEnabled,
        reasonCode: 'ASSESSMENT_CONFIGURATION_MUTATION',
      },
    })
  }
  if (before.courseId !== after.courseId) {
    drafts.push({
      eventType: 'ASSESSMENT_COURSE_ASSIGNMENT_CHANGED',
      producerOperationId: `${producerOperationId}:course-assignment`,
      payload: {
        courseIdBefore: before.courseId,
        courseIdAfter: after.courseId,
        reasonCode: 'LECTURER_CONFIGURATION_MUTATION',
      },
    })
  }
  if (
    configurationChanges.some(
      (field) => !CONFIGURATION_LIFECYCLE_FIELDS.has(field)
    )
  ) {
    drafts.push({
      eventType: 'ASSESSMENT_CONFIGURATION_CHANGED',
      producerOperationId: `${producerOperationId}:configuration`,
      payload: {
        entityType: 'ASSESSMENT',
        entityId: after.id,
        before: beforeConfiguration,
        after: afterConfiguration,
        reasonCode: 'LECTURER_CONFIGURATION_MUTATION',
      },
    })
  }

  const beforeBlocks = new Map(
    before.blocks.map((block) => [block.id, assessmentBlockState(block)])
  )
  const afterBlocks = new Map(
    after.blocks.map((block) => [block.id, assessmentBlockState(block)])
  )
  for (const [blockId, block] of beforeBlocks) {
    if (!afterBlocks.has(blockId)) {
      drafts.push({
        eventType: 'ASSESSMENT_BLOCK_DELETED',
        producerOperationId: `${producerOperationId}:block:${blockId}:deleted`,
        scope: { blockId },
        payload: {
          entityType: 'BLOCK',
          entityId: String(blockId),
          before: block,
          after: null,
          reasonCode: 'LECTURER_CONTENT_MUTATION',
        },
      })
    }
  }
  for (const [blockId, block] of afterBlocks) {
    const previous = beforeBlocks.get(blockId)
    if (previous === undefined) {
      drafts.push({
        eventType: 'ASSESSMENT_BLOCK_CREATED',
        producerOperationId: `${producerOperationId}:block:${blockId}:created`,
        scope: { blockId },
        payload: {
          entityType: 'BLOCK',
          entityId: String(blockId),
          before: null,
          after: block,
          reasonCode: 'LECTURER_CONTENT_MUTATION',
        },
      })
      continue
    }
    const fields = changedKeys(previous, block)
    if (fields.length === 0) continue
    if (fields.includes('status') && block.status === 'ACTIVE') {
      drafts.push({
        eventType: 'ASSESSMENT_BLOCK_ACTIVATED',
        producerOperationId: `${producerOperationId}:block:${blockId}:activated`,
        scope: { blockId },
        payload: {
          entityType: 'BLOCK',
          entityId: String(blockId),
          before: previous,
          after: block,
          reasonCode: 'LECTURER_BLOCK_ACTIVATION',
        },
      })
    } else if (fields.includes('status') && block.status === 'EXECUTED') {
      drafts.push({
        eventType: 'ASSESSMENT_BLOCK_CLOSED',
        producerOperationId: `${producerOperationId}:block:${blockId}:closed`,
        scope: { blockId },
        payload: {
          entityType: 'BLOCK',
          entityId: String(blockId),
          before: previous,
          after: block,
          reasonCode: 'BLOCK_CLOSURE',
        },
      })
    } else {
      const mutableConfigurationFields = [
        'timeLimitSeconds',
        'expiresAt',
        'randomSelectionCount',
      ] as const
      const mutableConfigurationFieldSet = new Set<string>(
        mutableConfigurationFields
      )
      if (
        fields.every(
          (field) =>
            field === 'order' || mutableConfigurationFieldSet.has(field)
        )
      ) {
        let intermediate = previous
        if (fields.some((field) => mutableConfigurationFieldSet.has(field))) {
          const afterConfiguration = {
            ...intermediate,
            ...Object.fromEntries(
              mutableConfigurationFields.map((field) => [field, block[field]])
            ),
          }
          drafts.push({
            eventType: 'ASSESSMENT_BLOCK_UPDATED',
            producerOperationId: `${producerOperationId}:block:${blockId}:updated`,
            scope: { blockId },
            payload: {
              entityType: 'BLOCK',
              entityId: String(blockId),
              before: intermediate,
              after: afterConfiguration,
              reasonCode: 'LECTURER_CONTENT_MUTATION',
            },
          })
          intermediate = afterConfiguration
        }
        if (fields.includes('order')) {
          drafts.push({
            eventType: 'ASSESSMENT_BLOCK_REORDERED',
            producerOperationId: `${producerOperationId}:block:${blockId}:reordered`,
            scope: { blockId },
            payload: {
              entityType: 'BLOCK',
              entityId: String(blockId),
              before: intermediate,
              after: block,
              reasonCode: 'LECTURER_CONTENT_MUTATION',
            },
          })
        }
      }
    }
  }

  const beforeInstances = instanceMap(before)
  const afterInstances = instanceMap(after)
  for (const [instanceId, instance] of beforeInstances) {
    if (!afterInstances.has(instanceId)) {
      drafts.push({
        eventType: 'ASSESSMENT_ELEMENT_INSTANCE_REMOVED',
        producerOperationId: `${producerOperationId}:instance:${instanceId}:removed`,
        scope: {
          blockId: instance.blockId,
          elementInstanceId: instanceId,
          elementId: instance.sourceElementId,
        },
        payload: {
          entityType: 'ELEMENT_INSTANCE',
          entityId: String(instanceId),
          before: instance,
          after: null,
          reasonCode: 'LECTURER_CONTENT_MUTATION',
        },
      })
    }
  }
  for (const [instanceId, instance] of afterInstances) {
    const previous = beforeInstances.get(instanceId)
    if (previous === undefined) {
      drafts.push({
        eventType: 'ASSESSMENT_ELEMENT_INSTANCE_ADDED',
        producerOperationId: `${producerOperationId}:instance:${instanceId}:added`,
        scope: {
          blockId: instance.blockId,
          elementInstanceId: instanceId,
          elementId: instance.sourceElementId,
        },
        payload: {
          entityType: 'ELEMENT_INSTANCE',
          entityId: String(instanceId),
          before: null,
          after: instance,
          reasonCode: 'LECTURER_CONTENT_MUTATION',
        },
      })
      continue
    }
    const fields = changedKeys(previous, instance)
    if (fields.length === 0) continue
    const reorderFields = ['blockId', 'order']
    const refreshFields = [
      'sourceElementVersion',
      'isVersionOutdated',
      'effectiveElement',
      'effectiveContentHash',
      'effectiveSolutionHash',
    ]
    const eventType = fields.every((field) => reorderFields.includes(field))
      ? 'ASSESSMENT_ELEMENT_INSTANCE_REORDERED'
      : fields.every((field) => refreshFields.includes(field))
        ? 'ASSESSMENT_ELEMENT_INSTANCE_REFRESHED'
        : 'ASSESSMENT_ELEMENT_INSTANCE_UPDATED'
    drafts.push({
      eventType,
      producerOperationId: `${producerOperationId}:instance:${instanceId}:${eventType.toLowerCase()}`,
      scope: {
        blockId: instance.blockId,
        elementInstanceId: instanceId,
        elementId: instance.sourceElementId,
      },
      payload: {
        entityType: 'ELEMENT_INSTANCE',
        entityId: String(instanceId),
        before: previous,
        after: instance,
        reasonCode: 'LECTURER_CONTENT_MUTATION',
      },
    })
  }
  return drafts
}

export function assessmentLifecycleDraft<
  T extends
    | 'ASSESSMENT_PUBLISHED'
    | 'ASSESSMENT_STARTED'
    | 'ASSESSMENT_PAUSED'
    | 'ASSESSMENT_RESUMED'
    | 'ASSESSMENT_COMPLETED'
    | 'ASSESSMENT_REOPENED'
    | 'ASSESSMENT_CANCELLED'
    | 'ASSESSMENT_RESET'
    | 'ASSESSMENT_COPIED'
    | 'ASSESSMENT_IMPORTED'
    | 'ASSESSMENT_DELETED',
>(input: {
  eventType: T
  producerOperationId: string
  fromState:
    | 'DRAFT'
    | 'SCHEDULED'
    | 'PUBLISHED'
    | 'RUNNING'
    | 'PAUSED'
    | 'COMPLETED'
    | 'CANCELLED'
    | 'DELETED'
    | null
  toState:
    | 'DRAFT'
    | 'SCHEDULED'
    | 'PUBLISHED'
    | 'RUNNING'
    | 'PAUSED'
    | 'COMPLETED'
    | 'CANCELLED'
    | 'DELETED'
  reasonCode: string
  sourceLiveQuizId?: string
}): AuditEventDraft<T> {
  return {
    eventType: input.eventType,
    producerOperationId: input.producerOperationId,
    payload: {
      fromState: input.fromState,
      toState: input.toState,
      reasonCode: input.reasonCode,
      ...(input.sourceLiveQuizId === undefined
        ? {}
        : { sourceLiveQuizId: input.sourceLiveQuizId }),
    },
  } as AuditEventDraft<T>
}

export function assessmentSessionDraft<
  T extends
    | 'ASSESSMENT_SESSION_STARTED'
    | 'ASSESSMENT_SESSION_RESUMED'
    | 'ASSESSMENT_SESSION_ENDED',
>(input: {
  eventType: T
  producerOperationId: string
  sessionId: string
  transition: 'STARTED' | 'RESUMED' | 'ENDED'
  reasonCode?: string
}): AuditEventDraft<T> {
  return {
    eventType: input.eventType,
    producerOperationId: input.producerOperationId,
    payload: {
      sessionId: input.sessionId,
      transition: input.transition,
      ...(input.reasonCode === undefined
        ? {}
        : { reasonCode: input.reasonCode }),
    },
  } as AuditEventDraft<T>
}
