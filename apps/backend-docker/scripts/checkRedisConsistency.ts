import { PrismaClient } from '@klicker-uzh/prisma'
import { Redis } from 'ioredis'

async function run() {
  const prisma = new PrismaClient()

  const redisExec = new Redis({
    family: 4,
    host: process.env.REDIS_HOST ?? 'localhost',
    password: process.env.REDIS_PASS ?? '',
    port: Number(process.env.REDIS_PORT) ?? 6379,
    tls: process.env.REDIS_TLS ? {} : undefined,
  })

  const sessions = await prisma.liveSession.findMany({
    where: {
      status: {
        not: 'RUNNING',
      },
    },
  })

  let count = 0

  for (const session of sessions) {
    const invalidKeys = await redisExec.keys(`s:${session.id}:*`)

    if (invalidKeys.length > 0) {
      count += invalidKeys.length
    }
  }

  console.log(count)
}

await run()
