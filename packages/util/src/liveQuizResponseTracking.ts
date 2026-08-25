export type LiveQuizResponseCountStatus = 'received' | 'processed'

export const LIVE_QUIZ_RESPONSE_TRACKING_TTL_SECONDS = 60 * 60 * 24
export const LIVE_QUIZ_RESPONSE_REPLAY_CLAIM_TTL_SECONDS =
  LIVE_QUIZ_RESPONSE_TRACKING_TTL_SECONDS

// Redis runs this script atomically. Replay claims are age-trimmed so each
// identifier gets the full horizon without retaining expired members forever.
export const LIVE_QUIZ_RESPONSE_PROCESSING_SCRIPT = `
local commands = cjson.decode(ARGV[3])
local commandErrors = {}
local trackingErrors = {}
local instanceInfoTtl = redis.call('TTL', KEYS[3])
local replayClaimTtl = tonumber(ARGV[2])
-- Keep member trimming on the replay horizon. The instance TTL only bounds
-- the lifetime of the claim key itself during cleanup.
local claimKeyTtl = replayClaimTtl

if instanceInfoTtl >= 0 then
  claimKeyTtl = math.max(instanceInfoTtl, 1)
end

local currentTime = tonumber(redis.call('TIME')[1])
local existingClaimResult = redis.pcall('ZSCORE', KEYS[1], ARGV[1])
if type(existingClaimResult) == 'table' and existingClaimResult.err then
  table.insert(commandErrors, existingClaimResult.err)
  return cjson.encode({
    status = 'aggregation_failed',
    counted = false,
    commandErrors = commandErrors,
    trackingErrors = trackingErrors,
  })
end

local legacyMemberResult = redis.pcall('SISMEMBER', KEYS[4], ARGV[1])
if type(legacyMemberResult) == 'table' and legacyMemberResult.err then
  table.insert(commandErrors, legacyMemberResult.err)
  return cjson.encode({
    status = 'aggregation_failed',
    counted = false,
    commandErrors = commandErrors,
    trackingErrors = trackingErrors,
  })
end

if legacyMemberResult == 1 or (
  existingClaimResult ~= false and
  currentTime - tonumber(existingClaimResult) < replayClaimTtl
) then
  return cjson.encode({
    status = 'already_processed',
    counted = false,
    commandErrors = commandErrors,
    trackingErrors = trackingErrors,
  })
end

local function isInteger(value)
  return value ~= nil and string.match(tostring(value), '^%-?%d+$') ~= nil
end

local function validateCommands()
  for commandIndex, command in ipairs(commands) do
    local operation = command[1]
    local key = command[2]
    if type(operation) ~= 'string' or type(key) ~= 'string' then
      return string.format('invalid Redis command at index %d', commandIndex)
    end

    if operation ~= 'HINCRBY' and operation ~= 'HSET' then
      return string.format(
        'unsupported Redis command %s at index %d',
        operation,
        commandIndex
      )
    end

    local keyTypeResult = redis.pcall('TYPE', key)
    if type(keyTypeResult) == 'table' and keyTypeResult.err then
      return keyTypeResult.err
    end
    local keyType = keyTypeResult.ok
    if keyType ~= 'none' and keyType ~= 'hash' then
      return string.format(
        'Redis command %s targets a non-hash key %s',
        operation,
        key
      )
    end

    local field = command[3]
    if type(field) ~= 'string' then
      return string.format(
        'Redis command %s has an invalid hash field at index %d',
        operation,
        commandIndex
      )
    end

    if operation == 'HINCRBY' then
      if not isInteger(command[4]) then
        return string.format(
          'Redis HINCRBY has a non-integer increment at index %d',
          commandIndex
        )
      end

      local fieldValueResult = redis.pcall('HGET', key, field)
      if type(fieldValueResult) == 'table' and fieldValueResult.err then
        return fieldValueResult.err
      end
      if fieldValueResult ~= false and not isInteger(fieldValueResult) then
        return string.format(
          'Redis HINCRBY targets a non-integer field %s at index %d',
          field,
          commandIndex
        )
      end
    elseif
      type(command[4]) ~= 'string' and
      type(command[4]) ~= 'number'
    then
      return string.format(
        'Redis HSET has an invalid value at index %d',
        commandIndex
      )
    end
  end

  return nil
end

local validationError = validateCommands()
if validationError then
  table.insert(commandErrors, validationError)
  return cjson.encode({
    status = 'aggregation_failed',
    counted = false,
    commandErrors = commandErrors,
    trackingErrors = trackingErrors,
  })
end

local trimResult = redis.pcall(
  'ZREMRANGEBYSCORE',
  KEYS[1],
  '-inf',
  currentTime - replayClaimTtl
)
if type(trimResult) == 'table' and trimResult.err then
  table.insert(commandErrors, trimResult.err)
  return cjson.encode({
    status = 'aggregation_failed',
    counted = false,
    commandErrors = commandErrors,
    trackingErrors = trackingErrors,
  })
end

local counterTtl
if instanceInfoTtl >= 0 then
  counterTtl = math.max(instanceInfoTtl, 1)
elseif instanceInfoTtl == -2 then
  counterTtl = tonumber(ARGV[2])
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

local function releaseClaim()
  local releaseResult = redis.pcall('ZREM', KEYS[1], ARGV[1])
  if type(releaseResult) == 'table' and releaseResult.err then
    table.insert(trackingErrors, releaseResult.err)
  end
end

-- Initialize a new counter from the legacy processed set once. This keeps
-- counts visible during the key-shape cutover without double-counting new
-- claims. Validation runs before this mutation so malformed batches remain
-- safely retryable.
local legacyProcessedCount = redis.pcall('SCARD', KEYS[4])
if type(legacyProcessedCount) == 'table' and legacyProcessedCount.err then
  table.insert(trackingErrors, legacyProcessedCount.err)
else
  local baselineResult = redis.pcall('SETNX', KEYS[2], legacyProcessedCount)
  if type(baselineResult) == 'table' and baselineResult.err then
    table.insert(trackingErrors, baselineResult.err)
  end
end

expireCounter()

local claimResult = redis.pcall('ZADD', KEYS[1], currentTime, ARGV[1])
if type(claimResult) == 'table' and claimResult.err then
  table.insert(commandErrors, claimResult.err)
  return cjson.encode({
    status = 'aggregation_failed',
    counted = false,
    commandErrors = commandErrors,
    trackingErrors = trackingErrors,
  })
end

local expireResult = redis.pcall('EXPIRE', KEYS[1], claimKeyTtl)
if type(expireResult) == 'table' and expireResult.err then
  table.insert(trackingErrors, expireResult.err)
end

local appliedCommandCount = 0
for _, command in ipairs(commands) do
  local result = redis.pcall(unpack(command))
  if type(result) == 'table' and result.err then
    table.insert(commandErrors, result.err)
    break
  end
  appliedCommandCount = appliedCommandCount + 1
end

if #commandErrors > 0 then
  if appliedCommandCount == 0 then
    -- No aggregation command succeeded, so the worker can safely retry.
    releaseClaim()
  else
    -- Keep the claim when a non-idempotent command already applied. Retrying
    -- the batch could duplicate the successful commands; reconciliation must
    -- inspect the partial result instead.
    return cjson.encode({
      status = 'reconciliation_required',
      counted = false,
      commandErrors = commandErrors,
      trackingErrors = trackingErrors,
    })
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
if instanceInfoTtl == -2 then
  return cjson.encode({ status = 'inactive' })
end

local currentCountResult = redis.pcall('GET', KEYS[1])
if type(currentCountResult) == 'table' and currentCountResult.err then
  return cjson.encode({
    status = 'tracking_failed',
    error = currentCountResult.err,
  })
end

local currentCount = currentCountResult
local nextCount = 1
if currentCount then
  local numericCount = tonumber(currentCount)
  if not numericCount then
    return cjson.encode({
      status = 'tracking_failed',
      error = 'received response counter is not numeric',
    })
  end
  nextCount = numericCount + 1
end

-- SET with EX commits the value and its retention together. Active instance
-- info without an expiry keeps the counter persistent until cleanup starts.
local setResult
if instanceInfoTtl >= 0 then
  local trackingTtl = math.max(math.min(instanceInfoTtl, tonumber(ARGV[1])), 1)
  setResult = redis.pcall('SET', KEYS[1], nextCount, 'EX', trackingTtl)
else
  setResult = redis.pcall('SET', KEYS[1], nextCount)
end

if type(setResult) == 'table' and setResult.err then
  return cjson.encode({
    status = 'tracking_failed',
    error = setResult.err,
  })
end

return cjson.encode({ status = 'tracked', ttl = instanceInfoTtl })
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
  return `lq:${liveQuizId}:i:${instanceId}:responses:processed:claims`
}

export function getLiveQuizLegacyResponseProcessedKey({
  liveQuizId,
  instanceId,
}: {
  liveQuizId: string
  instanceId: string | number
}): string {
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
