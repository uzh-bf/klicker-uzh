import { LiveQuizResponseCollectionMode } from '@klicker-uzh/prisma/client'
import {
  buildCorrelatedVoteKey,
  claimCorrelatedResponse,
  getLiveQuizRespondentCookieName,
  LIVE_QUIZ_RESPONDENT_TOKEN_MAX_AGE_SECONDS,
  releaseCorrelatedResponse,
} from '@klicker-uzh/util'

export {
  buildCorrelatedVoteKey,
  claimCorrelatedResponse,
  releaseCorrelatedResponse,
}

export function serializeLiveQuizRespondentCookie({
  token,
  liveQuizId,
  domain,
  secure,
}: {
  token: string
  liveQuizId: string
  domain?: string
  secure: boolean
}) {
  const attributes = [
    `${getLiveQuizRespondentCookieName(liveQuizId)}=${token}`,
    `Max-Age=${LIVE_QUIZ_RESPONDENT_TOKEN_MAX_AGE_SECONDS}`,
  ]
  if (domain) attributes.push(`Domain=${domain}`)
  attributes.push('Path=/', 'HttpOnly')
  if (secure) attributes.push('Secure')
  attributes.push('SameSite=Lax')

  return attributes.join('; ')
}

export async function resolveResponseCollectionMode({
  cachedMode,
  liveQuizId,
  lookupMode,
}: {
  cachedMode: string | undefined
  liveQuizId: string
  lookupMode: (
    liveQuizId: string
  ) => Promise<LiveQuizResponseCollectionMode | string | null>
}) {
  if (
    cachedMode === LiveQuizResponseCollectionMode.AGGREGATED_ANONYMOUS ||
    cachedMode === LiveQuizResponseCollectionMode.CORRELATED_EXPORT
  ) {
    return cachedMode
  }

  const storedMode = await lookupMode(liveQuizId)
  if (
    storedMode === LiveQuizResponseCollectionMode.AGGREGATED_ANONYMOUS ||
    storedMode === LiveQuizResponseCollectionMode.CORRELATED_EXPORT
  ) {
    return storedMode
  }

  throw new Error(
    `Response collection mode for live quiz ${liveQuizId} is unavailable`
  )
}
