import {
  LIVE_QUIZ_RESPONDENT_COOKIE_NAME,
  LIVE_QUIZ_RESPONDENT_TOKEN_MAX_AGE_SECONDS,
} from '@klicker-uzh/util'

interface CorrelatedResponseRedis {
  hsetnx(key: string, field: string, value: string): Promise<number>
  eval(
    script: string,
    numberOfKeys: number,
    ...args: string[]
  ): Promise<unknown>
}

const RELEASE_OWNED_CLAIM_SCRIPT = `
if redis.call('HGET', KEYS[1], ARGV[1]) == ARGV[2] then
  return redis.call('HDEL', KEYS[1], ARGV[1])
end
return 0
`

export function buildCorrelatedVoteKey({
  liveQuizId,
  instanceId,
  blockExecution,
}: {
  liveQuizId: string
  instanceId: string
  blockExecution: string
}) {
  return `lq:${liveQuizId}:i:${instanceId}:correlatedVotes:${blockExecution}`
}

export async function claimCorrelatedResponse({
  redis,
  key,
  identityKey,
  messageId,
}: {
  redis: CorrelatedResponseRedis
  key: string
  identityKey: string
  messageId: string
}) {
  return (await redis.hsetnx(key, identityKey, messageId)) === 1
}

export async function releaseCorrelatedResponse({
  redis,
  key,
  identityKey,
  messageId,
}: {
  redis: CorrelatedResponseRedis
  key: string
  identityKey: string
  messageId: string
}) {
  const released = await redis.eval(
    RELEASE_OWNED_CLAIM_SCRIPT,
    1,
    key,
    identityKey,
    messageId
  )
  return Number(released) === 1
}

export function serializeLiveQuizRespondentCookie({
  token,
  domain,
  secure,
}: {
  token: string
  domain?: string
  secure: boolean
}) {
  const attributes = [
    `${LIVE_QUIZ_RESPONDENT_COOKIE_NAME}=${token}`,
    `Max-Age=${LIVE_QUIZ_RESPONDENT_TOKEN_MAX_AGE_SECONDS}`,
  ]
  if (domain) attributes.push(`Domain=${domain}`)
  attributes.push('Path=/', 'HttpOnly')
  if (secure) attributes.push('Secure')
  attributes.push('SameSite=Lax')

  return attributes.join('; ')
}
