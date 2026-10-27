import { CreditResetPeriod } from '@klicker-uzh/prisma/client'
import {
  MAX_SIGNED_INT32,
  normalizeAndValidateCreditPolicy,
} from '../src/services/chatbotCreditPolicy.js'

describe('chatbot credit policy', () => {
  it('accepts a recurring policy with distinct values', () => {
    expect(
      normalizeAndValidateCreditPolicy({
        creditInitialCredits: 2,
        creditResetPeriod: CreditResetPeriod.MONTHLY,
        creditResetAmount: 3,
        creditMaxCredits: 8,
      })
    ).toEqual({
      creditInitialCredits: 2,
      creditResetPeriod: CreditResetPeriod.MONTHLY,
      creditResetAmount: 3,
      creditMaxCredits: 8,
    })
  })

  it('allows a zero allowance and normalizes NONE reset amount to zero', () => {
    expect(
      normalizeAndValidateCreditPolicy({
        creditInitialCredits: 0,
        creditResetPeriod: CreditResetPeriod.NONE,
        creditResetAmount: -99,
        creditMaxCredits: 0,
      })
    ).toEqual({
      creditInitialCredits: 0,
      creditResetPeriod: CreditResetPeriod.NONE,
      creditResetAmount: 0,
      creditMaxCredits: 0,
    })
  })

  it.each([
    {
      creditInitialCredits: -1,
      creditResetPeriod: CreditResetPeriod.NONE,
      creditResetAmount: 0,
      creditMaxCredits: 1,
    },
    {
      creditInitialCredits: 1,
      creditResetPeriod: CreditResetPeriod.WEEKLY,
      creditResetAmount: 0,
      creditMaxCredits: 1,
    },
    {
      creditInitialCredits: 2,
      creditResetPeriod: CreditResetPeriod.WEEKLY,
      creditResetAmount: 1,
      creditMaxCredits: 1,
    },
    {
      creditInitialCredits: 1,
      creditResetPeriod: CreditResetPeriod.WEEKLY,
      creditResetAmount: 2,
      creditMaxCredits: 1,
    },
    {
      creditInitialCredits: MAX_SIGNED_INT32 + 1,
      creditResetPeriod: CreditResetPeriod.NONE,
      creditResetAmount: 0,
      creditMaxCredits: MAX_SIGNED_INT32,
    },
  ])('rejects an invalid policy: %o', (policy) => {
    expect(() => normalizeAndValidateCreditPolicy(policy)).toThrow()
  })
})
