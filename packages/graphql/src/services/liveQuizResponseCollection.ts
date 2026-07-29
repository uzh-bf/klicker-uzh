import * as DB from '@klicker-uzh/prisma/client'
import { GraphQLError } from 'graphql'

export function resolveLiveQuizResponseCollectionMode({
  isAssessmentEnabled,
  requestedMode,
  existingMode,
}: {
  isAssessmentEnabled: boolean
  requestedMode?: DB.LiveQuizResponseCollectionMode | null
  existingMode?: DB.LiveQuizResponseCollectionMode | null
}) {
  if (isAssessmentEnabled) {
    return DB.LiveQuizResponseCollectionMode.AGGREGATED_ANONYMOUS
  }

  return (
    requestedMode ??
    existingMode ??
    DB.LiveQuizResponseCollectionMode.AGGREGATED_ANONYMOUS
  )
}

export function assertLiveQuizResponseCollectionCompatibility({
  isGamificationEnabled,
  responseCollectionMode,
}: {
  isGamificationEnabled: boolean
  responseCollectionMode: DB.LiveQuizResponseCollectionMode
}) {
  if (
    isGamificationEnabled &&
    responseCollectionMode ===
      DB.LiveQuizResponseCollectionMode.CORRELATED_EXPORT
  ) {
    throw new GraphQLError(
      'Correlated response exports cannot be enabled for gamified live quizzes',
      {
        extensions: {
          code: 'LIVE_QUIZ_CORRELATED_GAMIFICATION_CONFLICT',
        },
      }
    )
  }
}
