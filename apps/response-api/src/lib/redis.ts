import { Redis } from 'ioredis'
import { env } from './env.js'

let client: Redis | null = null

export function getRedis(): Redis {
  if (client) return client
  client = new Redis({
    family: 4,
    host: env.REDIS_HOST,
    password: env.REDIS_PASS ?? '',
    port: env.REDIS_PORT ?? 6379,
    tls: env.REDIS_TLS ? {} : undefined,
    lazyConnect: false,
  })
  client.on('error', () => {})
  return client
}

export async function pingRedis(timeoutMs = 250): Promise<boolean> {
  const r = getRedis()
  try {
    const res = await Promise.race([
      r.ping(),
      new Promise<string>((_, rej) =>
        setTimeout(() => rej(new Error('timeout')), timeoutMs)
      ),
    ])
    return res === 'PONG'
  } catch {
    return false
  }
}

export async function quitRedis(): Promise<void> {
  if (client) {
    try {
      await client.quit()
    } catch {
    } finally {
      client = null
    }
  }
}
