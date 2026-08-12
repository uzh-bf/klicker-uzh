import type { LiveQuizResponseIdentity } from '@klicker-uzh/util'

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
