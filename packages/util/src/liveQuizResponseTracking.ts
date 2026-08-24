export type LiveQuizResponseCountStatus = 'received' | 'processed'

export const LIVE_QUIZ_RESPONSE_TRACKING_TTL_SECONDS = 60 * 60 * 24
export const LIVE_QUIZ_RESPONSE_REPLAY_CLAIM_TTL_SECONDS =
  LIVE_QUIZ_RESPONSE_TRACKING_TTL_SECONDS

// Redis runs this script atomically. The replay claim is bounded independently
// of the exact processed counter so active quizzes cannot retain one member
// forever for every response.
export const LIVE_QUIZ_RESPONSE_PROCESSING_SCRIPT = `
local commands = cjson.decode(ARGV[3])
local commandErrors = {}
local trackingErrors = {}
local instanceInfoTtl = redis.call('TTL', KEYS[3])
local replayClaimTtl = tonumber(ARGV[2])

if instanceInfoTtl >= 0 and instanceInfoTtl < replayClaimTtl then
  replayClaimTtl = instanceInfoTtl
elseif instanceInfoTtl == -2 then
  replayClaimTtl = tonumber(ARGV[2])
end

local currentClaimTtl = redis.call('TTL', KEYS[1])
if currentClaimTtl == -1 or currentClaimTtl > replayClaimTtl then
  local expireResult = redis.pcall('EXPIRE', KEYS[1], replayClaimTtl)
  if type(expireResult) == 'table' and expireResult.err then
    table.insert(trackingErrors, expireResult.err)
  end
end

-- Initialize a new counter from the legacy processed set once. This keeps
-- counts visible during the key-shape cutover without double-counting new
-- claims.
local baselineResult = redis.pcall(
  'SETNX',
  KEYS[2],
  redis.call('SCARD', KEYS[1])
)
if type(baselineResult) == 'table' and baselineResult.err then
  table.insert(trackingErrors, baselineResult.err)
end

local function expireCounter()
  local expireResult
  if instanceInfoTtl >= 0 then
    expireResult = redis.pcall('EXPIRE', KEYS[2], instanceInfoTtl)
  elseif instanceInfoTtl == -2 then
    expireResult = redis.pcall(
      'EXPIRE',
      KEYS[2],
      tonumber(ARGV[2])
    )
  end

  if type(expireResult) == 'table' and expireResult.err then
    table.insert(trackingErrors, expireResult.err)
  end
end

expireCounter()

if redis.call('SISMEMBER', KEYS[1], ARGV[1]) == 1 then
  return cjson.encode({
    status = 'already_processed',
    counted = false,
    commandErrors = commandErrors,
    trackingErrors = trackingErrors,
  })
end

redis.call('SADD', KEYS[1], ARGV[1])
if currentClaimTtl == -2 then
  local expireResult = redis.pcall('EXPIRE', KEYS[1], replayClaimTtl)
  if type(expireResult) == 'table' and expireResult.err then
    table.insert(trackingErrors, expireResult.err)
  end
end

for _, command in ipairs(commands) do
  local result = redis.pcall(unpack(command))
  if type(result) == 'table' and result.err then
    table.insert(commandErrors, result.err)
  end
end

local counted = false
if #commandErrors == 0 then
  local countResult = redis.pcall('INCR', KEYS[2])
  if type(countResult) == 'table' and countResult.err then
    table.insert(trackingErrors, countResult.err)
  else
    counted = true
    expireCounter()
  end
end

return cjson.encode({
  status = #commandErrors == 0 and 'processed' or 'aggregation_failed',
  counted = counted,
  commandErrors = commandErrors,
  trackingErrors = trackingErrors,
})
`.trim()

// Redis runs this script atomically so the received counter and its retention
// policy are updated together. Each accepted request is a separate event.
export const LIVE_QUIZ_RESPONSE_RECEIVED_SCRIPT = `
local instanceInfoTtl = redis.call('TTL', KEYS[2])
redis.call('INCR', KEYS[1])

if instanceInfoTtl >= 0 then
  redis.call('EXPIRE', KEYS[1], instanceInfoTtl)
elseif instanceInfoTtl == -2 then
  redis.call('EXPIRE', KEYS[1], tonumber(ARGV[1]))
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

export function getLiveQuizResponseCountKey({
  liveQuizId,
  instanceId,
  status,
}: {
  liveQuizId: string
  instanceId: string | number
  status: LiveQuizResponseCountStatus
}): string {
  return `lq:${liveQuizId}:i:${instanceId}:responses:${status}:count`
}

export function getLiveQuizResponseReplayClaimKey({
  liveQuizId,
  instanceId,
}: {
  liveQuizId: string
  instanceId: string | number
}): string {
  // Keep the existing processed-set name so a coordinated worker rollout does
  // not create a second replay guard during the cutover.
  return `lq:${liveQuizId}:i:${instanceId}:responses:processed`
}

export function getLiveQuizLegacyResponseReceivedKey({
  liveQuizId,
  instanceId,
}: {
  liveQuizId: string
  instanceId: string | number
}): string {
  return `lq:${liveQuizId}:i:${instanceId}:responses:received`
}
