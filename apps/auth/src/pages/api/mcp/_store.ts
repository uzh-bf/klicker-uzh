import Redis from 'ioredis'

export type CodeRecord = {
  jwt: string
  codeChallenge: string
  codeChallengeMethod: string
  redirectUri: string
  clientId: string
  createdAt: number
}

const CODE_TTL_SECONDS = 60
const CODE_KEY_PREFIX = 'mcp:oauth:code:'

let redisClient: Redis | null = null

function getRedisClient(): Redis {
  if (redisClient) return redisClient

  const host = process.env.REDIS_CACHE_HOST
  const port = Number(process.env.REDIS_CACHE_PORT ?? 6379)

  if (!host) {
    throw new Error('REDIS_CACHE_HOST is required for MCP OAuth code storage')
  }
  if (!Number.isInteger(port) || port <= 0) {
    throw new Error('REDIS_CACHE_PORT must be a positive integer')
  }

  redisClient = new Redis({
    host,
    port,
    password: process.env.REDIS_CACHE_PASS || undefined,
    tls: process.env.REDIS_CACHE_TLS === 'true' ? {} : undefined,
    lazyConnect: true,
  })

  return redisClient
}

export async function putCode(
  code: string,
  record: Omit<CodeRecord, 'createdAt'>
): Promise<void> {
  const result = await getRedisClient().set(
    `${CODE_KEY_PREFIX}${code}`,
    JSON.stringify({ ...record, createdAt: Date.now() }),
    'EX',
    CODE_TTL_SECONDS,
    'NX'
  )

  if (result !== 'OK') {
    throw new Error('Could not store MCP OAuth code')
  }
}

export async function popCode(code: string): Promise<CodeRecord | null> {
  const value = await getRedisClient().getdel(`${CODE_KEY_PREFIX}${code}`)
  if (!value) return null

  return JSON.parse(value) as CodeRecord
}
