const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { Worker } = require('node:worker_threads')
const test = require('node:test')

const { AdmissionStore } = require('./warpbuild-admission.cjs')

const now = Date.parse('2026-01-01T12:00:00Z')
const policy = {
  windowId: 'synthetic-burst',
  expiresAt: '2026-01-01T14:00:00Z',
  controlSha: 'c'.repeat(40),
  maxSubmissions: 2,
  maxConcurrent: 1,
  budgetMicros: 2000000,
  reservationMicros: 1000000,
  accountLimitMicros: 10000000,
  historicalLiabilityMicros: 1000000,
  maxBillingAgeSeconds: 900,
  ticketSeconds: 300,
}
const identity = {
  runId: '100',
  runAttempt: '1',
  pullRequestNumber: '10',
  headSha: 'a'.repeat(40),
  baseSha: 'b'.repeat(40),
  controlSha: policy.controlSha,
}

function fixture(t, overrides = {}) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'admission-test-'))
  const filename = path.join(directory, 'state.sqlite')
  const store = new AdmissionStore(filename)
  store.initialize({ ...policy, ...overrides }, now)
  store.recordBilling(
    { observedAt: new Date(now).toISOString(), reportedMicros: 500000 },
    now
  )
  t.after(() => {
    store.close()
    fs.rmSync(directory, { recursive: true, force: true })
  })
  return { store, filename }
}

test('concurrent requests reserve one slot and restart preserves its identity', async (t) => {
  const { store, filename } = fixture(t)
  const modulePath = require.resolve('./warpbuild-admission.cjs')
  const requests = [identity, { ...identity, runId: '101' }]
  const results = await Promise.all(
    requests.map(
      (request) =>
        new Promise((resolve, reject) => {
          const worker = new Worker(
            `
      const { parentPort, workerData } = require('node:worker_threads')
      const { AdmissionStore } = require(workerData.modulePath)
      const store = new AdmissionStore(workerData.filename)
      parentPort.postMessage(store.reserve(workerData.request, workerData.now))
      store.close()
    `,
            { eval: true, workerData: { filename, modulePath, request, now } }
          )
          worker.once('message', resolve)
          worker.once('error', reject)
          worker.once('exit', (code) => {
            if (code) reject(new Error(`worker exited ${code}`))
          })
        })
    )
  )
  assert.equal(results.filter((result) => result.ticket).length, 1)
  assert.equal(store.status().reservedMicros, 1000000)
  assert.equal(store.status().submissions, 1)
  const accepted = results.find((result) => result.ticket).ticket
  const reopened = new AdmissionStore(filename)
  t.after(() => reopened.close())
  assert.deepEqual(
    reopened.reserve(
      requests.find((request) => request.runId === accepted.runId),
      now
    ),
    { ticket: accepted }
  )
  assert.equal(
    reopened.reserve(
      { ...identity, runId: accepted.runId, headSha: 'd'.repeat(40) },
      now
    ).reason,
    'identity-conflict'
  )
  assert.equal(reopened.status().submissions, 1)
})

test('only complete terminal reconciliation releases a hold and never resets count', (t) => {
  const { store } = fixture(t)
  store.reserve(identity, now)
  const receipt = {
    terminal: true,
    completeBilling: true,
    successful: true,
    actualMicros: 200000,
    receiptSha256: 'd'.repeat(64),
  }
  for (const change of [
    { terminal: false },
    { completeBilling: false },
    { actualMicros: -1 },
    { receiptSha256: '' },
  ]) {
    assert.throws(() =>
      store.reconcile(identity, { ...receipt, ...change }, now)
    )
    assert.equal(store.status().reservedMicros, 1000000)
  }
  store.reconcile(identity, receipt, now)
  store.reconcile(identity, receipt, now)
  assert.equal(store.status().reservedMicros, 0)
  assert.equal(store.status().spentMicros, 200000)
  assert.equal(store.reserve(identity, now).reason, 'already-settled')
  assert.ok(store.reserve({ ...identity, runId: '101' }, now).ticket)
  assert.throws(() =>
    store.reconcile({ ...identity, runId: '101' }, receipt, now)
  )
  store.reconcile(
    { ...identity, runId: '101' },
    { ...receipt, receiptSha256: 'f'.repeat(64) },
    now
  )
  assert.equal(
    store.reserve({ ...identity, runId: '102' }, now).reason,
    'count-exhausted'
  )
  assert.throws(() => store.initialize(policy, now))
})

test('failed correctness or an overrun disables further admission after reconciliation', (t) => {
  for (const change of [{ successful: false }, { actualMicros: 1000001 }]) {
    const { store } = fixture(t)
    store.reserve(identity, now)
    store.reconcile(
      identity,
      {
        terminal: true,
        completeBilling: true,
        successful: true,
        actualMicros: 100000,
        receiptSha256: 'e'.repeat(64),
        ...change,
      },
      now
    )
    assert.equal(store.status().disabled, true)
    assert.equal(
      store.reserve({ ...identity, runId: '102' }, now).reason,
      'disabled'
    )
  }
})

test('budget, account headroom, attempt and control boundaries deny without allocating', (t) => {
  const cases = [
    {
      policy: { budgetMicros: 1000000, maxConcurrent: 2 },
      first: true,
      request: { runId: '101' },
      reason: 'budget-exhausted',
    },
    { policy: { accountLimitMicros: 2000000 }, reason: 'headroom-exhausted' },
    { request: { runAttempt: '2' }, reason: 'retry-not-admitted' },
    { request: { controlSha: 'd'.repeat(40) }, reason: 'control-mismatch' },
  ]
  for (const item of cases) {
    const { store } = fixture(t, item.policy)
    if (item.first) assert.ok(store.reserve(identity, now).ticket)
    assert.equal(
      store.reserve({ ...identity, ...item.request }, now).reason,
      item.reason
    )
    assert.equal(store.status().submissions, item.first ? 1 : 0)
  }
})

test('expiry, stale billing and the kill switch retain existing exposure', (t) => {
  const { store } = fixture(t)
  store.reserve(identity, now)
  assert.equal(store.reserve(identity, now + 301000).reason, 'ticket-expired')
  assert.equal(
    store.reserve({ ...identity, runId: '101' }, now + 901000).reason,
    'billing-stale'
  )
  assert.equal(store.status().reservedMicros, 1000000)
  assert.throws(() =>
    store.recordBilling(
      {
        observedAt: new Date(now + 902000).toISOString(),
        reportedMicros: 499999,
      },
      now + 902000
    )
  )
  assert.throws(() => store.reserve(identity, now))
  store.disable(now + 902000)
  assert.equal(store.reserve(identity, now + 902000).reason, 'disabled')
  assert.equal(store.status().reservedMicros, 1000000)
  const other = fixture(t).store
  assert.equal(other.reserve(identity, now + 7200000).reason, 'window-expired')
})

test('invalid financial inputs and uninitialized state cannot authorize work', (t) => {
  const { store, filename } = fixture(t)
  for (const change of [{ runId: 100 }, { headSha: 'bad' }, { extra: true }]) {
    assert.throws(() => store.reserve({ ...identity, ...change }, now))
  }
  assert.equal(store.status().submissions, 0)
  const other = new AdmissionStore(
    path.join(path.dirname(filename), 'uninitialized.sqlite')
  )
  t.after(() => other.close())
  assert.throws(() => other.reserve(identity, now))
  for (const change of [
    { maxConcurrent: 3 },
    { reservationMicros: -1 },
    { budgetMicros: 0.5 },
    { maxBillingAgeSeconds: 901 },
    { ticketSeconds: 14401 },
    { expiresAt: 'invalid' },
  ]) {
    assert.throws(() => other.initialize({ ...policy, ...change }, now))
  }
  assert.throws(() =>
    store.recordBilling(
      { observedAt: new Date(now + 1000).toISOString(), reportedMicros: 1 },
      now
    )
  )
})

test('ledger refuses public files and symlinks', (t) => {
  const { filename } = fixture(t)
  const link = path.join(path.dirname(filename), 'alias.sqlite')
  fs.symlinkSync(filename, link)
  assert.throws(() => new AdmissionStore(link))
  const publicFile = path.join(path.dirname(filename), 'public.sqlite')
  fs.writeFileSync(publicFile, '', { mode: 0o644 })
  assert.throws(() => new AdmissionStore(publicFile))
})
