import type { PrismaClient } from '@klicker-uzh/prisma/client'
import generatePassword from 'generate-password'

const LIVE_QUIZ_PIN_ALLOCATION_ATTEMPTS = 10
const LIVE_QUIZ_PIN_TRANSACTION_RETRY_ATTEMPTS = 3

export function isLiveQuizPinConflict(error: unknown) {
  if (
    typeof error !== 'object' ||
    error === null ||
    !('code' in error) ||
    error.code !== 'P2002'
  ) {
    return false
  }

  const target =
    'meta' in error &&
    typeof error.meta === 'object' &&
    error.meta !== null &&
    'target' in error.meta
      ? error.meta.target
      : null
  return Array.isArray(target)
    ? target.includes('pinCode')
    : typeof target === 'string' && target.includes('pinCode')
}

export async function withLiveQuizPinRetry<T>(
  operation: () => Promise<T>
): Promise<T> {
  for (
    let attempt = 0;
    attempt < LIVE_QUIZ_PIN_TRANSACTION_RETRY_ATTEMPTS;
    attempt++
  ) {
    try {
      return await operation()
    } catch (error) {
      if (
        !isLiveQuizPinConflict(error) ||
        attempt === LIVE_QUIZ_PIN_TRANSACTION_RETRY_ATTEMPTS - 1
      ) {
        throw error
      }
    }
  }

  throw new Error('Live quiz PIN allocation retries exhausted')
}

export async function allocateLiveQuizPin({
  database,
}: {
  database: Pick<PrismaClient, 'liveQuiz'>
}) {
  for (
    let attempt = 0;
    attempt < LIVE_QUIZ_PIN_ALLOCATION_ATTEMPTS;
    attempt++
  ) {
    const pinCode = generatePassword.generate({
      uppercase: true,
      lowercase: false,
      numbers: true,
      symbols: false,
      length: 6,
    })
    const existingLiveQuiz = await database.liveQuiz.findUnique({
      where: { pinCode },
      select: { id: true },
    })
    if (!existingLiveQuiz) return pinCode
  }

  throw new Error('Could not find available pin code for live quiz')
}
