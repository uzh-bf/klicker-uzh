import * as DB from '@klicker-uzh/prisma/client'
import { GraphQLError } from 'graphql'

export const MAX_SIGNED_INT32 = 2_147_483_647

export type ChatbotCreditPolicy = {
  creditInitialCredits: number
  creditResetPeriod: DB.CreditResetPeriod
  creditResetAmount: number
  creditMaxCredits: number
}

function invalidCreditPolicy(message: string) {
  return new GraphQLError(message, {
    extensions: { code: 'BAD_USER_INPUT' },
  })
}

export function normalizeAndValidateCreditPolicy(
  policy: ChatbotCreditPolicy
): ChatbotCreditPolicy {
  const isNonNegativeSignedInt32 = (value: unknown): value is number =>
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= 0 &&
    value <= MAX_SIGNED_INT32

  if (!Object.values(DB.CreditResetPeriod).includes(policy.creditResetPeriod)) {
    throw invalidCreditPolicy('Invalid chatbot credit reset period')
  }

  const normalizedPolicy = {
    ...policy,
    creditResetAmount:
      policy.creditResetPeriod === DB.CreditResetPeriod.NONE
        ? 0
        : policy.creditResetAmount,
  }

  if (
    !isNonNegativeSignedInt32(normalizedPolicy.creditInitialCredits) ||
    !isNonNegativeSignedInt32(normalizedPolicy.creditResetAmount) ||
    !isNonNegativeSignedInt32(normalizedPolicy.creditMaxCredits)
  ) {
    throw invalidCreditPolicy(
      'Chatbot credit amounts must be non-negative signed 32-bit integers'
    )
  }

  if (normalizedPolicy.creditInitialCredits > policy.creditMaxCredits) {
    throw invalidCreditPolicy(
      'Initial chatbot credits must not exceed maximum credits'
    )
  }
  if (normalizedPolicy.creditResetAmount > policy.creditMaxCredits) {
    throw invalidCreditPolicy(
      'Chatbot reset amount must not exceed maximum credits'
    )
  }
  if (
    normalizedPolicy.creditResetPeriod !== DB.CreditResetPeriod.NONE &&
    normalizedPolicy.creditResetAmount < 1
  ) {
    throw invalidCreditPolicy(
      'Chatbot reset amount must be positive when resets are enabled'
    )
  }

  return normalizedPolicy
}
