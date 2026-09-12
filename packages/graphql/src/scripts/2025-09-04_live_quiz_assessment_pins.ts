import { prisma } from '@klicker-uzh/prisma'
import generatePassword from 'generate-password'

// ! IMPORTANT INFORMATION
// BEFORE DB MIGRATION: Run this script with the setting set to "NUMERICAL" to set numerical pins for all assessment quizzes
// (required due to a constraint introduced on the pin field and the assessment setting of the live quiz)
// AFTER DB MIGRATION: Re-run this script with the setting set to "ALPHANUMERIC" to set alphanumeric pins for all assessment quizzes

async function run() {
  // TODO: set the mode correctly here:
  const mode: 'NUMERICAL' | 'ALPHANUMERIC' = 'NUMERICAL'

  // get all live quizzes in assessment mode
  const liveQuizzes = await prisma.liveQuiz.findMany({
    where: { isAssessmentEnabled: true },
  })

  // set pins for all live quizzes
  for (const quiz of liveQuizzes) {
    if (mode === 'NUMERICAL') {
      await prisma.liveQuiz.update({
        where: { id: quiz.id },
        data: { pinCode: Math.floor(Math.random() * 9000) + 1000 },
      })
    } else {
      await prisma.liveQuiz.update({
        where: { id: quiz.id },
        data: {
          pinCode: generatePassword.generate({
            uppercase: true,
            lowercase: false,
            numbers: true,
            symbols: false,
            length: 6,
          }),
        },
      })
    }
  }
}

await run()
