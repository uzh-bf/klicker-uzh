import { describe, expect, test } from 'vitest'
import {
  creditPercent,
  formatCredits,
} from '../src/components/thread-credits-format'

describe('formatCredits', () => {
  test('keeps the zeros of whole numbers', () => {
    expect(formatCredits(10)).toBe('10')
    expect(formatCredits(100)).toBe('100')
    expect(formatCredits(1)).toBe('1')
  })

  test('trims only a fractional tail', () => {
    expect(formatCredits(1.0)).toBe('1')
    expect(formatCredits(0.5)).toBe('0.5')
    // a fractional tail that rounds to trailing zeros still collapses
    expect(formatCredits(0.0999)).toBe('0.1')
  })

  test('renders values of 1 or more as whole numbers', () => {
    // values >= 1 are formatted with zero decimals by design; 1.2 rounds down
    expect(formatCredits(1.2)).toBe('1')
    expect(formatCredits(9.6)).toBe('10')
  })

  test('keeps the first significant digit of small values', () => {
    expect(formatCredits(0.009)).toBe('0.009')
    expect(formatCredits(0.05)).toBe('0.05')
  })

  test('handles zero and non-finite input', () => {
    expect(formatCredits(0)).toBe('0')
    expect(formatCredits(Number.NaN)).toBe('0')
    expect(formatCredits(Number.POSITIVE_INFINITY)).toBe('0')
  })
})

describe('creditPercent', () => {
  test('shows a full budget as 100', () => {
    expect(creditPercent(3, 3)).toBe(100)
  })

  test('rounds down so it never overstates what is left', () => {
    expect(creditPercent(2.98, 3)).toBe(99)
    expect(creditPercent(2.999, 3)).toBe(99)
    expect(creditPercent(1.5, 3)).toBe(50)
    expect(creditPercent(0.0049, 3)).toBe(0)
  })

  test('absorbs floating-point error at exact steps', () => {
    // 2.97 / 3 * 100 is 98.99999999999999 in binary floating point
    expect(creditPercent(2.97, 3)).toBe(99)
    expect(creditPercent(0.29, 1)).toBe(29)
  })

  test('clamps to 0-100 and handles an empty or invalid budget', () => {
    expect(creditPercent(0, 3)).toBe(0)
    expect(creditPercent(-1, 3)).toBe(0)
    expect(creditPercent(4, 3)).toBe(100)
    expect(creditPercent(1, 0)).toBe(0)
    expect(creditPercent(Number.NaN, 3)).toBe(0)
  })
})
