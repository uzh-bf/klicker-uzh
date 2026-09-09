import assert from 'node:assert/strict'
import test from 'node:test'

import {
  createDatabaseClient,
  restoreFixture,
  validateCurrentBaseUsage,
} from './writing-coach-evaluation.mjs'

function monthStartInZurich(monthOffset = 0) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Zurich',
    year: 'numeric',
    month: 'numeric',
  }).formatToParts(new Date())
  const year = Number(parts.find((part) => part.type === 'year').value)
  const month = Number(parts.find((part) => part.type === 'month').value)
  const date = new Date(Date.UTC(year, month - 1 + monthOffset, 1))
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-01`
}

test('database client requires the repository disposable database guard', async () => {
  await assert.rejects(
    createDatabaseClient({
      DATABASE_URL: 'postgresql://klicker_test@localhost/other_database',
    }),
    (error) => error?.code === 'disposable_database_required'
  )
})

test('fallback budget validation requires the exact current month with remaining budget', () => {
  const currentMonthStart = monthStartInZurich()
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
        monthStart: monthStartInZurich(-1),
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
