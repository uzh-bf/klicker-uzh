import type { LiveQuizResetCacheGenerationSnapshot } from '@klicker-uzh/types'
import type { Redis } from 'ioredis'
import { v4 as uuidv4 } from 'uuid'

const CLEAR_LIVE_QUIZ_CACHE_SCRIPT = `
local currentGeneration = redis.call('HGET', KEYS[1], 'cacheGeneration')
if ARGV[1] == 'LEGACY' then
  if currentGeneration then
    return 0
  end
elseif currentGeneration ~= ARGV[2] then
  return 0
end
for index = 1, #KEYS do
  redis.call('UNLINK', KEYS[index])
end
return 1
`

const INITIALIZE_LIVE_QUIZ_CACHE_SCRIPT = `
for index = 1, #KEYS do
  redis.call('UNLINK', KEYS[index])
end
redis.call(
  'HSET',
  KEYS[1],
  'namespace', ARGV[1],
  'startedAt', ARGV[2],
  'isGamificationEnabled', ARGV[3],
  'isAssessmentEnabled', ARGV[4],
  'cacheGeneration', ARGV[5]
)
return ARGV[5]
`

async function scanLiveQuizExecutionKeys({
  liveQuizId,
  redis,
}: {
  liveQuizId: string
  redis: Redis
}): Promise<string[]> {
  const keys = new Set<string>()
  let cursor = '0'
  do {
    const [nextCursor, batch] = await redis.scan(
      cursor,
      'MATCH',
      `lq:${liveQuizId}:*`,
      'COUNT',
      500
    )
    cursor = nextCursor
    for (const key of batch) keys.add(key)
  } while (cursor !== '0')
  return [...keys]
}

function includeMetaKey(liveQuizId: string, keys: string[]): string[] {
  const metaKey = `lq:${liveQuizId}:meta`
  return [metaKey, ...keys.filter((key) => key !== metaKey)]
}

export async function clearAllLiveQuizExecutionCache({
  liveQuizId,
  redis,
}: {
  liveQuizId: string
  redis: Redis
}): Promise<void> {
  const keys = includeMetaKey(
    liveQuizId,
    await scanLiveQuizExecutionKeys({ liveQuizId, redis })
  )
  await redis.unlink(...keys)
}

export async function clearLiveQuizExecutionCache({
  liveQuizId,
  redis,
  cacheGenerationSnapshot,
}: {
  liveQuizId: string
  redis: Redis
  cacheGenerationSnapshot: LiveQuizResetCacheGenerationSnapshot
}): Promise<boolean> {
  if (cacheGenerationSnapshot.status === 'UNAVAILABLE') return false

  const keys = includeMetaKey(
    liveQuizId,
    await scanLiveQuizExecutionKeys({ liveQuizId, redis })
  )
  const legacy =
    cacheGenerationSnapshot.generation === null ? 'LEGACY' : 'GENERATED'
  const cleared = await redis.eval(
    CLEAR_LIVE_QUIZ_CACHE_SCRIPT,
    keys.length,
    ...keys,
    legacy,
    cacheGenerationSnapshot.generation ?? ''
  )
  return cleared === 1
}

export async function initializeLiveQuizExecutionCache({
  liveQuizId,
  namespace,
  isGamificationEnabled,
  isAssessmentEnabled,
  redis,
  startedAt,
}: {
  liveQuizId: string
  namespace: string
  isGamificationEnabled: boolean
  isAssessmentEnabled: boolean
  redis: Redis
  startedAt: Date
}): Promise<string> {
  const keys = includeMetaKey(
    liveQuizId,
    await scanLiveQuizExecutionKeys({ liveQuizId, redis })
  )
  const cacheGeneration = uuidv4()
  await redis.eval(
    INITIALIZE_LIVE_QUIZ_CACHE_SCRIPT,
    keys.length,
    ...keys,
    namespace,
    startedAt.getTime(),
    String(isGamificationEnabled),
    String(isAssessmentEnabled),
    cacheGeneration
  )
  return cacheGeneration
}
