import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

import {
  ANALYTICS_INDEX_NAMES,
  parseSqlStatements,
  prepareAnalyticsIndexes,
} from './prepareAnalyticsIndexes.mjs'

class FakeClient {
  constructor({
    tablesReady = true,
    migrationState = 'pending',
    invalidIndexes = [],
    appliedMigrations = ['20260419_before_analytics'],
  } = {}) {
    this.tablesReady = tablesReady
    this.migrationState = migrationState
    this.invalidIndexes = invalidIndexes
    this.appliedMigrations = appliedMigrations
    this.executed = []
  }

  async query(sql) {
    if (sql.includes('AS ready')) {
      return { rows: [{ ready: this.tablesReady }] }
    }
    if (sql.includes('AS present')) {
      return { rows: [{ present: this.migrationState !== 'missing-table' }] }
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
    if (sql.includes('i.indisvalid, i.indisready')) {
      return {
        rows: ANALYTICS_INDEX_NAMES.map((name) => ({
          name,
          indisvalid: true,
          indisready: true,
        })),
      }
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
})

test('skips the prebuild on a fresh database', async () => {
  const client = new FakeClient({ tablesReady: false })

  assert.deepEqual(await prepareAnalyticsIndexes(client, await statements()), {
    prepared: false,
    resolveLegacyMigration: false,
  })
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
