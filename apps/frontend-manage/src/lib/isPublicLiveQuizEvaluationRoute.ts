import type { NextRouter } from 'next/router'

export function isPublicLiveQuizEvaluationRoute(
  router: Pick<NextRouter, 'isReady' | 'pathname' | 'query'>
) {
  return (
    router.pathname === '/quizzes/[id]/evaluation' &&
    (!router.isReady || router.query.hmac !== undefined)
  )
}
