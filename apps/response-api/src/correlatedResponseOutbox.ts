import type { PrismaClient } from '@klicker-uzh/prisma/client'
import {
  CORRELATED_RESPONSE_EVENT,
  type CorrelatedResponseDeliveryMessage,
} from '@klicker-uzh/util'

const CORRELATED_OUTBOX_RETRY_MS = 30_000
const CORRELATED_OUTBOX_BATCH_SIZE = 50

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
