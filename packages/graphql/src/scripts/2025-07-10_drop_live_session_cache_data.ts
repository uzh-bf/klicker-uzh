import { Redis } from 'ioredis'

// ? This script removes all redis cache entries that are related to live sessions (and not the new live quiz)
async function run() {
  const redisExec = new Redis({
    family: 4,
    host: process.env.REDIS_HOST ?? 'localhost',
    password: process.env.REDIS_PASS ?? '',
    port: Number(process.env.REDIS_PORT) ?? 6379,
    tls: process.env.REDIS_TLS ? {} : undefined,
  })

  // drop all live session redis cache entries starting with 's:'
  const keys = await redisExec.keys('s:*')
  console.log(`Deleting ${keys.length} keys:`)
  console.log(keys)

  // TODO: uncomment this line to execute redis pipeline
  // await redisExec.del(...keys)

  redisExec.quit()
}

await run()
