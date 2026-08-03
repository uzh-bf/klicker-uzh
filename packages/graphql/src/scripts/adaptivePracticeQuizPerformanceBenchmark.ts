import * as DB from '@klicker-uzh/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { randomUUID } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { performance } from 'node:perf_hooks'
import {
  persistAdaptivePracticeQuizEstimates,
  type PersistAdaptivePracticeQuizEstimatesInput,
} from '../services/adaptivePracticeQuizRepository.js'
import {
  isRetryableAdaptiveTransactionConflict,
  waitForAdaptiveTransactionRetry,
} from '../services/adaptiveTransactions.js'
import {
  ADAPTIVE_PRACTICE_QUIZ_BENCHMARK_PROFILES,
  analyzeAdaptivePracticeQuizBenchmarkTables,
  cleanupAdaptivePracticeQuizBenchmarkFixture,
  createAdaptivePracticeQuizBenchmarkFixture,
  verifyAdaptivePracticeQuizBenchmarkFixture,
  type AdaptivePracticeQuizBenchmarkFixture,
  type AdaptivePracticeQuizBenchmarkPoolItem,
  type AdaptivePracticeQuizBenchmarkProfile,
} from './adaptivePracticeQuizPerformanceBenchmarkFixture.js'
import {
  buildAdaptivePracticeQuizBenchmarkQueries,
  explainAdaptiveEstimatePersistence,
  explainAdaptivePracticeQuizBenchmarkQuery,
  type AdaptivePracticeQuizBenchmarkQuery,
} from './adaptivePracticeQuizPerformanceBenchmarkQueries.js'

const MAX_TRANSACTION_ATTEMPTS = 3
const SLOW_LOCK_ACQUISITION_MS = 5
const UUID_PATTERN =
  /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi

type Percentiles = {
  samples: number
  minMs: number | null
  meanMs: number | null
  p50Ms: number | null
  p95Ms: number | null
  p99Ms: number | null
  maxMs: number | null
}

type QueryBenchmarkResult = {
  name: AdaptivePracticeQuizBenchmarkQuery['name']
  timedQueryCount: number
  warmupQueryCount: number
  rowsReturned: number
  latency: Percentiles
  expectedIndexes: string[]
  observedIndexes: string[]
  missingExpectedIndexes: string[]
  explainArtifact: string
}

type PersistenceSample = {
  succeeded: boolean
  retryCount: number
  transactionAttempts: number
  applicationQueryCount: number
  successfulAttemptQueryCount: number | null
  durationMs: number
  lockAcquisitionMs: number[]
}

async function main() {
  const profile = parseProfile(process.argv.slice(2))
  if (!profile) return
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) {
    throw new Error(
      'DATABASE_URL is required. Point it at a migrated, disposable PostgreSQL database.'
    )
  }

  const runToken = randomUUID().replaceAll('-', '').slice(0, 12)
  const runLabel = `adaptive-pq-benchmark-${runToken}`
  const outputDirectory =
    process.env.ADAPTIVE_BENCHMARK_OUTPUT_DIR ??
    join(tmpdir(), `adaptive-practice-quiz-benchmark-${runToken}`)
  await mkdir(outputDirectory, { recursive: true })

  const adapter = new PrismaPg({ connectionString: databaseUrl })
  const prisma = new DB.PrismaClient({ adapter })
  let fixture: AdaptivePracticeQuizBenchmarkFixture | undefined
  let summary: Record<string, unknown> | undefined
  try {
    const database = await loadDatabaseMetadata(prisma)
    console.log(
      `Setting up ${profile.name} adaptive benchmark fixture outside timed paths...`
    )
    const setupStartedAt = performance.now()
    fixture = await createAdaptivePracticeQuizBenchmarkFixture(
      prisma,
      profile,
      runLabel
    )
    const setupDurationMs = performance.now() - setupStartedAt
    const fixtureCounts = await verifyAdaptivePracticeQuizBenchmarkFixture(
      prisma,
      fixture,
      profile
    )
    await analyzeAdaptivePracticeQuizBenchmarkTables(prisma)

    const queryResults: QueryBenchmarkResult[] = []
    for (const query of buildAdaptivePracticeQuizBenchmarkQueries(
      fixture,
      profile
    )) {
      console.log(`Benchmarking ${query.name}...`)
      const result = await benchmarkQuery(prisma, query, profile)
      const explainPlan = await explainAdaptivePracticeQuizBenchmarkQuery(
        prisma,
        query
      )
      const explainArtifact = `${query.name}.explain.json`
      const observedIndexes = extractIndexNames(explainPlan)
      await writeJson(join(outputDirectory, explainArtifact), {
        schemaVersion: 1,
        benchmark: 'phase-13-adaptive-practice-quiz',
        query: {
          name: query.name,
          description: query.description,
          expectedIndexes: query.expectedIndexes,
          observedIndexes,
        },
        fixture: publicFixtureShape(profile, fixtureCounts),
        privacy: {
          participantLevelDataIncluded: false,
          fixtureIdentifiersRedacted: true,
        },
        plan: sanitizeArtifact(explainPlan, runLabel),
      })
      queryResults.push({
        ...result,
        expectedIndexes: query.expectedIndexes,
        observedIndexes,
        missingExpectedIndexes: query.expectedIndexes.filter(
          (index) => !observedIndexes.includes(index)
        ),
        explainArtifact,
      })
    }

    console.log('Benchmarking concurrent response and estimate persistence...')
    const persistence = await benchmarkConcurrentPersistence(
      prisma,
      fixture,
      profile
    )
    const estimatePlan = await explainAdaptiveEstimatePersistence(
      prisma,
      fixture
    )
    const estimateArtifact = 'estimate-persistence-upsert.explain.json'
    await writeJson(join(outputDirectory, estimateArtifact), {
      schemaVersion: 1,
      benchmark: 'phase-13-adaptive-practice-quiz',
      query: {
        name: 'estimate-persistence-upsert',
        description:
          'The production 250-row node-estimate INSERT ON CONFLICT shape; EXPLAIN ANALYZE runs inside a rolled-back transaction.',
        observedIndexes: extractIndexNames(estimatePlan),
      },
      fixture: publicFixtureShape(profile, fixtureCounts),
      privacy: {
        participantLevelDataIncluded: false,
        fixtureIdentifiersRedacted: true,
      },
      plan: sanitizeArtifact(estimatePlan, runLabel),
    })

    summary = {
      schemaVersion: 1,
      benchmark: 'phase-13-adaptive-practice-quiz',
      createdAt: new Date().toISOString(),
      profile: profile.name,
      evidenceClass: profile.isMaximumShape
        ? 'maximum-production-shape'
        : 'smoke-only-not-performance-evidence',
      database,
      fixture: publicFixtureShape(profile, fixtureCounts),
      setup: {
        includedInTimedPaths: false,
        durationMs: round(setupDurationMs),
        oneCommittedTransaction: true,
      },
      queries: queryResults,
      concurrentPersistence: {
        ...persistence,
        explainArtifact: estimateArtifact,
      },
      privacy: {
        participantLevelDataIncluded: false,
        fixtureIdentifiersIncluded: false,
        rawResponsesIncluded: false,
        exactParticipantTimingsIncluded: false,
      },
      limitations: [
        'This is an executable SQL persistence/query harness, not a GraphQL end-to-end request benchmark.',
        'The persistence path locks an attempt, inserts a response snapshot, updates attempt state, and calls the production bulk-estimate repository; it does not grade answers or select the next item.',
        'Application SQL statements are counted explicitly. Prisma transaction-control and driver housekeeping statements are excluded.',
        `Lock contention uses lock acquisition slower than ${SLOW_LOCK_ACQUISITION_MS} ms as a proxy; PostgreSQL wait-event sampling is not performed.`,
        'A single isolated quiz makes sequential scans rational in smoke mode; inspect the maximum-shape EXPLAIN artifacts and missingExpectedIndexes on a production-sized clone.',
        'Percentiles describe this database, hardware, cache state, and profile only; smoke percentiles are execution checks, not release evidence.',
      ],
    }
  } finally {
    if (fixture) {
      console.log('Cleaning isolated adaptive benchmark fixture...')
      await cleanupAdaptivePracticeQuizBenchmarkFixture(prisma, fixture)
      await analyzeAdaptivePracticeQuizBenchmarkTables(prisma)
    }
    await prisma.$disconnect()
  }

  if (!summary) throw new Error('Adaptive benchmark produced no summary.')
  const summaryPath = join(outputDirectory, 'summary.json')
  await writeJson(summaryPath, {
    ...summary,
    cleanup: { completed: true },
  })
  console.log(
    JSON.stringify(
      {
        profile: profile.name,
        outputDirectory,
        summary: summaryPath,
        cleanupCompleted: true,
        queryLatency: Object.fromEntries(
          (summary.queries as QueryBenchmarkResult[]).map((query) => [
            query.name,
            query.latency,
          ])
        ),
        concurrentPersistence: summary.concurrentPersistence,
      },
      null,
      2
    )
  )
}

function parseProfile(
  args: string[]
): AdaptivePracticeQuizBenchmarkProfile | null {
  if (args.length === 1 && args[0] === '--smoke') {
    return ADAPTIVE_PRACTICE_QUIZ_BENCHMARK_PROFILES.smoke
  }
  if (args.length === 1 && args[0] === '--full') {
    return ADAPTIVE_PRACTICE_QUIZ_BENCHMARK_PROFILES.full
  }
  if (args.length === 1 && (args[0] === '--help' || args[0] === '-h')) {
    printUsage()
    return null
  }
  printUsage()
  throw new Error('Choose exactly one opt-in benchmark profile.')
}

function printUsage() {
  console.log(`
Usage:
  DATABASE_URL=... pnpm --filter @klicker-uzh/graphql exec tsx src/scripts/adaptivePracticeQuizPerformanceBenchmark.ts --smoke
  DATABASE_URL=... pnpm --filter @klicker-uzh/graphql exec tsx src/scripts/adaptivePracticeQuizPerformanceBenchmark.ts --full

Profiles:
  --smoke  Small executable lifecycle check; its percentiles are not performance evidence.
  --full   500 nodes, 10,000 pool items, 10,000 completed attempts,
           500,000 responses, 5,010,000 estimates, and 160 contended writes.

Artifacts default to a unique directory under the system temporary directory.
Set ADAPTIVE_BENCHMARK_OUTPUT_DIR to retain them elsewhere. Use a migrated,
disposable PostgreSQL database; fixture setup is committed before timing so
concurrent connections can observe it, then all named rows are deleted.
`)
}

async function benchmarkQuery(
  prisma: DB.PrismaClient,
  query: AdaptivePracticeQuizBenchmarkQuery,
  profile: AdaptivePracticeQuizBenchmarkProfile
) {
  for (let index = 0; index < profile.queryWarmups; index++) {
    await prisma.$queryRaw(query.sql)
  }
  const durations: number[] = []
  let rowsReturned = 0
  for (let index = 0; index < profile.queryIterations; index++) {
    const startedAt = performance.now()
    const rows = await prisma.$queryRaw<unknown[]>(query.sql)
    durations.push(performance.now() - startedAt)
    rowsReturned = rows.length
  }
  return {
    name: query.name,
    timedQueryCount: profile.queryIterations,
    warmupQueryCount: profile.queryWarmups,
    rowsReturned,
    latency: summarizeDurations(durations),
  }
}

async function benchmarkConcurrentPersistence(
  prisma: DB.PrismaClient,
  fixture: AdaptivePracticeQuizBenchmarkFixture,
  profile: AdaptivePracticeQuizBenchmarkProfile
) {
  const samples: PersistenceSample[] = []
  for (
    let roundIndex = 0;
    roundIndex < profile.persistenceRounds;
    roundIndex++
  ) {
    const roundSamples = await Promise.all(
      Array.from(
        { length: profile.persistenceConcurrency },
        (_, workerIndex) => {
          const contentionGroup = Math.floor(workerIndex / 2)
          const attemptId = fixture.contentionAttemptIds[contentionGroup]
          const poolItem =
            fixture.persistencePoolItems[roundIndex * 2 + (workerIndex % 2)]
          if (!attemptId || !poolItem) {
            throw new Error('Adaptive persistence fixture is incomplete.')
          }
          return runPersistenceTransaction({
            prisma,
            fixture,
            attemptId,
            poolItem,
            responseOrder:
              roundIndex * profile.persistenceConcurrency + workerIndex + 1,
          })
        }
      )
    )
    samples.push(...roundSamples)
  }

  const successful = samples.filter((sample) => sample.succeeded)
  const exhausted = samples.filter((sample) => !sample.succeeded)
  const retried = successful.filter((sample) => sample.retryCount > 0)
  const lockDurations = samples.flatMap((sample) => sample.lockAcquisitionMs)
  const queryCounts = samples.map((sample) => sample.applicationQueryCount)
  const expectedSuccessfulAttemptQueries =
    4 + Math.ceil(fixture.nodes.length / 250)
  const unexpectedSuccessfulQueryCounts = successful.filter(
    (sample) =>
      sample.successfulAttemptQueryCount !== expectedSuccessfulAttemptQueries
  ).length

  return {
    requestedTransactions: samples.length,
    successfulTransactions: successful.length,
    exhaustedTransactions: exhausted.length,
    succeededWithoutRetry: successful.length - retried.length,
    succeededAfterRetry: retried.length,
    retryAttempts: samples.reduce(
      (total, sample) => total + sample.retryCount,
      0
    ),
    retryRate: ratio(retried.length, samples.length),
    retryExhaustionRate: ratio(exhausted.length, samples.length),
    latency: summarizeDurations(successful.map((sample) => sample.durationMs)),
    exhaustedLatency: summarizeDurations(
      exhausted.map((sample) => sample.durationMs)
    ),
    lockAcquisition: {
      thresholdMs: SLOW_LOCK_ACQUISITION_MS,
      slowAcquisitionCount: lockDurations.filter(
        (duration) => duration > SLOW_LOCK_ACQUISITION_MS
      ).length,
      slowAcquisitionRate: ratio(
        lockDurations.filter((duration) => duration > SLOW_LOCK_ACQUISITION_MS)
          .length,
        lockDurations.length
      ),
      latency: summarizeDurations(lockDurations),
    },
    applicationQueryCount: {
      total: queryCounts.reduce((total, count) => total + count, 0),
      minPerTransaction: queryCounts.length ? Math.min(...queryCounts) : null,
      meanPerTransaction: queryCounts.length
        ? round(
            queryCounts.reduce((total, count) => total + count, 0) /
              queryCounts.length
          )
        : null,
      maxPerTransaction: queryCounts.length ? Math.max(...queryCounts) : null,
      expectedSuccessfulAttemptQueries,
      unexpectedSuccessfulAttemptQueryCounts: unexpectedSuccessfulQueryCounts,
      transactionControlStatementsIncluded: false,
    },
  }
}

async function runPersistenceTransaction({
  prisma,
  fixture,
  attemptId,
  poolItem,
  responseOrder,
}: {
  prisma: DB.PrismaClient
  fixture: AdaptivePracticeQuizBenchmarkFixture
  attemptId: string
  poolItem: AdaptivePracticeQuizBenchmarkPoolItem
  responseOrder: number
}): Promise<PersistenceSample> {
  const startedAt = performance.now()
  const lockAcquisitionMs: number[] = []
  let applicationQueryCount = 0
  let retryCount = 0
  for (
    let transactionAttempt = 1;
    transactionAttempt <= MAX_TRANSACTION_ATTEMPTS;
    transactionAttempt++
  ) {
    let attemptQueryCount = 0
    const countQuery = () => {
      attemptQueryCount++
      applicationQueryCount++
    }
    try {
      await prisma.$transaction(
        async (tx) => {
          const lockStartedAt = performance.now()
          countQuery()
          const locked = await tx.$queryRaw<Array<{ id: string }>>`
            SELECT "id"
            FROM "AdaptivePracticeQuizAttempt"
            WHERE "id" = ${attemptId}::uuid
              AND "configId" = ${fixture.configId}::uuid
              AND "status" = 'IN_PROGRESS'::"AdaptivePracticeQuizAttemptStatus"
            FOR UPDATE
          `
          lockAcquisitionMs.push(performance.now() - lockStartedAt)
          if (!locked[0]) {
            throw new Error('Adaptive benchmark attempt lock failed.')
          }

          countQuery()
          const inserted = await tx.$executeRaw(DB.Prisma.sql`
            INSERT INTO "AdaptivePracticeQuizResponse" (
              "order",
              "response",
              "normalizedResponse",
              "score",
              "correct",
              "overallThetaBefore",
              "overallThetaAfter",
              "overallStandardErrorAfter",
              "elapsedSeconds",
              "attemptId",
              "configId",
              "assignmentId",
              "poolItemId",
              "elementId",
              "elementSnapshot"
            )
            SELECT
              ${responseOrder},
              '{"value":1}'::jsonb,
              '{"value":1}'::jsonb,
              1.0,
              TRUE,
              0.0,
              0.1,
              0.9,
              30,
              ${attemptId}::uuid,
              ${fixture.configId}::uuid,
              pool."sourceAssignmentId",
              pool."id",
              pool."elementId",
              pool."elementData"
            FROM "PracticeQuizAdaptivePoolItem" pool
            WHERE pool."configId" = ${fixture.configId}::uuid
              AND pool."id" = ${poolItem.id}
              AND pool."sourceAssignmentId" = ${poolItem.sourceAssignmentId}
              AND pool."elementId" = ${poolItem.elementId}
          `)
          if (inserted !== 1) {
            throw new Error('Adaptive benchmark response insert failed.')
          }

          countQuery()
          await tx.$executeRaw(DB.Prisma.sql`
            UPDATE "AdaptivePracticeQuizAttempt"
            SET
              "currentTheta" = LEAST(10.0, "currentTheta" + 0.001),
              "currentStandardError" = GREATEST(0.1, COALESCE("currentStandardError", 1.0) - 0.001),
              "nextPoolItemId" = ${poolItem.id},
              "updatedAt" = CURRENT_TIMESTAMP
            WHERE "id" = ${attemptId}::uuid
          `)

          const estimateInput = buildEstimateInput(
            fixture,
            attemptId,
            responseOrder
          )
          const countingTx = {
            $executeRaw: async (query: DB.Prisma.Sql) => {
              countQuery()
              return tx.$executeRaw(query)
            },
          } as unknown as DB.Prisma.TransactionClient
          await persistAdaptivePracticeQuizEstimates(estimateInput, countingTx)
        },
        {
          isolationLevel: DB.Prisma.TransactionIsolationLevel.Serializable,
          maxWait: 5_000,
          timeout: 20_000,
        }
      )
      return {
        succeeded: true,
        retryCount,
        transactionAttempts: transactionAttempt,
        applicationQueryCount,
        successfulAttemptQueryCount: attemptQueryCount,
        durationMs: performance.now() - startedAt,
        lockAcquisitionMs,
      }
    } catch (error) {
      if (!isRetryableAdaptiveTransactionConflict(error)) throw error
      if (transactionAttempt === MAX_TRANSACTION_ATTEMPTS) {
        return {
          succeeded: false,
          retryCount,
          transactionAttempts: transactionAttempt,
          applicationQueryCount,
          successfulAttemptQueryCount: null,
          durationMs: performance.now() - startedAt,
          lockAcquisitionMs,
        }
      }
      retryCount++
      await waitForAdaptiveTransactionRetry(transactionAttempt - 1)
    }
  }
  throw new Error('Unreachable adaptive benchmark transaction state.')
}

function buildEstimateInput(
  fixture: AdaptivePracticeQuizBenchmarkFixture,
  attemptId: string,
  responseOrder: number
): PersistAdaptivePracticeQuizEstimatesInput {
  return {
    attemptId,
    configId: fixture.configId,
    competenceTreeId: fixture.competenceTreeId,
    overall: {
      nodeKind: DB.AdaptiveEstimateNodeKind.OVERALL,
      nodeId: null,
      theta: 0.1,
      standardError: 0.9,
      responseCount: responseOrder,
      levelId: fixture.levelId,
      stopReason: null,
    },
    nodes: fixture.nodes.map((node, index) => ({
      nodeKind:
        node.kind === DB.AdaptiveNodeKind.COMPETENCE
          ? DB.AdaptiveEstimateNodeKind.COMPETENCE
          : DB.AdaptiveEstimateNodeKind.SUBCOMPETENCE,
      nodeId: node.id,
      theta: ((index % 7) - 3) / 10,
      standardError: 0.5 + (index % 5) / 10,
      responseCount: responseOrder,
      levelId: fixture.levelId,
      stopReason: null,
    })),
  }
}

function publicFixtureShape(
  profile: AdaptivePracticeQuizBenchmarkProfile,
  counts: Awaited<ReturnType<typeof verifyAdaptivePracticeQuizBenchmarkFixture>>
) {
  return {
    roots: profile.rootCount,
    leaves: profile.rootCount,
    levels: profile.levelCount,
    itemsPerLeafLevel: profile.itemsPerLeafLevel,
    ...counts,
  }
}

async function loadDatabaseMetadata(prisma: DB.PrismaClient) {
  const rows = await prisma.$queryRaw<
    Array<{ serverVersion: string; serverVersionNum: string }>
  >`
    SELECT
      current_setting('server_version') AS "serverVersion",
      current_setting('server_version_num') AS "serverVersionNum"
  `
  return rows[0] ?? { serverVersion: 'unknown', serverVersionNum: 'unknown' }
}

function summarizeDurations(values: number[]): Percentiles {
  if (values.length === 0) {
    return {
      samples: 0,
      minMs: null,
      meanMs: null,
      p50Ms: null,
      p95Ms: null,
      p99Ms: null,
      maxMs: null,
    }
  }
  const sorted = [...values].sort((left, right) => left - right)
  return {
    samples: sorted.length,
    minMs: round(sorted[0]!),
    meanMs: round(
      sorted.reduce((total, value) => total + value, 0) / sorted.length
    ),
    p50Ms: round(percentile(sorted, 0.5)),
    p95Ms: round(percentile(sorted, 0.95)),
    p99Ms: round(percentile(sorted, 0.99)),
    maxMs: round(sorted.at(-1)!),
  }
}

function percentile(sorted: number[], quantile: number) {
  return sorted[Math.max(0, Math.ceil(sorted.length * quantile) - 1)]!
}

function ratio(numerator: number, denominator: number) {
  return denominator === 0 ? null : round(numerator / denominator)
}

function round(value: number) {
  return Math.round(value * 1000) / 1000
}

function extractIndexNames(value: unknown): string[] {
  const indexes = new Set<string>()
  visit(value)
  return [...indexes].sort()

  function visit(current: unknown) {
    if (Array.isArray(current)) {
      current.forEach(visit)
      return
    }
    if (!current || typeof current !== 'object') return
    for (const [key, nested] of Object.entries(current)) {
      if (key === 'Index Name' && typeof nested === 'string') {
        indexes.add(nested)
      }
      visit(nested)
    }
  }
}

function sanitizeArtifact(value: unknown, runLabel: string): unknown {
  if (typeof value === 'string') {
    return value
      .replace(UUID_PATTERN, '<fixture-uuid>')
      .replaceAll(runLabel, '<fixture-label>')
  }
  if (Array.isArray(value)) {
    return value.map((entry) => sanitizeArtifact(entry, runLabel))
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, nested]) => [
        key,
        sanitizeArtifact(nested, runLabel),
      ])
    )
  }
  return value
}

async function writeJson(path: string, value: unknown) {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
