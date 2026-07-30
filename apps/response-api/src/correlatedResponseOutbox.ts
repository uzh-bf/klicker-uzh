import {
  LiveQuizResponseCollectionMode,
  PublicationStatus,
  type PrismaClient,
} from '@klicker-uzh/prisma/client'
import {
  CORRELATED_RESPONSE_EVENT,
  type CorrelatedResponseDeliveryMessage,
} from '@klicker-uzh/util'

const CORRELATED_OUTBOX_RETRY_MS = 30_000
const CORRELATED_OUTBOX_BATCH_SIZE = 50

export async function registerPendingCorrelatedResponse({
  database,
  liveQuizId,
  messageId,
  responseKey,
  eventPayload,
  nextDeliveryAt = new Date(Date.now() + CORRELATED_OUTBOX_RETRY_MS),
}: {
  database: Pick<PrismaClient, '$transaction'>
  liveQuizId: string
  messageId: string
  responseKey: string
  eventPayload: string
  nextDeliveryAt?: Date
}) {
  try {
    return await database.$transaction(async (prisma) => {
      const [liveQuiz] = await prisma.$queryRaw<
        {
          isAssessmentEnabled: boolean
          responseCollectionMode: LiveQuizResponseCollectionMode
          status: PublicationStatus
        }[]
      >`
        SELECT
          "isAssessmentEnabled",
          "responseCollectionMode"::text AS "responseCollectionMode",
          "status"::text AS "status"
        FROM "public"."LiveQuiz"
        WHERE "id" = ${liveQuizId}::uuid AND "isDeleted" = false
        FOR UPDATE
      `

      if (
        !liveQuiz ||
        liveQuiz.status !== PublicationStatus.PUBLISHED ||
        liveQuiz.isAssessmentEnabled ||
        liveQuiz.responseCollectionMode !==
          LiveQuizResponseCollectionMode.CORRELATED_EXPORT
      ) {
        return 'not_found' as const
      }

      await prisma.liveQuizPendingResponse.create({
        data: {
          id: messageId,
          liveQuizId,
          responseKey,
          eventPayload,
          nextDeliveryAt,
        },
      })
      return 'registered' as const
    })
  } catch (error) {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 'P2002'
    ) {
      return 'duplicate' as const
    }
    throw error
  }
}

export async function reservePendingCorrelatedResponses({
  database,
  now = new Date(),
  nextDeliveryAt = new Date(now.getTime() + CORRELATED_OUTBOX_RETRY_MS),
  batchSize = CORRELATED_OUTBOX_BATCH_SIZE,
}: {
  database: Pick<PrismaClient, '$queryRaw'>
  now?: Date
  nextDeliveryAt?: Date
  batchSize?: number
}) {
  return database.$queryRaw<{ id: string }[]>`
    WITH due AS (
      SELECT "id"
      FROM "public"."LiveQuizPendingResponse"
      WHERE "settledAt" IS NULL AND "nextDeliveryAt" <= ${now}
      ORDER BY "nextDeliveryAt" ASC, "createdAt" ASC
      LIMIT ${batchSize}
      FOR UPDATE SKIP LOCKED
    )
    UPDATE "public"."LiveQuizPendingResponse" AS pending
    SET
      "nextDeliveryAt" = ${nextDeliveryAt},
      "deliveryAttempts" = pending."deliveryAttempts" + 1
    FROM due
    WHERE pending."id" = due."id"
    RETURNING pending."id"
  `
}

export async function dispatchPendingCorrelatedResponses({
  database,
  pushEvent,
  now,
}: {
  database: Pick<PrismaClient, '$queryRaw'>
  pushEvent: (
    eventName: string,
    message: CorrelatedResponseDeliveryMessage
  ) => Promise<unknown>
  now?: Date
}) {
  const pendingResponses = await reservePendingCorrelatedResponses({
    database,
    now,
  })
  const results = await Promise.allSettled(
    pendingResponses.map(({ id }) =>
      pushEvent(CORRELATED_RESPONSE_EVENT, { messageId: id })
    )
  )

  return {
    attempted: results.length,
    failed: results.filter((result) => result.status === 'rejected').length,
  }
}
