import type { PrismaClient } from '@klicker-uzh/prisma/client'
import generatePassword from 'generate-password'

const LIVE_QUIZ_PIN_ALLOCATION_ATTEMPTS = 10

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
