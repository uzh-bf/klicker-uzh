const fs = require('node:fs')
const path = require('node:path')
const { isDeepStrictEqual } = require('node:util')
const { DatabaseSync } = require('node:sqlite')

const IDENTITY_FIELDS = [
  'runId',
  'runAttempt',
  'pullRequestNumber',
  'headSha',
  'baseSha',
  'controlSha',
]

function integer(value, maximum = 1000000000000) {
  if (!Number.isSafeInteger(value) || value < 0 || value > maximum)
    throw new Error('invalid integer')
  return value
}

function timestamp(value) {
  if (
    typeof value !== 'string' ||
    !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{3})?Z$/.test(value) ||
    !Number.isFinite(Date.parse(value))
  ) {
    throw new Error('invalid timestamp')
  }
  return Date.parse(value)
}

function validateIdentity(identity) {
  if (
    !identity ||
    !isDeepStrictEqual(
      Object.keys(identity).sort(),
      [...IDENTITY_FIELDS].sort()
    )
  )
    throw new Error('invalid identity')
  for (const key of IDENTITY_FIELDS) {
    if (
      typeof identity[key] !== 'string' ||
      !(key.endsWith('Sha') ? /^[a-f0-9]{40}$/ : /^[1-9]\d{0,19}$/).test(
        identity[key]
      )
    )
      throw new Error('invalid identity')
  }
}

function validatePolicy(policy, now) {
  if (!Number.isSafeInteger(now) || now < 0) throw new Error('invalid clock')
  const fields = [
    'windowId',
    'expiresAt',
    'controlSha',
    'maxSubmissions',
    'maxConcurrent',
    'budgetMicros',
    'reservationMicros',
    'accountLimitMicros',
    'historicalLiabilityMicros',
    'maxBillingAgeSeconds',
    'ticketSeconds',
  ]
  if (!policy || !isDeepStrictEqual(Object.keys(policy).sort(), fields.sort()))
    throw new Error('invalid policy')
  if (
    typeof policy.windowId !== 'string' ||
    !/^[a-zA-Z0-9-]{1,80}$/.test(policy.windowId) ||
    typeof policy.controlSha !== 'string' ||
    !/^[a-f0-9]{40}$/.test(policy.controlSha)
  )
    throw new Error('invalid policy')
  const expiry = timestamp(policy.expiresAt)
  if (expiry <= now || expiry > now + 24 * 60 * 60 * 1000)
    throw new Error('invalid window')
  for (const key of [
    'budgetMicros',
    'reservationMicros',
    'accountLimitMicros',
    'historicalLiabilityMicros',
  ])
    integer(policy[key])
  if (
    !policy.reservationMicros ||
    policy.reservationMicros > policy.budgetMicros
  )
    throw new Error('invalid reservation')
  if (
    !integer(policy.maxSubmissions, 100) ||
    !integer(policy.maxConcurrent, 2) ||
    policy.maxConcurrent > policy.maxSubmissions
  )
    throw new Error('invalid count')
  if (
    !integer(policy.maxBillingAgeSeconds, 900) ||
    !integer(policy.ticketSeconds, 14400)
  )
    throw new Error('invalid freshness')
}

function totals(state) {
  const reservations = Object.values(state.reservations)
  const pending = reservations.filter((item) => !item.settlement)
  const reservedMicros = pending.reduce(
    (sum, item) => sum + item.reservedMicros,
    0
  )
  const spentMicros = reservations.reduce(
    (sum, item) => sum + (item.settlement?.actualMicros ?? 0),
    0
  )
  return {
    submissions: reservations.length,
    pending: pending.length,
    reservedMicros,
    spentMicros,
  }
}

class AdmissionStore {
  constructor(filename) {
    const parent = fs.statSync(path.dirname(filename))
    if (
      !parent.isDirectory() ||
      (parent.mode & 0o077) !== 0 ||
      parent.uid !== process.getuid()
    )
      throw new Error('ledger requires an owned private directory')
    try {
      fs.closeSync(fs.openSync(filename, 'ax', 0o600))
    } catch (error) {
      if (error.code !== 'EEXIST') throw error
    }
    const stat = fs.lstatSync(filename)
    if (
      !stat.isFile() ||
      stat.nlink !== 1 ||
      (stat.mode & 0o077) !== 0 ||
      stat.uid !== process.getuid()
    )
      throw new Error('ledger requires an owned private regular file')
    this.db = new DatabaseSync(filename)
    this.db.exec(
      'PRAGMA busy_timeout = 3000; PRAGMA synchronous = FULL; CREATE TABLE IF NOT EXISTS admission_state (id INTEGER PRIMARY KEY CHECK (id = 1), value TEXT NOT NULL)'
    )
  }

  close() {
    this.db.close()
  }

  transaction(update) {
    this.db.exec('BEGIN IMMEDIATE')
    try {
      const row = this.db
        .prepare('SELECT value FROM admission_state WHERE id = 1')
        .get()
      const state = row ? JSON.parse(row.value) : null
      const { next, result } = update(state)
      this.db
        .prepare(
          'INSERT INTO admission_state (id, value) VALUES (1, ?) ON CONFLICT(id) DO UPDATE SET value = excluded.value'
        )
        .run(JSON.stringify(next))
      this.db.exec('COMMIT')
      return result
    } catch (error) {
      this.db.exec('ROLLBACK')
      throw error
    }
  }

  initialize(policy, now = Date.now()) {
    validatePolicy(policy, now)
    return this.transaction((state) => {
      if (state)
        throw new Error('ledger already initialized; window cannot be reset')
      return {
        next: {
          schema: 1,
          policy,
          disabled: false,
          lastObservedAt: now,
          billing: null,
          reservations: {},
        },
        result: undefined,
      }
    })
  }

  change(now, update) {
    if (!Number.isSafeInteger(now) || now < 0) throw new Error('invalid clock')
    return this.transaction((state) => {
      if (state?.schema !== 1) throw new Error('ledger not initialized')
      if (now < state.lastObservedAt) throw new Error('clock moved backwards')
      state.lastObservedAt = now
      return { next: state, result: update(state) }
    })
  }

  recordBilling(billing, now = Date.now()) {
    const observedAt = timestamp(billing.observedAt)
    integer(billing.reportedMicros)
    if (observedAt > now) throw new Error('future billing observation')
    return this.change(now, (state) => {
      if (
        state.billing &&
        (observedAt <= timestamp(state.billing.observedAt) ||
          billing.reportedMicros < state.billing.reportedMicros)
      )
        throw new Error('billing observation regressed')
      state.billing = {
        observedAt: billing.observedAt,
        reportedMicros: billing.reportedMicros,
      }
    })
  }

  disable(now = Date.now()) {
    return this.change(now, (state) => {
      state.disabled = true
    })
  }

  reserve(identity, now = Date.now()) {
    validateIdentity(identity)
    return this.change(now, (state) => {
      const { policy } = state
      const key = `${identity.runId}:${identity.runAttempt}`
      const previous = state.reservations[key]
      if (previous && !isDeepStrictEqual(previous.identity, identity))
        return { reason: 'identity-conflict' }
      if (state.disabled) return { reason: 'disabled' }
      if (now >= timestamp(policy.expiresAt))
        return { reason: 'window-expired' }
      if (identity.controlSha !== policy.controlSha)
        return { reason: 'control-mismatch' }
      if (
        !state.billing ||
        now - timestamp(state.billing.observedAt) >
          policy.maxBillingAgeSeconds * 1000
      )
        return { reason: 'billing-stale' }
      if (previous) {
        if (previous.settlement) return { reason: 'already-settled' }
        if (timestamp(previous.ticket.expiresAt) <= now)
          return { reason: 'ticket-expired' }
        return { ticket: previous.ticket }
      }
      // A new attempt needs new named authority; a burst never retries a run.
      if (
        identity.runAttempt !== '1' ||
        Object.values(state.reservations).some(
          (item) => item.identity.runId === identity.runId
        )
      )
        return { reason: 'retry-not-admitted' }
      const usage = totals(state)
      if (usage.submissions >= policy.maxSubmissions)
        return { reason: 'count-exhausted' }
      if (usage.pending >= policy.maxConcurrent)
        return { reason: 'concurrency-exhausted' }
      const exposure =
        usage.reservedMicros + usage.spentMicros + policy.reservationMicros
      if (exposure > policy.budgetMicros) return { reason: 'budget-exhausted' }
      // Settled window charges may also occur in reported spend. Counting both
      // is conservative and avoids releasing exposure on an incomplete snapshot.
      if (
        state.billing.reportedMicros +
          policy.historicalLiabilityMicros +
          exposure >
        policy.accountLimitMicros
      )
        return { reason: 'headroom-exhausted' }
      const ticket = {
        ...identity,
        expiresAt: new Date(
          Math.min(
            // Keep a minute of clock margin below the client's four-hour bound.
            now + Math.min(policy.ticketSeconds, 14340) * 1000,
            timestamp(policy.expiresAt)
          )
        ).toISOString(),
      }
      state.reservations[key] = {
        identity,
        ticket,
        reservedMicros: policy.reservationMicros,
        settlement: null,
      }
      return { ticket }
    })
  }

  status() {
    const row = this.db
      .prepare('SELECT value FROM admission_state WHERE id = 1')
      .get()
    if (!row) throw new Error('ledger not initialized')
    const state = JSON.parse(row.value)
    return {
      windowId: state.policy.windowId,
      disabled: state.disabled,
      ...totals(state),
    }
  }

  // Only the local operator interface may attest a private evidence receipt.
  // The preparation endpoint never exposes settlement or ledger administration.
  reconcile(identity, receipt, now = Date.now()) {
    validateIdentity(identity)
    const fields = [
      'terminal',
      'completeBilling',
      'successful',
      'actualMicros',
      'receiptSha256',
    ]
    if (
      !receipt ||
      !isDeepStrictEqual(Object.keys(receipt).sort(), fields.sort()) ||
      receipt.terminal !== true ||
      receipt.completeBilling !== true ||
      typeof receipt.successful !== 'boolean' ||
      !/^[a-f0-9]{64}$/.test(receipt.receiptSha256)
    )
      throw new Error('complete terminal evidence required')
    integer(receipt.actualMicros)
    return this.change(now, (state) => {
      const reservation =
        state.reservations[`${identity.runId}:${identity.runAttempt}`]
      if (!reservation || !isDeepStrictEqual(reservation.identity, identity))
        throw new Error('unknown reservation')
      if (
        reservation.settlement &&
        !isDeepStrictEqual(reservation.settlement, receipt)
      )
        throw new Error('settlement conflict')
      if (
        Object.values(state.reservations).some(
          (other) =>
            other !== reservation &&
            other.settlement?.receiptSha256 === receipt.receiptSha256
        )
      )
        throw new Error('receipt already used for another reservation')
      reservation.settlement = receipt
      if (
        !receipt.successful ||
        receipt.actualMicros > reservation.reservedMicros
      )
        state.disabled = true
    })
  }
}

module.exports = { AdmissionStore, validateIdentity }
