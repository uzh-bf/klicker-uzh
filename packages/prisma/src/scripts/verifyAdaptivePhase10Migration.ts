import assert from 'node:assert/strict'
import { readdir, readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { Client, type DatabaseError } from 'pg'

const PHASE_10_MIGRATIONS = [
  '20260713210000_adaptive_runtime_constraint_validation',
  '20260713212000_adaptive_competence_tree_audit_type',
  '20260713213000_adaptive_history_retention',
] as const
const FIRST_PHASE_10_MIGRATION = PHASE_10_MIGRATIONS[0]
const migrationsPath = fileURLToPath(
  new URL('../prisma/schema/migrations/', import.meta.url)
)
const fixturePath = fileURLToPath(
  new URL(
    '../prisma/fixtures/adaptive-learning-phase10-pre-repair.sql',
    import.meta.url
  )
)

async function main() {
  const sourceDatabaseUrl = process.env.DATABASE_URL
  if (!sourceDatabaseUrl) {
    throw new Error('DATABASE_URL is required for the migration rehearsal.')
  }

  const databaseName = `adaptive_phase10_${process.pid}_${Date.now()}`
  const admin = new Client({ connectionString: sourceDatabaseUrl })
  const testDatabaseUrl = new URL(sourceDatabaseUrl)
  testDatabaseUrl.pathname = `/${databaseName}`
  const testDatabase = new Client({ connectionString: testDatabaseUrl.href })

  await admin.connect()
  await admin.query(`CREATE DATABASE ${quoteIdentifier(databaseName)}`)
  try {
    await testDatabase.connect()
    const migrationNames = (
      await readdir(migrationsPath, {
        withFileTypes: true,
      })
    )
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort()
    const prePhase10Migrations = migrationNames.filter(
      (name) => name < FIRST_PHASE_10_MIGRATION
    )

    for (const migrationName of prePhase10Migrations) {
      await applySqlFile(
        testDatabase,
        `${migrationsPath}/${migrationName}/migration.sql`,
        migrationName
      )
    }
    await applySqlFile(testDatabase, fixturePath, 'Phase 10 pre-repair fixture')
    for (const migrationName of PHASE_10_MIGRATIONS) {
      assert(
        migrationNames.includes(migrationName),
        `Missing migration ${migrationName}`
      )
      await applySqlFile(
        testDatabase,
        `${migrationsPath}/${migrationName}/migration.sql`,
        migrationName
      )
    }

    await verifyRepairs(testDatabase)
    await verifyConstraints(testDatabase)
    await verifyRetentionAndErasure(testDatabase)
    console.log(
      `Adaptive Phase 10 migration rehearsal passed on ${prePhase10Migrations.length} prior migrations.`
    )
  } finally {
    await testDatabase.end().catch(() => undefined)
    await admin.query(
      `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()`,
      [databaseName]
    )
    await admin.query(
      `DROP DATABASE IF EXISTS ${quoteIdentifier(databaseName)}`
    )
    await admin.end()
  }
}

async function applySqlFile(
  client: Client,
  path: string,
  label: string
): Promise<void> {
  const sql = await readFile(path, 'utf8')
  try {
    await client.query(sql)
  } catch (error) {
    throw new Error(`Failed while applying ${label}.`, { cause: error })
  }
}

async function verifyRepairs(client: Client) {
  const attempts = await client.query<{
    id: string
    status: string
    stopReason: string | null
    completed: boolean
    nextPoolItemId: number | null
  }>(`
    SELECT
      "id",
      "status"::text,
      "stopReason"::text AS "stopReason",
      "completedAt" IS NOT NULL AS completed,
      "nextPoolItemId" AS "nextPoolItemId"
    FROM "AdaptivePracticeQuizAttempt"
    ORDER BY "id"
  `)
  assert.deepEqual(attempts.rows, [
    {
      id: '91000000-0000-4000-8000-000000000007',
      status: 'ABANDONED',
      stopReason: 'ABANDONED',
      completed: true,
      nextPoolItemId: null,
    },
    {
      id: '91000000-0000-4000-8000-000000000008',
      status: 'COMPLETED',
      stopReason: 'CLASSIFIED',
      completed: true,
      nextPoolItemId: null,
    },
    {
      id: '91000000-0000-4000-8000-000000000009',
      status: 'IN_PROGRESS',
      stopReason: null,
      completed: false,
      nextPoolItemId: 9102,
    },
    {
      id: '91000000-0000-4000-8000-000000000011',
      status: 'ABANDONED',
      stopReason: 'ABANDONED',
      completed: true,
      nextPoolItemId: null,
    },
  ])

  const response = await client.query<{
    poolItemId: number | null
    hasSnapshot: boolean
  }>(`
    SELECT
      "poolItemId" AS "poolItemId",
      "elementSnapshot" IS NOT NULL AS "hasSnapshot"
    FROM "AdaptivePracticeQuizResponse"
    WHERE "id" = 9101
  `)
  assert.deepEqual(response.rows, [{ poolItemId: 9101, hasSnapshot: true }])
}

async function verifyConstraints(client: Client) {
  const expectedConstraints = [
    'apqa_runtime_state_check',
    'apqa_runtime_values_check',
    'apqe_runtime_values_check',
    'apqr_element_snapshot_required_check',
    'apqr_pool_item_required_check',
    'apqr_runtime_values_check',
  ]
  const constraints = await client.query<{
    conname: string
    convalidated: boolean
  }>(
    `
      SELECT conname, convalidated
      FROM pg_constraint
      WHERE conname = ANY($1::text[])
      ORDER BY conname
    `,
    [expectedConstraints]
  )
  assert.deepEqual(
    constraints.rows,
    expectedConstraints.sort().map((conname) => ({
      conname,
      convalidated: true,
    }))
  )

  const retentionConstraints = await client.query<{
    conname: string
    confdeltype: string
    convalidated: boolean
  }>(`
    SELECT conname, confdeltype, convalidated
    FROM pg_constraint
    WHERE conname IN (
      'CompetenceTree_ownerId_fkey',
      'AdaptivePracticeQuizAttempt_config_quiz_tree_fkey',
      'AdaptivePracticeQuizAttempt_practiceQuizId_courseId_fkey',
      'AdaptivePracticeQuizAttempt_courseId_fkey'
    )
    ORDER BY conname
  `)
  assert.equal(retentionConstraints.rowCount, 4)
  assert(
    retentionConstraints.rows.every(
      ({ confdeltype, convalidated }) =>
        confdeltype === 'r' && convalidated === true
    )
  )

  const auditType = await client.query<{ present: boolean }>(`
    SELECT EXISTS (
      SELECT 1
      FROM pg_enum
      JOIN pg_type ON pg_type.oid = pg_enum.enumtypid
      WHERE pg_type.typname = 'ObjectType'
        AND pg_enum.enumlabel = 'COMPETENCE_TREE'
    ) AS present
  `)
  assert.equal(auditType.rows[0]?.present, true)
}

async function verifyRetentionAndErasure(client: Client) {
  await assert.rejects(
    client.query(`
      DELETE FROM "PracticeQuiz"
      WHERE "id" = '91000000-0000-4000-8000-000000000004'
    `),
    (error: DatabaseError) => error.code === '23503'
  )
  await client.query(`
    DELETE FROM "Participant"
    WHERE "id" IN (
      '91000000-0000-4000-8000-000000000006',
      '91000000-0000-4000-8000-000000000010'
    )
  `)
  const attemptCount = await client.query<{ count: number }>(`
    SELECT COUNT(*)::integer AS count
    FROM "AdaptivePracticeQuizAttempt"
  `)
  assert.equal(attemptCount.rows[0]?.count, 0)
  const quizCount = await client.query<{ count: number }>(`
    SELECT COUNT(*)::integer AS count
    FROM "PracticeQuiz"
    WHERE "id" = '91000000-0000-4000-8000-000000000004'
  `)
  assert.equal(quizCount.rows[0]?.count, 1)
}

function quoteIdentifier(value: string): string {
  return `"${value.replaceAll('"', '""')}"`
}

await main()
