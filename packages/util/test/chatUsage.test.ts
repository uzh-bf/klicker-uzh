import { describe, expect, it } from 'vitest'
import {
  getDefaultChatAccountUsage,
  getZurichMonthEnd,
  getZurichMonthReset,
  getZurichMonthStart,
  parseChatUsageCredits,
} from '../src/chatUsage.js'

describe('chat usage month boundary (Europe/Zurich)', () => {
  it('maps a mid-month Zurich instant to the first calendar day', () => {
    // 2026-03-15 12:34 UTC is 13:34 in Zurich (CET, UTC+1).
    expect(getZurichMonthStart(new Date('2026-03-15T12:34:00Z'))).toEqual(
      new Date('2026-03-01T00:00:00Z')
    )
  })

  it('maps a late UTC evening that is already the next Zurich day', () => {
    // 2026-05-01 23:00 UTC is 2026-05-02 in Zurich (CEST, UTC+2); the month
    // key is still the first day of that month.
    expect(getZurichMonthStart(new Date('2026-05-01T23:00:00Z'))).toEqual(
      new Date('2026-05-01T00:00:00Z')
    )
  })

  it('derives the reset instant across the spring DST shift', () => {
    // 2026-03-29 02:00 CET jumps to 03:00 CEST; the month key is 2026-03-01.
    expect(getZurichMonthStart(new Date('2026-03-28T23:00:00Z'))).toEqual(
      new Date('2026-03-01T00:00:00Z')
    )
    expect(getZurichMonthEnd(new Date('2026-03-01T00:00:00Z'))).toEqual(
      new Date('2026-03-31T22:00:00Z') // 2026-04-01 00:00 CEST == 2026-03-31 22:00 UTC
    )
  })

  it('derives the reset instant across the fall DST jump', () => {
    // 2026-10-25 03:00 CEST falls back to 02:00 CET.
    expect(getZurichMonthEnd(new Date('2026-10-01T00:00:00Z'))).toEqual(
      new Date('2026-10-31T23:00:00Z') // 2026-11-01 00:00 CET == 2026-10-31 23:00 UTC
    )
  })

  it('resets at the start of the following month for a given now', () => {
    const now = new Date('2026-07-15T10:00:00Z')
    expect(getZurichMonthReset(now)).toEqual(
      new Date('2026-07-31T22:00:00Z') // 2026-08-01 00:00 CEST == 2026-07-31 22:00 UTC
    )
  })
})

describe('chat usage credit validation', () => {
  it('accepts non-negative values with at most six decimals', () => {
    expect(parseChatUsageCredits(0)).toBe(0)
    expect(parseChatUsageCredits(12.5)).toBe(12.5)
    expect(parseChatUsageCredits(0.000001)).toBe(0.000001)
    expect(parseChatUsageCredits(999999999999.99)).toBe(999999999999.99)
  })

  it('rejects negative values', () => {
    expect(parseChatUsageCredits(-1)).toBeNull()
    expect(parseChatUsageCredits(-0.000001)).toBeNull()
  })

  it('rejects malformed values', () => {
    expect(parseChatUsageCredits('12.5')).toBeNull()
    expect(parseChatUsageCredits(undefined)).toBeNull()
    expect(parseChatUsageCredits(NaN)).toBeNull()
    expect(parseChatUsageCredits(Infinity)).toBeNull()
    expect(parseChatUsageCredits(12.1234567)).toBeNull()
    expect(parseChatUsageCredits(1e12)).toBeNull()
  })
})

describe('default chat account usage', () => {
  it('projects zero budget and zero used credits for a missing row', () => {
    expect(getDefaultChatAccountUsage()).toEqual({
      budgetCredits: 0,
      usedCredits: 0,
    })
  })
})
