import * as DB from '@klicker-uzh/prisma/client'
import type { PrismaTransactionClient } from '@klicker-uzh/util'

type ScoringInstance = Pick<
  DB.ElementInstance,
  'elementData' | 'elementType' | 'options'
>

export type CourseScoreResult = {
  participantId: string
  basePoints: number
  correctnessPoints: number
  bonusPoints: number
}

export type CourseScoreAggregate = {
  name: string
  availableBasePoints: number
  availableCorrectnessPoints: number
  availableBonusPoints: number
  numberOfCorrections: number
  studentResults: CourseScoreResult[]
}

function getInstanceScoringInfo(instance: ScoringInstance) {
  const { elementData } = instance
  const hasSampleSolution =
    'options' in elementData &&
    'hasSampleSolution' in elementData.options &&
    (elementData.options.hasSampleSolution ?? false)
  const hasBasePoints =
    instance.elementType !== DB.ElementType.FLASHCARD &&
    instance.elementType !== DB.ElementType.CONTENT &&
    (instance.options.basePoints ?? false)

  return {
    hasSampleSolution,
    hasBasePoints,
    pointsMultiplier: instance.options.pointsMultiplier ?? 1,
  }
}

export function getInstanceAvailablePoints({
  instance,
  activityBasePoints,
  activityCorrectnessPoints,
  activityBonusPoints,
}: {
  instance: ScoringInstance
  activityBasePoints: number
  activityCorrectnessPoints: number
  activityBonusPoints: number
}) {
  const { hasSampleSolution, hasBasePoints, pointsMultiplier } =
    getInstanceScoringInfo(instance)

  return {
    basePoints: hasBasePoints ? activityBasePoints : 0,
    correctnessPoints: hasSampleSolution
      ? pointsMultiplier * activityCorrectnessPoints
      : 0,
    bonusPoints: hasSampleSolution ? pointsMultiplier * activityBonusPoints : 0,
  }
}

export async function calculateAssessmentCourseScores(
  {
    courseId,
    participantScope,
  }: { courseId: string; participantScope: 'ALL' | 'ACTIVE' },
  ctx: { prisma: PrismaTransactionClient }
): Promise<CourseScoreAggregate | null> {
  const activeParticipationWhere =
    participantScope === 'ACTIVE'
      ? { isActive: true, participant: { isActive: true } }
      : undefined
  const activeResponseWhere =
    participantScope === 'ACTIVE'
      ? {
          participant: {
            isActive: true,
            participations: { some: { courseId, isActive: true } },
          },
        }
      : undefined

  const course = await ctx.prisma.course.findUnique({
    where: { id: courseId, isAssessmentEnabled: true },
    select: {
      name: true,
      liveQuizzes: {
        where: {
          status: DB.PublicationStatus.ENDED,
          isDeleted: false,
          isAssessmentEnabled: true,
        },
        select: {
          defaultPoints: true,
          defaultCorrectPoints: true,
          maxBonusPoints: true,
          blocks: {
            select: {
              execution: true,
              elements: {
                select: {
                  elementData: true,
                  elementType: true,
                  options: true,
                  liveQuizResponses: {
                    where: activeResponseWhere,
                    select: {
                      participantId: true,
                      elementBlockExecution: true,
                      basePoints: true,
                      correctnessPoints: true,
                      bonusPoints: true,
                    },
                  },
                  _count: { select: { corrections: true } },
                },
              },
            },
          },
          _count: { select: { corrections: true } },
        },
      },
      participations: {
        where: activeParticipationWhere,
        select: { participantId: true },
      },
    },
  })

  if (!course) return null

  const initialStudentResults = Object.fromEntries(
    course.participations.map(({ participantId }) => [
      participantId,
      {
        participantId,
        basePoints: 0,
        correctnessPoints: 0,
        bonusPoints: 0,
      } satisfies CourseScoreResult,
    ])
  )

  const courseResults = course.liveQuizzes.reduce<
    Omit<CourseScoreAggregate, 'studentResults'> & {
      studentResults: Record<string, CourseScoreResult>
    }
  >(
    (courseAcc, liveQuiz) => {
      for (const block of liveQuiz.blocks) {
        for (const instance of block.elements) {
          const { basePoints, correctnessPoints, bonusPoints } =
            getInstanceAvailablePoints({
              instance,
              activityBasePoints: liveQuiz.defaultPoints,
              activityCorrectnessPoints: liveQuiz.defaultCorrectPoints,
              activityBonusPoints: liveQuiz.maxBonusPoints,
            })

          courseAcc.availableBasePoints += basePoints
          courseAcc.availableCorrectnessPoints += correctnessPoints
          courseAcc.availableBonusPoints += bonusPoints
          courseAcc.numberOfCorrections += instance._count.corrections

          for (const response of instance.liveQuizResponses) {
            if (response.elementBlockExecution !== block.execution) continue

            const result = (courseAcc.studentResults[response.participantId] ??=
              {
                participantId: response.participantId,
                basePoints: 0,
                correctnessPoints: 0,
                bonusPoints: 0,
              })
            result.basePoints += response.basePoints
            result.correctnessPoints += response.correctnessPoints
            result.bonusPoints += response.bonusPoints
          }
        }
      }

      courseAcc.numberOfCorrections += liveQuiz._count.corrections
      return courseAcc
    },
    {
      name: course.name,
      availableBasePoints: 0,
      availableCorrectnessPoints: 0,
      availableBonusPoints: 0,
      numberOfCorrections: 0,
      studentResults: initialStudentResults,
    }
  )

  return {
    ...courseResults,
    studentResults: Object.values(courseResults.studentResults),
  }
}
