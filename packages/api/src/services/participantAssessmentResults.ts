import {
  ElementType,
  PermissionLevel,
  UserLoginScope,
  type AppliedPointCorrection,
  type ElementInstance,
  type LiveQuiz,
  type LiveQuizResponse,
  type PointCorrection,
  type PrismaClient,
} from '@klicker-uzh/prisma/client'
import type {
  ActivityStudentPerformance,
  StudentPointCorrection,
} from '@klicker-uzh/types'
import type { TRPCContextWithUser } from '../trpc/context.js'
import { throwForbidden } from '../trpc/errors.js'

type AssessmentResponse = Pick<
  LiveQuizResponse,
  'basePoints' | 'bonusPoints' | 'correctnessPoints'
> & {
  appliedCorrections: (Pick<
    AppliedPointCorrection,
    | 'awardedBasePoints'
    | 'awardedBonusPoints'
    | 'awardedCorrectnessPoints'
    | 'deductedBasePoints'
    | 'deductedBonusPoints'
    | 'deductedCorrectnessPoints'
    | 'pointCorrectionId'
  > & {
    pointCorrection: Pick<
      PointCorrection,
      'createdAt' | 'reason' | 'studentReason'
    >
  })[]
}

type AssessmentElementInstance = Pick<
  ElementInstance,
  'elementData' | 'elementType' | 'options'
> & {
  liveQuizResponses: AssessmentResponse[]
}

type AssessmentLiveQuiz = Pick<
  LiveQuiz,
  | 'defaultCorrectPoints'
  | 'defaultPoints'
  | 'displayName'
  | 'finishedAt'
  | 'id'
  | 'maxBonusPoints'
  | 'pointsMultiplier'
> & {
  blocks: {
    elements: AssessmentElementInstance[]
  }[]
}

type AssessmentActivityPerformance = Omit<
  ActivityStudentPerformance,
  'corrections'
> & {
  corrections: (StudentPointCorrection & { createdAt: Date })[]
}

export type StudentAssessmentResults = {
  liveQuizzes: AssessmentActivityPerformance[]
  practiceQuizzes: AssessmentActivityPerformance[]
  microLearnings: AssessmentActivityPerformance[]
  groupActivities: AssessmentActivityPerformance[]
}

function emptyStudentAssessmentResults(): StudentAssessmentResults {
  return {
    liveQuizzes: [],
    practiceQuizzes: [],
    microLearnings: [],
    groupActivities: [],
  }
}

function asJsonObject(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function getBoolean(value: unknown) {
  return typeof value === 'boolean' ? value : false
}

function getNumber(value: unknown, fallback: number) {
  return typeof value === 'number' ? value : fallback
}

function getInstanceScoringInfo({
  instance,
}: {
  instance: AssessmentElementInstance
}) {
  const elementData = asJsonObject(instance.elementData)
  const elementDataOptions = asJsonObject(elementData.options)
  const instanceOptions = asJsonObject(instance.options)

  const hasSampleSolution = getBoolean(elementDataOptions.hasSampleSolution)
  const hasBasePoints =
    instance.elementType !== ElementType.FLASHCARD &&
    instance.elementType !== ElementType.CONTENT &&
    getBoolean(instanceOptions.basePoints)
  const pointsMultiplier = getNumber(instanceOptions.pointsMultiplier, 1)

  return { hasSampleSolution, hasBasePoints, pointsMultiplier }
}

function getInstanceAvailablePoints({
  activityBasePoints,
  activityBonusPoints,
  activityCorrectnessPoints,
  instance,
}: {
  activityBasePoints: number
  activityBonusPoints: number
  activityCorrectnessPoints: number
  instance: AssessmentElementInstance
}) {
  const { hasBasePoints, hasSampleSolution, pointsMultiplier } =
    getInstanceScoringInfo({ instance })

  return {
    basePoints: hasBasePoints ? activityBasePoints : 0,
    correctnessPoints: hasSampleSolution
      ? pointsMultiplier * activityCorrectnessPoints
      : 0,
    bonusPoints: hasSampleSolution ? pointsMultiplier * activityBonusPoints : 0,
  }
}

function getStudentAssessmentQuizPerformance({
  quiz,
}: {
  quiz: AssessmentLiveQuiz
}): AssessmentActivityPerformance {
  const quizResults = quiz.blocks.reduce<AssessmentActivityPerformance>(
    (quizAcc, block) => {
      const instanceResults = block.elements.reduce<
        Omit<
          AssessmentActivityPerformance,
          | 'activityId'
          | 'corrections'
          | 'displayName'
          | 'finishedAt'
          | 'id'
          | 'multiplier'
        > & {
          corrections: AssessmentActivityPerformance['corrections']
        }
      >(
        (blockAcc, instance) => {
          const { basePoints, bonusPoints, correctnessPoints } =
            getInstanceAvailablePoints({
              activityBasePoints: quiz.defaultPoints,
              activityBonusPoints: quiz.maxBonusPoints,
              activityCorrectnessPoints: quiz.defaultCorrectPoints,
              instance,
            })

          blockAcc.availableBasePoints += basePoints
          blockAcc.availableCorrectnessPoints += correctnessPoints
          blockAcc.availableBonusPoints += bonusPoints

          const response = instance.liveQuizResponses[0]
          if (response) {
            blockAcc.basePoints += response.basePoints
            blockAcc.correctnessPoints += response.correctnessPoints
            blockAcc.bonusPoints += response.bonusPoints

            blockAcc.corrections.push(
              ...response.appliedCorrections.map((correction) => ({
                id: correction.pointCorrectionId,
                createdAt: correction.pointCorrection.createdAt,
                lecturerReason: correction.pointCorrection.reason,
                studentReason: correction.pointCorrection.studentReason,
                awardedBasePoints: correction.awardedBasePoints,
                awardedCorrectnessPoints: correction.awardedCorrectnessPoints,
                awardedBonusPoints: correction.awardedBonusPoints,
                deductedBasePoints: correction.deductedBasePoints,
                deductedCorrectnessPoints: correction.deductedCorrectnessPoints,
                deductedBonusPoints: correction.deductedBonusPoints,
              }))
            )
          }

          return blockAcc
        },
        {
          basePoints: 0,
          availableBasePoints: 0,
          correctnessPoints: 0,
          availableCorrectnessPoints: 0,
          bonusPoints: 0,
          availableBonusPoints: 0,
          corrections: [],
        }
      )

      quizAcc.basePoints += instanceResults.basePoints
      quizAcc.availableBasePoints += instanceResults.availableBasePoints
      quizAcc.correctnessPoints += instanceResults.correctnessPoints
      quizAcc.availableCorrectnessPoints +=
        instanceResults.availableCorrectnessPoints
      quizAcc.bonusPoints += instanceResults.bonusPoints
      quizAcc.availableBonusPoints += instanceResults.availableBonusPoints
      quizAcc.corrections.push(...instanceResults.corrections)

      return quizAcc
    },
    {
      id: quiz.id,
      activityId: quiz.id,
      displayName: quiz.displayName,
      finishedAt: quiz.finishedAt!,
      multiplier: quiz.pointsMultiplier,
      basePoints: 0,
      availableBasePoints: 0,
      correctnessPoints: 0,
      availableCorrectnessPoints: 0,
      bonusPoints: 0,
      availableBonusPoints: 0,
      corrections: [],
    }
  )

  const groupedCorrections = quizResults.corrections.reduce<
    Record<string, AssessmentActivityPerformance['corrections']>
  >((acc, correction) => {
    if (!acc[correction.id]) {
      acc[correction.id] = []
    }
    acc[correction.id]!.push(correction)
    return acc
  }, {})

  const deduplicatedCorrections = Object.entries(groupedCorrections)
    .map(([correctionId, corrections]) =>
      corrections.reduce<StudentPointCorrection & { createdAt: Date }>(
        (acc, correction) => {
          acc.awardedBasePoints += correction.awardedBasePoints
          acc.awardedCorrectnessPoints += correction.awardedCorrectnessPoints
          acc.awardedBonusPoints += correction.awardedBonusPoints
          acc.deductedBasePoints += correction.deductedBasePoints
          acc.deductedCorrectnessPoints += correction.deductedCorrectnessPoints
          acc.deductedBonusPoints += correction.deductedBonusPoints
          return acc
        },
        {
          id: Number(correctionId),
          createdAt: corrections[0]!.createdAt,
          lecturerReason: corrections[0]!.lecturerReason,
          studentReason: corrections[0]!.studentReason,
          awardedBasePoints: 0,
          awardedCorrectnessPoints: 0,
          awardedBonusPoints: 0,
          deductedBasePoints: 0,
          deductedCorrectnessPoints: 0,
          deductedBonusPoints: 0,
        }
      )
    )
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())

  return {
    ...quizResults,
    corrections: deduplicatedCorrections,
  }
}

export async function getStudentAssessmentResults({
  courseId,
  participantId,
  prisma,
  user,
}: {
  courseId: string
  participantId: string
  prisma: PrismaClient
  user: TRPCContextWithUser['user']
}): Promise<StudentAssessmentResults> {
  const isAssessmentCourseAdmin = await prisma.derivedPermission.findUnique({
    where: {
      courseId_userId: {
        courseId,
        userId: user.sub,
      },
      permissionLevel: {
        in: [PermissionLevel.OWNER, PermissionLevel.ADMIN],
      },
      course: { isAssessmentEnabled: true },
    },
  })

  if (!isAssessmentCourseAdmin) {
    if (user.scope !== UserLoginScope.EDUID) {
      throwForbidden(
        'Only logged in assessment participants can access assessment results'
      )
    }

    const participation = await prisma.participation.findUnique({
      where: {
        courseId_participantId: {
          courseId,
          participantId,
        },
      },
    })

    if (!participation) {
      throwForbidden('Participation not found')
    }
  }

  const course = await prisma.course.findUnique({
    where: { id: courseId, isAssessmentEnabled: true },
    include: {
      liveQuizzes: {
        where: { isDeleted: false, finishedAt: { not: null } },
        orderBy: { finishedAt: 'desc' },
        include: {
          blocks: {
            include: {
              elements: {
                include: {
                  liveQuizResponses: {
                    where: { participantId },
                    include: {
                      appliedCorrections: {
                        include: { pointCorrection: true },
                        orderBy: { createdAt: 'desc' },
                      },
                    },
                    orderBy: { createdAt: 'desc' },
                    take: 1,
                  },
                },
                orderBy: { order: 'asc' },
              },
            },
            orderBy: { order: 'asc' },
          },
        },
      },
    },
  })

  if (!course) return emptyStudentAssessmentResults()

  return {
    liveQuizzes: course.liveQuizzes.map((quiz) =>
      getStudentAssessmentQuizPerformance({ quiz })
    ),
    practiceQuizzes: [],
    microLearnings: [],
    groupActivities: [],
  }
}
