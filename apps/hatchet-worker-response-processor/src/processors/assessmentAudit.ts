import { NonRetryableError } from '@hatchet-dev/typescript-sdk/index.js'
import {
  type AuditEventDraft,
  type AuditTransactionClient,
  compareAuditText,
  createTrustedAuditContext,
  deriveAuditEventIdentity,
  emitAuditEvents,
  hashCanonicalValue,
  recordStandaloneAuditEvents,
} from '@klicker-uzh/audit'
import { ElementType, Prisma } from '@klicker-uzh/prisma/client'
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
  activatedAt?: Date | null
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
          .sort(([left], [right]) => compareAuditText(left, right))
          .map(([caseId, itemResponses]) => ({
            caseId,
            items: Object.entries(itemResponses)
              .sort(([left], [right]) => Number(left) - Number(right))
              .map(([itemId, criterionResponses]) => ({
                itemId: Number(itemId),
                criteria: Object.entries(criterionResponses)
                  .sort(([left], [right]) => compareAuditText(left, right))
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
  liveQuizId: string,
  receivedAt?: string
): Promise<CoveredAssessmentScope | null> {
  return client.assessmentAuditScope.findFirst({
    where: {
      liveQuizId,
      coverageState: 'COVERED',
      ...(receivedAt === undefined
        ? {}
        : { activatedAt: { lte: new Date(receivedAt) } }),
    },
    orderBy: { lifecycleEpoch: 'desc' },
    select: { lifecycleEpoch: true, activatedAt: true },
  })
}

function producerOperationId(message: SubmissionCommand, suffix: string) {
  return `assessment-submission:${message.submissionId}:${suffix}`
}

export function submissionDraft(
  message: SubmissionCommand,
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
    producerOperationId: producerOperationId(message, operationSuffix),
    submissionId: message.submissionId,
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
      decision: missing.some(
        (draft) =>
          draft.eventType === 'SUBMISSION_REJECTED' &&
          draft.payload.reasonCode === 'PARTICIPATION_NOT_FOUND'
      )
        ? 'DENIED'
        : 'ALLOWED',
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

// Rejections that depend on when this delivery was received. A resend of the
// same submission can receive a time-based rejection that an earlier, on-time
// receipt of that submission would not.
const TIME_BASED_REJECTION_REASONS: ReadonlySet<string> = new Set([
  'SUBMISSION_AFTER_BLOCK_CLOSE',
  'SUBMISSION_BLOCK_EXECUTION_CHANGED',
  'SUBMISSION_LIFECYCLE_CHANGED',
])

// Serializes every transaction that checks and records audit evidence for one
// submissionId. It must run before the first read so READ COMMITTED reads see
// the evidence a concurrent delivery committed. Without it, two matching
// resends can both miss the stored event and the second insert fails as an
// idempotency conflict, because its receipt and recording times differ.
export async function lockSubmissionOutcome(
  tx: Pick<Prisma.TransactionClient, '$executeRaw'>,
  message: SubmissionCommand
) {
  await tx.$executeRaw(
    Prisma.sql`SELECT pg_advisory_xact_lock(hashtextextended(${message.submissionId}::text, 0))`
  )
}

async function findSubmissionEvents(
  tx: Pick<Prisma.TransactionClient, 'assessmentAuditOutboxEvent'>,
  message: SubmissionCommand,
  eventTypes: readonly string[]
) {
  return tx.assessmentAuditOutboxEvent.findMany({
    where: {
      liveQuizId: message.liveQuizId,
      correlationId: message.submissionId,
      eventType: { in: [...eventTypes] },
    },
    select: { eventType: true, canonicalEnvelope: true },
  })
}

// A time-based rejection recorded for a later receipt does not block an
// earlier receipt of the same submission that was on time.
function isSupersededByEarlierReceipt(
  row: { eventType: string; canonicalEnvelope: string },
  message: SubmissionCommand
) {
  if (row.eventType !== 'SUBMISSION_REJECTED') return false
  let envelope: { receivedAt?: unknown; payload?: { reasonCode?: unknown } }
  try {
    envelope = JSON.parse(row.canonicalEnvelope)
  } catch {
    throw new Error('Stored terminal submission evidence is not valid JSON')
  }
  const reasonCode = envelope.payload?.reasonCode
  return (
    typeof reasonCode === 'string' &&
    TIME_BASED_REJECTION_REASONS.has(reasonCode) &&
    typeof envelope.receivedAt === 'string' &&
    Date.parse(envelope.receivedAt) > Date.parse(message.receivedAt)
  )
}

export async function assertTerminalStageAvailable(input: {
  tx: Pick<Prisma.TransactionClient, 'assessmentAuditOutboxEvent'>
  message: SubmissionCommand
  intendedEventType: (typeof TERMINAL_EVENT_TYPES)[number]
}) {
  const rows = await findSubmissionEvents(
    input.tx,
    input.message,
    TERMINAL_EVENT_TYPES
  )
  const conflicting = rows.filter(
    (row) =>
      row.eventType !== input.intendedEventType &&
      !(
        input.intendedEventType === 'SUBMISSION_PERSISTED' &&
        isSupersededByEarlierReceipt(row, input.message)
      )
  )
  if (conflicting.length > 0) {
    // A resend of an already decided submission must not retry into failure
    // evidence for an outcome that is already recorded.
    throw new NonRetryableError(
      'Submission command already has a conflicting terminal stage'
    )
  }
}

export async function getTerminalStageForCommand(input: {
  tx: Pick<Prisma.TransactionClient, 'assessmentAuditOutboxEvent'>
  message: SubmissionCommand
}) {
  const rows = await findSubmissionEvents(
    input.tx,
    input.message,
    TERMINAL_EVENT_TYPES
  )
  const stages = new Set(rows.map((row) => row.eventType))
  // PERSISTED wins: an on-time earlier receipt may persist after a later
  // receipt was rejected for timing, and older evidence can pair PERSISTED
  // with DUPLICATE for one submission.
  if (stages.has('SUBMISSION_PERSISTED')) return 'SUBMISSION_PERSISTED'
  if (stages.size > 1) {
    throw new Error('Submission command has multiple terminal stages')
  }
  return [...stages][0]
}

export async function commandHasRecordedFailure(input: {
  tx: Pick<Prisma.TransactionClient, 'assessmentAuditOutboxEvent'>
  message: SubmissionCommand
}) {
  const failures = await findSubmissionEvents(input.tx, input.message, [
    'SUBMISSION_PROCESSING_FAILED',
  ])
  return failures.length > 0
}

export type AcceptedSubmissionBinding = {
  elementBlockExecution: number
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
        payload?: { answerStateHash?: unknown; elementBlockExecution?: unknown }
        scope?: { elementInstanceId?: unknown }
      }
      const answerStateHash = envelope.payload?.answerStateHash
      const elementBlockExecution = envelope.payload?.elementBlockExecution
      if (
        typeof answerStateHash !== 'string' ||
        typeof elementBlockExecution !== 'number' ||
        !Number.isSafeInteger(elementBlockExecution) ||
        elementBlockExecution < 0
      )
        throw new Error('Stored submission acceptance binding is incomplete')
      const elementInstanceId = envelope.scope?.elementInstanceId
      return [
        {
          elementBlockExecution,
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
