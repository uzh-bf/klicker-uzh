import { describe, expect, it } from 'vitest'
import { formatDuration } from '../src/components/evaluation/adaptive/formatDuration'

describe('completion time in hours:minutes:seconds', () => {
  it.each([
    [0, '00:00:00'],
    [9, '00:00:09'],
    [59, '00:00:59'],
    [60, '00:01:00'],
    [99, '00:01:39'],
    [423.25, '00:07:03'],
    [59.5, '00:01:00'],
    [3599.5, '01:00:00'],
    [3600, '01:00:00'],
    [3661, '01:01:01'],
    [90061, '25:01:01'],
    [360000, '100:00:00'],
  ])('formats %s seconds as %s', (seconds, expected) => {
    expect(formatDuration(seconds)).toBe(expected)
  })
})
