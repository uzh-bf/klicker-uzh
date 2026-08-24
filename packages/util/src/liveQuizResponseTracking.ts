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
if replayClaimTtl < 1 then
  replayClaimTtl = 1
end

local counterTtl
if instanceInfoTtl >= 0 then
  counterTtl = math.max(instanceInfoTtl, 1)
elseif instanceInfoTtl == -2 then
  counterTtl = tonumber(ARGV[2])
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
  if counterTtl then
    expireResult = redis.pcall('EXPIRE', KEYS[2], counterTtl)
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
local trackingTtl = tonumber(ARGV[1])

if instanceInfoTtl >= 0 and instanceInfoTtl < trackingTtl then
  trackingTtl = instanceInfoTtl
end
if trackingTtl < 1 then
  trackingTtl = 1
end

local currentCount = redis.call('GET', KEYS[1])
local nextCount = 1
if currentCount then
  nextCount = tonumber(currentCount) + 1
end

-- SET with EX commits the value and its retention together. A malformed
-- existing counter fails before this write and cannot create an unexpired key.
redis.call('SET', KEYS[1], nextCount, 'EX', trackingTtl)

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
