export type LiveQuizResponseTrackingStatus = 'received' | 'processed'

export const LIVE_QUIZ_RESPONSE_TRACKING_TTL_SECONDS = 60 * 60 * 24

export const LIVE_QUIZ_RESPONSE_TRACKING_SCRIPT = `
local instanceInfoTtl = redis.call('TTL', KEYS[2])
redis.call('SADD', KEYS[1], ARGV[1])

if instanceInfoTtl >= 0 then
  redis.call('EXPIRE', KEYS[1], instanceInfoTtl)
elseif instanceInfoTtl == -2 then
  redis.call('EXPIRE', KEYS[1], tonumber(ARGV[2]))
end

return instanceInfoTtl
`.trim()

export function getLiveQuizInstanceInfoKey({
  liveQuizId,
  instanceId,
}: {
  liveQuizId: string
  instanceId: string | number
}): string {
  return `lq:${liveQuizId}:i:${instanceId}:info`
}

export function getLiveQuizResponseTrackingKey({
  liveQuizId,
  instanceId,
  status,
}: {
  liveQuizId: string
  instanceId: string | number
  status: LiveQuizResponseTrackingStatus
}): string {
  return `lq:${liveQuizId}:i:${instanceId}:responses:${status}`
}
