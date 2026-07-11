import { randomUUID } from 'crypto'

interface DedupRedis {
  get(key: string): Promise<string | null>
  set(
    key: string,
    value: string,
    expiryMode: 'EX',
    ttl: number,
    setMode: 'NX'
  ): Promise<'OK' | null>
  eval(
    script: string,
    numberOfKeys: number,
    ...args: string[]
  ): Promise<unknown>
}

export async function assertRedisHashKeysCompatible({
  keys,
  increments,
  redis,
}: {
  keys: string[]
  increments: Array<{ key: string; field: string }>
  redis: Pick<DedupRedis, 'eval'>
}) {
  if (keys.length === 0) return

  const incompatibleKey = await redis.eval(
    `for _, key in ipairs(KEYS) do
       local keyType = redis.call('TYPE', key).ok
       if keyType ~= 'none' and keyType ~= 'hash' then return key end
     end
     for index = 1, #ARGV, 2 do
       local value = redis.call('HGET', ARGV[index], ARGV[index + 1])
       if value then
         local digits = string.gsub(value, '^%-', '')
         if not string.match(value, '^%-?%d+$') or string.len(digits) > 18 then
           return ARGV[index] .. ':' .. ARGV[index + 1]
         end
       end
     end
     return ''`,
    keys.length,
    ...keys,
    ...increments.flatMap(({ key, field }) => [key, field])
  )
  if (incompatibleKey) {
    throw new Error(
      `Redis key or increment field ${String(incompatibleKey)} is incompatible`
    )
  }
}

export async function withEscapeResponseDedup<T extends { status: number }>({
  messageId,
  redis,
  process,
}: {
  messageId: string
  redis: DedupRedis
  process: (doneKey?: string) => Promise<T>
}) {
  if (!messageId.startsWith('escape:')) return process()

  const doneKey = `response-message:${messageId}:done`
  const lockKey = `response-message:${messageId}:lock`
  if ((await redis.get(doneKey)) === '1') return { status: 200 } as T

  const lockToken = randomUUID()
  const lock = await redis.set(lockKey, lockToken, 'EX', 300, 'NX')
  if (lock !== 'OK') {
    throw new Error(`Escape response ${messageId} is already being processed`)
  }

  try {
    const result = await process(doneKey)
    if (result.status !== 200) {
      throw new Error(
        `Escape response ${messageId} failed with status ${result.status}`
      )
    }
    return result
  } finally {
    await redis.eval(
      `if redis.call('get', KEYS[1]) == ARGV[1] then
         return redis.call('del', KEYS[1])
       end
       return 0`,
      1,
      lockKey,
      lockToken
    )
  }
}
