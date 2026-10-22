import type { Redis } from 'ioredis'

// Free-text elements in standard live quizzes may accept several responses per
// participant (the element's response limit). Admission is decided atomically
// in Redis so that concurrent worker runs and Hatchet retries never exceed the
// limit or count one message twice. All keys share the instance prefix, so the
// existing block-close expiry and quiz reset clean them up.

export const MAX_RESPONSE_LIMIT = 10

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
  }
}

export type ResponseAdmission =
  | { admitted: false; reason: 'processed' | 'duplicate' | 'limit' }
  | { admitted: true; isFirstResponse: boolean }

// KEYS: messages, responseMembers, responseCounts
// ARGV: messageId, participantKey ('' for anonymous), responseHash, limit,
//       anonymous first-response flag ('1' or '0')
const ADMIT_SCRIPT = `
if redis.call('SISMEMBER', KEYS[1], ARGV[1]) == 1 then
  return 'processed'
end
if ARGV[2] == '' then
  redis.call('SADD', KEYS[1], ARGV[1])
  if ARGV[5] == '1' then return 'first' end
  return 'repeat'
end
local member = ARGV[2] .. ':' .. ARGV[3]
if redis.call('SISMEMBER', KEYS[2], member) == 1 then
  return 'duplicate'
end
local count = tonumber(redis.call('HGET', KEYS[3], ARGV[2]) or '0')
if count >= tonumber(ARGV[4]) then
  return 'limit'
end
redis.call('SADD', KEYS[1], ARGV[1])
redis.call('SADD', KEYS[2], member)
redis.call('HINCRBY', KEYS[3], ARGV[2], 1)
if count == 0 then return 'first' end
return 'repeat'
`

// KEYS and ARGV as for the admit script; reverts exactly one admission
const UNDO_SCRIPT = `
if redis.call('SREM', KEYS[1], ARGV[1]) == 0 then
  return 0
end
if ARGV[2] ~= '' then
  redis.call('SREM', KEYS[2], ARGV[2] .. ':' .. ARGV[3])
  if redis.call('HINCRBY', KEYS[3], ARGV[2], -1) <= 0 then
    redis.call('HDEL', KEYS[3], ARGV[2])
  end
end
return 1
`

export interface ResponseAdmissionArgs {
  redis: Redis
  instanceKey: string
  messageId: string
  // undefined for anonymous participants
  participantKey?: string
  responseHash: string
  responseLimit: number
  // trusted only for anonymous participants, whose cap is enforced on their device
  anonymousIsFirstResponse?: boolean
}

function scriptArgs({
  instanceKey,
  messageId,
  participantKey,
  responseHash,
  responseLimit,
  anonymousIsFirstResponse,
}: Omit<ResponseAdmissionArgs, 'redis'>) {
  const keys = getResponseAdmissionKeys(instanceKey)
  return [
    3,
    keys.messages,
    keys.responseMembers,
    keys.responseCounts,
    messageId,
    participantKey ?? '',
    responseHash,
    String(responseLimit),
    anonymousIsFirstResponse ? '1' : '0',
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

export async function undoLiveQuizResponseAdmission({
  redis,
  ...args
}: ResponseAdmissionArgs): Promise<boolean> {
  const result = await redis.eval(UNDO_SCRIPT, ...scriptArgs(args))
  return result === 1
}

// Parses the response limit stored with the instance metadata; anything
// missing or invalid falls back to a single response.
export function parseResponseLimit(value?: string | number | null): number {
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed < 1) return 1
  return Math.min(parsed, MAX_RESPONSE_LIMIT)
}
