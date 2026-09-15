import type { ImmutableAuditMediaPolicyStore } from '../azure/media-store.js'
import { retentionBatchFor } from './retention-horizon.js'

export type ActiveAssessmentMediaReference = {
  blobName: string
  contentHash: string
  retainUntil?: Date
}

export type AssessmentMediaPolicyRenewalSummary = {
  inspected: number
  extended: number
  alreadySufficient: number
  retainUntil: string
  minimumHorizonDays: number | null
}

export async function renewActiveAssessmentMediaPolicies(input: {
  references: AsyncIterable<ActiveAssessmentMediaReference>
  store: ImmutableAuditMediaPolicyStore
  now?: Date
}): Promise<AssessmentMediaPolicyRenewalSummary> {
  const now = input.now ?? new Date()
  const retainUntil = retentionBatchFor(now)
  let inspected = 0
  let extended = 0
  let alreadySufficient = 0
  let minimumHorizonDays: number | null = null

  for await (const reference of input.references) {
    const result = await input.store.extendRetention({
      blobName: reference.blobName,
      contentHash: reference.contentHash,
      retainUntil: reference.retainUntil ?? retainUntil,
    })
    inspected += 1
    if (result.outcome === 'EXTENDED') extended += 1
    else alreadySufficient += 1
    const horizonDays =
      (result.retainUntil.getTime() - now.getTime()) / (24 * 60 * 60 * 1_000)
    minimumHorizonDays =
      minimumHorizonDays === null
        ? horizonDays
        : Math.min(minimumHorizonDays, horizonDays)
  }

  return {
    inspected,
    extended,
    alreadySufficient,
    retainUntil: retainUntil.toISOString(),
    minimumHorizonDays,
  }
}
