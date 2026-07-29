import * as DB from '@klicker-uzh/prisma/client'
import { GraphQLError } from 'graphql'

export async function lockCourseLiveQuizResponseCollectionState({
  prisma,
  courseId,
}: {
  prisma: Pick<DB.Prisma.TransactionClient, '$queryRaw'>
  courseId: string
}) {
  const [course] = await prisma.$queryRaw<
    Pick<DB.Course, 'id' | 'isAssessmentEnabled' | 'isGamificationEnabled'>[]
  >`
    SELECT
      "id",
      "isAssessmentEnabled",
      "isGamificationEnabled"
    FROM "public"."Course"
    WHERE "id" = ${courseId}::uuid
    FOR UPDATE
  `
  if (!course) return null

  const liveQuizzes = await prisma.$queryRaw<
    Pick<
      DB.LiveQuiz,
      'id' | 'pinCode' | 'responseCollectionMode' | 'status' | 'isDeleted'
    >[]
  >`
    SELECT
      "id",
      "pinCode",
      "responseCollectionMode"::text AS "responseCollectionMode",
      "status"::text AS "status",
      "isDeleted"
    FROM "public"."LiveQuiz"
    WHERE
      "courseId" = ${courseId}::uuid
      AND "isDeleted" = false
      AND "status" IN (
        'DRAFT'::"PublicationStatus",
        'SCHEDULED'::"PublicationStatus",
        'PUBLISHED'::"PublicationStatus"
      )
    ORDER BY "id"
    FOR UPDATE
  `

  return { course, liveQuizzes }
}

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
