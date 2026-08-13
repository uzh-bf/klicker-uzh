import type { PrismaClient } from '@klicker-uzh/prisma/client'
import {
  resolveLiveQuizResponseIdentity,
  type LiveQuizResponseIdentity,
} from '@klicker-uzh/util'

export async function resolveCorrelatedResponseIdentity({
  database,
  cookieHeader,
  liveQuizId,
  secret,
  issuer,
  respondentToken,
}: {
  database: Pick<PrismaClient, 'temporaryLeaderboardEntry'>
  cookieHeader: string | undefined
  liveQuizId: string
  secret: string
  issuer: string
  respondentToken?: string
}) {
  const identity = await resolveLiveQuizResponseIdentity({
    cookieHeader,
    liveQuizId,
    secret,
    issuer,
    respondentToken,
  })
  if (!identity || identity.kind !== 'temporary') return identity

  const temporaryEntry = await database.temporaryLeaderboardEntry.findUnique({
    where: {
      id_quizId: {
        id: identity.id,
        quizId: liveQuizId,
      },
    },
    select: { id: true },
  })
  if (temporaryEntry) return identity

  return resolveLiveQuizResponseIdentity({
    cookieHeader,
    liveQuizId,
    secret,
    issuer,
    respondentToken,
    ignoreTemporaryParticipant: true,
  })
}

export function getCorrelatedResponseInitializationToken({
  identity,
  created,
  allowTokenFallback,
}: {
  identity: LiveQuizResponseIdentity
  created: boolean
  allowTokenFallback: boolean
}) {
  if (!allowTokenFallback || !created || identity.kind !== 'anonymous') {
    return undefined
  }
  return identity.token
}
