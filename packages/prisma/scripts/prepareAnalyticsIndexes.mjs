import { spawnSync } from 'node:child_process'
import { readFile, readdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

import { Client } from 'pg'

export const LEGACY_ANALYTICS_MIGRATION = '20260420_analytics_covering_indexes'

export const ANALYTICS_INDEXES = [
  {
    name: 'QuestionResponse_courseId_createdAt_idx',
    table: 'QuestionResponse',
    method: 'btree',
    columns: ['courseId', 'createdAt'],
  },
  {
    name: 'ChatMessage_threadId_createdAt_idx',
    table: 'ChatMessage',
    method: 'btree',
    columns: ['threadId', 'createdAt'],
  },
  {
    name: 'ParticipantAnalytics_courseId_type_timestamp_idx',
    table: 'ParticipantAnalytics',
    method: 'btree',
    columns: ['courseId', 'type', 'timestamp'],
  },
  {
    name: 'AggregatedAnalytics_courseId_type_timestamp_idx',
    table: 'AggregatedAnalytics',
    method: 'btree',
    columns: ['courseId', 'type', 'timestamp'],
  },
  {
    name: 'QuestionResponseDetail_createdAt_brin_idx',
    table: 'QuestionResponseDetail',
    method: 'brin',
    columns: ['createdAt'],
  },
  {
    name: 'LiveQuizResponse_createdAt_brin_idx',
    table: 'LiveQuizResponse',
    method: 'brin',
    columns: ['createdAt'],
  },
  {
    name: 'LiveQuizResponse_instanceId_participantId_submittedAt_idx',
    table: 'LiveQuizResponse',
    method: 'btree',
    columns: ['instanceId', 'participantId', 'submittedAt'],
  },
]

export const ANALYTICS_INDEX_NAMES = ANALYTICS_INDEXES.map(({ name }) => name)

const MIGRATION_LOCK_NAME = 'klicker-uzh-prisma-deploy'

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

async function inspectDatabase(client) {
  const tables = await client.query(
    `SELECT name, to_regclass(format('public.%I', name)) IS NOT NULL AS present
     FROM unnest($1::text[]) AS name`,
    [REQUIRED_TABLES]
  )
  const missingTables = tables.rows
    .filter(({ present }) => !present)
    .map(({ name }) => name)
  const presentTableCount = REQUIRED_TABLES.length - missingTables.length

  const migrationTable = await client.query(
    `SELECT to_regclass('public."_prisma_migrations"') IS NOT NULL AS present`
  )
  const migrationTablePresent = migrationTable.rows[0]?.present === true
  const migrationCount = migrationTablePresent
    ? Number(
        (
          await client.query(
            `SELECT COUNT(*)::int AS count FROM "_prisma_migrations"`
          )
        ).rows[0]?.count ?? 0
      )
    : 0

  return {
    migrationCount,
    missingTables,
    presentTableCount,
  }
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
     JOIN pg_class t ON t.oid = i.indrelid
     JOIN pg_namespace n ON n.oid = t.relnamespace
     WHERE NOT i.indisvalid
       AND n.nspname = 'public'
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

async function validateIndexes(client, { requireAll }) {
  const result = await client.query(
    `SELECT
       c.relname AS name,
       t.relname AS table_name,
       am.amname AS access_method,
       i.indisvalid,
       i.indisready,
       ARRAY(
         SELECT pg_get_indexdef(i.indexrelid, key_position, true)
         FROM generate_series(1, i.indnkeyatts) AS key_position
       ) AS key_columns
     FROM pg_index i
     JOIN pg_class c ON c.oid = i.indexrelid
     JOIN pg_class t ON t.oid = i.indrelid
     JOIN pg_namespace n ON n.oid = t.relnamespace
     JOIN pg_am am ON am.oid = c.relam
     WHERE n.nspname = 'public'
       AND c.relname = ANY($1::text[])`,
    [ANALYTICS_INDEX_NAMES]
  )

  const actualByName = new Map(result.rows.map((index) => [index.name, index]))
  const mismatched = ANALYTICS_INDEXES.filter((expected) => {
    const actual = actualByName.get(expected.name)
    if (!actual) return false
    return (
      actual.table_name !== expected.table ||
      actual.access_method !== expected.method ||
      !actual.indisvalid ||
      !actual.indisready ||
      JSON.stringify(
        actual.key_columns.map((column) =>
          column.startsWith('"') && column.endsWith('"')
            ? column.slice(1, -1)
            : column
        )
      ) !== JSON.stringify(expected.columns)
    )
  }).map(({ name }) => name)
  if (mismatched.length > 0) {
    throw new Error(
      `Analytics index definition validation failed for: ${mismatched.join(', ')}`
    )
  }

  if (!requireAll) return
  const missing = ANALYTICS_INDEX_NAMES.filter(
    (name) => !actualByName.has(name)
  )
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
  const database = await inspectDatabase(client)
  if (database.presentTableCount === 0 && database.migrationCount === 0) {
    return { prepared: false, resolveLegacyMigration: false }
  }
  if (database.missingTables.length > 0) {
    throw new Error(
      `Initialized database is missing required analytics tables: ${database.missingTables.join(', ')}`
    )
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
  await validateIndexes(client, { requireAll: false })
  for (const statement of statements) {
    await client.query(statement)
  }
  await validateIndexes(client, { requireAll: true })

  return {
    prepared: true,
    resolveLegacyMigration: migrationState === 'pending',
  }
}

export async function acquireMigrationLock(client) {
  const result = await client.query(
    `SELECT pg_try_advisory_lock(hashtext($1)) AS acquired`,
    [MIGRATION_LOCK_NAME]
  )
  if (result.rows[0]?.acquired !== true) {
    throw new Error(
      'Another repository Prisma deployment holds the analytics prebuild lock'
    )
  }
}

async function releaseMigrationLock(client) {
  await client.query(`SELECT pg_advisory_unlock(hashtext($1))`, [
    MIGRATION_LOCK_NAME,
  ])
}

function runPrisma(args) {
  const result = spawnSync('pnpm', ['exec', 'prisma', ...args], {
    env: process.env,
    stdio: 'inherit',
  })
  if (result.error) throw result.error
  if (result.status !== 0) {
    throw new Error(
      `prisma ${args.join(' ')} exited with status ${result.status ?? 'unknown'}`
    )
  }
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required for Prisma migration deployment')
  }

  const client = new Client({ connectionString: process.env.DATABASE_URL })
  await client.connect()
  let locked = false
  try {
    await acquireMigrationLock(client)
    locked = true
    const result = await prepareAnalyticsIndexes(
      client,
      await loadStatements(),
      await loadPriorMigrationNames()
    )

    if (!result.prepared) {
      console.log(
        'Analytics tables are absent; the normal migration chain will create indexes on the fresh database.'
      )
    } else {
      console.log('Analytics indexes are present, valid, and ready.')
    }

    if (result.resolveLegacyMigration) {
      runPrisma(['migrate', 'resolve', '--applied', LEGACY_ANALYTICS_MIGRATION])
    }
    runPrisma(['migrate', 'deploy'])
  } finally {
    if (locked) await releaseMigrationLock(client)
    await client.end()
  }
}

const entryPoint = process.argv[1]
if (entryPoint && fileURLToPath(import.meta.url) === entryPoint) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
}
