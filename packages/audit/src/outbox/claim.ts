import {
  type AssessmentAuditOutboxEvent,
  Prisma,
  type PrismaClient,
} from '@klicker-uzh/prisma/client'

export const AUDIT_OUTBOX_LEASE_MILLISECONDS = 2 * 60 * 1000
export const AUDIT_OUTBOX_CLAIM_MAX_EVENTS = 100
export const AUDIT_OUTBOX_CLAIM_MAX_BYTES = 8 * 1024 * 1024

type ClaimClient = Pick<PrismaClient, '$transaction'>

function assertWorkerId(workerId: string): void {
  if (!/^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,127}$/.test(workerId)) {
    throw new TypeError('Audit outbox workerId is invalid')
  }
}

export async function claimAuditOutboxEvents(
  client: ClaimClient,
  workerId: string,
  now = new Date()
): Promise<AssessmentAuditOutboxEvent[]> {
  assertWorkerId(workerId)
  const leaseExpiresAt = new Date(
    now.getTime() + AUDIT_OUTBOX_LEASE_MILLISECONDS
  )

  const claimed = await client.$transaction((tx) =>
    tx.$queryRaw<AssessmentAuditOutboxEvent[]>(Prisma.sql`
      WITH locked AS (
        SELECT
          "eventId",
          "canonicalByteLength",
          "recordedAt"
        FROM "AssessmentAuditOutboxEvent"
        WHERE
          (
            "deliveryState" = 'PENDING'
            AND "nextAttemptAt" <= ${now}
          )
          OR (
            "deliveryState" = 'LEASED'
            AND "leaseExpiresAt" <= ${now}
          )
        ORDER BY "recordedAt", "eventId"
        LIMIT ${AUDIT_OUTBOX_CLAIM_MAX_EVENTS}
        FOR UPDATE SKIP LOCKED
      ), ranked AS (
        SELECT
          "eventId",
          ROW_NUMBER() OVER (ORDER BY "recordedAt", "eventId") AS row_number,
          SUM("canonicalByteLength") OVER (
            ORDER BY "recordedAt", "eventId"
          ) AS running_bytes
        FROM locked
      ), selected AS (
        SELECT "eventId"
        FROM ranked
        WHERE
          running_bytes <= ${AUDIT_OUTBOX_CLAIM_MAX_BYTES}
          OR row_number = 1
      )
      UPDATE "AssessmentAuditOutboxEvent" AS event
      SET
        "deliveryState" = 'LEASED',
        "leaseOwner" = ${workerId},
        "leaseExpiresAt" = ${leaseExpiresAt},
        "attemptCount" = event."attemptCount" + 1
      FROM selected
      WHERE event."eventId" = selected."eventId"
      RETURNING event.*
    `)
  )

  return claimed.sort(
    (left, right) =>
      left.recordedAt.getTime() - right.recordedAt.getTime() ||
      left.eventId.localeCompare(right.eventId)
  )
}

export async function markAuditOutboxDelivered(
  client: ClaimClient,
  eventId: string,
  workerId: string,
  deliveredAt = new Date()
): Promise<void> {
  assertWorkerId(workerId)
  const updated = await client.$transaction((tx) =>
    tx.assessmentAuditOutboxEvent.updateMany({
      where: { eventId, deliveryState: 'LEASED', leaseOwner: workerId },
      data: {
        deliveryState: 'DELIVERED_UNSEALED',
        deliveredAt,
        leaseOwner: null,
        leaseExpiresAt: null,
      },
    })
  )
  if (updated.count !== 1) {
    throw new Error(`Audit delivery lease lost for ${eventId}`)
  }
}

export async function releaseAuditOutboxForRetry(
  client: ClaimClient,
  eventId: string,
  workerId: string,
  nextAttemptAt: Date
): Promise<void> {
  assertWorkerId(workerId)
  const updated = await client.$transaction((tx) =>
    tx.assessmentAuditOutboxEvent.updateMany({
      where: { eventId, deliveryState: 'LEASED', leaseOwner: workerId },
      data: {
        deliveryState: 'PENDING',
        nextAttemptAt,
        leaseOwner: null,
        leaseExpiresAt: null,
      },
    })
  )
  if (updated.count !== 1) {
    throw new Error(`Audit delivery lease lost for ${eventId}`)
  }
}

export async function quarantineAuditOutboxEvent(
  client: ClaimClient,
  eventId: string,
  workerId: string,
  reasonCode: string,
  quarantinedAt = new Date()
): Promise<void> {
  assertWorkerId(workerId)
  if (!/^[A-Z][A-Z0-9_]{1,127}$/.test(reasonCode)) {
    throw new TypeError('Audit quarantine reasonCode is invalid')
  }
  const updated = await client.$transaction((tx) =>
    tx.assessmentAuditOutboxEvent.updateMany({
      where: { eventId, deliveryState: 'LEASED', leaseOwner: workerId },
      data: {
        deliveryState: 'QUARANTINED',
        quarantinedAt,
        quarantineReason: reasonCode,
        leaseOwner: null,
        leaseExpiresAt: null,
      },
    })
  )
  if (updated.count !== 1) {
    throw new Error(`Audit delivery lease lost for ${eventId}`)
  }
}
