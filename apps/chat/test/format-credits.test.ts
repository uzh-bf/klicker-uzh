import { describe, expect, test } from 'vitest'
import { formatCredits } from '../src/components/thread-credits-format'

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
