import { MAX_RESPONSE_LIMIT } from '@klicker-uzh/types'
import type { Redis } from 'ioredis'

export { MAX_RESPONSE_LIMIT } from '@klicker-uzh/types'

// Free-text elements in standard live quizzes may accept several responses per
// participant (the element's response limit). Admission and every persisted
// effect are decided in one Redis script so that concurrent worker runs and
// Hatchet retries never exceed the limit, count one message twice, or leave a
// partial response behind. Admission keys share the instance prefix and expire
// with block results; the existing quiz lifecycle manages leaderboard keys.

export function getResponseAdmissionKeys(instanceKey: string) {
  return {
    // ids of messages that were admitted, so a retried message is not counted again
    messages: `${instanceKey}:admittedMessages`,
    // `participantKey:responseHash` members, so the same answer is not counted twice
    responseMembers: `${instanceKey}:participantResponses`,
    // number of admitted responses per participant
    responseCounts: `${instanceKey}:participantResponseCounts`,
    // number of distinct participants with at least one admitted response
    respondents: `${instanceKey}:respondents`,
    // persisted aggregate response state
    results: `${instanceKey}:results`,
    responseHashes: `${instanceKey}:responseHashes`,
    responses: `${instanceKey}:responses`,
    // instance metadata containing firstResponseReceivedAt
    info: `${instanceKey}:info`,
  }
}

export type ResponseAdmission =
  | { admitted: false; reason: 'processed' | 'duplicate' | 'limit' }
  | { admitted: true; isFirstResponse: boolean }

export type ResponseAdmissionParticipantRole =
  | 'PARTICIPANT'
  | 'TEMPORARY_PARTICIPANT'

// KEYS: messages, responseMembers, responseCounts, respondents, results,
//       responseHashes, responses, info, block leaderboard, quiz leaderboard,
//       quiz xp
// ARGV: messageId, participantKey ('' for anonymous), participantRole
//       ('' for anonymous), responseHash, responseValue, limit, anonymous
//       first-response flag ('1' or '0'), pointsAwarded, xpAwarded,
//       responseTimestamp, leaderboard participant id, first-correct-response flag
const ADMIT_SCRIPT = `
local MAX_SAFE_INTEGER = 9007199254740991
local participantKey = ARGV[2]
local participantRole = ARGV[3]
local isAnonymous = participantKey == ''

local function key_type_error(keyIndex, expected)
  local typeReply = redis.call('TYPE', KEYS[keyIndex])
  local actual = type(typeReply) == 'table' and typeReply['ok'] or typeReply
  if actual ~= 'none' and actual ~= expected then
    return redis.error_reply('WRONGTYPE response admission key ' .. keyIndex .. ' is not ' .. expected)
  end
end

local expectedTypes = {'set', 'set', 'hash', 'string', 'hash', 'hash', 'hash', 'hash'}
for index, expected in ipairs(expectedTypes) do
  local typeError = key_type_error(index, expected)
  if typeError then return typeError end
end

if isAnonymous then
  if participantRole ~= '' then
    return redis.error_reply('invalid anonymous participant role')
  end
elseif participantRole ~= 'PARTICIPANT' and participantRole ~= 'TEMPORARY_PARTICIPANT' then
  return redis.error_reply('invalid participant role')
end

if not isAnonymous then
  local typeError = key_type_error(9, 'hash')
  if typeError then return typeError end
  typeError = key_type_error(10, 'hash')
  if typeError then return typeError end
  if participantRole == 'PARTICIPANT' then
    typeError = key_type_error(11, 'hash')
    if typeError then return typeError end
  end
end

if redis.call('SISMEMBER', KEYS[1], ARGV[1]) == 1 then
  return 'processed'
end

local isFirstResponse
local count
if isAnonymous then
  isFirstResponse = ARGV[7] == '1'
  count = 0
else
  local member = participantKey .. ':' .. ARGV[4]
  if redis.call('SISMEMBER', KEYS[2], member) == 1 then
    return 'duplicate'
  end

  local rawCount = redis.call('HGET', KEYS[3], participantKey) or '0'
  if rawCount ~= '0' and string.match(rawCount, '^[1-9]%d*$') == nil then
    return redis.error_reply('participant response count is not a non-negative integer')
  end
  count = tonumber(rawCount)
  if count == nil or count > MAX_SAFE_INTEGER then
    return redis.error_reply('participant response count is outside the supported integer range')
  end
  if count >= tonumber(ARGV[6]) then
    return 'limit'
  end
  isFirstResponse = count == 0
end

local function non_negative_integer(value, label)
  if value ~= '0' and string.match(value, '^[1-9]%d*$') == nil then
    return nil, label .. ' is not a non-negative integer'
  end
  local parsed = tonumber(value)
  if parsed == nil or parsed > MAX_SAFE_INTEGER then
    return nil, label .. ' is outside the supported integer range'
  end
  return parsed
end

local resultCount, countError = non_negative_integer(
  redis.call('HGET', KEYS[5], ARGV[4]) or '0',
  'response result count'
)
if resultCount == nil then return redis.error_reply(countError) end
if resultCount >= MAX_SAFE_INTEGER then
  return redis.error_reply('response result count would overflow')
end

local participants, participantsError = non_negative_integer(
  redis.call('HGET', KEYS[5], 'participants') or '0',
  'participant result count'
)
if participants == nil then return redis.error_reply(participantsError) end
if participants >= MAX_SAFE_INTEGER then
  return redis.error_reply('participant result count would overflow')
end

local existingValue = redis.call('HGET', KEYS[6], ARGV[4])
if existingValue and existingValue ~= ARGV[5] then
  return redis.error_reply('response hash is already associated with a different value')
end

if not isAnonymous then
  local responseExists = redis.call('HEXISTS', KEYS[7], participantKey)
  if isFirstResponse and responseExists == 1 then
    return redis.error_reply('participant response marker exists without an admission count')
  end
  if not isFirstResponse and responseExists == 0 then
    return redis.error_reply('participant response marker is missing for an admitted participant')
  end
end

if isFirstResponse then
  local respondents, respondentsError = non_negative_integer(
    redis.call('GET', KEYS[4]) or '0',
    'respondent count'
  )
  if respondents == nil then return redis.error_reply(respondentsError) end
  if respondents >= MAX_SAFE_INTEGER then
    return redis.error_reply('respondent count would overflow')
  end

  if not isAnonymous then
    local points, pointsError = non_negative_integer(ARGV[8], 'pointsAwarded')
    if points == nil then return redis.error_reply(pointsError) end
    local xp, xpError = non_negative_integer(ARGV[9], 'xpAwarded')
    if xp == nil then return redis.error_reply(xpError) end

    local increments = {{9, points, 'block leaderboard points'}, {10, points, 'quiz leaderboard points'}}
    if participantRole == 'PARTICIPANT' then
      table.insert(increments, {11, xp, 'quiz xp'})
    end
    for _, increment in ipairs(increments) do
      local current, currentError = non_negative_integer(
        redis.call('HGET', KEYS[increment[1]], ARGV[11]) or '0', increment[3]
      )
      if current == nil then return redis.error_reply(currentError) end
      if current > MAX_SAFE_INTEGER - increment[2] then
        return redis.error_reply(increment[3] .. ' would overflow')
      end
    end
  end
end

redis.call('SADD', KEYS[1], ARGV[1])
if not isAnonymous then
  redis.call('SADD', KEYS[2], participantKey .. ':' .. ARGV[4])
  redis.call('HINCRBY', KEYS[3], participantKey, 1)
end
redis.call('HINCRBY', KEYS[5], ARGV[4], 1)
redis.call('HSET', KEYS[6], ARGV[4], ARGV[5])
redis.call('HINCRBY', KEYS[5], 'participants', 1)

if isFirstResponse then
  redis.call('INCR', KEYS[4])
  if not isAnonymous and ARGV[12] == '1' and redis.call('HEXISTS', KEYS[8], 'firstResponseReceivedAt') == 0 then
    redis.call('HSET', KEYS[8], 'firstResponseReceivedAt', ARGV[10])
  end

  if not isAnonymous then
    redis.call('HSET', KEYS[7], participantKey, ARGV[5])
    redis.call('HINCRBY', KEYS[9], ARGV[11], ARGV[8])
    redis.call('HINCRBY', KEYS[10], ARGV[11], ARGV[8])
    if participantRole == 'PARTICIPANT' then
      redis.call('HINCRBY', KEYS[11], ARGV[11], ARGV[9])
    end
  end
end

if isFirstResponse then return 'first' end
return 'repeat'
`

export interface ResponseAdmissionArgs {
  redis: Redis
  instanceKey: string
  liveQuizKey: string
  messageId: string
  // undefined for anonymous participants
  participantKey?: string
  participantRole?: ResponseAdmissionParticipantRole
  responseHash: string
  responseValue: string
  responseLimit: number
  sessionBlockId: string
  responseTimestamp: number
  pointsAwarded: number
  xpAwarded: number
  setFirstResponseTimestamp?: boolean
  // trusted only for anonymous participants, whose cap is enforced on their device
  anonymousIsFirstResponse?: boolean
}

function scriptArgs({
  instanceKey,
  liveQuizKey,
  messageId,
  participantKey,
  participantRole,
  responseHash,
  responseValue,
  responseLimit,
  sessionBlockId,
  responseTimestamp,
  pointsAwarded,
  xpAwarded,
  setFirstResponseTimestamp,
  anonymousIsFirstResponse,
}: Omit<ResponseAdmissionArgs, 'redis'>) {
  if (!instanceKey || !liveQuizKey || !sessionBlockId) {
    throw new Error('Response admission requires non-empty instance state keys')
  }
  if (!messageId || !responseHash || !responseValue.trim()) {
    throw new Error('Response admission requires a message id, hash and value')
  }
  if (
    !Number.isInteger(responseLimit) ||
    responseLimit <= 1 ||
    responseLimit > MAX_RESPONSE_LIMIT
  ) {
    throw new Error(
      'Response admission limit must be an integer above 1 and at most 10'
    )
  }
  if (!Number.isSafeInteger(responseTimestamp) || responseTimestamp < 0) {
    throw new Error(
      'Response admission timestamp must be a non-negative integer'
    )
  }
  if (!Number.isSafeInteger(pointsAwarded) || pointsAwarded < 0) {
    throw new Error('pointsAwarded must be a non-negative safe integer')
  }
  if (!Number.isSafeInteger(xpAwarded) || xpAwarded < 0) {
    throw new Error('xpAwarded must be a non-negative safe integer')
  }
  if (
    participantKey === undefined
      ? participantRole !== undefined
      : participantRole !== 'PARTICIPANT' &&
        participantRole !== 'TEMPORARY_PARTICIPANT'
  ) {
    throw new Error('Response admission participant key and role do not match')
  }

  const leaderboardParticipantId =
    participantRole === 'TEMPORARY_PARTICIPANT'
      ? participantKey?.slice('temporary-'.length)
      : participantKey
  if (
    participantRole === 'TEMPORARY_PARTICIPANT' &&
    (!participantKey?.startsWith('temporary-') || !leaderboardParticipantId)
  ) {
    throw new Error(
      'Temporary participant admission requires a prefixed participant key'
    )
  }

  const keys = getResponseAdmissionKeys(instanceKey)
  const blockLeaderboardKey =
    participantRole === 'PARTICIPANT'
      ? `${liveQuizKey}:b:${sessionBlockId}:lb`
      : `${liveQuizKey}:b:${sessionBlockId}:lbTemporary`
  const quizLeaderboardKey =
    participantRole === 'PARTICIPANT'
      ? `${liveQuizKey}:lb`
      : `${liveQuizKey}:lbTemporary`

  return [
    11,
    keys.messages,
    keys.responseMembers,
    keys.responseCounts,
    keys.respondents,
    keys.results,
    keys.responseHashes,
    keys.responses,
    keys.info,
    blockLeaderboardKey,
    quizLeaderboardKey,
    `${liveQuizKey}:xp`,
    messageId,
    participantKey ?? '',
    participantRole ?? '',
    responseHash,
    responseValue,
    String(responseLimit),
    anonymousIsFirstResponse !== false ? '1' : '0',
    String(pointsAwarded),
    String(xpAwarded),
    String(responseTimestamp),
    leaderboardParticipantId ?? '',
    setFirstResponseTimestamp ? '1' : '0',
  ] as const
}

export async function admitLiveQuizResponse({
  redis,
  ...args
}: ResponseAdmissionArgs): Promise<ResponseAdmission> {
  const result = (await redis.eval(ADMIT_SCRIPT, ...scriptArgs(args))) as
    | 'processed'
    | 'duplicate'
    | 'limit'
    | 'first'
    | 'repeat'

  if (result === 'first' || result === 'repeat') {
    return { admitted: true, isFirstResponse: result === 'first' }
  }
  return { admitted: false, reason: result }
}

// Parses the response limit stored with the instance metadata; anything
// missing or invalid falls back to a single response.
export function parseResponseLimit(value?: string | number | null): number {
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed < 1) return 1
  return Math.min(parsed, MAX_RESPONSE_LIMIT)
}
