import type { PrismaClient } from '@klicker-uzh/prisma/client'
import type { VerifiedAuditEvidence } from '../azure/table-reader.js'
import type { AuditSealingState, AuditSealRepository } from './seal.js'

export class PrismaAuditSealRepository implements AuditSealRepository {
  constructor(private readonly client: PrismaClient) {}

  async listQuizIds(): Promise<string[]> {
    const rows = await this.client.$queryRaw<{ liveQuizId: string }[]>`
      SELECT "liveQuizId" FROM "AssessmentAuditScope"
      UNION SELECT "liveQuizId" FROM "AssessmentAuditOutboxEvent"
      ORDER BY "liveQuizId"
    `
    return rows.map((row) => row.liveQuizId)
  }

  async getSealingState(liveQuizId: string): Promise<AuditSealingState> {
    const rows = await this.client.assessmentAuditOutboxEvent.findMany({
      where: {
        liveQuizId,
        deliveryState: {
          in: ['PENDING', 'LEASED', 'DELIVERED_UNSEALED', 'SEALED'],
        },
      },
      select: { eventId: true, deliveryState: true },
    })
    const sealable = new Set<string>()
    const inFlight = new Set<string>()
    const sealed = new Set<string>()
    for (const { eventId, deliveryState } of rows) {
      if (deliveryState === 'DELIVERED_UNSEALED') sealable.add(eventId)
      else if (deliveryState === 'SEALED') sealed.add(eventId)
      else inFlight.add(eventId)
    }
    return { sealable, inFlight, sealed }
  }

  // One transaction per manifest batch: all members transition together with
  // the same sealedAt, and any divergence aborts the whole batch.
  async markSealed(
    evidence: VerifiedAuditEvidence[],
    sealedAt: Date
  ): Promise<number> {
    if (evidence.length === 0) return 0
    return await this.client.$transaction(async (tx) => {
      let count = 0
      for (const item of evidence) {
        const result = await tx.assessmentAuditOutboxEvent.updateMany({
          where: {
            eventId: item.envelope.eventId,
            deliveryState: 'DELIVERED_UNSEALED',
            deliveredAt: { lte: sealedAt },
            canonicalEnvelope: item.canonicalEnvelope,
            eventHash: item.envelope.eventHash,
            liveQuizId: item.envelope.scope.liveQuizId,
            lifecycleEpoch: item.envelope.scope.lifecycleEpoch,
          },
          data: { deliveryState: 'SEALED', sealedAt },
        })
        count += result.count
        if (result.count > 0) continue
        // The event is already in an immutable manifest, so a row that cannot
        // transition must be explained, never silently skipped.
        const existing = await tx.assessmentAuditOutboxEvent.findUnique({
          where: { eventId: item.envelope.eventId },
          select: {
            canonicalEnvelope: true,
            eventHash: true,
            liveQuizId: true,
            lifecycleEpoch: true,
            deliveryState: true,
          },
        })
        if (!existing) {
          throw new Error(
            `Outbox record missing for sealed evidence: ${item.envelope.eventId}`
          )
        }
        if (
          existing.canonicalEnvelope !== item.canonicalEnvelope ||
          existing.eventHash !== item.envelope.eventHash ||
          existing.liveQuizId !== item.envelope.scope.liveQuizId ||
          existing.lifecycleEpoch !== item.envelope.scope.lifecycleEpoch
        ) {
          throw new Error(
            `Outbox differs from sealed evidence: ${item.envelope.eventId}`
          )
        }
        if (existing.deliveryState !== 'SEALED') {
          throw new Error(
            `Outbox record for sealed evidence is ${existing.deliveryState}: ${item.envelope.eventId}`
          )
        }
      }
      return count
    })
  }
}
