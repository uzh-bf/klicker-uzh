import { parseArgs } from 'node:util'
import { prisma } from '@klicker-uzh/prisma'
import { AssessmentAuditRolloutOutcome } from '@klicker-uzh/prisma/client'
import { readAssessmentAuditRolloutConfig } from '../services/assessmentAuditActivation.js'
import {
  beginOrResumeAssessmentAuditRollout,
  discoverAssessmentAuditRolloutCandidates,
  processAssessmentAuditRolloutItem,
} from '../services/assessmentAuditRollout.js'

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu

function validateUuid(value: string, option: string): string {
  if (!UUID_PATTERN.test(value)) {
    throw new TypeError(`${option} must be a UUID`)
  }
  return value.toLowerCase()
}

async function main() {
  const { values } = parseArgs({
    options: {
      'dry-run': { type: 'boolean', default: false },
      'scan-id': { type: 'string' },
      'quiz-id': { type: 'string', multiple: true, default: [] },
    },
    strict: true,
    allowPositionals: false,
  })
  const explicitIds = [...new Set(values['quiz-id'])].map((id) =>
    validateUuid(id, '--quiz-id')
  )
  const config = readAssessmentAuditRolloutConfig()
  const requestedIds =
    explicitIds.length > 0
      ? explicitIds
      : config.mode === 'pilot'
        ? [...config.pilotLiveQuizIds]
        : undefined
  if (explicitIds.length === 0 && config.mode === 'disabled') {
    throw new Error(
      'Rollout is disabled; pass --quiz-id or configure pilot/all mode'
    )
  }

  const discovered = await discoverAssessmentAuditRolloutCandidates({
    client: prisma,
    liveQuizIds: requestedIds,
  })
  if (values['dry-run']) {
    console.info(
      JSON.stringify(
        {
          dryRun: true,
          rolloutMode: config.mode,
          candidates: discovered.candidates,
          missing: discovered.missingLiveQuizIds.map((liveQuizId) => ({
            liveQuizId,
            result: 'NO_ROLLOUT_RECORD',
            limitation: 'PRE_INSTRUMENTATION_DELETION_UNKNOWABLE',
          })),
        },
        null,
        2
      )
    )
    return
  }

  if (values['scan-id'] === undefined) {
    throw new Error('--scan-id is required when applying a rollout scan')
  }
  const scanId = validateUuid(values['scan-id'], '--scan-id')
  const inventory = await beginOrResumeAssessmentAuditRollout({
    client: prisma,
    scanId,
    observedAt: new Date(),
    candidates: discovered.candidates,
  })
  const inventoriedIds = new Set(inventory.map((item) => item.liveQuizId))
  const unknown = discovered.missingLiveQuizIds.filter(
    (liveQuizId) => !inventoriedIds.has(liveQuizId)
  )
  const candidates = new Map(
    discovered.candidates.map((candidate) => [candidate.liveQuizId, candidate])
  )
  const results: Array<{
    liveQuizId: string
    outcome: string
    reason?: string
  }> = unknown.map((liveQuizId) => ({
    liveQuizId,
    outcome: 'NO_ROLLOUT_RECORD',
    reason: 'PRE_INSTRUMENTATION_DELETION_UNKNOWABLE',
  }))

  for (const item of inventory) {
    if (item.outcome !== AssessmentAuditRolloutOutcome.PENDING) {
      results.push({ liveQuizId: item.liveQuizId, outcome: item.outcome })
      continue
    }
    const candidate = candidates.get(item.liveQuizId)
    if (candidate === undefined) {
      results.push({
        liveQuizId: item.liveQuizId,
        outcome: 'PENDING',
        reason: 'CURRENT_BUSINESS_RECORD_UNAVAILABLE',
      })
      continue
    }
    const outcome = await processAssessmentAuditRolloutItem({
      client: prisma,
      candidate,
      inventory: item,
    })
    results.push({ liveQuizId: item.liveQuizId, outcome })
  }

  const complete =
    unknown.length === 0 &&
    results.every(
      (result) =>
        result.outcome === AssessmentAuditRolloutOutcome.ACTIVATED ||
        result.outcome === AssessmentAuditRolloutOutcome.ROLLOUT_BASELINED ||
        result.outcome === AssessmentAuditRolloutOutcome.EXCLUDED_TERMINAL
    )
  console.info(
    JSON.stringify({ dryRun: false, scanId, complete, results }, null, 2)
  )
  if (!complete) process.exitCode = 1
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : 'Unknown failure')
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
