import type { PrismaClient } from '@klicker-uzh/prisma/client'
import type { VerifiedAuditEvidence } from '../azure/table-reader.js'
import type { AuditSealRepository } from './seal.js'

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

  async markSealed(
    evidence: VerifiedAuditEvidence[],
    sealedAt: Date
  ): Promise<number> {
    let count = 0
    for (const item of evidence) {
      const result = await this.client.assessmentAuditOutboxEvent.updateMany({
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
      if (result.count === 0) {
        const existing =
          await this.client.assessmentAuditOutboxEvent.findUnique({
            where: { eventId: item.envelope.eventId },
            select: {
              canonicalEnvelope: true,
              eventHash: true,
              liveQuizId: true,
              lifecycleEpoch: true,
            },
          })
        if (
          existing &&
          (existing.canonicalEnvelope !== item.canonicalEnvelope ||
            existing.eventHash !== item.envelope.eventHash ||
            existing.liveQuizId !== item.envelope.scope.liveQuizId ||
            existing.lifecycleEpoch !== item.envelope.scope.lifecycleEpoch)
        ) {
          throw new Error(
            `Outbox differs from sealed evidence: ${item.envelope.eventId}`
          )
        }
      }
    }
    return count
  }
}
