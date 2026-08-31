import * as DB from '@klicker-uzh/prisma/client'

export type FreeTextDispatchAuthorizationResult =
  | { authorized: true }
  | {
      authorized: false
      reason:
        | 'CONSENT_REQUIRED'
        | 'CONSENT_DECLINED'
        | 'PARTICIPANT_ACCESS_UNAVAILABLE'
        | 'LECTURER_ENTITLEMENT_UNAVAILABLE'
        | 'ATTEMPT_NOT_PENDING'
    }

export async function authorizeFreeTextEvaluationDispatch({
  attemptId,
  evaluationRevision,
  participantId,
  disclosureVersion,
  prisma,
}: {
  attemptId: string
  evaluationRevision: number
  participantId: string
  disclosureVersion: string
  prisma: DB.PrismaClient
}): Promise<FreeTextDispatchAuthorizationResult> {
  return await prisma.$transaction(async (tx) => {
    const lockedParticipants = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT "id"
      FROM "Participant"
      WHERE "id" = CAST(${participantId} AS UUID)
      FOR UPDATE
    `
    if (!lockedParticipants[0]) {
      return { authorized: false, reason: 'PARTICIPANT_ACCESS_UNAVAILABLE' }
    }

    const attempt = await tx.freeTextAttempt.findUnique({
      where: { id: attemptId },
      include: {
        cycle: {
          include: {
            participation: true,
            practiceQuiz: { include: { owner: true } },
            elementInstance: { include: { elementStack: true } },
          },
        },
      },
    })
    if (
      !attempt ||
      attempt.evaluationRevision !== evaluationRevision ||
      attempt.evaluationStatus !== DB.FreeTextEvaluationStatus.PENDING ||
      attempt.cycle.status !== DB.FreeTextPracticeCycleStatus.ACTIVE ||
      attempt.cycle.participantId !== participantId
    ) {
      return { authorized: false, reason: 'ATTEMPT_NOT_PENDING' }
    }

    const { cycle } = attempt
    const hasCurrentAccess =
      cycle.participation.participantId === participantId &&
      cycle.participation.courseId === cycle.practiceQuiz.courseId &&
      cycle.practiceQuiz.status === DB.PublicationStatus.PUBLISHED &&
      !cycle.practiceQuiz.isDeleted &&
      cycle.elementInstance.type === DB.ElementInstanceType.PRACTICE_QUIZ &&
      cycle.elementInstance.elementStack?.practiceQuizId ===
        cycle.practiceQuizId
    if (!hasCurrentAccess) {
      return { authorized: false, reason: 'PARTICIPANT_ACCESS_UNAVAILABLE' }
    }

    if (
      !cycle.practiceQuiz.owner.catalystInstitutional &&
      !cycle.practiceQuiz.owner.catalystIndividual
    ) {
      return {
        authorized: false,
        reason: 'LECTURER_ENTITLEMENT_UNAVAILABLE',
      }
    }

    const consent = await tx.participantSemanticEvaluationConsent.findUnique({
      where: {
        participantId_disclosureVersion: {
          participantId,
          disclosureVersion,
        },
      },
    })
    if (consent?.decision !== DB.SemanticEvaluationConsentDecision.ACCEPTED) {
      return {
        authorized: false,
        reason:
          consent?.decision === DB.SemanticEvaluationConsentDecision.DECLINED
            ? 'CONSENT_DECLINED'
            : 'CONSENT_REQUIRED',
      }
    }

    // Re-check consent on every workflow delivery. A request that is already in
    // flight may finish, but a later automatic retry must not resend an answer
    // after the participant has declined.
    if (attempt.evaluationAuthorizedAt !== null) {
      return { authorized: true }
    }

    const claimed = await tx.freeTextAttempt.updateMany({
      where: {
        id: attemptId,
        evaluationRevision,
        evaluationStatus: DB.FreeTextEvaluationStatus.PENDING,
        evaluationAuthorizedAt: null,
      },
      data: { evaluationAuthorizedAt: new Date() },
    })
    return claimed.count === 1
      ? { authorized: true }
      : { authorized: false, reason: 'ATTEMPT_NOT_PENDING' }
  })
}
