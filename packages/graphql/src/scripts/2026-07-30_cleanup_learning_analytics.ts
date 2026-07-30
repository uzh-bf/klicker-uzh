/**
 * Removes all dedicated learning-analytics results created before the optional
 * LA controls are released. Normal course, participation, response, grading,
 * feedback, gamification, and research-consent data are outside this script.
 *
 * Usage:
 *   pnpm --filter @klicker-uzh/graphql script:prod:cleanup-learning-analytics
 *   DRY_RUN=false \
 *     CONFIRM_LEARNING_ANALYTICS_CLEANUP=<reviewed-snapshot-hash> \
 *     pnpm --filter @klicker-uzh/graphql script:prod:cleanup-learning-analytics
 */
import { prisma } from '@klicker-uzh/prisma'
import type { PrismaTransactionClient } from '@klicker-uzh/util'
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import {
  DEDICATED_LEARNING_ANALYTICS_MODELS,
  deleteAllDedicatedLearningAnalytics,
  readAllDedicatedLearningAnalyticsCounts,
  type DedicatedLearningAnalyticsCounts,
} from '../lib/learningAnalyticsCleanup.js'

interface OperationalCounts {
  courses: number
  participations: number
  participants: number
  questionResponses: number
  questionResponseDetails: number
  elementFeedbacks: number
}

interface CleanupSnapshot {
  contractVersion: 2
  contractHash: string
  snapshotHash: string
  dedicatedLearningAnalytics: DedicatedLearningAnalyticsCounts
  operationalData: OperationalCounts
}

const DRY_RUN = process.env.DRY_RUN !== 'false'
const WRITE_CONFIRMATION = process.env.CONFIRM_LEARNING_ANALYTICS_CLEANUP ?? ''
const CLEANUP_RECEIPT_ID = '2026-07-30-pre-feature-derived-data'
const cleanupDirectoryUrl = new URL('./_local/', import.meta.url)
const beforeDumpUrl = new URL(
  'learning_analytics_cleanup_dump_before.json',
  cleanupDirectoryUrl
)
const afterDumpUrl = new URL(
  'learning_analytics_cleanup_dump_after.json',
  cleanupDirectoryUrl
)
const CONTRACT = {
  version: 2,
  scope: 'all dedicated learning-analytics result rows',
  excludedData: [
    'courses',
    'participations',
    'participants',
    'question responses',
    'question response details',
    'element feedback',
    'grading and gamification',
    'research consent',
  ],
  dedicatedModels: DEDICATED_LEARNING_ANALYTICS_MODELS,
} as const
const CONTRACT_HASH = createHash('sha256')
  .update(JSON.stringify(CONTRACT))
  .digest('hex')

async function readOperationalCounts(
  client: PrismaTransactionClient
): Promise<OperationalCounts> {
  const [
    courses,
    participations,
    participants,
    questionResponses,
    questionResponseDetails,
    elementFeedbacks,
  ] = await Promise.all([
    client.course.count(),
    client.participation.count(),
    client.participant.count(),
    client.questionResponse.count(),
    client.questionResponseDetail.count(),
    client.elementFeedback.count(),
  ])

  return {
    courses,
    participations,
    participants,
    questionResponses,
    questionResponseDetails,
    elementFeedbacks,
  }
}

async function createSnapshot(
  client: PrismaTransactionClient
): Promise<CleanupSnapshot> {
  const [dedicatedLearningAnalytics, operationalData] = await Promise.all([
    readAllDedicatedLearningAnalyticsCounts(client),
    readOperationalCounts(client),
  ])

  const payload = {
    contractVersion: 2 as const,
    contractHash: CONTRACT_HASH,
    dedicatedLearningAnalytics,
    operationalData,
  }
  return {
    ...payload,
    snapshotHash: createHash('sha256')
      .update(JSON.stringify(payload))
      .digest('hex'),
  }
}

function assertSameSnapshot(
  actual: CleanupSnapshot,
  expected: CleanupSnapshot,
  label: string
) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(
      `${label} does not match the reviewed dry-run snapshot. Run a new dry run and review the aggregate-only dump.`
    )
  }
}

function assertDedicatedLearningAnalyticsEmpty(
  counts: DedicatedLearningAnalyticsCounts
) {
  const remaining = Object.entries(counts).filter(([, count]) => count !== 0)
  if (remaining.length > 0) {
    throw new Error(
      `Dedicated learning-analytics verification failed for ${remaining.length} model(s).`
    )
  }
}

function readSnapshot(url: URL): CleanupSnapshot {
  return JSON.parse(fs.readFileSync(url, 'utf8')) as CleanupSnapshot
}

function writeSnapshot(url: URL, snapshot: CleanupSnapshot) {
  fs.mkdirSync(cleanupDirectoryUrl, { recursive: true, mode: 0o700 })
  fs.chmodSync(cleanupDirectoryUrl, 0o700)
  fs.writeFileSync(url, `${JSON.stringify(snapshot, null, 2)}\n`, {
    encoding: 'utf8',
    flag: 'wx',
    mode: 0o600,
  })
}

function logCounts(label: string, counts: DedicatedLearningAnalyticsCounts) {
  console.log(label)
  for (const [model, count] of Object.entries(counts)) {
    console.log(`  ${model}: ${count}`)
  }
}

async function main() {
  const existingReceipt =
    await prisma.learningAnalyticsCleanupReceipt.findUnique({
      where: { id: CLEANUP_RECEIPT_ID },
    })
  if (existingReceipt) {
    throw new Error(
      `The durable cleanup receipt exists (${existingReceipt.completedAt.toISOString()}). This one-time cleanup has completed and must not be replayed.`
    )
  }

  const currentSnapshot = await createSnapshot(prisma)
  console.log(
    `Dry Run Mode: ${DRY_RUN ? 'ENABLED (no database writes)' : 'DISABLED (database writes active)'}`
  )
  console.log(`Cleanup contract: ${CONTRACT_HASH}`)
  console.log(`Reviewed snapshot hash: ${currentSnapshot.snapshotHash}`)
  logCounts(
    'Dedicated learning-analytics rows:',
    currentSnapshot.dedicatedLearningAnalytics
  )

  if (DRY_RUN) {
    if (fs.existsSync(beforeDumpUrl)) {
      assertSameSnapshot(
        currentSnapshot,
        readSnapshot(beforeDumpUrl),
        'Current state'
      )
      console.log(
        `Reviewed before-state dump already matches: ${beforeDumpUrl.pathname}`
      )
    } else {
      writeSnapshot(beforeDumpUrl, currentSnapshot)
      console.log(`Before-state dump: ${beforeDumpUrl.pathname}`)
    }
    console.log('Dry run complete. Zero database writes executed.')
    return
  }

  if (WRITE_CONFIRMATION !== currentSnapshot.snapshotHash) {
    throw new Error(
      'A write requires CONFIRM_LEARNING_ANALYTICS_CLEANUP to equal the reviewed dry-run snapshot hash.'
    )
  }

  const afterSnapshot = await prisma.$transaction(
    async (tx) => {
      const receipt = await tx.learningAnalyticsCleanupReceipt.findUnique({
        where: { id: CLEANUP_RECEIPT_ID },
      })
      if (receipt) {
        throw new Error(
          'The durable cleanup receipt already exists. This one-time cleanup must not be replayed.'
        )
      }

      const courses = await tx.course.findMany({
        select: { id: true },
        orderBy: { id: 'asc' },
      })
      for (const course of courses) {
        await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${course.id}))::text`
      }

      const transactionBefore = await createSnapshot(tx)
      assertSameSnapshot(
        transactionBefore,
        currentSnapshot,
        'Transaction starting state'
      )

      await deleteAllDedicatedLearningAnalytics(tx)

      const transactionAfter = await createSnapshot(tx)
      assertDedicatedLearningAnalyticsEmpty(
        transactionAfter.dedicatedLearningAnalytics
      )
      if (
        JSON.stringify(transactionAfter.operationalData) !==
        JSON.stringify(transactionBefore.operationalData)
      ) {
        throw new Error(
          'Operational-data counts changed inside the cleanup transaction.'
        )
      }

      await tx.learningAnalyticsCleanupReceipt.create({
        data: {
          id: CLEANUP_RECEIPT_ID,
          contractHash: CONTRACT_HASH,
          snapshotHash: transactionBefore.snapshotHash,
        },
      })

      return transactionAfter
    },
    {
      isolationLevel: 'Serializable',
      maxWait: 10_000,
      timeout: 600_000,
    }
  )

  if (!fs.existsSync(afterDumpUrl)) {
    writeSnapshot(afterDumpUrl, afterSnapshot)
  }
  logCounts(
    'Verified dedicated learning-analytics rows after cleanup:',
    afterSnapshot.dedicatedLearningAnalytics
  )
  console.log(
    `Durable database receipt: LearningAnalyticsCleanupReceipt/${CLEANUP_RECEIPT_ID}`
  )
  if (fs.existsSync(afterDumpUrl)) {
    console.log(`Local after-state dump: ${afterDumpUrl.pathname}`)
  }
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
