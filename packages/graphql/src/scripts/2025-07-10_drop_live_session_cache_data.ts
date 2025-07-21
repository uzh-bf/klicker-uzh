import { Redis } from 'ioredis'

// ! This script removes all redis cache entries that are related to live sessions (and not the new live quiz)
async function run() {
  const redisExec = new Redis({
    family: 4,
    host: process.env.REDIS_HOST ?? 'localhost',
    password: process.env.REDIS_PASS ?? '',
    port: Number(process.env.REDIS_PORT) ?? 6379,
    tls: process.env.REDIS_TLS ? {} : undefined,
  })

  // drop all live session redis cache entries starting with 's:'
  const keys: string[] = []
  let cursor = '0'

  do {
    const result = await redisExec.scan(cursor, 'MATCH', 's:*', 'COUNT', 100)
    cursor = result[0]
    keys.push(...result[1])
  } while (cursor !== '0')

  console.log(`Deleting ${keys.length} keys:`)
  console.log(keys)

  // verify that every string starts with 's:'
  for (const key of keys) {
    if (!key.startsWith('s:')) {
      console.log(`Deleting key: ${key}`)
      throw new Error(`Key does not start with 's:', aborting deletion`)
    }
  }

  // ! delete the keys to remove them from redis asynchronously (in batches)
  const batchSize = 1000
  for (let i = 0; i < keys.length; i += batchSize) {
    const batch = keys.slice(i, i + batchSize)
    if (batch.length > 0) {
      await redisExec.del(...batch)
      console.log(`Deleted batch of ${batch.length} keys`)
    }
  }

  redisExec.quit()
}

await run()
