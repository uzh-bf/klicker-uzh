import { prisma } from '@klicker-uzh/prisma'

import { seedInteractions } from '../data/interactions/index.js'

async function main() {
  // Fail closed against production; the pnpm wrapper pins Infisical to --env dev,
  // but a manual invocation could still override ENV.
  if (process.env.ENV === 'production') {
    console.error('[seedInteractions] refusing to run against ENV=production')
    process.exit(1)
  }
  const seed = process.env.ANALYTICS_SEED ?? undefined

  const started = Date.now()
  try {
    const result = await seedInteractions({ prisma, seed })
    const elapsed = ((Date.now() - started) / 1000).toFixed(1)

    console.log(`\n[seedInteractions] seed=${result.seed} elapsed=${elapsed}s`)
    for (const c of result.perCourse) {
      console.log(
        `  course=${c.courseId}` +
          ` participations+=${c.participations}` +
          ` responses=${c.responses.inserted}+${c.responses.updated}↻` +
          ` liveQuizResponses=${c.liveQuizResponses.inserted}+${c.liveQuizResponses.updated}↻ (${c.liveQuizResponses.quizzes} quizzes)` +
          ` chat=${c.chat.threads}t/${c.chat.messages}m`
      )
    }
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((err) => {
  console.error('[seedInteractions] FAILED:', err)
  process.exit(1)
})
