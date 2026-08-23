import { describe, expect, it } from 'vitest'

import {
  applyQualifiedDate,
  FREEZE_BALANCE_MAX,
  FREEZE_EARN_THRESHOLD,
  QUALIFIED_RESPONSES_PER_DAY,
} from '../src/services/studyStreak.js'

const initialState = (): Parameters<typeof applyQualifiedDate>[0] => ({
  current: 0,
  longest: 0,
  freezeBalance: 2,
  qualifiedDaysSinceFreeze: 0,
  lastQualifiedDate: null,
  lastProcessedDate: null,
})

describe('constants', () => {
  it('uses the approved thresholds', () => {
    expect(QUALIFIED_RESPONSES_PER_DAY).toBe(5)
    expect(FREEZE_EARN_THRESHOLD).toBe(7)
    expect(FREEZE_BALANCE_MAX).toBe(3)
  })
})

describe('applyQualifiedDate', () => {
  it('starts a streak on the first weekday response date', () => {
    const result = applyQualifiedDate(initialState(), '2026-08-24') // Monday
    expect(result.current).toBe(1)
    expect(result.longest).toBe(1)
    expect(result.lastQualifiedDate).toBe('2026-08-24')
    expect(result.qualifiedDaysSinceFreeze).toBe(1)
  })

  it('ignores dates at or before the last processed date', () => {
    let state = applyQualifiedDate(initialState(), '2026-08-24')
    state = applyQualifiedDate(state, '2026-08-24') // same day again
    expect(state.current).toBe(1)
  })

  it('treats a Saturday as neutral (no advance, no break)', () => {
    let state = applyQualifiedDate(initialState(), '2026-08-24') // Monday
    state = applyQualifiedDate(state, '2026-08-29') // Saturday
    expect(state.current).toBe(1)
    expect(state.longest).toBe(1)
    expect(state.lastQualifiedDate).toBe('2026-08-24')
    expect(state.lastProcessedDate).toBe('2026-08-29')
    expect(state.freezeBalance).toBe(2)
  })

  it('advances across a weekend without consuming freezes', () => {
    let state = applyQualifiedDate(initialState(), '2026-08-28') // Friday
    state = applyQualifiedDate(state, '2026-08-31') // Monday after weekend
    expect(state.current).toBe(2)
    expect(state.freezeBalance).toBe(2)
  })

  it('breaks the streak after missed weekdays with zero balance', () => {
    const state0 = { ...initialState(), freezeBalance: 0 }
    let state = applyQualifiedDate(state0, '2026-08-24') // Monday
    state = applyQualifiedDate(state, '2026-08-27') // Thursday
    expect(state.current).toBe(1)
    expect(state.longest).toBe(1)
    expect(state.freezeBalance).toBe(0)
  })

  it('consumes one freeze for one missed weekday', () => {
    let state = applyQualifiedDate(initialState(), '2026-08-24') // Monday
    expect(state.freezeBalance).toBe(2)
    state = applyQualifiedDate(state, '2026-08-26') // Wednesday
    expect(state.current).toBe(2)
    expect(state.freezeBalance).toBe(1)
  })

  it('consumes two freezes for two missed weekdays', () => {
    let state = applyQualifiedDate(initialState(), '2026-08-24') // Monday
    state = applyQualifiedDate(state, '2026-08-27') // Thursday
    expect(state.current).toBe(2)
    expect(state.freezeBalance).toBe(0)
  })

  it('resets when more weekdays are missed than freezes cover', () => {
    const lowBalance = { ...initialState(), freezeBalance: 1 }
    let state = applyQualifiedDate(lowBalance, '2026-08-24') // Monday
    state = applyQualifiedDate(state, '2026-08-28') // Friday
    expect(state.current).toBe(1)
    expect(state.freezeBalance).toBe(0)
  })

  it('earns a freeze after seven qualified days below max balance', () => {
    let state = initialState()
    const dates = [
      '2026-08-24',
      '2026-08-25',
      '2026-08-26',
      '2026-08-27',
      '2026-08-28',
      '2026-08-31',
      '2026-09-01',
    ]
    for (const d of dates) {
      state = applyQualifiedDate(state, d)
    }
    expect(state.qualifiedDaysSinceFreeze).toBe(0)
    expect(state.freezeBalance).toBe(FREEZE_BALANCE_MAX)
  })

  it('does not exceed the maximum freeze balance', () => {
    const atMax = { ...initialState(), freezeBalance: FREEZE_BALANCE_MAX }
    const result = applyQualifiedDate(atMax, '2026-08-24')
    expect(result.freezeBalance).toBe(FREEZE_BALANCE_MAX)
  })
})
