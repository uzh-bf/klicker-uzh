import type { Prisma, PrismaClient } from '@klicker-uzh/prisma/client'
import { canonicalByteLength } from '../canonical/canonicalize.js'
import {
  type AuditEventDraft,
  type CanonicalAuditEvent,
  createCanonicalAuditEvent,
  type TrustedAuditContext,
} from '../contract/envelope.js'
import { EVENT_REGISTRY } from '../contract/event-registry.js'

const auditTransactionBrand = Symbol('assessment-audit-transaction')

export type AuditTransactionClient = Pick<
  Prisma.TransactionClient,
  'assessmentAuditOutboxEvent'
> & { readonly [auditTransactionBrand]: true }

export type StandaloneAuditClient = Pick<PrismaClient, '$transaction'>

export type EmittedAuditEvent = {
  eventId: string
  idempotencyKey: string
  eventHash: string
}

const auditTransactionClients = new WeakSet<object>()

function bindAuditTransaction(
  tx: Prisma.TransactionClient
): AuditTransactionClient {
  const capability = Object.freeze({
    assessmentAuditOutboxEvent: tx.assessmentAuditOutboxEvent,
    [auditTransactionBrand]: true as const,
  })
  auditTransactionClients.add(capability)
  return capability
}

export async function runInAuditTransaction<T>(
  client: StandaloneAuditClient,
  callback: (
    tx: Prisma.TransactionClient,
    auditTx: AuditTransactionClient
  ) => Promise<T>
): Promise<T> {
  return client.$transaction((tx) => callback(tx, bindAuditTransaction(tx)))
}

function assertTransactionClient(tx: AuditTransactionClient): void {
  if (!auditTransactionClients.has(tx)) {
    throw new TypeError('Audit transaction capability is not trusted')
  }
}

function assertNoInBatchIdentityCollision(events: CanonicalAuditEvent[]): void {
  const byEventId = new Map<string, string>()
  const byIdempotencyKey = new Map<string, string>()

  for (const event of events) {
    const { eventId, idempotencyKey } = event.envelope
    const previousById = byEventId.get(eventId)
    const previousByKey = byIdempotencyKey.get(idempotencyKey)
    if (
      previousById === event.canonicalEnvelope ||
      previousByKey === event.canonicalEnvelope
    ) {
      throw new Error('Duplicate audit identity in one emission batch')
    }
    if (
      (previousById !== undefined &&
        previousById !== event.canonicalEnvelope) ||
      (previousByKey !== undefined && previousByKey !== event.canonicalEnvelope)
    ) {
      throw new Error('Conflicting audit identities in one emission batch')
    }
    byEventId.set(eventId, event.canonicalEnvelope)
    byIdempotencyKey.set(idempotencyKey, event.canonicalEnvelope)
  }
}

export async function emitAuditEvents(
  tx: AuditTransactionClient,
  trustedContext: TrustedAuditContext,
  drafts: readonly AuditEventDraft[]
): Promise<EmittedAuditEvent[]> {
  assertTransactionClient(tx)
  if (drafts.length === 0) {
    return []
  }

  const canonicalEvents = drafts.map((draft) =>
    createCanonicalAuditEvent(trustedContext, draft)
  )
  assertNoInBatchIdentityCollision(canonicalEvents)

  await tx.assessmentAuditOutboxEvent.createMany({
    data: canonicalEvents.map((event) => {
      const { envelope } = event
      const registration = EVENT_REGISTRY[envelope.eventType]
      return {
        eventId: envelope.eventId,
        idempotencyKey: envelope.idempotencyKey,
        eventHash: envelope.eventHash,
        payloadHash: envelope.payloadHash,
        schemaVersion: envelope.schemaVersion,
        payloadSchemaVersion: envelope.payloadSchemaVersion,
        eventType: envelope.eventType,
        emissionPath: registration.emissionPath,
        evidenceClass: envelope.evidenceClass,
        criticality: envelope.criticality,
        recordedVia: envelope.recordedVia,
        liveQuizId: envelope.scope.liveQuizId,
        lifecycleEpoch: envelope.scope.lifecycleEpoch,
        courseId: envelope.scope.courseId,
        participantId: envelope.scope.participantId,
        correlationId: envelope.correlationId,
        receivedAt: new Date(envelope.receivedAt),
        recordedAt: new Date(envelope.recordedAt),
        canonicalEnvelope: event.canonicalEnvelope,
        canonicalByteLength: canonicalByteLength(event.canonicalEnvelope),
      }
    }),
    skipDuplicates: true,
  })

  const stored = await tx.assessmentAuditOutboxEvent.findMany({
    where: {
      OR: [
        {
          eventId: {
            in: canonicalEvents.map((event) => event.envelope.eventId),
          },
        },
        {
          idempotencyKey: {
            in: canonicalEvents.map((event) => event.envelope.idempotencyKey),
          },
        },
      ],
    },
    select: {
      eventId: true,
      idempotencyKey: true,
      eventHash: true,
      payloadHash: true,
      canonicalEnvelope: true,
    },
  })

  for (const event of canonicalEvents) {
    const matching = stored.filter(
      (row) =>
        row.eventId === event.envelope.eventId ||
        row.idempotencyKey === event.envelope.idempotencyKey
    )
    if (
      matching.length !== 1 ||
      matching[0]?.eventId !== event.envelope.eventId ||
      matching[0]?.idempotencyKey !== event.envelope.idempotencyKey ||
      matching[0]?.eventHash !== event.envelope.eventHash ||
      matching[0]?.payloadHash !== event.envelope.payloadHash ||
      matching[0]?.canonicalEnvelope !== event.canonicalEnvelope
    ) {
      throw new Error(
        `Audit idempotency conflict for ${event.envelope.eventId}`
      )
    }
  }

  return canonicalEvents.map(({ envelope }) => ({
    eventId: envelope.eventId,
    idempotencyKey: envelope.idempotencyKey,
    eventHash: envelope.eventHash,
  }))
}

export async function recordStandaloneAuditEvents(
  client: StandaloneAuditClient,
  trustedContext: TrustedAuditContext,
  drafts: readonly AuditEventDraft[]
): Promise<EmittedAuditEvent[]> {
  for (const draft of drafts) {
    const registration = EVENT_REGISTRY[draft.eventType]
    if (
      registration.criticality !== 'STANDARD' ||
      registration.evidenceClass !== 'SERVER_OBSERVED'
    ) {
      throw new Error(
        `Standalone audit emission is forbidden for ${draft.eventType}`
      )
    }
  }

  return runInAuditTransaction(client, (_tx, auditTx) =>
    emitAuditEvents(auditTx, trustedContext, drafts)
  )
}
