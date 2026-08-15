import { createHmac } from 'node:crypto'
import * as DB from '@klicker-uzh/prisma/client'
import type { PrismaTransactionClient } from '@klicker-uzh/util'

const correlatedResponseMode =
  DB.LiveQuizResponseCollectionMode.CORRELATED_EXPORT

export const CORRELATED_RESPONSE_RETENTION_DAYS = 90
const millisecondsPerDay = 24 * 60 * 60 * 1000

export function getCorrelatedResponseRetentionCutoff(now: Date): Date {
  return new Date(
    now.getTime() - CORRELATED_RESPONSE_RETENTION_DAYS * millisecondsPerDay
  )
}

export type CorrelatedLiveQuizFinalizationStatus =
  | 'finalized'
  | 'not_applicable'
  | 'not_ended'
  | 'not_found'
  | 'pending'

type FinalizableLiveQuiz = Pick<
  DB.LiveQuiz,
  | 'id'
  | 'status'
  | 'isAssessmentEnabled'
  | 'responseCollectionMode'
  | 'publicationGeneration'
  | 'exportSalt'
  | 'finishedAt'
>

async function lockLiveQuiz({
  prisma,
  liveQuizId,
}: {
  prisma: PrismaTransactionClient
  liveQuizId: string
}) {
  // Soft-deleted quizzes stay eligible for finalization: deleting an ended
  // correlated quiz removes lecturer access but must not leave participant
  // bindings, salts, or receipts outside the settlement lifecycle.
  const [lockedQuiz] = await prisma.$queryRaw<{ id: string }[]>`
    SELECT "id"
    FROM "public"."LiveQuiz"
    WHERE "id" = ${liveQuizId}::uuid
    FOR UPDATE
  `
  if (!lockedQuiz) return null

  return prisma.liveQuiz.findUnique({
    where: { id: lockedQuiz.id },
    select: {
      id: true,
      status: true,
      isAssessmentEnabled: true,
      responseCollectionMode: true,
      publicationGeneration: true,
      exportSalt: true,
      finishedAt: true,
    },
  })
}

function isCorrelatedLiveQuiz(quiz: FinalizableLiveQuiz) {
  return (
    !quiz.isAssessmentEnabled &&
    quiz.responseCollectionMode === correlatedResponseMode
  )
}

function hasUnsettledOrIncompleteReceipt(receipt: {
  settledAt: Date | null
  eventPayload: string | null
  nextDeliveryAt: Date | null
}) {
  return (
    receipt.settledAt === null ||
    receipt.eventPayload !== null ||
    receipt.nextDeliveryAt !== null
  )
}

function respondentLabelDigest(exportSalt: string, respondentId: string) {
  return createHmac('sha256', exportSalt).update(respondentId).digest('hex')
}

async function finalizeLockedCorrelatedLiveQuiz({
  prisma,
  quiz,
  now,
}: {
  prisma: PrismaTransactionClient
  quiz: FinalizableLiveQuiz
  now: Date
}): Promise<CorrelatedLiveQuizFinalizationStatus> {
  if (!isCorrelatedLiveQuiz(quiz)) return 'not_applicable'
  if (quiz.status !== DB.PublicationStatus.ENDED) return 'not_ended'

  const receipts = await prisma.liveQuizPendingResponse.findMany({
    where: {
      liveQuizId: quiz.id,
      publicationGeneration: quiz.publicationGeneration,
    },
    select: { settledAt: true, eventPayload: true, nextDeliveryAt: true },
  })
  if (receipts.some(hasUnsettledOrIncompleteReceipt)) return 'pending'

  const respondents = await prisma.liveQuizRespondent.findMany({
    where: {
      liveQuizId: quiz.id,
      publicationGeneration: quiz.publicationGeneration,
    },
    select: { id: true, exportLabel: true, finalizedAt: true },
  })

  if (
    respondents.some(
      (respondent) =>
        respondent.exportLabel === null || respondent.finalizedAt === null
    ) &&
    quiz.exportSalt === null
  ) {
    throw new Error(
      `Cannot finalize correlated live quiz ${quiz.id} without an export salt`
    )
  }

  const sortedRespondents = [...respondents].sort((left, right) => {
    if (quiz.exportSalt) {
      const leftDigest = respondentLabelDigest(quiz.exportSalt, left.id)
      const rightDigest = respondentLabelDigest(quiz.exportSalt, right.id)
      if (leftDigest !== rightDigest) return leftDigest < rightDigest ? -1 : 1
      return left.id.localeCompare(right.id)
    }

    if (left.exportLabel !== right.exportLabel) {
      return (
        (left.exportLabel ?? Number.POSITIVE_INFINITY) -
        (right.exportLabel ?? Number.POSITIVE_INFINITY)
      )
    }
    return left.id.localeCompare(right.id)
  })

  for (const [index, respondent] of sortedRespondents.entries()) {
    const exportLabel = index + 1
    if (
      respondent.exportLabel !== null &&
      respondent.exportLabel !== exportLabel
    ) {
      throw new Error(
        `Correlated respondent ${respondent.id} has an immutable label conflict`
      )
    }
    if (respondent.finalizedAt !== null && respondent.exportLabel === null) {
      throw new Error(
        `Correlated respondent ${respondent.id} is finalized without an export label`
      )
    }

    const result = await prisma.liveQuizRespondent.updateMany({
      where: {
        id: respondent.id,
        liveQuizId: quiz.id,
        publicationGeneration: quiz.publicationGeneration,
      },
      data: {
        exportLabel,
        finalizedAt: respondent.finalizedAt ?? now,
        type: null,
        username: null,
        avatar: null,
        score: 0,
        verificationSecretHash: null,
      },
    })
    if (result.count !== 1) {
      throw new Error(
        `Correlated respondent ${respondent.id} changed during finalization`
      )
    }
  }

  await prisma.liveQuizRespondentBinding.deleteMany({
    where: {
      liveQuizId: quiz.id,
      publicationGeneration: quiz.publicationGeneration,
    },
  })
  await prisma.liveQuizPendingResponse.deleteMany({
    where: {
      liveQuizId: quiz.id,
      publicationGeneration: quiz.publicationGeneration,
      settledAt: { not: null },
      eventPayload: null,
      nextDeliveryAt: null,
    },
  })
  await prisma.liveQuiz.update({
    where: { id: quiz.id },
    data: { exportSalt: null },
  })

  return 'finalized'
}

export async function finalizeCorrelatedLiveQuiz({
  prisma,
  liveQuizId,
  now = new Date(),
}: {
  prisma: DB.PrismaClient
  liveQuizId: string
  now?: Date
}): Promise<CorrelatedLiveQuizFinalizationStatus> {
  return prisma.$transaction(async (transaction) => {
    const quiz = await lockLiveQuiz({ prisma: transaction, liveQuizId })
    if (!quiz) return 'not_found'
    return finalizeLockedCorrelatedLiveQuiz({
      prisma: transaction,
      quiz,
      now,
    })
  })
}

export async function endLiveQuizAndFinalizeCorrelatedGeneration({
  prisma,
  liveQuizId,
  now = new Date(),
}: {
  prisma: DB.PrismaClient
  liveQuizId: string
  now?: Date
}) {
  return prisma.$transaction(async (transaction) => {
    const quiz = await lockLiveQuiz({ prisma: transaction, liveQuizId })
    if (!quiz) return null
    if (
      quiz.status !== DB.PublicationStatus.PUBLISHED &&
      quiz.status !== DB.PublicationStatus.ENDED
    ) {
      return null
    }

    const endedQuiz =
      quiz.status === DB.PublicationStatus.PUBLISHED
        ? await transaction.liveQuiz.update({
            where: { id: quiz.id },
            data: {
              status: DB.PublicationStatus.ENDED,
              finishedAt: quiz.finishedAt ?? now,
            },
          })
        : quiz

    await finalizeLockedCorrelatedLiveQuiz({
      prisma: transaction,
      quiz: endedQuiz,
      now,
    })

    return transaction.liveQuiz.findUniqueOrThrow({ where: { id: quiz.id } })
  })
}

export async function reconcileCorrelatedLiveQuizFinalizations({
  prisma,
  batchSize = 50,
  now = new Date(),
}: {
  prisma: DB.PrismaClient
  batchSize?: number
  now?: Date
}) {
  const quizzes = await prisma.liveQuiz.findMany({
    where: {
      status: DB.PublicationStatus.ENDED,
      isAssessmentEnabled: false,
      responseCollectionMode: correlatedResponseMode,
      exportSalt: { not: null },
    },
    select: { id: true },
    orderBy: { updatedAt: 'asc' },
    take: batchSize,
  })
  const failures: unknown[] = []

  for (const quiz of quizzes) {
    try {
      await finalizeCorrelatedLiveQuiz({
        prisma,
        liveQuizId: quiz.id,
        now,
      })
    } catch (error) {
      failures.push(error)
    }
  }

  if (failures.length > 0) {
    throw new AggregateError(
      failures,
      `Failed to finalize ${failures.length} correlated live quiz generation(s)`
    )
  }

  return quizzes.length
}

/**
 * Remove finalized correlated datasets after the teaching-export retention
 * window. Finalization has already removed the account/token binding and
 * settled receipts; deleting the respondent row cascades to its response and
 * correction rows as one referentially-integrity-preserving operation.
 */
export async function reconcileExpiredCorrelatedLiveQuizResponses({
  prisma,
  batchSize = 50,
  now = new Date(),
}: {
  prisma: DB.PrismaClient
  batchSize?: number
  now?: Date
}) {
  if (!Number.isInteger(batchSize) || batchSize <= 0) {
    throw new RangeError(
      'Correlated response retention batch size must be positive'
    )
  }

  const expiryBefore = new Date(
    now.getTime() - CORRELATED_RESPONSE_RETENTION_DAYS * millisecondsPerDay
  )

  return prisma.$transaction(async (transaction) => {
    const expiredRespondents = await transaction.$queryRaw<{ id: string }[]>`
      SELECT respondent."id"
      FROM "public"."LiveQuizRespondent" AS respondent
      WHERE respondent."finalizedAt" IS NOT NULL
        AND respondent."finalizedAt" <= ${expiryBefore}
        AND respondent."exportLabel" IS NOT NULL
        AND NOT EXISTS (
          SELECT 1
          FROM "public"."LiveQuizRespondentBinding" AS binding
          WHERE binding."respondentId" = respondent."id"
            AND binding."liveQuizId" = respondent."liveQuizId"
            AND binding."publicationGeneration" = respondent."publicationGeneration"
        )
        AND NOT EXISTS (
          SELECT 1
          FROM "public"."LiveQuizPendingResponse" AS pending_response
          WHERE pending_response."liveQuizId" = respondent."liveQuizId"
            AND pending_response."publicationGeneration" = respondent."publicationGeneration"
        )
      ORDER BY respondent."finalizedAt" ASC, respondent."id" ASC
      LIMIT ${batchSize}
      FOR UPDATE OF respondent SKIP LOCKED
    `

    if (expiredRespondents.length === 0) return 0

    const result = await transaction.liveQuizRespondent.deleteMany({
      where: { id: { in: expiredRespondents.map(({ id }) => id) } },
    })
    return result.count
  })
}
