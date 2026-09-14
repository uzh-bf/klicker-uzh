import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'vitest'

import {
  MAX_ATTEMPTED_SUBMISSIONS,
  createDatabaseClient,
  latestReceipt,
  restoreFixture,
  validateBundle,
  validateCurrentBaseUsage,
  withFileLock,
} from './writing-coach-evaluation.mjs'

function validBundle(cases) {
  return {
    defaults: { maxAttemptedSubmissions: MAX_ATTEMPTED_SUBMISSIONS },
    contexts: {},
    cases,
  }
}

test('bundle validation rejects case ids that would escape the receipts directory', () => {
  assert.doesNotThrow(() =>
    validateBundle(
      validBundle([
        { id: 'draft-1', mode: 'writing-coach', question: 'Draft.' },
      ])
    )
  )
  for (const id of ['../../tmp/escaped', '/etc/passwd', 'nested/case', '']) {
    assert.throws(
      () =>
        validateBundle(
          validBundle([{ id, mode: 'writing-coach', question: 'Draft.' }])
        ),
      (error) => error?.code === 'case_invalid'
    )
  }
})

test('a stale submission lock is reclaimed instead of blocking the run', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'writing-coach-lock-'))
  const lockPath = join(directory, 'submission-counter.lock')
  try {
    await writeFile(
      lockPath,
      JSON.stringify({
        pid: 1,
        createdAt: new Date(Date.now() - 10 * 60_000).toISOString(),
      })
    )
    assert.equal(await withFileLock(lockPath, async () => 'ran'), 'ran')
    await assert.rejects(readFile(lockPath, 'utf8'), { code: 'ENOENT' })
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})

test('resumed receipts are only authoritative for the bundle they recorded', () => {
  const receipts = [
    { caseId: 'draft-1', status: 'completed', bundleFingerprint: 'older' },
    { caseId: 'draft-1', status: 'completed', bundleFingerprint: 'current' },
  ]
  assert.equal(
    latestReceipt(receipts, 'draft-1', true, 'current')?.bundleFingerprint,
    'current'
  )
  assert.equal(latestReceipt(receipts, 'draft-1', true, 'unknown'), null)
  assert.equal(
    latestReceipt(receipts, 'draft-1', true)?.bundleFingerprint,
    'current'
  )
})

test('database client requires the repository disposable database guard', async () => {
  await assert.rejects(
    createDatabaseClient({
      DATABASE_URL: 'postgresql://klicker_test@localhost/other_database',
    }),
    (error) => error?.code === 'disposable_database_required'
  )
})

test('fallback budget validation requires the exact current month with remaining budget', () => {
  const currentMonthStart = '2026-09-01'
  assert.doesNotThrow(() =>
    validateCurrentBaseUsage({
      monthStart: currentMonthStart,
      currentMonthStart,
      budget: '10',
      used: '2',
    })
  )
  assert.throws(
    () =>
      validateCurrentBaseUsage({
        monthStart: '2026-08-01',
        currentMonthStart,
        budget: '10',
        used: '2',
      }),
    (error) => error?.code === 'owner_base_budget_unavailable'
  )
  assert.throws(
    () =>
      validateCurrentBaseUsage({
        monthStart: currentMonthStart,
        currentMonthStart,
        budget: '2',
        used: '2',
      }),
    (error) => error?.code === 'owner_base_budget_unavailable'
  )
})

test('restore fails immediately when a required row is not updated', async () => {
  const client = {
    async $executeRawUnsafe() {
      return 0
    },
    async $queryRawUnsafe() {
      throw new Error('readback should not run after a failed update')
    },
  }
  const fixture = {
    chatbot: {
      standardModeConfig: {},
      creditInitialCredits: 1,
      creditResetPeriod: 'NONE',
      creditResetAmount: 1,
      creditMaxCredits: 1,
    },
    mcpConfigs: [],
    participant: { id: 'participant-fixture' },
    creditRow: null,
  }

  await assert.rejects(
    restoreFixture(client, fixture),
    (error) => error?.code === 'fixture_restore_update_failed'
  )
})
