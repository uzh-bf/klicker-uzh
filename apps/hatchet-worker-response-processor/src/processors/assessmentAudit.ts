import {
  type AuditEventDraft,
  type AuditTransactionClient,
  createTrustedAuditContext,
  deriveAuditEventIdentity,
  emitAuditEvents,
  hashCanonicalValue,
  recordStandaloneAuditEvents,
} from '@klicker-uzh/audit'
import type { Prisma } from '@klicker-uzh/prisma/client'
import { ElementType } from '@klicker-uzh/prisma/client'
import type {
  AssessmentResponseCommand,
  LiveQuizResponseInput,
  NumericalRestrictions,
} from '@klicker-uzh/types'

export const ASSESSMENT_VALIDATION_RULES_VERSION =
  'assessment-response-validation-v1'
export const ASSESSMENT_SCORING_ALGORITHM_VERSION = 'klicker-grading-v1'

export type CoveredAssessmentScope = {
  lifecycleEpoch: number
}

type SubmissionCommand = AssessmentResponseCommand<unknown>
type SubmissionDraft = AuditEventDraft<
  | 'SUBMISSION_SERVER_ACCEPTED'
  | 'SUBMISSION_VALIDATED'
  | 'SUBMISSION_REJECTED'
  | 'SUBMISSION_DUPLICATE'
  | 'SUBMISSION_PERSISTED'
  | 'SUBMISSION_SCORED'
  | 'SUBMISSION_PROCESSING_FAILED'
  | 'SUBMISSION_PROCESSING_RECOVERED'
>

export function normalizeAssessmentAnswer(input: {
  type: ElementType
  response: LiveQuizResponseInput
  restrictions?: NumericalRestrictions
}) {
  switch (input.type) {
    case ElementType.SC:
    case ElementType.MC:
    case ElementType.KPRIM:
      if (!Array.isArray(input.response.choices)) {
        throw new Error('Choices response is not normalizable')
      }
      return {
        kind: input.type,
        selectedOptionIds: input.response.choices
          .filter((choice) => choice.selected)
          .map((choice) => choice.ix)
          .sort((left, right) => left - right),
      } as const
    case ElementType.NUMERICAL: {
      const value = Number.parseFloat(String(input.response.value))
      if (!Number.isFinite(value)) {
        throw new Error('Numerical response is not normalizable')
      }
      return {
        kind: 'NUMERICAL' as const,
        value,
        restriction: {
          minimum: input.restrictions?.min ?? null,
          maximum: input.restrictions?.max ?? null,
          precision: null,
        },
      }
    }
    case ElementType.FREE_TEXT:
      if (typeof input.response.value !== 'string') {
        throw new Error('Free-text response is not normalizable')
      }
      return { kind: 'FREE_TEXT' as const, value: input.response.value }
    case ElementType.SELECTION:
      if (!Array.isArray(input.response.selection)) {
        throw new Error('Selection response is not normalizable')
      }
      return {
        kind: 'SELECTION' as const,
        selectedItemIds: input.response.selection
          .filter((itemId) => Number.isInteger(itemId) && itemId > 0)
          .sort((left, right) => left - right),
      }
    case ElementType.CASE_STUDY:
      if (
        input.response.assessment === null ||
        input.response.assessment === undefined
      ) {
        throw new Error('Case-study response is not normalizable')
      }
      return {
        kind: 'CASE_STUDY' as const,
        cases: Object.entries(input.response.assessment)
          .sort(([left], [right]) => left.localeCompare(right))
          .map(([caseId, itemResponses]) => ({
            caseId,
            items: Object.entries(itemResponses)
              .sort(([left], [right]) => Number(left) - Number(right))
              .map(([itemId, criterionResponses]) => ({
                itemId: Number(itemId),
                criteria: Object.entries(criterionResponses)
                  .sort(([left], [right]) => left.localeCompare(right))
                  .map(([criterionId, response]) => ({
                    criterionId,
                    response,
                  })),
              })),
          })),
      }
    case ElementType.CONTENT:
      return {
        kind: 'CONTENT' as const,
        viewed: input.response.viewed === true,
      }
    default:
      throw new Error(`Unsupported assessment answer type ${input.type}`)
  }
}

export async function recordSubmissionMetadataQuarantine(input: {
  client: Parameters<typeof recordStandaloneAuditEvents>[0]
  message: SubmissionCommand
  scope: CoveredAssessmentScope
  reasonCode: string
  recordedAt: Date
}) {
  const context = createTrustedAuditContext({
    recordedVia: 'AUDIT_SERVICE',
    receivedAt: input.message.receivedAt,
    transportAttemptedAt: input.message.transportAttemptedAt,
    recordedAt: input.recordedAt,
    actor: { kind: 'SERVICE', serviceId: 'assessment-response-processor' },
    authorization: {
      decision: 'NOT_APPLICABLE',
      authScope: 'ASSESSMENT_SUBMISSION_METADATA',
      resolvedObjectScope: {
        type: 'LIVE_QUIZ',
        id: input.message.liveQuizId,
      },
    },
    scope: {
      liveQuizId: input.message.liveQuizId,
      lifecycleEpoch: input.scope.lifecycleEpoch,
    },
    correlationId: input.message.submissionId,
  })
  return recordStandaloneAuditEvents(input.client, context, [
    {
      eventType: 'AUDIT_DELIVERY_QUARANTINED',
      producerOperationId: `assessment-submission:${input.message.submissionId}:metadata-quarantine:${input.reasonCode}`,
      outcome: 'QUARANTINED',
      payload: {
        operation: 'AUDIT_DELIVERY_QUARANTINED',
        reasonCode: input.reasonCode,
        affectedRecordCount: 1,
      },
    },
  ])
}

const TERMINAL_EVENT_TYPES = [
  'SUBMISSION_REJECTED',
  'SUBMISSION_DUPLICATE',
  'SUBMISSION_PERSISTED',
] as const

export async function findCoveredAssessmentScope(
  client: Pick<Prisma.TransactionClient, 'assessmentAuditScope'>,
  liveQuizId: string
): Promise<CoveredAssessmentScope | null> {
  return client.assessmentAuditScope.findFirst({
    where: { liveQuizId, coverageState: 'COVERED' },
    orderBy: { lifecycleEpoch: 'desc' },
    select: { lifecycleEpoch: true },
  })
}

function producerOperationId(
  message: SubmissionCommand,
  hatchetEventId: string,
  suffix: string
) {
  return `assessment-submission:${message.submissionId}:${hatchetEventId}:${suffix}`
}

export function submissionDraft(
  message: SubmissionCommand,
  hatchetEventId: string,
  draft: Omit<
    SubmissionDraft,
    'producerOperationId' | 'submissionId' | 'hatchetEventId'
  > & {
    operationSuffix: string
  }
): SubmissionDraft {
  const { operationSuffix, ...event } = draft
  return {
    ...event,
    producerOperationId: producerOperationId(
      message,
      hatchetEventId,
      operationSuffix
    ),
    submissionId: message.submissionId,
    hatchetEventId,
    scope: {
      participantId: message.participantId,
      elementInstanceId: Number(message.instanceId),
      ...event.scope,
    },
  } as SubmissionDraft
}

type ExistingAuditRow = {
  eventId: string
  eventType: string
  payloadHash: string
  liveQuizId: string
  lifecycleEpoch: number
  participantId: string | null
  correlationId: string
  canonicalEnvelope: string
}

function assertExistingEventMatches(
  row: ExistingAuditRow,
  input: {
    message: SubmissionCommand
    scope: CoveredAssessmentScope
    hatchetEventId: string
    draft: SubmissionDraft
  }
) {
  let envelope: Record<string, unknown>
  try {
    envelope = JSON.parse(row.canonicalEnvelope) as Record<string, unknown>
  } catch {
    throw new Error(`Stored audit event ${row.eventId} is not valid JSON`)
  }
  if (
    row.eventType !== input.draft.eventType ||
    row.liveQuizId !== input.message.liveQuizId ||
    row.lifecycleEpoch !== input.scope.lifecycleEpoch ||
    row.participantId !== input.message.participantId ||
    row.correlationId !== input.message.submissionId ||
    envelope.submissionId !== input.message.submissionId ||
    envelope.hatchetEventId !== input.hatchetEventId ||
    row.payloadHash !== hashCanonicalValue(input.draft.payload)
  ) {
    throw new Error(`Audit idempotency conflict for ${row.eventId}`)
  }
}

export async function emitSubmissionAuditEvents(input: {
  tx: Pick<Prisma.TransactionClient, 'assessmentAuditOutboxEvent'>
  auditTx: AuditTransactionClient
  message: SubmissionCommand
  scope: CoveredAssessmentScope
  hatchetEventId: string
  courseId?: string
  recordedAt: Date
  drafts: readonly SubmissionDraft[]
}) {
  if (input.drafts.length === 0) return []
  const identities = input.drafts.map((draft) => ({
    draft,
    ...deriveAuditEventIdentity({
      eventType: draft.eventType,
      liveQuizId: input.message.liveQuizId,
      lifecycleEpoch: input.scope.lifecycleEpoch,
      producerOperationId: draft.producerOperationId,
    }),
  }))
  const existing = await input.tx.assessmentAuditOutboxEvent.findMany({
    where: { eventId: { in: identities.map(({ eventId }) => eventId) } },
    select: {
      eventId: true,
      eventType: true,
      payloadHash: true,
      liveQuizId: true,
      lifecycleEpoch: true,
      participantId: true,
      correlationId: true,
      canonicalEnvelope: true,
    },
  })
  const existingById = new Map(existing.map((row) => [row.eventId, row]))
  const missing = identities.flatMap(({ draft, eventId }) => {
    const row = existingById.get(eventId)
    if (row === undefined) return [draft]
    assertExistingEventMatches(row, {
      message: input.message,
      scope: input.scope,
      hatchetEventId: input.hatchetEventId,
      draft,
    })
    return []
  })
  if (missing.length === 0) return []

  const context = createTrustedAuditContext({
    recordedVia: 'HATCHET_PROCESSOR',
    receivedAt: input.message.receivedAt,
    transportAttemptedAt: input.message.transportAttemptedAt,
    recordedAt: input.recordedAt,
    actor: {
      kind: 'PARTICIPANT',
      participantId: input.message.participantId,
    },
    authorization: {
      decision: 'ALLOWED',
      authScope: 'ASSESSMENT_PARTICIPANT_SESSION',
      requiredPermission: 'SUBMIT_ASSESSMENT_RESPONSE',
      resolvedObjectScope: {
        type: 'LIVE_QUIZ',
        id: input.message.liveQuizId,
      },
    },
    scope: {
      liveQuizId: input.message.liveQuizId,
      lifecycleEpoch: input.scope.lifecycleEpoch,
      ...(input.courseId === undefined ? {} : { courseId: input.courseId }),
    },
    correlationId: input.message.submissionId,
  })
  return emitAuditEvents(input.auditTx, context, missing)
}

export async function assertTerminalStageAvailable(input: {
  tx: Pick<Prisma.TransactionClient, 'assessmentAuditOutboxEvent'>
  message: SubmissionCommand
  hatchetEventId: string
  intendedEventType: (typeof TERMINAL_EVENT_TYPES)[number]
}) {
  const terminalRows = await input.tx.assessmentAuditOutboxEvent.findMany({
    where: {
      liveQuizId: input.message.liveQuizId,
      correlationId: input.message.submissionId,
      eventType: { in: [...TERMINAL_EVENT_TYPES] },
    },
    select: { eventType: true, canonicalEnvelope: true },
  })
  const forCommand = terminalRows.filter((row) => {
    try {
      const envelope = JSON.parse(row.canonicalEnvelope) as {
        hatchetEventId?: string
      }
      return envelope.hatchetEventId === input.hatchetEventId
    } catch {
      throw new Error('Stored terminal submission evidence is not valid JSON')
    }
  })
  if (forCommand.some((row) => row.eventType !== input.intendedEventType)) {
    throw new Error(
      'Submission command already has a conflicting terminal stage'
    )
  }
}

export async function getTerminalStageForCommand(input: {
  tx: Pick<Prisma.TransactionClient, 'assessmentAuditOutboxEvent'>
  message: SubmissionCommand
  hatchetEventId: string
}) {
  const terminalRows = await input.tx.assessmentAuditOutboxEvent.findMany({
    where: {
      liveQuizId: input.message.liveQuizId,
      correlationId: input.message.submissionId,
      eventType: { in: [...TERMINAL_EVENT_TYPES] },
    },
    select: { eventType: true, canonicalEnvelope: true },
  })
  const stages = terminalRows.flatMap((row) => {
    try {
      const envelope = JSON.parse(row.canonicalEnvelope) as {
        hatchetEventId?: string
      }
      return envelope.hatchetEventId === input.hatchetEventId
        ? [row.eventType]
        : []
    } catch {
      throw new Error('Stored terminal submission evidence is not valid JSON')
    }
  })
  if (stages.length > 1) {
    throw new Error('Submission command has multiple terminal stages')
  }
  return stages[0]
}

export async function commandHasRecordedFailure(input: {
  tx: Pick<Prisma.TransactionClient, 'assessmentAuditOutboxEvent'>
  message: SubmissionCommand
  hatchetEventId: string
}) {
  const failures = await input.tx.assessmentAuditOutboxEvent.findMany({
    where: {
      liveQuizId: input.message.liveQuizId,
      correlationId: input.message.submissionId,
      eventType: 'SUBMISSION_PROCESSING_FAILED',
    },
    select: { canonicalEnvelope: true },
  })
  return failures.some((row) => {
    try {
      const envelope = JSON.parse(row.canonicalEnvelope) as {
        hatchetEventId?: string
      }
      return envelope.hatchetEventId === input.hatchetEventId
    } catch {
      throw new Error('Stored submission failure evidence is not valid JSON')
    }
  })
}

export type AcceptedSubmissionBinding = {
  answerStateHash: string
  participantId: string | null
  elementInstanceId: number | null
  lifecycleEpoch: number
}

export async function findAcceptedSubmissionBindings(input: {
  tx: Pick<Prisma.TransactionClient, 'assessmentAuditOutboxEvent'>
  message: SubmissionCommand
}) {
  const accepted = await input.tx.assessmentAuditOutboxEvent.findMany({
    where: {
      liveQuizId: input.message.liveQuizId,
      correlationId: input.message.submissionId,
      eventType: 'SUBMISSION_SERVER_ACCEPTED',
    },
    select: {
      canonicalEnvelope: true,
      lifecycleEpoch: true,
      participantId: true,
    },
  })
  return accepted.flatMap((row): AcceptedSubmissionBinding[] => {
    try {
      const envelope = JSON.parse(row.canonicalEnvelope) as {
        payload?: { answerStateHash?: unknown }
        scope?: { elementInstanceId?: unknown }
      }
      const answerStateHash = envelope.payload?.answerStateHash
      if (typeof answerStateHash !== 'string') return []
      const elementInstanceId = envelope.scope?.elementInstanceId
      return [
        {
          answerStateHash,
          participantId: row.participantId,
          elementInstanceId:
            typeof elementInstanceId === 'number' &&
            Number.isInteger(elementInstanceId)
              ? elementInstanceId
              : null,
          lifecycleEpoch: row.lifecycleEpoch,
        },
      ]
    } catch {
      throw new Error('Stored submission acceptance evidence is not valid JSON')
    }
  })
}
