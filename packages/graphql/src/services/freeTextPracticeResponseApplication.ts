import { computeAwardedXp } from '@klicker-uzh/grading'
import * as DB from '@klicker-uzh/prisma/client'
import type { PrismaTransactionClient } from '@klicker-uzh/util'
import { POINTS_PER_INSTANCE } from './questionResponseEvaluation.js'
import { applyQuestionResponseInTransaction } from './questionResponsePersistence.js'

/**
 * Applies an already evaluated semantic attempt through the normal question
 * response pipeline.  This module owns semantic attempt bookkeeping; the
 * generic stack service only receives a response and an explicit actor.
 */
export async function applyEvaluatedFreeTextAttemptInTransaction(
  {
    attemptId,
    bumpStateVersion = true,
  }: { attemptId: string; bumpStateVersion?: boolean },
  prisma: PrismaTransactionClient
) {
  await prisma.$queryRaw`
    SELECT cycle."id"
    FROM "FreeTextPracticeCycle" AS cycle
    INNER JOIN "FreeTextAttempt" AS attempt
      ON attempt."cycleId" = cycle."id"
    WHERE attempt."id" = ${attemptId}
    FOR UPDATE OF cycle
  `
  const attempt = await prisma.freeTextAttempt.findUnique({
    where: { id: attemptId },
    include: {
      cycle: {
        include: {
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
  if (
    !Number.isFinite(attempt.aggregateScore) ||
    attempt.aggregateScore < 0 ||
    attempt.aggregateScore > 100
  ) {
    throw new Error(
      'Evaluated free-text attempt has an invalid aggregate score'
    )
  }

  const previousBest = await prisma.freeTextAttempt.aggregate({
    where: {
      cycleId: attempt.cycleId,
      id: { not: attempt.id },
      ordinal: { lt: attempt.ordinal },
      evaluationStatus: DB.FreeTextEvaluationStatus.EVALUATED,
    },
    _max: { aggregateScore: true },
  })
  const instance = await prisma.elementInstance.findUniqueOrThrow({
    where: { id: attempt.cycle.elementInstanceId },
    select: { options: true },
  })
  const multiplier = instance.options.pointsMultiplier ?? 1
  const previousPercentage = (previousBest._max.aggregateScore ?? 0) / 100
  const previousScore = previousPercentage * POINTS_PER_INSTANCE * multiplier
  const currentPercentage = attempt.aggregateScore / 100
  const currentScore = currentPercentage * POINTS_PER_INSTANCE * multiplier
  const currentXp = computeAwardedXp({ pointsPercentage: currentPercentage })
  const previousXp = computeAwardedXp({ pointsPercentage: previousPercentage })
  const pointsAwarded = attempt.cycle.participation.isActive
    ? attempt.cycle.pointsRewardEligible
      ? Math.max(0, currentScore - previousScore)
      : 0
    : null
  const xpAwarded = attempt.cycle.xpRewardEligible
    ? Math.max(0, currentXp - previousXp)
    : 0

  const result = await applyQuestionResponseInTransaction(
    {
      id: attempt.cycle.elementInstanceId,
      courseId: attempt.cycle.practiceQuiz.courseId,
      response: { value: attempt.answer },
      answerTime: attempt.answerTime,
      actor: {
        participation: attempt.cycle.participation,
      },
      evaluationPolicy: {
        kind: 'PRECOMPUTED',
        correctness: currentPercentage,
        award: { pointsAwarded, xpAwarded },
      },
    },
    prisma
  )
  const responseDetailId = result?.responseDetailId
  if (!responseDetailId) return false

  const linked = await prisma.freeTextAttempt.updateMany({
    where: { id: attempt.id, questionResponseDetailId: null },
    data: { questionResponseDetailId: responseDetailId },
  })
  if (linked.count !== 1) return false
  await prisma.freeTextPracticeCycle.update({
    where: { id: attempt.cycleId },
    data: {
      pointsAwarded: { increment: pointsAwarded ?? 0 },
      xpAwarded: { increment: xpAwarded },
      bestXp: Math.max(attempt.cycle.bestXp, currentXp),
      ...(bumpStateVersion ? { stateVersion: { increment: 1 as const } } : {}),
    },
  })
  return true
}

export async function applyEvaluatedFreeTextAttempt(
  args: { attemptId: string },
  prisma: DB.PrismaClient
) {
  return await prisma.$transaction((tx) =>
    applyEvaluatedFreeTextAttemptInTransaction(args, tx)
  )
}
