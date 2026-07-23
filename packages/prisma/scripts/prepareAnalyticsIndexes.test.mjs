import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

import {
  ANALYTICS_INDEXES,
  ANALYTICS_INDEX_NAMES,
  acquireMigrationLock,
  parseSqlStatements,
  prepareAnalyticsIndexes,
} from './prepareAnalyticsIndexes.mjs'

class FakeClient {
  constructor({
    missingTables = [],
    migrationState = 'pending',
    invalidIndexes = [],
    appliedMigrations = ['20260419_before_analytics'],
    migrationCount = 1,
    wrongIndexName,
    lockAcquired = true,
  } = {}) {
    this.missingTables = missingTables
    this.migrationState = migrationState
    this.invalidIndexes = invalidIndexes
    this.appliedMigrations = appliedMigrations
    this.migrationCount = migrationCount
    this.wrongIndexName = wrongIndexName
    this.lockAcquired = lockAcquired
    this.executed = []
  }

  async query(sql) {
    if (sql.includes('FROM unnest')) {
      return {
        rows: [
          'QuestionResponse',
          'ChatMessage',
          'ParticipantAnalytics',
          'AggregatedAnalytics',
          'QuestionResponseDetail',
          'LiveQuizResponse',
        ].map((name) => ({
          name,
          present: !this.missingTables.includes(name),
        })),
      }
    }
    if (sql.includes('AS present')) {
      return { rows: [{ present: this.migrationState !== 'missing-table' }] }
    }
    if (sql.includes('COUNT(*)::int')) {
      return { rows: [{ count: this.migrationCount }] }
    }
    if (sql.includes('finished_at, rolled_back_at')) {
      if (this.migrationState === 'pending') return { rows: [] }
      if (this.migrationState === 'applied') {
        return {
          rows: [{ finished_at: new Date(), rolled_back_at: null }],
        }
      }
      return {
        rows: [{ finished_at: null, rolled_back_at: null }],
      }
    }
    if (sql.includes('migration_name = ANY')) {
      return {
        rows: this.appliedMigrations.map((migration_name) => ({
          migration_name,
        })),
      }
    }
    if (sql.includes('NOT i.indisvalid')) {
      return { rows: this.invalidIndexes.map((name) => ({ name })) }
    }
    if (sql.includes('pg_get_indexdef')) {
      return {
        rows: ANALYTICS_INDEXES.map((index) => ({
          name: index.name,
          schema_name: 'public',
          table_name:
            index.name === this.wrongIndexName ? 'WrongTable' : index.table,
          access_method: index.method,
          indisvalid: true,
          indisready: true,
          key_columns: index.columns,
        })),
      }
    }
    if (sql.includes('pg_try_advisory_lock')) {
      return { rows: [{ acquired: this.lockAcquired }] }
    }

    this.executed.push(sql)
    return { rows: [] }
  }
}

async function statements() {
  const sql = await readFile(
    new URL('./create-analytics-indexes-concurrently.sql', import.meta.url),
    'utf8'
  )
  return parseSqlStatements(sql)
}

test('parses every concurrent index statement and drops the old index after its replacement', async () => {
  const parsed = await statements()

  assert.equal(parsed.length, 8)
  const replacement = parsed.findIndex((sql) =>
    sql.includes('ChatMessage_threadId_createdAt_idx')
  )
  const oldIndexDrop = parsed.findIndex((sql) =>
    sql.includes('DROP INDEX CONCURRENTLY')
  )
  assert.ok(replacement >= 0)
  assert.ok(oldIndexDrop > replacement)

  const createNames = parsed
    .map((sql) =>
      sql.match(/CREATE INDEX CONCURRENTLY IF NOT EXISTS "([^"]+)"/)
    )
    .filter(Boolean)
    .map((match) => match[1])
  assert.deepEqual(createNames, ANALYTICS_INDEX_NAMES)
})

test('skips the prebuild on a fresh database', async () => {
  const client = new FakeClient({
    missingTables: [
      'QuestionResponse',
      'ChatMessage',
      'ParticipantAnalytics',
      'AggregatedAnalytics',
      'QuestionResponseDetail',
      'LiveQuizResponse',
    ],
    migrationState: 'missing-table',
    migrationCount: 0,
  })

  assert.deepEqual(await prepareAnalyticsIndexes(client, await statements()), {
    prepared: false,
    resolveLegacyMigration: false,
  })
  assert.deepEqual(client.executed, [])
})

test('fails closed on an initialized database with a partial analytics schema', async () => {
  const client = new FakeClient({
    missingTables: ['ParticipantAnalytics'],
  })

  await assert.rejects(
    prepareAnalyticsIndexes(client, await statements()),
    /missing required analytics tables: ParticipantAnalytics/
  )
  assert.deepEqual(client.executed, [])
})

test('prebuilds initialized databases and baselines a pending legacy migration', async () => {
  const client = new FakeClient()
  const parsed = await statements()

  assert.deepEqual(
    await prepareAnalyticsIndexes(client, parsed, [
      '20260419_before_analytics',
    ]),
    {
      prepared: true,
      resolveLegacyMigration: true,
    }
  )
  assert.deepEqual(client.executed, parsed)
})

test('does not baseline an already applied legacy migration', async () => {
  const client = new FakeClient({ migrationState: 'applied' })

  assert.deepEqual(await prepareAnalyticsIndexes(client, await statements()), {
    prepared: true,
    resolveLegacyMigration: false,
  })
})

test('fails before building when a named invalid index exists', async () => {
  const client = new FakeClient({
    invalidIndexes: ['QuestionResponse_courseId_createdAt_idx'],
  })

  await assert.rejects(
    prepareAnalyticsIndexes(client, await statements()),
    /Invalid analytics indexes found/
  )
  assert.deepEqual(client.executed, [])
})

test('fails before building when a named index has the wrong definition', async () => {
  const client = new FakeClient({
    wrongIndexName: 'QuestionResponse_courseId_createdAt_idx',
  })

  await assert.rejects(
    prepareAnalyticsIndexes(client, await statements()),
    /index definition validation failed/
  )
  assert.deepEqual(client.executed, [])
})

test('fails on an unfinished legacy migration record', async () => {
  const client = new FakeClient({ migrationState: 'failed' })

  await assert.rejects(
    prepareAnalyticsIndexes(client, await statements()),
    /unfinished or rolled-back/
  )
})

test('does not baseline an initialized database without complete migration history', async () => {
  const client = new FakeClient({ appliedMigrations: [] })

  await assert.rejects(
    prepareAnalyticsIndexes(client, await statements(), [
      '20260419_before_analytics',
    ]),
    /earlier migrations are not recorded as applied/
  )
  assert.deepEqual(client.executed, [])
})

test('does not baseline an initialized database without a migration table', async () => {
  const client = new FakeClient({ migrationState: 'missing-table' })

  await assert.rejects(
    prepareAnalyticsIndexes(client, await statements()),
    /has no Prisma migration table/
  )
  assert.deepEqual(client.executed, [])
})

test('fails when another repository migration command holds the advisory lock', async () => {
  const client = new FakeClient({ lockAcquired: false })

  await assert.rejects(
    acquireMigrationLock(client),
    /Another repository Prisma deployment/
  )
})
