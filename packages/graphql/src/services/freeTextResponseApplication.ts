import * as DB from '@klicker-uzh/prisma/client'
import type { PrismaTransactionClient } from '@klicker-uzh/util'
import type { Context } from '@/lib/context.js'
import type { ResponseInput } from '../ops.js'

type RespondToQuestionInTransaction = (
  args: {
    id: number
    courseId: string
    response: ResponseInput
    answerTime: number
    participation: (DB.Participation & { participant: DB.Participant }) | null
    correctnessOverride?: number
    freeTextAttemptId?: string
  },
  ctx: Context,
  prisma: PrismaTransactionClient
) => Promise<unknown>

export async function applyFreeTextAttemptResponseInTransaction(
  { attemptId }: { attemptId: string },
  prisma: PrismaTransactionClient,
  respondToQuestion: RespondToQuestionInTransaction
) {
  const attempt = await prisma.freeTextAttempt.findUnique({
    where: { id: attemptId },
    include: {
      cycle: {
        include: {
          participant: true,
          participation: { include: { participant: true } },
          practiceQuiz: true,
        },
      },
    },
  })
  if (
    !attempt ||
    attempt.questionResponseDetailId !== null ||
    attempt.evaluationStatus !== DB.FreeTextEvaluationStatus.EVALUATED ||
    attempt.aggregateScore === null
  ) {
    return false
  }

  await respondToQuestion(
    {
      id: attempt.cycle.elementInstanceId,
      courseId: attempt.cycle.practiceQuiz.courseId,
      response: { value: attempt.answer },
      answerTime: attempt.answerTime,
      participation: attempt.cycle.participation,
      correctnessOverride: attempt.aggregateScore / 100,
      freeTextAttemptId: attempt.id,
    },
    {
      prisma,
      user: {
        sub: attempt.cycle.participantId,
        role: DB.UserRole.PARTICIPANT,
        scope: DB.UserLoginScope.READ_ONLY,
        catalystInstitutional: false,
        catalystIndividual: false,
      },
    } as Context,
    prisma
  )

  const linked = await prisma.freeTextAttempt.findUnique({
    where: { id: attempt.id },
    select: { questionResponseDetailId: true },
  })
  return linked?.questionResponseDetailId !== null
}
