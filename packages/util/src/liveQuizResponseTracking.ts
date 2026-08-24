export type LiveQuizResponseTrackingStatus = 'received' | 'processed'

export const LIVE_QUIZ_RESPONSE_TRACKING_TTL_SECONDS = 60 * 60 * 24

// Redis runs this script atomically. The processed marker is claimed before
// aggregation commands so a retry after a lost reply cannot apply them again.
export const LIVE_QUIZ_RESPONSE_PROCESSING_SCRIPT = `
if redis.call('SISMEMBER', KEYS[1], ARGV[1]) == 1 then
  return cjson.encode({ status = 'already_processed' })
end

redis.call('SADD', KEYS[1], ARGV[1])

local commands = cjson.decode(ARGV[3])
local commandErrors = {}
for _, command in ipairs(commands) do
  local result = redis.pcall(unpack(command))
  if type(result) == 'table' and result.err then
    table.insert(commandErrors, result.err)
  end
end

local trackingErrors = {}
local instanceInfoTtl = redis.pcall('TTL', KEYS[2])
if type(instanceInfoTtl) == 'table' and instanceInfoTtl.err then
  table.insert(trackingErrors, instanceInfoTtl.err)
elseif instanceInfoTtl >= 0 then
  local expireResult = redis.pcall('EXPIRE', KEYS[1], instanceInfoTtl)
  if type(expireResult) == 'table' and expireResult.err then
    table.insert(trackingErrors, expireResult.err)
  end
elseif instanceInfoTtl == -2 then
  local expireResult = redis.pcall(
    'EXPIRE',
    KEYS[1],
    tonumber(ARGV[2])
  )
  if type(expireResult) == 'table' and expireResult.err then
    table.insert(trackingErrors, expireResult.err)
  end
end

return cjson.encode({
  status = 'processed',
  commandErrors = commandErrors,
  trackingErrors = trackingErrors,
})
`.trim()

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
