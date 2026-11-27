import type { Prisma } from '@klicker-uzh/prisma/client'
import {
  type AuditActor,
  createTrustedAuditContext,
} from '../contract/envelope.js'
import type { AuditTransactionClient } from '../outbox/emit.js'
import { emitAuditEvents } from '../outbox/emit.js'

/**
 * Serializes every producer that creates the course participation of one
 * participant. Call it before checking whether the participation exists, so
 * two concurrent producers cannot both see it missing and both record the
 * eligibility change. Callers that take it for several courses must do so in
 * ascending course order to avoid deadlocks.
 */
export async function lockParticipationEligibility(
  tx: Pick<Prisma.TransactionClient, '$executeRaw'>,
  courseId: string,
  participantId: string
) {
  const lockKey = `participation-eligibility:${courseId}:${participantId}`
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`
}

export async function emitCoveredParticipantEligibilityChange(input: {
  tx: Pick<Prisma.TransactionClient, 'liveQuiz' | 'assessmentAuditScope'>
  auditTx: AuditTransactionClient
  courseId: string
  participantId: string
  eligible: boolean
  actor: Extract<AuditActor, { kind: 'PARTICIPANT' | 'SYSTEM' | 'USER' }>
  correlationId: string
  occurredAt: Date
  producerOperationId: string
}) {
  const liveQuizzes = await input.tx.liveQuiz.findMany({
    where: { courseId: input.courseId, isAssessmentEnabled: true },
    orderBy: { id: 'asc' },
    select: { id: true },
  })
  const events = []
  for (const liveQuiz of liveQuizzes) {
    const scope = await input.tx.assessmentAuditScope.findFirst({
      where: { liveQuizId: liveQuiz.id, coverageState: 'COVERED' },
      orderBy: { lifecycleEpoch: 'desc' },
      select: { lifecycleEpoch: true },
    })
    if (scope === null) continue
    const context = createTrustedAuditContext({
      recordedVia: 'TRANSACTIONAL_OUTBOX',
      receivedAt: input.occurredAt,
      actor: input.actor,
      authorization:
        input.actor.kind === 'SYSTEM'
          ? {
              decision: 'NOT_APPLICABLE',
              authScope: 'SYSTEM_PARTICIPANT_ENROLLMENT',
            }
          : input.actor.kind === 'PARTICIPANT'
            ? {
                decision: 'ALLOWED',
                authScope: 'PARTICIPANT_INVITATION_ACCEPTANCE',
                requiredPermission: 'PARTICIPATE',
              }
            : {
                decision: 'ALLOWED',
                authScope: 'AS_USER_FULL_ACCESS',
                requiredPermission: 'ADMIN',
              },
      scope: {
        liveQuizId: liveQuiz.id,
        lifecycleEpoch: scope.lifecycleEpoch,
        courseId: input.courseId,
      },
      correlationId: input.correlationId,
    })
    events.push(
      ...(await emitAuditEvents(input.auditTx, context, [
        {
          eventType: 'ASSESSMENT_PARTICIPANT_ELIGIBILITY_CHANGED',
          producerOperationId: `${input.producerOperationId}:${liveQuiz.id}`,
          scope: { participantId: input.participantId },
          payload: {
            subjectType: 'PARTICIPANT',
            subjectId: input.participantId,
            change: input.eligible ? 'ADDED' : 'REMOVED',
            reasonCode: input.eligible
              ? 'ASSESSMENT_INVITATION_ACCEPTED'
              : 'ASSESSMENT_PARTICIPATION_DEACTIVATED',
          },
        },
      ]))
    )
  }
  return events
}
