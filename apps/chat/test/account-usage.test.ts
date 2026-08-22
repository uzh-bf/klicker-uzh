import { describe, expect, test, vi } from 'vitest'

vi.mock('@klicker-uzh/prisma', () => ({ prisma: {} }))

import { roundChatUsageCredits } from '../src/services/accountUsage'

describe('account usage credit rounding', () => {
  test('rounds once to the persisted six-decimal precision', () => {
    expect(roundChatUsageCredits(0.1234564).toString()).toBe('0.123456')
    expect(roundChatUsageCredits(0.1234565).toString()).toBe('0.123457')
  })

  test.each([
    -1,
    Number.POSITIVE_INFINITY,
    Number.NaN,
  ])('rejects invalid usage value %s', (value) => {
    expect(() => roundChatUsageCredits(value)).toThrow(RangeError)
  })

  test('rejects the first value beyond Decimal(18,6)', () => {
    expect(() => roundChatUsageCredits(1e12)).toThrow(RangeError)
  })
})
