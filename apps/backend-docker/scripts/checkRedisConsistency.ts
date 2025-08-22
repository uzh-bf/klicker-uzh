import { PrismaClient, PublicationStatus } from '@klicker-uzh/prisma'
import { PrismaPg } from '@prisma/adapter-pg'
import { Redis } from 'ioredis'

async function run() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })
  const prisma = new PrismaClient({ adapter })

  const redisExec = new Redis({
    family: 4,
    host: process.env.REDIS_HOST ?? 'localhost',
    password: process.env.REDIS_PASS ?? '',
    port: Number(process.env.REDIS_PORT) ?? 6379,
    tls: process.env.REDIS_TLS ? {} : undefined,
  })

  const quizzes = await prisma.liveQuiz.findMany({
    where: {
      status: {
        not: PublicationStatus.PUBLISHED,
      },
    },
  })

  let count = 0

  for (const quiz of quizzes) {
    const invalidKeys = await redisExec.keys(`lq:${quiz.id}:*`)

    if (invalidKeys.length > 0) {
      count += invalidKeys.length
    }
  }

  console.log(count)
}

await run()
