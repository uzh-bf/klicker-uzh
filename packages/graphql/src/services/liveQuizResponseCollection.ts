import * as DB from '@klicker-uzh/prisma/client'
import { GraphQLError } from 'graphql'

type LiveQuizResponseCollectionCourseState = Awaited<
  ReturnType<typeof lockCourseLiveQuizResponseCollectionState>
>

export async function lockLiveQuizResponseCollectionState({
  prisma,
  liveQuizId,
}: {
  prisma: Pick<DB.Prisma.TransactionClient, '$queryRaw'>
  liveQuizId: string
}) {
  const [liveQuiz] = await prisma.$queryRaw<
    Pick<DB.LiveQuiz, 'id' | 'courseId' | 'responseCollectionMode' | 'status'>[]
  >`
    SELECT
      "id",
      "courseId",
      "responseCollectionMode"::text AS "responseCollectionMode",
      "status"::text AS "status"
    FROM "public"."LiveQuiz"
    WHERE "id" = ${liveQuizId}::uuid AND "isDeleted" = false
    FOR UPDATE
  `

  return liveQuiz ?? null
}

export async function lockCourseLiveQuizResponseCollectionState({
  prisma,
  courseId,
}: {
  prisma: Pick<DB.Prisma.TransactionClient, '$queryRaw'>
  courseId: string
}) {
  const course = await lockCourseLiveQuizResponseCollectionSettings({
    prisma,
    courseId,
  })
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

export async function lockCourseLiveQuizResponseCollectionSettings({
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

  return course ?? null
}

export function deriveLiveQuizResponseCollectionMode({
  isAssessmentEnabled,
  isGamificationEnabled,
  requestedMode,
  existingMode,
}: {
  isAssessmentEnabled: boolean
  isGamificationEnabled: boolean
  requestedMode?: DB.LiveQuizResponseCollectionMode | null
  existingMode?: DB.LiveQuizResponseCollectionMode | null
}) {
  const responseCollectionMode = isAssessmentEnabled
    ? DB.LiveQuizResponseCollectionMode.AGGREGATED_ANONYMOUS
    : (requestedMode ??
      existingMode ??
      DB.LiveQuizResponseCollectionMode.AGGREGATED_ANONYMOUS)

  assertLiveQuizResponseCollectionCompatibility({
    isGamificationEnabled,
    responseCollectionMode,
  })

  return responseCollectionMode
}

export function assertLiveQuizResponseCollectionModeEditable({
  liveQuiz,
  responseCollectionMode,
}: {
  liveQuiz: Pick<DB.LiveQuiz, 'status' | 'responseCollectionMode'>
  responseCollectionMode: DB.LiveQuizResponseCollectionMode
}) {
  if (
    responseCollectionMode !== liveQuiz.responseCollectionMode &&
    liveQuiz.status !== DB.PublicationStatus.DRAFT &&
    liveQuiz.status !== DB.PublicationStatus.SCHEDULED
  ) {
    throw new GraphQLError(
      'Response collection mode cannot be changed after publication',
      { extensions: { code: 'LIVE_QUIZ_RESPONSE_MODE_LOCKED' } }
    )
  }

  if (liveQuiz.status === DB.PublicationStatus.PUBLISHED) {
    throw new GraphQLError('Cannot edit a published live quiz')
  }
}

export function deriveCourseLiveQuizResponseCollectionTransition({
  state,
  isAssessmentEnabled,
  isGamificationEnabled,
}: {
  state: NonNullable<LiveQuizResponseCollectionCourseState>
  isAssessmentEnabled: boolean
  isGamificationEnabled: boolean
}) {
  if (
    isAssessmentEnabled !== state.course.isAssessmentEnabled &&
    state.liveQuizzes.some(
      (liveQuiz) => liveQuiz.status === DB.PublicationStatus.PUBLISHED
    )
  ) {
    throw new GraphQLError(
      'Running live quizzes must end before the course assessment setting can be changed',
      {
        extensions: {
          code: 'LIVE_QUIZ_ASSESSMENT_TRANSITION_CONFLICT',
        },
      }
    )
  }

  return state.liveQuizzes.map((liveQuiz) => ({
    id: liveQuiz.id,
    responseCollectionMode: deriveLiveQuizResponseCollectionMode({
      isAssessmentEnabled,
      isGamificationEnabled,
      requestedMode: liveQuiz.responseCollectionMode,
    }),
  }))
}

function assertLiveQuizResponseCollectionCompatibility({
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
