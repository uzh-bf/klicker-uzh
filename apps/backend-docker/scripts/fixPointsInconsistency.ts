// pn exec:prod scripts/fixPointsInconsistency.ts

import { PrismaClient } from '@klicker-uzh/prisma'
import { Redis } from 'ioredis'
const prisma = new PrismaClient()

const redisExec = new Redis({
  family: 4,
  host: process.env.REDIS_HOST ?? 'localhost',
  password: process.env.REDIS_PASS ?? '',
  port: Number(process.env.REDIS_PORT) ?? 6379,
  tls: process.env.REDIS_TLS ? {} : undefined,
})

// deduct points from course leaderboard entries: 1x points in quizLB
const FAILURES = 1

const COURSE_ID = ''
const QUIZ_ID = ''

const quizLB = await redisExec.hgetall(`s:${QUIZ_ID}:lb`)
const quizXP = await redisExec.hgetall(`s:${QUIZ_ID}:xp`)

const results = await Promise.allSettled(
  Object.entries(quizLB).map(async ([participantId, score]) => {
    const lbEntry = await prisma.leaderboardEntry.findFirst({
      where: {
        participantId,
        type: 'COURSE',
        courseId: COURSE_ID,
      },
    })

    if (!lbEntry) {
      console.log('no leaderboard entry found for', participantId)
    } else {
      const adjustedScore = lbEntry.score - parseInt(score) * FAILURES

      console.log('score adjustment', lbEntry.score, '->', adjustedScore)

      // await prisma.leaderboardEntry.update({
      //   where: {
      //     id: lbEntry.id,
      //   },
      //   data: {
      //     score: adjustedScore,
      //   },
      // })
    }
  })
)

console.log(results)

process.exit(0)
