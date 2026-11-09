import { describe, expect, it } from 'vitest'
import { retentionBatchFor } from '../src/media/retention-horizon.js'

describe('assessment evidence retention calendar', () => {
  it.each([
    ['2026-03-01T00:00:00.000Z', '2027-03-01T00:00:00.000Z'],
    ['2026-03-01T00:00:00.001Z', '2027-10-01T00:00:00.000Z'],
    ['2026-09-30T23:59:59.999Z', '2027-10-01T00:00:00.000Z'],
    ['2026-10-01T00:00:00.000Z', '2027-10-01T00:00:00.000Z'],
    ['2024-02-29T12:00:00.000Z', '2025-03-01T00:00:00.000Z'],
  ])('maps %s to %s', (anchor, expected) => {
    expect(retentionBatchFor(new Date(anchor)).toISOString()).toBe(expected)
  })

  it('rejects invalid anchors', () => {
    expect(() => retentionBatchFor(new Date(Number.NaN))).toThrow(
      'retention anchor must be a valid date'
    )
  })
})
