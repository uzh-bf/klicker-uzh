import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { getEscapeRoomLockoutRemainingSeconds } from './escapeRoomLockout'

const SIX_HOURS_MS = 6 * 60 * 60 * 1000
const STARTED_AT = '2026-01-01T10:00:00.000Z'
const startedAtMs = new Date(STARTED_AT).getTime()

// The attempt was fetched 100 s after it started; the server locked the
// participant out until 20 s after that fetch.
const base = {
  startedAt: STARTED_AT,
  timeLimit: 1800,
  remainingSeconds: 1700,
  lockoutSeconds: 30,
  lockoutUntil: new Date(startedAtMs + 120_000).toISOString(),
}

describe('escape room lockout remaining', () => {
  it('counts down from the server snapshot', () => {
    assert.equal(
      getEscapeRoomLockoutRemainingSeconds({
        ...base,
        receivedAtMs: 5_000,
        nowMs: 5_000,
      }),
      20
    )
    assert.equal(
      getEscapeRoomLockoutRemainingSeconds({
        ...base,
        receivedAtMs: 5_000,
        nowMs: 12_000,
      }),
      13
    )
  })

  it('ignores a device clock running ahead or behind', () => {
    for (const skewMs of [SIX_HOURS_MS, -SIX_HOURS_MS]) {
      assert.equal(
        getEscapeRoomLockoutRemainingSeconds({
          ...base,
          receivedAtMs: Date.now() + skewMs,
          nowMs: Date.now() + skewMs + 5_000,
        }),
        15
      )
    }
  })

  it('returns zero without a lockout', () => {
    assert.equal(
      getEscapeRoomLockoutRemainingSeconds({
        ...base,
        lockoutUntil: null,
        receivedAtMs: 0,
        nowMs: 0,
      }),
      0
    )
  })

  it('returns zero once the lockout has expired', () => {
    assert.equal(
      getEscapeRoomLockoutRemainingSeconds({
        ...base,
        receivedAtMs: 0,
        nowMs: 25_000,
      }),
      0
    )
    assert.equal(
      getEscapeRoomLockoutRemainingSeconds({
        ...base,
        remainingSeconds: 1500,
        receivedAtMs: 0,
        nowMs: 0,
      }),
      0
    )
  })

  it('clamps to the configured lockout', () => {
    assert.equal(
      getEscapeRoomLockoutRemainingSeconds({
        ...base,
        lockoutUntil: new Date(startedAtMs + 600_000).toISOString(),
        receivedAtMs: 0,
        nowMs: 0,
      }),
      30
    )
  })
})
