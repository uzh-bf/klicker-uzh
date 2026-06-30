import {
  ElementType,
  PermissionLevel,
  PointCorrectionType,
  PublicationStatus,
  type AppliedPointCorrection,
  type ElementBlock,
  type ElementInstance,
  type LiveQuiz,
  type LiveQuizResponse,
  type Participant,
  type PointCorrection,
  type PrismaClient,
  type ResponseCorrectness,
  type User,
} from '@klicker-uzh/prisma/client'
import type {
  AssessmentResultsCourse,
  AssessmentResultsLiveQuiz,
  SingleQuestionResponseLiveQuiz,
  StudentAssessmentResultsItem,
} from '@klicker-uzh/types'
import type { PrismaTransactionClient } from '@klicker-uzh/util'
import type { TRPCContextWithUser } from '../trpc/context.js'
import { getStudentAssessmentResults } from './participantAssessmentResults.js'

type ParticipantWithAssessmentEmail = Pick<
  Participant,
  'email' | 'id' | 'username'
> & {
  accounts?: { ssoEmail: string | null }[]
}

type PointCorrectionParticipant = {
  email?: string | null
  id: string
  username: string
}

export type AssessmentParticipantListItem = {
  email: string
  id: string
  username: string
}

export type EndedLiveQuizSelectionItem = {
  displayName: string
  id: string
  instances: { id: string; name: string }[]
  name: string
}

export type PointCorrectionHistoryItem = Pick<
  PointCorrection,
  | 'basePoints'
  | 'bonusPoints'
  | 'correctnessPoints'
  | 'createdAt'
  | 'id'
  | 'reason'
  | 'studentReason'
  | 'type'
> & {
  correctedBy?: Pick<User, 'id' | 'shortname'> | null
  instance?: { elementData?: { name?: string } | null; id: number } | null
  liveQuiz?: Pick<LiveQuiz, 'id' | 'name'> | null
  participant?: PointCorrectionParticipant | null
  participants?: PointCorrectionParticipant[] | null
}

type AssessmentElementInstance = Pick<
  ElementInstance,
  'elementData' | 'elementType' | 'id' | 'options' | 'type'
>

export type LiveQuizStudentAssessmentResponseItem = {
  basePoints: number
  bonusPoints: number
  correctness?: ResponseCorrectness | null
  correctnessPoints: number
  corrections: (Pick<
    AppliedPointCorrection,
    | 'awardedBasePoints'
    | 'awardedBonusPoints'
    | 'awardedCorrectnessPoints'
    | 'deductedBasePoints'
    | 'deductedBonusPoints'
    | 'deductedCorrectnessPoints'
    | 'id'
  > & {
    pointCorrection: PointCorrectionHistoryItem
  })[]
  instance: AssessmentElementInstance
  submission?: SingleQuestionResponseLiveQuiz | null
}

export type LiveQuizStudentAssessmentBlock = {
  blockId: number
  instances: LiveQuizStudentAssessmentResponseItem[]
}

type AuditLogEntry = { message: { info: string } }

type AuditLogTaskContext = {
  tasks?: unknown
}

export type CorrectAssessmentPointsInput = {
  awardBasePoints?: boolean | null
  awardBonusPoints?: boolean | null
  awardCorrectnessPoints?: boolean | null
  deductBasePoints?: boolean | null
  deductBonusPoints?: boolean | null
  deductCorrectnessPoints?: boolean | null
  participantId?: string | null
  participantIds?: string[] | null
  reason: string
  scope: PointCorrectionType
  studentReason: string
}

type ElementInstanceWithBlock = ElementInstance & {
  elementBlock: ElementBlock
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

function getElementName(elementData: unknown) {
  const value = asJsonObject(elementData).name
  return typeof value === 'string' ? value : ''
}

function getParticipantEmail(
  participant: ParticipantWithAssessmentEmail | null | undefined,
  fallback?: string
): string
function getParticipantEmail(
  participant: ParticipantWithAssessmentEmail | null | undefined,
  fallback: null
): string | null
function getParticipantEmail(
  participant: ParticipantWithAssessmentEmail | null | undefined,
  fallback: string | null = 'Missing E-Mail'
) {
  return participant?.accounts?.[0]?.ssoEmail ?? participant?.email ?? fallback
}

function getCorrectionParticipant(
  participant: ParticipantWithAssessmentEmail | null | undefined
): PointCorrectionParticipant | null {
  if (!participant) return null

  return {
    id: participant.id,
    username: participant.username,
    email: getParticipantEmail(participant, null),
  }
}

function getInstanceScoringInfo({
  instance,
}: {
  instance: Pick<ElementInstance, 'elementData' | 'elementType' | 'options'>
}) {
  const elementDataOptions = asJsonObject(
    asJsonObject(instance.elementData).options
  )
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
  instance: Pick<ElementInstance, 'elementData' | 'elementType' | 'options'>
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

function hasNoPointAdjustment({
  awardBasePoints,
  awardBonusPoints,
  awardCorrectnessPoints,
  deductBasePoints,
  deductBonusPoints,
  deductCorrectnessPoints,
}: Pick<
  CorrectAssessmentPointsInput,
  | 'awardBasePoints'
  | 'awardBonusPoints'
  | 'awardCorrectnessPoints'
  | 'deductBasePoints'
  | 'deductBonusPoints'
  | 'deductCorrectnessPoints'
>) {
  return (
    awardBasePoints !== true &&
    awardCorrectnessPoints !== true &&
    awardBonusPoints !== true &&
    deductBasePoints !== true &&
    deductCorrectnessPoints !== true &&
    deductBonusPoints !== true
  )
}

function hasConflictingPointAdjustment({
  awardBasePoints,
  awardBonusPoints,
  awardCorrectnessPoints,
  deductBasePoints,
  deductBonusPoints,
  deductCorrectnessPoints,
}: Pick<
  CorrectAssessmentPointsInput,
  | 'awardBasePoints'
  | 'awardBonusPoints'
  | 'awardCorrectnessPoints'
  | 'deductBasePoints'
  | 'deductBonusPoints'
  | 'deductCorrectnessPoints'
>) {
  return (
    (awardBasePoints === true && deductBasePoints === true) ||
    (awardCorrectnessPoints === true && deductCorrectnessPoints === true) ||
    (awardBonusPoints === true && deductBonusPoints === true)
  )
}

function getPointCorrectionData({
  awardBasePoints,
  awardBonusPoints,
  awardCorrectnessPoints,
  deductBasePoints,
  deductBonusPoints,
  deductCorrectnessPoints,
}: Pick<
  CorrectAssessmentPointsInput,
  | 'awardBasePoints'
  | 'awardBonusPoints'
  | 'awardCorrectnessPoints'
  | 'deductBasePoints'
  | 'deductBonusPoints'
  | 'deductCorrectnessPoints'
>) {
  return {
    basePoints: awardBasePoints ? true : deductBasePoints ? false : null,
    correctnessPoints: awardCorrectnessPoints
      ? true
      : deductCorrectnessPoints
        ? false
        : null,
    bonusPoints: awardBonusPoints ? true : deductBonusPoints ? false : null,
  }
}

function toPointCorrectionHistoryItem({
  correctedBy,
  instance,
  liveQuiz,
  participant,
  participants,
  ...correction
}: PointCorrection & {
  correctedBy?: Pick<User, 'id' | 'shortname'> | null
  instance?: Pick<ElementInstance, 'elementData' | 'id'> | null
  liveQuiz?: Pick<LiveQuiz, 'id' | 'name'> | null
  participant?: ParticipantWithAssessmentEmail | null
  participants?: ParticipantWithAssessmentEmail[] | null
}): PointCorrectionHistoryItem {
  return {
    id: correction.id,
    type: correction.type,
    basePoints: correction.basePoints,
    correctnessPoints: correction.correctnessPoints,
    bonusPoints: correction.bonusPoints,
    reason: correction.reason,
    studentReason: correction.studentReason,
    createdAt: correction.createdAt,
    correctedBy: correctedBy
      ? { id: correctedBy.id, shortname: correctedBy.shortname }
      : null,
    participant: getCorrectionParticipant(participant),
    participants:
      participants
        ?.map((correctionParticipant) =>
          getCorrectionParticipant(correctionParticipant)
        )
        .filter(
          (
            correctionParticipant
          ): correctionParticipant is PointCorrectionParticipant =>
            correctionParticipant !== null
        ) ?? null,
    liveQuiz: liveQuiz ? { id: liveQuiz.id, name: liveQuiz.name } : null,
    instance: instance
      ? {
          id: instance.id,
          elementData: { name: getElementName(instance.elementData) },
        }
      : null,
  }
}

async function runAuditLogEntries(
  ctx: TRPCContextWithUser & AuditLogTaskContext,
  entries: AuditLogEntry[]
) {
  if (entries.length === 0) return
  const tasks = ctx.tasks as
    | {
        createAuditLogEntry?: {
          runNoWait(entries: AuditLogEntry[]): Promise<unknown> | unknown
        }
      }
    | undefined

  await tasks?.createAuditLogEntry?.runNoWait(entries)
}

async function upsertResponseAppliedCorrection(
  {
    awardBasePoints,
    awardBonusPoints,
    awardCorrectnessPoints,
    availableBasePoints,
    availableBonusPoints,
    availableCorrectnessPoints,
    correctionId,
    deductBasePoints,
    deductBonusPoints,
    deductCorrectnessPoints,
    instance,
    participantId,
    response,
  }: {
    awardBasePoints?: boolean | null
    awardBonusPoints?: boolean | null
    awardCorrectnessPoints?: boolean | null
    availableBasePoints: number
    availableBonusPoints: number
    availableCorrectnessPoints: number
    correctionId: number
    deductBasePoints?: boolean | null
    deductBonusPoints?: boolean | null
    deductCorrectnessPoints?: boolean | null
    instance: ElementInstanceWithBlock
    participantId: string
    response?: LiveQuizResponse | null
  },
  tx: PrismaTransactionClient,
  ctx: TRPCContextWithUser
) {
  const liveQuizResponse = await tx.liveQuizResponse.upsert({
    where:
      response !== null && typeof response !== 'undefined'
        ? { id: response.id }
        : { id: -1 },
    create: {
      correctionOnly: true,
      submittedAt: new Date(),
      timeSpent: -1,
      correctness: 'CORRECT',
      basePoints: awardBasePoints === true ? availableBasePoints : 0,
      correctnessPoints:
        awardCorrectnessPoints === true ? availableCorrectnessPoints : 0,
      bonusPoints: awardBonusPoints === true ? availableBonusPoints : 0,
      elementBlockExecution: instance.elementBlock.execution,
      instance: { connect: { id: instance.id } },
      participant: { connect: { id: participantId } },
    },
    update: {
      basePoints:
        awardBasePoints === true
          ? availableBasePoints
          : deductBasePoints === true
            ? 0
            : undefined,
      correctnessPoints:
        awardCorrectnessPoints === true
          ? availableCorrectnessPoints
          : deductCorrectnessPoints === true
            ? 0
            : undefined,
      bonusPoints:
        awardBonusPoints === true
          ? availableBonusPoints
          : deductBonusPoints === true
            ? 0
            : undefined,
    },
  })

  const appliedCorrection = await tx.appliedPointCorrection.create({
    data: {
      awardedBasePoints:
        awardBasePoints === true
          ? availableBasePoints - (response?.basePoints ?? 0)
          : 0,
      awardedCorrectnessPoints:
        awardCorrectnessPoints === true
          ? availableCorrectnessPoints - (response?.correctnessPoints ?? 0)
          : 0,
      awardedBonusPoints:
        awardBonusPoints === true
          ? availableBonusPoints - (response?.bonusPoints ?? 0)
          : 0,
      deductedBasePoints:
        deductBasePoints === true ? (response?.basePoints ?? 0) : 0,
      deductedCorrectnessPoints:
        deductCorrectnessPoints === true
          ? (response?.correctnessPoints ?? 0)
          : 0,
      deductedBonusPoints:
        deductBonusPoints === true ? (response?.bonusPoints ?? 0) : 0,
      pointCorrection: { connect: { id: correctionId } },
      response: { connect: { id: liveQuizResponse.id } },
    },
  })

  return {
    message: {
      info: `[INFO] [Correct Assessment Points] User ${ctx.user.sub} corrected points for participant ${liveQuizResponse.participantId} on instance ${instance.id}. Deducted points: base ${appliedCorrection.deductedBasePoints}, correctness ${appliedCorrection.deductedCorrectnessPoints}, bonus ${appliedCorrection.deductedBonusPoints}. Awarded points: base ${appliedCorrection.awardedBasePoints}, correctness ${appliedCorrection.awardedCorrectnessPoints}, bonus ${appliedCorrection.awardedBonusPoints}.`,
    },
  }
}

export async function getManageStudentCourseResults({
  courseId,
  participantId,
  prisma,
  user,
}: {
  courseId: string
  participantId: string
  prisma: PrismaClient
  user: TRPCContextWithUser['user']
}) {
  const studentResults = await getStudentAssessmentResults({
    courseId,
    participantId,
    prisma,
    user,
  })

  return studentResults.liveQuizzes
}

export async function getAssessmentResultsLiveQuiz({
  liveQuizId,
  preferredAffiliation = 'uzh',
  prisma,
  userId,
}: {
  liveQuizId: string
  preferredAffiliation?: string
  prisma: PrismaClient
  userId: string
}): Promise<AssessmentResultsLiveQuiz | null> {
  const liveQuiz = await prisma.liveQuiz.findUnique({
    where: {
      id: liveQuizId,
      isAssessmentEnabled: true,
      course: {
        isAssessmentEnabled: true,
        permissions: {
          some: {
            userId,
            permissionLevel: {
              in: [PermissionLevel.OWNER, PermissionLevel.ADMIN],
            },
          },
        },
      },
    },
    include: {
      blocks: {
        include: {
          elements: {
            include: {
              liveQuizResponses: {
                include: {
                  participant: {
                    include: {
                      accounts: { where: { ssoType: preferredAffiliation } },
                    },
                  },
                },
              },
              _count: { select: { corrections: true } },
            },
          },
        },
      },
      course: {
        include: {
          participations: {
            include: {
              participant: {
                include: {
                  accounts: { where: { ssoType: preferredAffiliation } },
                },
              },
            },
          },
        },
      },
      _count: { select: { corrections: true } },
    },
  })

  if (!liveQuiz || !liveQuiz.course) return null

  const initialStudentResults = liveQuiz.course.participations.reduce<
    Record<string, StudentAssessmentResultsItem>
  >((acc, participation) => {
    acc[participation.participantId] = {
      participantId: participation.participantId,
      participantEmail: getParticipantEmail(participation.participant),
      basePoints: 0,
      correctnessPoints: 0,
      bonusPoints: 0,
    }
    return acc
  }, {})

  const liveQuizResults = liveQuiz.blocks.reduce<{
    basePoints: number
    bonusPoints: number
    correctnessPoints: number
    students: Record<string, StudentAssessmentResultsItem>
  }>(
    (quizAcc, block) => {
      block.elements.forEach((instance) => {
        const { basePoints, bonusPoints, correctnessPoints } =
          getInstanceAvailablePoints({
            instance,
            activityBasePoints: liveQuiz.defaultPoints,
            activityBonusPoints: liveQuiz.maxBonusPoints,
            activityCorrectnessPoints: liveQuiz.defaultCorrectPoints,
          })

        quizAcc.basePoints += basePoints
        quizAcc.correctnessPoints += correctnessPoints
        quizAcc.bonusPoints += bonusPoints

        instance.liveQuizResponses
          .filter(
            (response) => response.elementBlockExecution === block.execution
          )
          .forEach((response) => {
            const email = getParticipantEmail(response.participant)

            if (quizAcc.students[response.participantId]) {
              quizAcc.students[response.participantId]!.basePoints +=
                response.basePoints
              quizAcc.students[response.participantId]!.correctnessPoints +=
                response.correctnessPoints
              quizAcc.students[response.participantId]!.bonusPoints +=
                response.bonusPoints
            } else {
              quizAcc.students[response.participantId] = {
                participantId: response.participantId,
                participantEmail: email,
                basePoints: response.basePoints,
                correctnessPoints: response.correctnessPoints,
                bonusPoints: response.bonusPoints,
              }
            }
          })
      })

      return quizAcc
    },
    {
      basePoints: 0,
      correctnessPoints: 0,
      bonusPoints: 0,
      students: initialStudentResults,
    }
  )

  return {
    name: liveQuiz.name,
    quizBasePoints: liveQuiz.defaultPoints,
    quizCorrectnessPoints: liveQuiz.defaultCorrectPoints,
    quizBonusPoints: liveQuiz.maxBonusPoints,
    availableBasePoints: liveQuizResults.basePoints,
    availableCorrectnessPoints: liveQuizResults.correctnessPoints,
    availableBonusPoints: liveQuizResults.bonusPoints,
    numberOfCorrections:
      liveQuiz._count.corrections +
      liveQuiz.blocks.reduce(
        (acc, block) =>
          acc +
          block.elements.reduce(
            (elementAcc, element) => elementAcc + element._count.corrections,
            0
          ),
        0
      ),
    studentResults: Object.values(liveQuizResults.students),
  }
}

export async function getAssessmentResultsCourse({
  courseId,
  preferredAffiliation = 'uzh',
  prisma,
}: {
  courseId: string
  preferredAffiliation?: string
  prisma: PrismaClient
}): Promise<AssessmentResultsCourse | null> {
  const course = await prisma.course.findUnique({
    where: { id: courseId, isAssessmentEnabled: true },
    include: {
      liveQuizzes: {
        where: {
          status: PublicationStatus.ENDED,
          isDeleted: false,
          isAssessmentEnabled: true,
        },
        include: {
          blocks: {
            include: {
              elements: {
                include: {
                  liveQuizResponses: {
                    include: {
                      participant: {
                        include: {
                          accounts: {
                            where: { ssoType: preferredAffiliation },
                          },
                        },
                      },
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
        include: {
          participant: {
            include: {
              accounts: { where: { ssoType: preferredAffiliation } },
            },
          },
        },
      },
    },
  })

  if (!course) return null

  const initialStudentResults = course.participations.reduce<
    Record<string, StudentAssessmentResultsItem>
  >((acc, participation) => {
    acc[participation.participantId] = {
      participantId: participation.participantId,
      participantEmail: getParticipantEmail(participation.participant),
      basePoints: 0,
      correctnessPoints: 0,
      bonusPoints: 0,
    }
    return acc
  }, {})

  const courseResults = course.liveQuizzes.reduce<
    Omit<AssessmentResultsCourse, 'studentResults'> & {
      studentResults: Record<string, StudentAssessmentResultsItem>
    }
  >(
    (courseAcc, liveQuiz) => {
      liveQuiz.blocks.forEach((block) => {
        block.elements.forEach((instance) => {
          const { basePoints, bonusPoints, correctnessPoints } =
            getInstanceAvailablePoints({
              instance,
              activityBasePoints: liveQuiz.defaultPoints,
              activityBonusPoints: liveQuiz.maxBonusPoints,
              activityCorrectnessPoints: liveQuiz.defaultCorrectPoints,
            })

          courseAcc.availableBasePoints += basePoints
          courseAcc.availableCorrectnessPoints += correctnessPoints
          courseAcc.availableBonusPoints += bonusPoints
          courseAcc.numberOfCorrections += instance._count.corrections

          instance.liveQuizResponses
            .filter(
              (response) => response.elementBlockExecution === block.execution
            )
            .forEach((response) => {
              const email = getParticipantEmail(response.participant)

              if (courseAcc.studentResults[response.participantId]) {
                courseAcc.studentResults[response.participantId]!.basePoints +=
                  response.basePoints
                courseAcc.studentResults[
                  response.participantId
                ]!.correctnessPoints += response.correctnessPoints
                courseAcc.studentResults[response.participantId]!.bonusPoints +=
                  response.bonusPoints
              } else {
                courseAcc.studentResults[response.participantId] = {
                  participantId: response.participantId,
                  participantEmail: email,
                  basePoints: response.basePoints,
                  correctnessPoints: response.correctnessPoints,
                  bonusPoints: response.bonusPoints,
                }
              }
            })
        })
      })

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

export async function getLiveQuizStudentAssessmentResponses({
  liveQuizId,
  participantId,
  prisma,
  userId,
}: {
  liveQuizId: string
  participantId: string
  prisma: PrismaClient
  userId: string
}): Promise<LiveQuizStudentAssessmentBlock[] | null> {
  const liveQuiz = await prisma.liveQuiz.findUnique({
    where: {
      id: liveQuizId,
      isAssessmentEnabled: true,
      course: {
        isAssessmentEnabled: true,
        permissions: {
          some: {
            userId,
            permissionLevel: {
              in: [PermissionLevel.OWNER, PermissionLevel.ADMIN],
            },
          },
        },
      },
    },
    include: {
      blocks: {
        include: {
          elements: {
            include: {
              liveQuizResponses: {
                where: { participantId },
                include: {
                  appliedCorrections: {
                    include: {
                      pointCorrection: {
                        include: {
                          correctedBy: true,
                          participant: {
                            include: {
                              accounts: { where: { ssoType: 'uzh' } },
                            },
                          },
                          participants: {
                            include: {
                              accounts: { where: { ssoType: 'uzh' } },
                            },
                          },
                          liveQuiz: true,
                        },
                      },
                    },
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
  })

  if (!liveQuiz) return null

  return liveQuiz.blocks.map((block) => ({
    blockId: block.id,
    instances: block.elements.map((instance) => {
      const response = instance.liveQuizResponses[0]

      if (response) {
        return {
          instance,
          corrections: response.appliedCorrections.map((appliedCorrection) => ({
            id: appliedCorrection.id,
            awardedBasePoints: appliedCorrection.awardedBasePoints,
            awardedCorrectnessPoints:
              appliedCorrection.awardedCorrectnessPoints,
            awardedBonusPoints: appliedCorrection.awardedBonusPoints,
            deductedBasePoints: appliedCorrection.deductedBasePoints,
            deductedCorrectnessPoints:
              appliedCorrection.deductedCorrectnessPoints,
            deductedBonusPoints: appliedCorrection.deductedBonusPoints,
            pointCorrection: toPointCorrectionHistoryItem({
              ...appliedCorrection.pointCorrection,
              instance,
            }),
          })),
          basePoints: response.basePoints,
          correctnessPoints: response.correctnessPoints,
          bonusPoints: response.bonusPoints,
          correctness: response.correctness,
          submission: response.response as SingleQuestionResponseLiveQuiz,
        }
      }

      return {
        instance,
        corrections: [],
        basePoints: 0,
        correctnessPoints: 0,
        bonusPoints: 0,
        correctness: null,
        submission: null,
      }
    }),
  }))
}

export async function getEndedLiveQuizzesCourse({
  courseId,
  prisma,
}: {
  courseId: string
  prisma: PrismaClient
}): Promise<EndedLiveQuizSelectionItem[]> {
  const course = await prisma.course.findUnique({
    where: { id: courseId },
    include: {
      liveQuizzes: {
        where: { isDeleted: false, status: PublicationStatus.ENDED },
        include: {
          blocks: {
            include: { elements: { orderBy: { order: 'asc' } } },
            orderBy: { order: 'asc' },
          },
        },
        orderBy: { finishedAt: 'desc' },
      },
    },
  })

  if (!course) return []

  return course.liveQuizzes.map((quiz) => ({
    id: quiz.id,
    name: quiz.name,
    displayName: quiz.displayName,
    instances: quiz.blocks.flatMap((block) =>
      block.elements.map((element) => ({
        id: element.id.toString(),
        name: getElementName(element.elementData),
      }))
    ),
  }))
}

export async function getAssessmentCourseParticipants({
  courseId,
  preferredAffiliation = 'uzh',
  prisma,
}: {
  courseId: string
  preferredAffiliation?: string
  prisma: PrismaClient
}): Promise<AssessmentParticipantListItem[]> {
  const course = await prisma.course.findUnique({
    where: { id: courseId, isAssessmentEnabled: true },
    include: {
      participations: {
        include: {
          participant: {
            include: { accounts: { where: { ssoType: preferredAffiliation } } },
          },
        },
      },
    },
  })

  if (!course) return []

  return course.participations
    .map((participation) => ({
      id: participation.participant.id,
      email: getParticipantEmail(participation.participant, 'E-Mail Missing'),
      username: participation.participant.username,
    }))
    .sort((a, b) => a.email.localeCompare(b.email))
}

export async function getPreviousPointCorrections({
  courseId,
  instanceId,
  liveQuizId,
  preferredAffiliation = 'uzh',
  prisma,
  userId,
}: {
  courseId?: string | null
  instanceId?: number | null
  liveQuizId?: string | null
  preferredAffiliation?: string
  prisma: PrismaClient
  userId: string
}): Promise<PointCorrectionHistoryItem[]> {
  if (!courseId && !liveQuizId && typeof instanceId !== 'number') {
    return []
  }

  const participantInclude = {
    accounts: { where: { ssoType: preferredAffiliation } },
  }

  if (typeof instanceId === 'number') {
    const instance = await prisma.elementInstance.findUnique({
      where: {
        id: instanceId,
        elementBlock: {
          liveQuiz: {
            isAssessmentEnabled: true,
            course: {
              isAssessmentEnabled: true,
              permissions: {
                some: {
                  userId,
                  permissionLevel: {
                    in: [PermissionLevel.OWNER, PermissionLevel.ADMIN],
                  },
                },
              },
            },
          },
        },
      },
      include: {
        corrections: {
          include: {
            correctedBy: true,
            participant: { include: participantInclude },
            participants: { include: participantInclude },
            liveQuiz: true,
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    })

    return (
      instance?.corrections.map((correction) =>
        toPointCorrectionHistoryItem({ ...correction, instance })
      ) ?? []
    )
  }

  if (liveQuizId) {
    const liveQuiz = await prisma.liveQuiz.findUnique({
      where: {
        id: liveQuizId,
        isAssessmentEnabled: true,
        course: {
          isAssessmentEnabled: true,
          permissions: {
            some: {
              userId,
              permissionLevel: {
                in: [PermissionLevel.OWNER, PermissionLevel.ADMIN],
              },
            },
          },
        },
      },
      include: {
        corrections: {
          include: {
            correctedBy: true,
            participant: { include: participantInclude },
            participants: { include: participantInclude },
          },
        },
        blocks: {
          include: {
            elements: {
              include: {
                corrections: {
                  include: {
                    correctedBy: true,
                    participant: { include: participantInclude },
                    participants: { include: participantInclude },
                    liveQuiz: true,
                  },
                },
              },
              orderBy: { order: 'asc' },
            },
          },
          orderBy: { order: 'asc' },
        },
      },
    })

    const quizCorrections =
      liveQuiz?.corrections.map((correction) =>
        toPointCorrectionHistoryItem({ ...correction, liveQuiz })
      ) ?? []
    const instanceCorrections =
      liveQuiz?.blocks.flatMap((block) =>
        block.elements.flatMap((element) =>
          element.corrections.map((correction) =>
            toPointCorrectionHistoryItem({
              ...correction,
              instance: element,
              liveQuiz,
            })
          )
        )
      ) ?? []

    return [...quizCorrections, ...instanceCorrections].sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
    )
  }

  const course = await prisma.course.findUnique({
    where: {
      id: courseId!,
      isAssessmentEnabled: true,
      permissions: {
        some: {
          userId,
          permissionLevel: {
            in: [PermissionLevel.OWNER, PermissionLevel.ADMIN],
          },
        },
      },
    },
    include: {
      liveQuizzes: {
        include: {
          corrections: {
            include: {
              correctedBy: true,
              participant: { include: participantInclude },
              participants: { include: participantInclude },
            },
          },
          blocks: {
            include: {
              elements: {
                include: {
                  corrections: {
                    include: {
                      correctedBy: true,
                      participant: { include: participantInclude },
                      participants: { include: participantInclude },
                      liveQuiz: true,
                    },
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

  const quizCorrections =
    course?.liveQuizzes.flatMap((liveQuiz) =>
      liveQuiz.corrections.map((correction) =>
        toPointCorrectionHistoryItem({ ...correction, liveQuiz })
      )
    ) ?? []
  const instanceCorrections =
    course?.liveQuizzes.flatMap((liveQuiz) =>
      liveQuiz.blocks.flatMap((block) =>
        block.elements.flatMap((element) =>
          element.corrections.map((correction) =>
            toPointCorrectionHistoryItem({
              ...correction,
              instance: element,
              liveQuiz,
            })
          )
        )
      )
    ) ?? []

  return [...quizCorrections, ...instanceCorrections].sort(
    (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
  )
}

export async function correctAssessmentPointsInstance({
  ctx,
  input,
  instanceId,
}: {
  ctx: TRPCContextWithUser & AuditLogTaskContext
  input: CorrectAssessmentPointsInput
  instanceId: number
}) {
  const {
    awardBasePoints,
    awardBonusPoints,
    awardCorrectnessPoints,
    deductBasePoints,
    deductBonusPoints,
    deductCorrectnessPoints,
    participantId,
    participantIds,
    reason,
    scope,
    studentReason,
  } = input

  if (scope === PointCorrectionType.SINGLE && !participantId) return null
  if (
    scope === PointCorrectionType.MULTIPLE &&
    (!participantIds || participantIds.length === 0)
  ) {
    return null
  }
  if (hasNoPointAdjustment(input) || hasConflictingPointAdjustment(input)) {
    return null
  }

  const instance = await ctx.prisma.elementInstance.findUnique({
    where: {
      id: instanceId,
      elementBlock: {
        liveQuiz: {
          isAssessmentEnabled: true,
          course: {
            isAssessmentEnabled: true,
            permissions: {
              some: {
                userId: ctx.user.sub,
                permissionLevel: {
                  in: [PermissionLevel.OWNER, PermissionLevel.ADMIN],
                },
              },
            },
          },
        },
      },
    },
    include: { elementBlock: { include: { liveQuiz: true } } },
  })

  if (!instance?.elementBlock?.liveQuiz.courseId) return null

  const {
    basePoints: availableBasePoints,
    bonusPoints: availableBonusPoints,
    correctnessPoints: availableCorrectnessPoints,
  } = getInstanceAvailablePoints({
    instance,
    activityBasePoints: instance.elementBlock.liveQuiz.defaultPoints,
    activityBonusPoints: instance.elementBlock.liveQuiz.maxBonusPoints,
    activityCorrectnessPoints:
      instance.elementBlock.liveQuiz.defaultCorrectPoints,
  })

  if (scope === PointCorrectionType.SINGLE && participantId) {
    const response = await ctx.prisma.liveQuizResponse.findUnique({
      where: {
        instanceId_elementBlockExecution_participantId: {
          instanceId,
          elementBlockExecution: instance.elementBlock.execution,
          participantId,
        },
      },
    })

    return ctx.prisma.$transaction(
      async (tx) => {
        const correction = await tx.pointCorrection.create({
          data: {
            ...getPointCorrectionData(input),
            reason,
            studentReason,
            type: PointCorrectionType.SINGLE,
            correctedBy: { connect: { id: ctx.user.sub } },
            participant: { connect: { id: participantId } },
            instance: { connect: { id: instanceId } },
          },
        })

        const logEntry = await upsertResponseAppliedCorrection(
          {
            correctionId: correction.id,
            instance: instance as ElementInstanceWithBlock,
            response,
            participantId,
            awardBasePoints,
            awardCorrectnessPoints,
            awardBonusPoints,
            deductBasePoints,
            deductCorrectnessPoints,
            deductBonusPoints,
            availableBasePoints,
            availableCorrectnessPoints,
            availableBonusPoints,
          },
          tx,
          ctx
        )

        await runAuditLogEntries(ctx, [logEntry])
        return correction
      },
      { timeout: 300000 }
    )
  }

  if (scope === PointCorrectionType.PARTICIPATING) {
    const responses = await ctx.prisma.liveQuizResponse.findMany({
      where: {
        instanceId,
        elementBlockExecution: instance.elementBlock.execution,
        correctionOnly: false,
      },
    })

    return ctx.prisma.$transaction(
      async (tx) => {
        const correction = await tx.pointCorrection.create({
          data: {
            ...getPointCorrectionData(input),
            reason,
            studentReason,
            type: PointCorrectionType.PARTICIPATING,
            correctedBy: { connect: { id: ctx.user.sub } },
            instance: { connect: { id: instanceId } },
          },
        })

        const logEntries = await Promise.all(
          responses.map((response) =>
            upsertResponseAppliedCorrection(
              {
                correctionId: correction.id,
                instance: instance as ElementInstanceWithBlock,
                response,
                participantId: response.participantId,
                awardBasePoints,
                awardCorrectnessPoints,
                awardBonusPoints,
                deductBasePoints,
                deductCorrectnessPoints,
                deductBonusPoints,
                availableBasePoints,
                availableCorrectnessPoints,
                availableBonusPoints,
              },
              tx,
              ctx
            )
          )
        )

        await runAuditLogEntries(ctx, logEntries)
        return correction
      },
      { timeout: 300000 }
    )
  }

  if (
    scope === PointCorrectionType.ALL_COURSE ||
    scope === PointCorrectionType.MULTIPLE
  ) {
    const participations = await ctx.prisma.participation.findMany({
      where: {
        courseId: instance.elementBlock.liveQuiz.courseId,
        participantId:
          scope === PointCorrectionType.MULTIPLE
            ? { in: participantIds! }
            : undefined,
      },
      include: {
        participant: {
          include: {
            liveQuizResponses: {
              where: {
                instanceId,
                elementBlockExecution: instance.elementBlock.execution,
              },
            },
          },
        },
      },
    })

    return ctx.prisma.$transaction(
      async (tx) => {
        const correction = await tx.pointCorrection.create({
          data: {
            ...getPointCorrectionData(input),
            reason,
            studentReason,
            type: scope,
            correctedBy: { connect: { id: ctx.user.sub } },
            participants:
              scope === PointCorrectionType.MULTIPLE
                ? { connect: participantIds!.map((id) => ({ id })) }
                : undefined,
            instance: { connect: { id: instanceId } },
          },
        })

        const logEntries = await Promise.all(
          participations.map((participation) =>
            upsertResponseAppliedCorrection(
              {
                correctionId: correction.id,
                instance: instance as ElementInstanceWithBlock,
                response: participation.participant.liveQuizResponses[0],
                participantId: participation.participantId,
                awardBasePoints,
                awardCorrectnessPoints,
                awardBonusPoints,
                deductBasePoints,
                deductCorrectnessPoints,
                deductBonusPoints,
                availableBasePoints,
                availableCorrectnessPoints,
                availableBonusPoints,
              },
              tx,
              ctx
            )
          )
        )

        await runAuditLogEntries(ctx, logEntries)
        return correction
      },
      { timeout: 300000 }
    )
  }

  return null
}

export async function correctAssessmentPointsLiveQuiz({
  ctx,
  input,
  liveQuizId,
}: {
  ctx: TRPCContextWithUser & AuditLogTaskContext
  input: CorrectAssessmentPointsInput
  liveQuizId: string
}) {
  const {
    awardBasePoints,
    awardBonusPoints,
    awardCorrectnessPoints,
    deductBasePoints,
    deductBonusPoints,
    deductCorrectnessPoints,
    participantId,
    participantIds,
    reason,
    scope,
    studentReason,
  } = input

  if (scope === PointCorrectionType.SINGLE && !participantId) return null
  if (
    scope === PointCorrectionType.MULTIPLE &&
    (!participantIds || participantIds.length === 0)
  ) {
    return null
  }
  if (hasNoPointAdjustment(input) || hasConflictingPointAdjustment(input)) {
    return null
  }

  const liveQuiz = await ctx.prisma.liveQuiz.findUnique({
    where: {
      id: liveQuizId,
      isAssessmentEnabled: true,
      course: {
        isAssessmentEnabled: true,
        permissions: {
          some: {
            userId: ctx.user.sub,
            permissionLevel: {
              in: [PermissionLevel.OWNER, PermissionLevel.ADMIN],
            },
          },
        },
      },
    },
    include: {
      blocks: {
        include: { elements: { orderBy: { order: 'asc' } } },
        orderBy: { order: 'asc' },
      },
    },
  })

  if (!liveQuiz?.courseId) return null

  const availablePoints = liveQuiz.blocks.reduce<
    Record<
      number,
      {
        availableBasePoints: number
        availableBonusPoints: number
        availableCorrectnessPoints: number
      }
    >
  >((acc, block) => {
    block.elements.forEach((instance) => {
      const { basePoints, bonusPoints, correctnessPoints } =
        getInstanceAvailablePoints({
          instance,
          activityBasePoints: liveQuiz.defaultPoints,
          activityBonusPoints: liveQuiz.maxBonusPoints,
          activityCorrectnessPoints: liveQuiz.defaultCorrectPoints,
        })

      acc[instance.id] = {
        availableBasePoints: basePoints,
        availableCorrectnessPoints: correctnessPoints,
        availableBonusPoints: bonusPoints,
      }
    })
    return acc
  }, {})

  if (scope === PointCorrectionType.SINGLE && participantId) {
    return ctx.prisma.$transaction(
      async (tx) => {
        const correction = await tx.pointCorrection.create({
          data: {
            ...getPointCorrectionData(input),
            reason,
            studentReason,
            type: PointCorrectionType.SINGLE,
            correctedBy: { connect: { id: ctx.user.sub } },
            participant: { connect: { id: participantId } },
            liveQuiz: { connect: { id: liveQuiz.id } },
          },
        })

        const logEntries = await Promise.all(
          liveQuiz.blocks.flatMap((block) =>
            block.elements.map(async (instance) => {
              const response = await tx.liveQuizResponse.findUnique({
                where: {
                  instanceId_elementBlockExecution_participantId: {
                    instanceId: instance.id,
                    elementBlockExecution: block.execution,
                    participantId,
                  },
                },
              })

              return upsertResponseAppliedCorrection(
                {
                  correctionId: correction.id,
                  instance: { ...instance, elementBlock: block },
                  response,
                  participantId,
                  awardBasePoints,
                  awardCorrectnessPoints,
                  awardBonusPoints,
                  deductBasePoints,
                  deductCorrectnessPoints,
                  deductBonusPoints,
                  availableBasePoints:
                    availablePoints[instance.id]!.availableBasePoints,
                  availableCorrectnessPoints:
                    availablePoints[instance.id]!.availableCorrectnessPoints,
                  availableBonusPoints:
                    availablePoints[instance.id]!.availableBonusPoints,
                },
                tx,
                ctx
              )
            })
          )
        )

        await runAuditLogEntries(ctx, logEntries)
        return correction
      },
      { timeout: 300000 }
    )
  }

  if (scope === PointCorrectionType.PARTICIPATING) {
    const quizWithResponses = await ctx.prisma.liveQuiz.findUnique({
      where: { id: liveQuiz.id },
      include: {
        blocks: {
          include: { elements: { include: { liveQuizResponses: true } } },
        },
      },
    })

    if (!quizWithResponses) return null

    const participantResponseMap = quizWithResponses.blocks.reduce<
      Record<string, Record<number, LiveQuizResponse>>
    >((acc, block) => {
      block.elements.forEach((instance) => {
        instance.liveQuizResponses
          .filter(
            (response) => response.elementBlockExecution === block.execution
          )
          .forEach((response) => {
            if (!acc[response.participantId]) {
              acc[response.participantId] = {}
            }
            acc[response.participantId]![instance.id] = response
          })
      })
      return acc
    }, {})

    const filteredParticipantResponseMap = Object.fromEntries(
      Object.entries(participantResponseMap).filter(([, instanceResponseMap]) =>
        Object.values(instanceResponseMap).some(
          (response) => response.correctionOnly === false
        )
      )
    )

    return ctx.prisma.$transaction(
      async (tx) => {
        const correction = await tx.pointCorrection.create({
          data: {
            ...getPointCorrectionData(input),
            reason,
            studentReason,
            type: PointCorrectionType.PARTICIPATING,
            correctedBy: { connect: { id: ctx.user.sub } },
            liveQuiz: { connect: { id: liveQuiz.id } },
          },
        })

        const logEntries = await Promise.all(
          liveQuiz.blocks.flatMap((block) =>
            block.elements.flatMap((instance) =>
              Object.entries(filteredParticipantResponseMap).map(
                ([pId, instanceResponseMap]) =>
                  upsertResponseAppliedCorrection(
                    {
                      correctionId: correction.id,
                      instance: { ...instance, elementBlock: block },
                      response: instanceResponseMap[instance.id],
                      participantId: pId,
                      awardBasePoints,
                      awardCorrectnessPoints,
                      awardBonusPoints,
                      deductBasePoints,
                      deductCorrectnessPoints,
                      deductBonusPoints,
                      availableBasePoints:
                        availablePoints[instance.id]!.availableBasePoints,
                      availableCorrectnessPoints:
                        availablePoints[instance.id]!
                          .availableCorrectnessPoints,
                      availableBonusPoints:
                        availablePoints[instance.id]!.availableBonusPoints,
                    },
                    tx,
                    ctx
                  )
              )
            )
          )
        )

        await runAuditLogEntries(ctx, logEntries)
        return correction
      },
      { timeout: 300000 }
    )
  }

  if (
    scope === PointCorrectionType.ALL_COURSE ||
    scope === PointCorrectionType.MULTIPLE
  ) {
    const participations = await ctx.prisma.participation.findMany({
      where: {
        courseId: liveQuiz.courseId,
        participantId:
          scope === PointCorrectionType.MULTIPLE
            ? { in: participantIds! }
            : undefined,
      },
      include: { participant: true },
    })

    return ctx.prisma.$transaction(
      async (tx) => {
        const correction = await tx.pointCorrection.create({
          data: {
            ...getPointCorrectionData(input),
            reason,
            studentReason,
            type: scope,
            correctedBy: { connect: { id: ctx.user.sub } },
            participants:
              scope === PointCorrectionType.MULTIPLE
                ? { connect: participantIds!.map((id) => ({ id })) }
                : undefined,
            liveQuiz: { connect: { id: liveQuiz.id } },
          },
        })

        const logEntries = await Promise.all(
          liveQuiz.blocks.flatMap((block) =>
            block.elements.flatMap((instance) =>
              participations.map(async (participation) => {
                const response = await tx.liveQuizResponse.findUnique({
                  where: {
                    instanceId_elementBlockExecution_participantId: {
                      instanceId: instance.id,
                      elementBlockExecution: block.execution,
                      participantId: participation.participantId,
                    },
                  },
                })

                return upsertResponseAppliedCorrection(
                  {
                    correctionId: correction.id,
                    instance: { ...instance, elementBlock: block },
                    response,
                    participantId: participation.participantId,
                    awardBasePoints,
                    awardCorrectnessPoints,
                    awardBonusPoints,
                    deductBasePoints,
                    deductCorrectnessPoints,
                    deductBonusPoints,
                    availableBasePoints:
                      availablePoints[instance.id]!.availableBasePoints,
                    availableCorrectnessPoints:
                      availablePoints[instance.id]!.availableCorrectnessPoints,
                    availableBonusPoints:
                      availablePoints[instance.id]!.availableBonusPoints,
                  },
                  tx,
                  ctx
                )
              })
            )
          )
        )

        await runAuditLogEntries(ctx, logEntries)
        return correction
      },
      { timeout: 300000 }
    )
  }

  return null
}
