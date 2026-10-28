import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'vitest'

import {
  MAX_ATTEMPTED_SUBMISSIONS,
  createDatabaseClient,
  latestReceipt,
  readStaleLock,
  restoreFixture,
  validateBundle,
  validateCurrentBaseUsage,
  withFileLock,
} from './writing-coach-evaluation.mjs'

// A pid that is guaranteed not to be running, so a lock recorded by a crashed
// run can be told apart from one held by a live process.
const DEAD_PID = 2147483646

function validBundle(cases) {
  return {
    defaults: { maxAttemptedSubmissions: MAX_ATTEMPTED_SUBMISSIONS },
    contexts: {},
    cases,
  }
}

function createFixtureClient({ chatbot, creditRow, mcpConfigs, readback }) {
  return {
    async $executeRawUnsafe() {
      return 1
    },
    async $queryRawUnsafe(text) {
      if (text.includes('ChatUsageCredits')) {
        return readback?.creditRow ?? (creditRow ? [creditRow] : [])
      }
      if (text.includes('standardModeConfig')) {
        return [{ standardModeConfig: chatbot.standardModeConfig }]
      }
      if (text.includes('ChatbotMCPConfig')) {
        return mcpConfigs.map((config) => ({
          id: config.id,
          isEnabled: config.isEnabled,
        }))
      }
      return [
        {
          creditInitialCredits: chatbot.creditInitialCredits,
          creditResetPeriod: chatbot.creditResetPeriod,
          creditResetAmount: chatbot.creditResetAmount,
          creditMaxCredits: chatbot.creditMaxCredits,
        },
      ]
    },
  }
}

function restoreFixtureInput() {
  return {
    chatbot: {
      standardModeConfig: { writingCoachEnabled: true },
      creditInitialCredits: 40,
      creditResetPeriod: 'MONTHLY',
      creditResetAmount: 40,
      creditMaxCredits: 100,
    },
    mcpConfigs: [{ id: 'mcp-config-fixture', isEnabled: true }],
    server: { id: 'mcp-server-fixture' },
    participant: { id: 'participant-fixture' },
    creditRow: {
      participantId: 'participant-fixture',
      chatbotId: 'chatbot-fixture',
      current: '12',
      total: '100',
      periodStartedAt: '2026-09-01',
      lastResetAt: null,
      resetCount: 0,
      acceptedDisclaimerId: null,
      disclaimerAcceptedAt: null,
      disclaimerDeclined: false,
    },
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

test('bundle validation rejects follow-ups whose parent is not earlier in the bundle', () => {
  const child = {
    id: 'child',
    mode: 'writing-coach',
    question: 'Draft.',
    followUpTo: 'parent',
  }
  const parent = { id: 'parent', mode: 'writing-coach', question: 'Draft.' }
  assert.doesNotThrow(() => validateBundle(validBundle([parent, child])))
  for (const cases of [
    [child, parent],
    [child],
    [
      { ...parent, id: 'a', followUpTo: 'b' },
      { ...parent, id: 'b', followUpTo: 'a' },
    ],
  ]) {
    assert.throws(
      () => validateBundle(validBundle(cases)),
      (error) =>
        error?.code === 'case_follow_up_order_invalid' ||
        error?.code === 'case_follow_up_target_missing'
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
        pid: DEAD_PID,
        createdAt: new Date(Date.now() - 10 * 60_000).toISOString(),
        token: 'dead-owner',
      })
    )
    assert.equal(await withFileLock(lockPath, async () => 'ran'), 'ran')
    await assert.rejects(readFile(lockPath, 'utf8'), { code: 'ENOENT' })
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})

test('only a lock whose owner is gone is reclaimable', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'writing-coach-lock-'))
  const lockPath = join(directory, 'submission-counter.lock')
  try {
    await writeFile(
      lockPath,
      JSON.stringify({
        pid: process.pid,
        createdAt: new Date(0).toISOString(),
        token: 'live-owner',
      })
    )
    const live = await readStaleLock(lockPath)
    assert.equal(live.stale, false)
    assert.equal(JSON.parse(live.content).token, 'live-owner')

    await writeFile(
      lockPath,
      JSON.stringify({
        pid: DEAD_PID,
        createdAt: new Date().toISOString(),
        token: 'dead-owner',
      })
    )
    assert.equal((await readStaleLock(lockPath)).stale, true)

    await rm(lockPath, { force: true })
    assert.deepEqual(await readStaleLock(lockPath), {
      stale: true,
      content: null,
    })
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

test('restore returns the fixture to its recorded baseline', async () => {
  const fixture = restoreFixtureInput()
  await assert.doesNotReject(
    restoreFixture(createFixtureClient(fixture), fixture)
  )
})

test('restore fails when the readback does not match the recorded baseline', async () => {
  const fixture = restoreFixtureInput()
  const client = createFixtureClient({
    ...fixture,
    readback: { creditRow: [{ ...fixture.creditRow, current: '0' }] },
  })
  await assert.rejects(restoreFixture(client, fixture), (error) => {
    return error?.code === 'fixture_restore_readback_failed'
  })
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
