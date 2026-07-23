import { spawnSync } from 'node:child_process'
import { readFile, readdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

import { Client } from 'pg'

export const LEGACY_ANALYTICS_MIGRATION = '20260420_analytics_covering_indexes'

export const ANALYTICS_INDEX_NAMES = [
  'QuestionResponse_courseId_createdAt_idx',
  'ChatMessage_threadId_createdAt_idx',
  'ParticipantAnalytics_courseId_type_timestamp_idx',
  'AggregatedAnalytics_courseId_type_timestamp_idx',
  'QuestionResponseDetail_createdAt_brin_idx',
  'LiveQuizResponse_createdAt_brin_idx',
  'LiveQuizResponse_instanceId_participantId_submittedAt_idx',
]

const REQUIRED_TABLES = [
  'QuestionResponse',
  'ChatMessage',
  'ParticipantAnalytics',
  'AggregatedAnalytics',
  'QuestionResponseDetail',
  'LiveQuizResponse',
]

export function parseSqlStatements(sql) {
  return sql
    .replace(/^--.*$/gm, '')
    .split(';')
    .map((statement) => statement.trim())
    .filter(Boolean)
}

async function loadStatements() {
  const sql = await readFile(
    new URL('./create-analytics-indexes-concurrently.sql', import.meta.url),
    'utf8'
  )
  return parseSqlStatements(sql)
}

async function loadPriorMigrationNames() {
  const migrations = await readdir(
    new URL('../src/prisma/schema/migrations/', import.meta.url),
    { withFileTypes: true }
  )
  return migrations
    .filter(
      (entry) => entry.isDirectory() && entry.name < LEGACY_ANALYTICS_MIGRATION
    )
    .map((entry) => entry.name)
}

async function tablesAreReady(client) {
  const checks = REQUIRED_TABLES.map(
    (_, index) => `to_regclass($${index + 1}) IS NOT NULL`
  ).join(' AND ')
  const names = REQUIRED_TABLES.map((name) => `public."${name}"`)
  const result = await client.query(`SELECT ${checks} AS ready`, names)
  return result.rows[0]?.ready === true
}

async function legacyMigrationState(client) {
  const migrationTable = await client.query(
    `SELECT to_regclass('public."_prisma_migrations"') IS NOT NULL AS present`
  )
  if (migrationTable.rows[0]?.present !== true) return 'unmanaged'

  const result = await client.query(
    `SELECT finished_at, rolled_back_at
     FROM "_prisma_migrations"
     WHERE migration_name = $1
     ORDER BY started_at DESC
     LIMIT 1`,
    [LEGACY_ANALYTICS_MIGRATION]
  )
  if (result.rows.length === 0) return 'pending'

  const migration = result.rows[0]
  if (migration.finished_at && !migration.rolled_back_at) return 'applied'
  throw new Error(
    `${LEGACY_ANALYTICS_MIGRATION} has an unfinished or rolled-back record; resolve that migration state before deploying`
  )
}

async function assertPriorMigrationsApplied(client, priorMigrationNames) {
  const result = await client.query(
    `SELECT migration_name
     FROM "_prisma_migrations"
     WHERE migration_name = ANY($1::text[])
       AND finished_at IS NOT NULL
       AND rolled_back_at IS NULL`,
    [priorMigrationNames]
  )
  const applied = new Set(
    result.rows.map(({ migration_name }) => migration_name)
  )
  const missing = priorMigrationNames.filter((name) => !applied.has(name))
  if (missing.length > 0) {
    throw new Error(
      `Cannot baseline ${LEGACY_ANALYTICS_MIGRATION}: ${missing.length} earlier migrations are not recorded as applied`
    )
  }
}

async function assertNoInvalidIndexes(client) {
  const result = await client.query(
    `SELECT c.relname AS name
     FROM pg_index i
     JOIN pg_class c ON c.oid = i.indexrelid
     WHERE NOT i.indisvalid
       AND c.relname = ANY($1::text[])
     ORDER BY c.relname`,
    [ANALYTICS_INDEX_NAMES]
  )
  if (result.rows.length === 0) return

  const names = result.rows.map(({ name }) => name).join(', ')
  throw new Error(
    `Invalid analytics indexes found: ${names}. Drop only those exact indexes concurrently, then retry.`
  )
}

async function assertValidIndexes(client) {
  const result = await client.query(
    `SELECT c.relname AS name, i.indisvalid, i.indisready
     FROM pg_index i
     JOIN pg_class c ON c.oid = i.indexrelid
     WHERE c.relname = ANY($1::text[])`,
    [ANALYTICS_INDEX_NAMES]
  )
  const valid = new Set(
    result.rows
      .filter(({ indisvalid, indisready }) => indisvalid && indisready)
      .map(({ name }) => name)
  )
  const missing = ANALYTICS_INDEX_NAMES.filter((name) => !valid.has(name))
  if (missing.length > 0) {
    throw new Error(
      `Analytics index validation failed for: ${missing.join(', ')}`
    )
  }
}

export async function prepareAnalyticsIndexes(
  client,
  statements,
  priorMigrationNames = []
) {
  if (!(await tablesAreReady(client))) {
    return { prepared: false, resolveLegacyMigration: false }
  }

  const migrationState = await legacyMigrationState(client)
  if (migrationState === 'unmanaged') {
    throw new Error(
      `Cannot baseline ${LEGACY_ANALYTICS_MIGRATION}: initialized database has no Prisma migration table`
    )
  }
  if (migrationState === 'pending') {
    await assertPriorMigrationsApplied(client, priorMigrationNames)
  }
  await assertNoInvalidIndexes(client)
  for (const statement of statements) {
    await client.query(statement)
  }
  await assertValidIndexes(client)

  return {
    prepared: true,
    resolveLegacyMigration: migrationState === 'pending',
  }
}

function resolveLegacyMigration() {
  const result = spawnSync(
    'pnpm',
    [
      'exec',
      'prisma',
      'migrate',
      'resolve',
      '--applied',
      LEGACY_ANALYTICS_MIGRATION,
    ],
    {
      env: process.env,
      stdio: 'inherit',
    }
  )
  if (result.error) throw result.error
  if (result.status !== 0) {
    throw new Error(
      `prisma migrate resolve exited with status ${result.status ?? 'unknown'}`
    )
  }
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required for Prisma migration deployment')
  }

  const client = new Client({ connectionString: process.env.DATABASE_URL })
  await client.connect()
  let result
  try {
    result = await prepareAnalyticsIndexes(
      client,
      await loadStatements(),
      await loadPriorMigrationNames()
    )
  } finally {
    await client.end()
  }

  if (!result.prepared) {
    console.log(
      'Analytics tables are absent; the normal migration chain will create indexes on the fresh database.'
    )
    return
  }

  console.log('Analytics indexes are present, valid, and ready.')
  if (result.resolveLegacyMigration) {
    resolveLegacyMigration()
  }
}

const entryPoint = process.argv[1]
if (entryPoint && fileURLToPath(import.meta.url) === entryPoint) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
}
