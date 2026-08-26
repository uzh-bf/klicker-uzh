import { describe, expect, it } from 'vitest'
import {
  applyCourseStartDelta,
  getCourseStartDayDelta,
} from '../src/services/courseDuplication.js'

describe('getCourseStartDayDelta', () => {
  it('returns the exact day difference for aligned timestamps', () => {
    const oldStart = new Date('2026-02-16T23:00:00.000Z')
    const newStart = new Date('2026-04-16T23:00:00.000Z')

    expect(getCourseStartDayDelta(newStart, oldStart)).toEqual(59)
  })

  it('computes local calendar days across a DST transition', () => {
    // local midnight Europe/Zurich: 17 Feb 2026 00:00 CET -> 19 Oct 2026 00:00 CEST
    // exact difference is 243.958 days; truncation would shift activities a day early
    const oldStart = new Date('2026-02-16T23:00:00.000Z')
    const newStart = new Date('2026-10-18T22:00:00.000Z')

    expect(getCourseStartDayDelta(newStart, oldStart)).toEqual(244)
  })

  it('uses the local calendar date for legacy non-midnight starts', () => {
    const oldStart = new Date('2025-09-01T08:00:00.000Z')
    const newStart = new Date('2026-09-01T00:00:00.000Z')

    expect(getCourseStartDayDelta(newStart, oldStart)).toEqual(365)
  })

  it('supports negative deltas when duplicating to an earlier start', () => {
    const oldStart = new Date('2026-10-18T22:00:00.000Z')
    const newStart = new Date('2026-02-16T23:00:00.000Z')

    expect(getCourseStartDayDelta(newStart, oldStart)).toEqual(-244)
  })
})

describe('applyCourseStartDelta', () => {
  it('shifts activity dates by the given number of days', () => {
    const scheduledStartAt = new Date('2026-03-02T07:00:00.000Z')

    expect(applyCourseStartDelta(scheduledStartAt, 244)).toEqual(
      new Date('2026-11-01T07:00:00.000Z')
    )
  })

  it('preserves the Zurich wall clock from winter to summer', () => {
    const originalTimezone = process.env.TZ
    process.env.TZ = 'UTC'

    try {
      const scheduledStartAt = new Date('2026-03-02T07:00:00.000Z')

      expect(applyCourseStartDelta(scheduledStartAt, 59)).toEqual(
        new Date('2026-04-30T06:00:00.000Z')
      )
    } finally {
      if (originalTimezone) {
        process.env.TZ = originalTimezone
      } else {
        delete process.env.TZ
      }
    }
  })
})
