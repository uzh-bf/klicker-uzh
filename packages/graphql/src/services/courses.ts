import { ICourse, type ILeaderboardEntry } from '@/schema/course.js'
import * as DB from '@klicker-uzh/prisma/client'
import {
  ActivityStudentPerformance,
  ActivityType,
  AssessmentResultsCourse,
  AssessmentResultsLiveQuiz,
  HATCHET_EVENTS,
  PointCorrectionType,
  RecomputeLearningAnalyticsInput,
  SharingType,
  StudentAssessmentBlockResponse,
  StudentAssessmentInstanceResponse,
  StudentAssessmentResultsItem,
  StudentPointCorrection,
} from '@klicker-uzh/types'
import {
  levelFromXp,
  PrismaTransactionClient,
  recomputeDerivedPermissions,
} from '@klicker-uzh/util'
import dayjs from 'dayjs'
import customParseFormat from 'dayjs/plugin/customParseFormat.js'
import { random } from 'mathjs'
import { prop, sortBy } from 'remeda'
import type { Context, ContextWithUser } from '../lib/context.js'
import convertDateToUTCDatetime from '../lib/convertDateToUTCDatetime.js'
import {
  assertLearningAnalyticsChoiceProvided,
  assertLearningAnalyticsRolloutEnabled,
  buildLearningAnalyticsChoiceData,
  isLearningAnalyticsAvailableForCourse,
  isLearningAnalyticsChoiceCurrent,
  type LearningAnalyticsChoiceStatus,
} from '../lib/learningAnalytics.js'
import { deleteDedicatedLearningAnalyticsForCourse } from '../lib/learningAnalyticsCleanup.js'
import { computeRanks, orderStacks } from '../lib/util.js'
import {
  calculateAssessmentCourseScores,
  getInstanceAvailablePoints,
} from './assessmentScores.js'
import { checkAccess } from './sharing.js'

// custom date parser
dayjs.extend(customParseFormat)

export async function getBasicCourseInformation(
  { courseId }: { courseId: string },
  ctx: Context
) {
  const course = await ctx.prisma.course.findUnique({
    where: { id: courseId },
    include: { owner: true },
  })

  if (!course) {
    return null
  }

  return course
}

export async function joinCourseWithPin(
  {
    pin,
    learningAnalyticsStatus,
  }: {
    pin: number
    learningAnalyticsStatus?: LearningAnalyticsChoiceStatus | null
  },
  ctx: ContextWithUser
) {
  const updatedParticipant = await ctx.prisma.$transaction(async (prisma) => {
    const courseCandidate = await prisma.course.findUnique({
      where: { pinCode: pin, isAssessmentEnabled: false },
    })

    if (
      !courseCandidate ||
      courseCandidate.pinCode !== pin ||
      ctx.user.role !== DB.UserRole.PARTICIPANT
    ) {
      return null
    }

    await prisma.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${courseCandidate.id}))::text`

    const course = await prisma.course.findUnique({
      where: {
        id: courseCandidate.id,
        pinCode: pin,
        isAssessmentEnabled: false,
      },
    })
    if (!course) {
      return null
    }

    assertLearningAnalyticsChoiceProvided(
      course.isLearningAnalyticsEnabled,
      learningAnalyticsStatus
    )

    const existingParticipation = await prisma.participation.findUnique({
      where: {
        courseId_participantId: {
          courseId: course.id,
          participantId: ctx.user.sub,
        },
      },
    })
    const shouldSetChoice =
      isLearningAnalyticsAvailableForCourse(
        course.isLearningAnalyticsEnabled
      ) &&
      learningAnalyticsStatus &&
      (!existingParticipation ||
        !isLearningAnalyticsChoiceCurrent(existingParticipation))
    const choiceData = shouldSetChoice
      ? buildLearningAnalyticsChoiceData(learningAnalyticsStatus)
      : {}

    await prisma.participation.upsert({
      where: {
        courseId_participantId: {
          courseId: course.id,
          participantId: ctx.user.sub,
        },
      },
      create: {
        courseId: course.id,
        participantId: ctx.user.sub,
        ...choiceData,
      },
      update: choiceData,
    })

    return prisma.participant.findUnique({
      where: { id: ctx.user.sub },
    })
  })

  if (updatedParticipant) {
    ctx.emitter.emit('invalidate', {
      typename: 'Participant',
      id: updatedParticipant.id,
    })
  }

  return updatedParticipant
}

export async function joinCourseLeaderboard(
  { courseId }: { courseId: string },
  ctx: ContextWithUser
) {
  // upsert or activate participation in the course
  const participation = await ctx.prisma.participation.upsert({
    where: {
      courseId_participantId: {
        courseId,
        participantId: ctx.user.sub,
      },
    },
    create: {
      isActive: true,
      course: { connect: { id: courseId } },
      participant: { connect: { id: ctx.user.sub } },
    },
    update: { isActive: true },
  })

  if (!participation) return null

  // upsert a course leaderboard entry with zero points
  const lbEntry = await ctx.prisma.leaderboardEntry.upsert({
    where: {
      type_participantId_courseId: {
        type: DB.LeaderboardType.COURSE,
        participantId: ctx.user.sub,
        courseId,
      },
    },
    create: {
      type: DB.LeaderboardType.COURSE,
      participant: { connect: { id: ctx.user.sub } },
      course: { connect: { id: courseId } },
      participation: { connect: { id: participation.id } },
      score: 0,
    },
    update: {},
  })

  // invalidate participation and leaderboard entry
  ctx.emitter.emit('invalidate', {
    typename: 'Participation',
    id: participation.id,
  })
  ctx.emitter.emit('invalidate', {
    typename: 'LeaderboardEntry',
    id: lbEntry.id,
  })

  return {
    id: `${courseId}-${ctx.user.sub}`,
    participation,
    lbEntry,
  }
}

export async function ensureParticipation(
  { courseId }: { courseId: string },
  ctx: ContextWithUser
) {
  try {
    const course = await ctx.prisma.course.findUnique({
      where: { id: courseId },
      select: { id: true },
    })

    if (!course) {
      return false
    }

    const participation = await ctx.prisma.participation.findUnique({
      where: {
        courseId_participantId: {
          courseId,
          participantId: ctx.user.sub,
        },
      },
      select: { id: true },
    })

    return participation !== null
  } catch (error) {
    console.error('ensureParticipation failed', {
      courseId,
      participantId: ctx.user.sub,
      error,
    })
    return false
  }
}

export async function leaveCourseLeaderboard(
  { courseId }: { courseId: string },
  ctx: ContextWithUser
) {
  // leave a course leaderboard as a participant
  // deletes the leaderboard entries related to the course and sets the participation to inactive
  // meaning that no further points will be collected
  const participation = await ctx.prisma.participation.update({
    where: {
      courseId_participantId: {
        courseId,
        participantId: ctx.user.sub,
      },
    },
    data: {
      isActive: false,
    },
  })

  // delete the course leaderboard entry linked to the participation
  await ctx.prisma.leaderboardEntry.delete({
    where: {
      type_participantId_courseId: {
        type: DB.LeaderboardType.COURSE,
        participantId: ctx.user.sub,
        courseId,
      },
    },
  })

  // TODO: check if this deletion operation has any effect or can be removed
  await ctx.prisma.leaderboardEntry.deleteMany({
    where: { participation: { id: participation.id } },
  })

  // delete all session leaderboard entries linked to the participation
  await ctx.prisma.leaderboardEntry.deleteMany({
    where: { sessionParticipationId: participation.id },
  })

  // reset collected points on timeline entries linked to this participation
  await ctx.prisma.timelineEntry.updateMany({
    where: { participationId: participation.id },
    data: {
      collectedPoints: 0,
    },
  })

  // TODO: reset collected points and points dates on questionresponse and questionresponsedetail

  if (!participation) return null

  return {
    id: `${courseId}-${ctx.user.sub}`,
    participation,
  }
}

export async function getCourseOverviewData(
  { courseId }: { courseId: string },
  ctx: Context
) {
  // TODO: a lot of fetching seems to be duplicated with the large joins here - optimize where possible
  if (ctx.user?.sub && ctx.user.role === DB.UserRole.PARTICIPANT) {
    const participation = await ctx.prisma.participation.findUnique({
      where: {
        courseId_participantId: {
          courseId,
          participantId: ctx.user.sub,
        },
      },
      include: {
        course: {
          include: {
            participantGroups: true,
            awards: {
              include: { participant: true, participantGroup: true },
              orderBy: { order: 'asc' },
            },
          },
        },
        participant: { include: { participantGroups: true } },
      },
    })

    if (participation) {
      const allGroupEntries = participation.course.participantGroups.reduce<{
        mapped: (DB.ParticipantGroup & { score: number; isMember: boolean })[]
        sum: number
        count: number
      }>(
        (acc, group) => {
          const score = group.averageMemberScore + group.groupActivityScore
          return {
            mapped: [
              ...acc.mapped,
              {
                ...group,
                score,
                isMember: participation.participant.participantGroups.some(
                  (g) => g.id === group.id
                ),
              },
            ],
            count: acc.count + 1,
            sum: acc.sum + score,
          }
        },
        { mapped: [], count: 0, sum: 0 }
      )

      const sortedGroupEntries = sortBy(
        allGroupEntries.mapped,
        [prop('score'), 'desc'],
        [prop('name'), 'asc']
      )

      const filteredGroupEntries = computeRanks(sortedGroupEntries)

      const groupCreationPoolEntry =
        await ctx.prisma.groupAssignmentPoolEntry.findUnique({
          where: {
            courseId_participantId: {
              courseId,
              participantId: ctx.user.sub,
            },
          },
        })

      return {
        id: `${courseId}-${participation.participant.id}`,
        course: participation.course,
        participant: participation.participant,
        participation,
        groupLeaderboard: filteredGroupEntries,
        groupLeaderboardStatistics: {
          participantCount: allGroupEntries.count,
          averageScore:
            allGroupEntries.count > 0
              ? allGroupEntries.sum / allGroupEntries.count
              : 0,
        },
        inRandomGroupPool: groupCreationPoolEntry !== null,
      }
    }
  }

  const course = await ctx.prisma.course.findUnique({
    where: { id: courseId },
    include: {
      awards: { include: { participant: true, participantGroup: true } },
    },
  })

  if (!course) return null

  let participant: DB.Participant | null = null
  if (ctx.user?.sub && ctx.user.role === DB.UserRole.PARTICIPANT) {
    participant = await ctx.prisma.participant.findUnique({
      where: { id: ctx.user.sub },
    })
  }

  return {
    id: `${courseId}-${participant?.id}`,
    course,
    participant,
    participation: null,
  }
}

function getStudentAssessmentQuizPerformance({
  quiz,
}: {
  quiz: DB.LiveQuiz & {
    blocks: (DB.ElementBlock & {
      elements: (DB.ElementInstance & {
        liveQuizResponses: (DB.LiveQuizResponse & {
          appliedCorrections: (DB.AppliedPointCorrection & {
            pointCorrection: DB.PointCorrection
          })[]
        })[]
      })[]
    })[]
  }
}) {
  // extract the scoring-related parameters from the live quiz
  const defaultPoints = quiz.defaultPoints
  const defaultCorrectPoints = quiz.defaultCorrectPoints
  const defaultMaxBonusPoints = quiz.maxBonusPoints

  const quizResults = quiz.blocks.reduce<
    Omit<ActivityStudentPerformance, 'corrections'> & {
      corrections: (StudentPointCorrection & { createdAt: Date })[]
    }
  >(
    (quizAcc, block) => {
      const instanceResults = block.elements.reduce<
        Omit<
          ActivityStudentPerformance,
          | 'id'
          | 'activityId'
          | 'displayName'
          | 'finishedAt'
          | 'multiplier'
          | 'corrections'
        > & {
          corrections: (StudentPointCorrection & { createdAt: Date })[]
        }
      >(
        (blockAcc, instance) => {
          const { basePoints, correctnessPoints, bonusPoints } =
            getInstanceAvailablePoints({
              instance,
              activityBasePoints: defaultPoints,
              activityCorrectnessPoints: defaultCorrectPoints,
              activityBonusPoints: defaultMaxBonusPoints,
            })

          blockAcc.availableBasePoints += basePoints
          blockAcc.availableCorrectnessPoints += correctnessPoints
          blockAcc.availableBonusPoints += bonusPoints

          if (
            instance.liveQuizResponses.length > 0 &&
            instance.liveQuizResponses[0]
          ) {
            const response = instance.liveQuizResponses[0]
            blockAcc.basePoints += response.basePoints
            blockAcc.correctnessPoints += response.correctnessPoints
            blockAcc.bonusPoints += response.bonusPoints

            if (response.appliedCorrections.length > 0) {
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
                  deductedCorrectnessPoints:
                    correction.deductedCorrectnessPoints,
                  deductedBonusPoints: correction.deductedBonusPoints,
                }))
              )
            }
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

      // increment the results of the block corresponding to the instance results
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

  // deduplicate the corrections on quiz level -> only one entry per correction on student view
  let deduplicatedCorrections: (StudentPointCorrection & {
    createdAt: Date
  })[] = []
  if (quizResults.corrections.length > 0) {
    // group the corrections by correctionId and aggregate the contained corrections
    // -> per applied correction by the lecturer, only one entry should be shown on the quiz performance entry
    const groupedCorrections = quizResults.corrections.reduce<
      Record<string, (StudentPointCorrection & { createdAt: Date })[]>
    >((acc, correction) => {
      if (!acc[correction.id]) {
        acc[correction.id] = []
      }
      acc[correction.id]!.push(correction)
      return acc
    }, {})

    // for each group, create a new aggregated correction object
    for (const [correctionId, corrections] of Object.entries(
      groupedCorrections
    )) {
      const aggregatedCorrection = corrections.reduce<
        StudentPointCorrection & { createdAt: Date }
      >(
        (acc, appliedCorrection) => {
          acc.awardedBasePoints += appliedCorrection.awardedBasePoints
          acc.awardedCorrectnessPoints +=
            appliedCorrection.awardedCorrectnessPoints
          acc.awardedBonusPoints += appliedCorrection.awardedBonusPoints
          acc.deductedBasePoints += appliedCorrection.deductedBasePoints
          acc.deductedCorrectnessPoints +=
            appliedCorrection.deductedCorrectnessPoints
          acc.deductedBonusPoints += appliedCorrection.deductedBonusPoints
          return acc
        },
        {
          id: parseInt(correctionId),
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

      deduplicatedCorrections.push(aggregatedCorrection)
    }
  }

  return {
    ...quizResults,
    corrections: sortBy(deduplicatedCorrections, [prop('createdAt'), 'desc']),
  }
}

export async function getStudentAssessmentResults(
  { courseId, participantId }: { courseId: string; participantId: string },
  ctx: ContextWithUser
) {
  // check if the user is logged in as an assessment course admin -> skip validation of participant
  const isAssessmentCourseAdmin = await ctx.prisma.derivedPermission.findUnique(
    {
      where: {
        courseId_userId: {
          courseId,
          userId: ctx.user.sub,
        },
        permissionLevel: {
          in: [DB.PermissionLevel.OWNER, DB.PermissionLevel.ADMIN],
        },
        course: { isAssessmentEnabled: true },
      },
    }
  )

  // Participant access is backed by the accepted course invitation, independent
  // of the login mechanism used for the current session.
  if (!isAssessmentCourseAdmin) {
    if (participantId !== ctx.user.sub) {
      throw new Error(
        'Participants can only access their own assessment results'
      )
    }

    const participation = await ctx.prisma.participation.findFirst({
      where: {
        courseId,
        participantId,
        isActive: true,
        participant: { isActive: true },
        course: {
          isAssessmentEnabled: true,
          participantInvitations: {
            some: {
              participantId,
              status: DB.InvitationStatus.ACCEPTED,
              acceptedAt: { not: null },
            },
          },
        },
      },
      select: { id: true },
    })

    if (!participation) {
      throw new Error(
        'Active assessment participation with an accepted invitation not found'
      )
    }
  }

  // fetch all activities of the course, including the participants results
  const course = await ctx.prisma.course.findUnique({
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

  if (!course) {
    return {
      liveQuizzes: [],
      practiceQuizzes: [],
      microLearnings: [],
      groupActivities: [],
    }
  }

  const liveQuizResults = course.liveQuizzes.reduce<
    ActivityStudentPerformance[]
  >((acc, lq) => {
    // extract the scoring-related parameters from the live quiz
    const quizResults = getStudentAssessmentQuizPerformance({ quiz: lq })
    return acc.concat(quizResults)
  }, [])

  return {
    liveQuizzes: liveQuizResults,
    practiceQuizzes: [],
    microLearnings: [],
    groupActivities: [],
  }
}

export async function getAssessmentResultsLiveQuiz(
  {
    liveQuizId,
    preferredAffiliation = 'uzh',
  }: { liveQuizId: string; preferredAffiliation?: string },
  ctx: ContextWithUser
): Promise<AssessmentResultsLiveQuiz | null> {
  // fetch the live quiz and verify that the requesting user is an admin of the associated assessment course
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
              in: [DB.PermissionLevel.OWNER, DB.PermissionLevel.ADMIN],
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

  // initial student results object with all participants in the course
  const initialStudentResults = liveQuiz.course.participations.reduce<{
    [participantId: string]: StudentAssessmentResultsItem
  }>((acc, participation) => {
    const email =
      participation.participant.accounts[0]?.ssoEmail ??
      participation.participant.email ??
      'Missing E-Mail'
    acc[participation.participantId] = {
      participantId: participation.participantId,
      participantEmail: email,
      basePoints: 0,
      correctnessPoints: 0,
      bonusPoints: 0,
    }
    return acc
  }, {})

  // aggreagte the collected points by students (and overall available points) for the quiz
  const liveQuizResults = liveQuiz.blocks.reduce<{
    basePoints: number
    correctnessPoints: number
    bonusPoints: number
    students: { [participantId: string]: StudentAssessmentResultsItem }
  }>(
    (quizAcc, block) => {
      block.elements.forEach((instance) => {
        const { basePoints, correctnessPoints, bonusPoints } =
          getInstanceAvailablePoints({
            instance,
            activityBasePoints: liveQuiz.defaultPoints,
            activityCorrectnessPoints: liveQuiz.defaultCorrectPoints,
            activityBonusPoints: liveQuiz.maxBonusPoints,
          })

        quizAcc.basePoints += basePoints
        quizAcc.correctnessPoints += correctnessPoints
        quizAcc.bonusPoints += bonusPoints

        // iterate over the student responses and aggregate them into the quiz results object
        instance.liveQuizResponses
          .filter(
            (response) => response.elementBlockExecution === block.execution
          )
          .forEach((response) => {
            // get the student's affiliation email, if available
            const email =
              response.participant.accounts[0]?.ssoEmail ??
              response.participant.email ??
              'Missing E-Mail'

            // check if the student already has an entry in the results object and set it otherwise
            if (quizAcc.students[response.participantId]) {
              // increment the results object with the student response content
              quizAcc.students[response.participantId]!.basePoints +=
                response.basePoints
              quizAcc.students[response.participantId]!.correctnessPoints +=
                response.correctnessPoints
              quizAcc.students[response.participantId]!.bonusPoints +=
                response.bonusPoints
            } else {
              // set up a new student entry in the results object with the response content
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

  // return the aggregated data in the correct format
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
            (eAcc, element) => eAcc + element._count.corrections,
            0
          ),
        0
      ),
    studentResults: Object.values(liveQuizResults.students),
  }
}

export async function getAssessmentResultsCourse(
  {
    courseId,
    preferredAffiliation = 'uzh',
  }: { courseId: string; preferredAffiliation?: string },
  ctx: ContextWithUser
): Promise<AssessmentResultsCourse | null> {
  const scores = await calculateAssessmentCourseScores(
    { courseId, participantScope: 'ALL' },
    ctx
  )
  if (!scores) return null

  const participants = await ctx.prisma.participant.findMany({
    where: {
      id: { in: scores.studentResults.map((result) => result.participantId) },
    },
    select: {
      id: true,
      email: true,
      accounts: {
        where: { ssoType: preferredAffiliation },
        select: { ssoEmail: true },
        take: 1,
      },
    },
  })
  const emails = new Map(
    participants.map((participant) => [
      participant.id,
      participant.accounts[0]?.ssoEmail ??
        participant.email ??
        'Missing E-Mail',
    ])
  )

  return {
    ...scores,
    studentResults: scores.studentResults.map((result) => ({
      ...result,
      participantEmail: emails.get(result.participantId) ?? 'Missing E-Mail',
    })),
  }
}

export async function getLiveQuizStudentAssessmentResponses(
  { liveQuizId, participantId }: { liveQuizId: string; participantId: string },
  ctx: ContextWithUser
) {
  // fetch the live quiz and verify that the requesting user is an assessment course admin
  // include the participant's responses to the live quiz and the relevant instance information
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
              in: [DB.PermissionLevel.OWNER, DB.PermissionLevel.ADMIN],
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
                          participant: true,
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

  // extract the relevant information from the fetched data
  const studentResponses = liveQuiz.blocks.reduce<
    StudentAssessmentBlockResponse[]
  >((quizAcc, block) => {
    const instances = block.elements.map<StudentAssessmentInstanceResponse>(
      (instance) => {
        const response = instance.liveQuizResponses[0]

        if (response) {
          return {
            instance,
            corrections: response.appliedCorrections.map(
              (appliedCorrection) => ({
                ...appliedCorrection,
                pointCorrection: {
                  ...appliedCorrection.pointCorrection,
                  instance,
                },
              })
            ),
            basePoints: response.basePoints,
            correctnessPoints: response.correctnessPoints,
            bonusPoints: response.bonusPoints,
            correctness: response.correctness,
            submission: response.response,
          }
        }

        // if the student submitted no response, simply return the instance with zero points
        return {
          instance,
          corrections: [],
          basePoints: 0,
          correctnessPoints: 0,
          bonusPoints: 0,
          correctness: null,
          submission: null,
        }
      }
    )

    // push the instances together with the block information into the results array
    quizAcc.push({ blockId: block.id, instances })
    return quizAcc
  }, [])

  return studentResponses
}

async function upsertResponseAppliedCorrection(
  {
    correctionId,
    instance,
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
  }: {
    correctionId: number
    instance: DB.ElementInstance & { elementBlock: DB.ElementBlock }
    response?: DB.LiveQuizResponse | null
    participantId: string
    awardBasePoints?: boolean | null // true = award, null / undefined = no change
    awardCorrectnessPoints?: boolean | null // true = award, null / undefined = no change
    awardBonusPoints?: boolean | null // true = award, null / undefined = no change
    deductBasePoints?: boolean | null // true = deduct, null / undefined = no change
    deductCorrectnessPoints?: boolean | null // true = deduct, null / undefined = no change
    deductBonusPoints?: boolean | null // true = deduct, null / undefined = no change
    availableBasePoints: number
    availableCorrectnessPoints: number
    availableBonusPoints: number
  },
  tx: PrismaTransactionClient,
  ctx: ContextWithUser
) {
  // upsert live quiz response with the corrected points
  const lqr = await tx.liveQuizResponse.upsert({
    where:
      response !== null && typeof response !== 'undefined'
        ? { id: response.id }
        : { id: -1 },
    // response is not set -> defaults to null (setting it to null explicitly does not work, since this would be interpreted as the JSON value being null -> violates DB constraint)
    create: {
      correctionOnly: true,
      submittedAt: new Date(),
      timeSpent: -1,
      correctness: DB.ResponseCorrectness.CORRECT,
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

  // update applied correction entry
  const appliedCorrection = await tx.appliedPointCorrection.create({
    data: {
      // awarded and deducted points (true as award, false as deduction, null as no change)
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
      // link to point correction
      pointCorrection: { connect: { id: correctionId } },
      // upsert live quiz response with corresponding points
      response: { connect: { id: lqr.id } },
    },
  })

  return {
    message: {
      info: `[INFO] [Correct Assessment Points Instance] User ${ctx.user.sub} corrected points for participant ${lqr.participantId} on instance ${instance.id}. Deducted points: base ${appliedCorrection.deductedBasePoints}, correctness ${appliedCorrection.deductedCorrectnessPoints}, bonus ${appliedCorrection.deductedBonusPoints}. Awarded points: base ${appliedCorrection.awardedBasePoints}, correctness ${appliedCorrection.awardedCorrectnessPoints}, bonus ${appliedCorrection.awardedBonusPoints}.`,
    },
  }
}

export async function correctAssessmentPointsInstance(
  {
    instanceId,
    awardBasePoints,
    awardCorrectnessPoints,
    awardBonusPoints,
    deductBasePoints,
    deductCorrectnessPoints,
    deductBonusPoints,
    reason,
    studentReason,
    scope,
    participantId,
    participantIds,
  }: {
    instanceId: number
    awardBasePoints?: boolean | null // true = award, null / undefined = no change
    awardCorrectnessPoints?: boolean | null // true = award, null / undefined = no change
    awardBonusPoints?: boolean | null // true = award, null / undefined = no change
    deductBasePoints?: boolean | null // true = deduct, null / undefined = no change
    deductCorrectnessPoints?: boolean | null // true = deduct, null / undefined = no change
    deductBonusPoints?: boolean | null // true = deduct, null / undefined = no change
    reason: string
    studentReason: string
    scope: DB.PointCorrectionType // SINGLE = single participant, MULTIPLE = multiple participants, PARTICIPATING = all participants with a response to this instance, ALL_COURSE = all participants of the assessment course
    participantId?: string | null
    participantIds?: string[] | null
  },
  ctx: ContextWithUser
) {
  // if the scope is set to a single participant, but no participant is provided, return early
  if (scope === PointCorrectionType.SINGLE && !participantId) {
    return null
  }

  // if the scope is set to multiple participants, but no participants are provided, return early
  if (
    scope === PointCorrectionType.MULTIPLE &&
    (!participantIds || participantIds.length === 0)
  ) {
    return null
  }

  // if no updates should be applied, return early
  if (
    (awardBasePoints === null ||
      typeof awardBasePoints === 'undefined' ||
      awardBasePoints === false) &&
    (awardCorrectnessPoints === null ||
      typeof awardCorrectnessPoints === 'undefined' ||
      awardCorrectnessPoints === false) &&
    (awardBonusPoints === null ||
      typeof awardBonusPoints === 'undefined' ||
      awardBonusPoints === false) &&
    (deductBasePoints === null ||
      typeof deductBasePoints === 'undefined' ||
      deductBasePoints === false) &&
    (deductCorrectnessPoints === null ||
      typeof deductCorrectnessPoints === 'undefined' ||
      deductCorrectnessPoints === false) &&
    (deductBonusPoints === null ||
      typeof deductBonusPoints === 'undefined' ||
      deductBonusPoints === false)
  ) {
    return null
  }

  // if for one of the point categories both award and deduct is set, return early
  if (
    (awardBasePoints === true && deductBasePoints === true) ||
    (awardCorrectnessPoints === true && deductCorrectnessPoints === true) ||
    (awardBonusPoints === true && deductBonusPoints === true)
  ) {
    return null
  }

  // check that the requesting user is an assessment course admin and fetch the instance
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
                  in: [DB.PermissionLevel.OWNER, DB.PermissionLevel.ADMIN],
                },
              },
            },
          },
        },
      },
    },
    include: { elementBlock: { include: { liveQuiz: true } } },
  })

  if (
    !instance ||
    !instance.elementBlock ||
    !instance.elementBlock.liveQuiz.courseId
  )
    return null

  // compute the achievable points for this instance
  const {
    basePoints: availableBasePoints,
    correctnessPoints: availableCorrectnessPoints,
    bonusPoints: availableBonusPoints,
  } = getInstanceAvailablePoints({
    instance,
    activityBasePoints: instance.elementBlock.liveQuiz.defaultPoints,
    activityCorrectnessPoints:
      instance.elementBlock.liveQuiz.defaultCorrectPoints,
    activityBonusPoints: instance.elementBlock.liveQuiz.maxBonusPoints,
  })

  // if the points of a single participant should be modified, fetch the corresponding response and update it
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

    // compute the points that should be incremented / decremented and make the
    // corresponding change in a transaction (including audit logging)
    const createdCorrection = await ctx.prisma.$transaction(
      async (tx) => {
        // create point correction entry
        const correction = await tx.pointCorrection.create({
          data: {
            basePoints: awardBasePoints
              ? true
              : deductBasePoints
                ? false
                : null,
            correctnessPoints: awardCorrectnessPoints
              ? true
              : deductCorrectnessPoints
                ? false
                : null,
            bonusPoints: awardBonusPoints
              ? true
              : deductBonusPoints
                ? false
                : null,
            reason,
            studentReason,
            type: PointCorrectionType.SINGLE,
            correctedBy: { connect: { id: ctx.user.sub } },
            participant: { connect: { id: participantId } },
            instance: { connect: { id: instanceId } },
          },
          include: { correctedBy: true, participant: true, instance: true },
        })

        const logObject = await upsertResponseAppliedCorrection(
          {
            correctionId: correction.id,
            instance: instance as DB.ElementInstance & {
              elementBlock: DB.ElementBlock
            },
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

        // add an audit log entry for the correction
        await ctx.tasks.createAuditLogEntry.runNoWait([logObject])

        // return the correction to display it to the lecturer
        return correction
      },
      { timeout: 300000 } // 5 min timeout to ensure success for the moment -> until asynchronous execution is available
    )

    return createdCorrection
  }

  // if the points of all participating students should be modified, fetch all responses with a participantId and update them
  if (scope === PointCorrectionType.PARTICIPATING) {
    // find all live quiz responses for the given instance (excluding the ones generated through corrections with null as a response)
    const responses = await ctx.prisma.liveQuizResponse.findMany({
      where: {
        instanceId,
        elementBlockExecution: instance.elementBlock.execution,
        correctionOnly: false,
      },
    })

    const createdCorrection = await ctx.prisma.$transaction(
      async (tx) => {
        // create point correction entry
        const correction = await tx.pointCorrection.create({
          data: {
            basePoints: awardBasePoints
              ? true
              : deductBasePoints
                ? false
                : null,
            correctnessPoints: awardCorrectnessPoints
              ? true
              : deductCorrectnessPoints
                ? false
                : null,
            bonusPoints: awardBonusPoints
              ? true
              : deductBonusPoints
                ? false
                : null,
            reason,
            studentReason,
            type: PointCorrectionType.PARTICIPATING,
            correctedBy: { connect: { id: ctx.user.sub } },
            instance: { connect: { id: instanceId } },
          },
          include: { correctedBy: true, instance: true },
        })

        // initialize the audit log entries that should be executed
        const logEntries: { message: { info: string } }[] = []

        // loop over all responses and update them with the corrected points
        await Promise.all(
          responses.map(async (response) => {
            const logObject = await upsertResponseAppliedCorrection(
              {
                correctionId: correction.id,
                instance: instance as DB.ElementInstance & {
                  elementBlock: DB.ElementBlock
                },
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

            // add the log object to the list of log entries
            logEntries.push(logObject)
          })
        )

        // create the collected audit log entries
        await ctx.tasks.createAuditLogEntry.runNoWait(logEntries)

        // return the correction to display it to the lecturer
        return correction
      },
      { timeout: 300000 } // 5 min timeout to ensure success for the moment -> until asynchronous execution is available
    )

    return createdCorrection
  }

  // if the points of multiple students / all students in the course should be modified, fetch all responses and update them
  if (
    scope === PointCorrectionType.ALL_COURSE ||
    scope === PointCorrectionType.MULTIPLE
  ) {
    // find all participants of the course and the corresponding responses for the given instance
    const participations = await ctx.prisma.participation.findMany({
      where: {
        courseId: instance.elementBlock.liveQuiz.courseId!,
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

    const createdCorrection = await ctx.prisma.$transaction(
      async (tx) => {
        // create point correction entry
        const correction = await tx.pointCorrection.create({
          data: {
            basePoints: awardBasePoints
              ? true
              : deductBasePoints
                ? false
                : null,
            correctnessPoints: awardCorrectnessPoints
              ? true
              : deductCorrectnessPoints
                ? false
                : null,
            bonusPoints: awardBonusPoints
              ? true
              : deductBonusPoints
                ? false
                : null,
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
          include: { correctedBy: true, participants: true, instance: true },
        })

        // initialize the audit log entries that should be executed
        const logEntries: { message: { info: string } }[] = []

        // loop over all responses and update them with the corrected points
        await Promise.all(
          participations.map(async (participation) => {
            const logEntry = await upsertResponseAppliedCorrection(
              {
                correctionId: correction.id,
                instance: instance as DB.ElementInstance & {
                  elementBlock: DB.ElementBlock
                },
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

            // push the log object to the list of log entries
            logEntries.push(logEntry)
          })
        )

        // create the collected audit log entries
        await ctx.tasks.createAuditLogEntry.runNoWait(logEntries)

        // return the correction to display it to the lecturer
        return correction
      },
      { timeout: 300000 } // 5 min timeout to ensure success for the moment -> until asynchronous execution is available
    )

    return createdCorrection
  }

  // fallback case if no correct scope was defined
  return null
}

export async function correctAssessmentPointsLiveQuiz(
  {
    liveQuizId,
    awardBasePoints,
    awardCorrectnessPoints,
    awardBonusPoints,
    deductBasePoints,
    deductCorrectnessPoints,
    deductBonusPoints,
    reason,
    studentReason,
    scope,
    participantId,
    participantIds,
  }: {
    liveQuizId: string
    awardBasePoints?: boolean | null // true = award, null / undefined = no change
    awardCorrectnessPoints?: boolean | null // true = award, null / undefined = no change
    awardBonusPoints?: boolean | null // true = award, null / undefined = no change
    deductBasePoints?: boolean | null // true = deduct, null / undefined = no change
    deductCorrectnessPoints?: boolean | null // true = deduct, null / undefined = no change
    deductBonusPoints?: boolean | null // true = deduct, null / undefined = no change
    reason: string
    studentReason: string
    scope: DB.PointCorrectionType // SINGLE -> single participant, MULTIPLE -> multiple participants, PARTICIPATING -> all participants with a response to some question, ALL_COURSE -> all participants in the assessment course
    participantId?: string | null
    participantIds?: string[] | null
  },
  ctx: ContextWithUser
) {
  // if the scope is set to a single participant, but no participant is provided, return early
  if (scope === PointCorrectionType.SINGLE && !participantId) {
    return null
  }

  // if the scope is set to multiple participants, but no participants are provided, return early
  if (
    scope === PointCorrectionType.MULTIPLE &&
    (!participantIds || participantIds.length === 0)
  ) {
    return null
  }

  // if no updates should be applied, return early
  if (
    (awardBasePoints === null ||
      typeof awardBasePoints === 'undefined' ||
      awardBasePoints === false) &&
    (awardCorrectnessPoints === null ||
      typeof awardCorrectnessPoints === 'undefined' ||
      awardCorrectnessPoints === false) &&
    (awardBonusPoints === null ||
      typeof awardBonusPoints === 'undefined' ||
      awardBonusPoints === false) &&
    (deductBasePoints === null ||
      typeof deductBasePoints === 'undefined' ||
      deductBasePoints === false) &&
    (deductCorrectnessPoints === null ||
      typeof deductCorrectnessPoints === 'undefined' ||
      deductCorrectnessPoints === false) &&
    (deductBonusPoints === null ||
      typeof deductBonusPoints === 'undefined' ||
      deductBonusPoints === false)
  ) {
    return null
  }

  // if for one of the point categories both award and deduct is set, return early
  if (
    (awardBasePoints === true && deductBasePoints === true) ||
    (awardCorrectnessPoints === true && deductCorrectnessPoints === true) ||
    (awardBonusPoints === true && deductBonusPoints === true)
  ) {
    return null
  }

  // check that the requesting user is an assessment course admin
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
              in: [DB.PermissionLevel.OWNER, DB.PermissionLevel.ADMIN],
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

  if (!liveQuiz || !liveQuiz.courseId) return null

  // compute the available points for the instances (and aggregated for the entire quiz)
  const availablePoints = liveQuiz.blocks.reduce<{
    [instanceId: number]: {
      availableBasePoints: number
      availableCorrectnessPoints: number
      availableBonusPoints: number
    }
  }>((blockAcc, block) => {
    block.elements.forEach((instance) => {
      const { basePoints, correctnessPoints, bonusPoints } =
        getInstanceAvailablePoints({
          instance,
          activityBasePoints: liveQuiz.defaultPoints,
          activityCorrectnessPoints: liveQuiz.defaultCorrectPoints,
          activityBonusPoints: liveQuiz.maxBonusPoints,
        })

      blockAcc[instance.id] = {
        availableBasePoints: basePoints,
        availableCorrectnessPoints: correctnessPoints,
        availableBonusPoints: bonusPoints,
      }
    })

    return blockAcc
  }, {})

  // if the points of a single participant should be modified, fetch the corresponding response and update it
  if (scope === PointCorrectionType.SINGLE && participantId) {
    // compute the points that should be incremented / decremented and make the
    // corresponding change in a transaction (including audit logging)
    const createdCorrection = await ctx.prisma.$transaction(
      async (tx) => {
        // create point correction entry
        const correction = await tx.pointCorrection.create({
          data: {
            basePoints: awardBasePoints
              ? true
              : deductBasePoints
                ? false
                : null,
            correctnessPoints: awardCorrectnessPoints
              ? true
              : deductCorrectnessPoints
                ? false
                : null,
            bonusPoints: awardBonusPoints
              ? true
              : deductBonusPoints
                ? false
                : null,
            reason,
            studentReason,
            type: PointCorrectionType.SINGLE,
            correctedBy: { connect: { id: ctx.user.sub } },
            participant: { connect: { id: participantId } },
            liveQuiz: { connect: { id: liveQuiz.id } },
          },
          include: {
            correctedBy: true,
            participant: true,
            participants: true,
            liveQuiz: true,
          },
        })

        // initialize the audit log entries that should be executed
        const logEntries: { message: { info: string } }[] = []

        // loop over all instances and update the corresponding responses with the corrected points
        await Promise.all(
          liveQuiz.blocks.map(async (block) => {
            await Promise.all(
              block.elements.map(async (instance) => {
                const {
                  availableBasePoints,
                  availableCorrectnessPoints,
                  availableBonusPoints,
                } = availablePoints[instance.id]!

                // try to find an existing response of the participant for the instance
                const response = await tx.liveQuizResponse.findUnique({
                  where: {
                    instanceId_elementBlockExecution_participantId: {
                      instanceId: instance.id,
                      elementBlockExecution: block.execution,
                      participantId,
                    },
                  },
                })

                const logEntry = await upsertResponseAppliedCorrection(
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
                    availableBasePoints,
                    availableCorrectnessPoints,
                    availableBonusPoints,
                  },
                  tx,
                  ctx
                )

                // push the log object to the list of log entries
                logEntries.push(logEntry)
              })
            )
          })
        )

        // create the collected audit log entries
        await ctx.tasks.createAuditLogEntry.runNoWait(logEntries)

        return correction
      },
      { timeout: 300000 } // 5 min timeout to ensure success for the moment -> until asynchronous execution is available
    )

    return createdCorrection
  }

  // if the points of all participating students should be modified, fetch all responses with a participantId and update them
  if (scope === PointCorrectionType.PARTICIPATING) {
    // fetch the live quiz again, this time including all responses
    const quizWithResponses = await ctx.prisma.liveQuiz.findUnique({
      where: { id: liveQuiz.id },
      include: {
        blocks: {
          include: { elements: { include: { liveQuizResponses: true } } },
        },
      },
    })

    if (!quizWithResponses) return null

    // create a map between the participant ids and the instances they have answered with their responses
    const participantResponseMap = quizWithResponses.blocks.reduce<{
      [pId: string]: { [instanceId: number]: DB.LiveQuizResponse }
    }>((blockAcc, block) => {
      block.elements.forEach((instance) => {
        instance.liveQuizResponses
          .filter(
            (response) => response.elementBlockExecution === block.execution
          )
          .forEach((response) => {
            if (!blockAcc[response.participantId]) {
              blockAcc[response.participantId] = {}
            }

            blockAcc[response.participantId]![instance.id] = response
          })
      })
      return blockAcc
    }, {})

    // exclude all participants that only have null responses (only corrections, but no actual submission)
    const filteredParticipantResponseMap = Object.fromEntries(
      Object.entries(participantResponseMap).filter(([, instanceResponseMap]) =>
        Object.values(instanceResponseMap).some(
          (lqr) => lqr.correctionOnly === false
        )
      )
    )

    // update the responses of all participants that have submitted at least one response to the live quiz
    const createdCorrection = await ctx.prisma.$transaction(
      async (tx) => {
        // create point correction entry
        const correction = await tx.pointCorrection.create({
          data: {
            basePoints: awardBasePoints
              ? true
              : deductBasePoints
                ? false
                : null,
            correctnessPoints: awardCorrectnessPoints
              ? true
              : deductCorrectnessPoints
                ? false
                : null,
            bonusPoints: awardBonusPoints
              ? true
              : deductBonusPoints
                ? false
                : null,
            reason,
            studentReason,
            type: PointCorrectionType.PARTICIPATING,
            correctedBy: { connect: { id: ctx.user.sub } },
            liveQuiz: { connect: { id: liveQuiz.id } },
          },
          include: { correctedBy: true, liveQuiz: true },
        })

        // initialize the audit log entries that should be executed
        const logEntries: { message: { info: string } }[] = []

        // loop over all instances and participants to upsert all relevant responses
        await Promise.all(
          liveQuiz.blocks.map(async (block) => {
            await Promise.all(
              block.elements.map(async (instance) => {
                const {
                  availableBasePoints,
                  availableCorrectnessPoints,
                  availableBonusPoints,
                } = availablePoints[instance.id]!

                await Promise.all(
                  Object.entries(filteredParticipantResponseMap).map(
                    async ([pId, instanceResponseMap]) => {
                      const response = instanceResponseMap[instance.id]

                      const logEntry = await upsertResponseAppliedCorrection(
                        {
                          correctionId: correction.id,
                          instance: { ...instance, elementBlock: block },
                          response,
                          participantId: pId,
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

                      // push the log object to the list of log entries
                      logEntries.push(logEntry)
                    }
                  )
                )
              })
            )
          })
        )

        // create the collected audit log entries
        await ctx.tasks.createAuditLogEntry.runNoWait(logEntries)

        return correction
      },
      { timeout: 300000 } // 5 min timeout to ensure success for the moment -> until asynchronous execution is available
    )

    return createdCorrection
  }

  // if the points of multiple students / all students in the course should be modified, fetch all responses and update them
  if (
    scope === PointCorrectionType.ALL_COURSE ||
    scope === PointCorrectionType.MULTIPLE
  ) {
    // get all participations of the course, including the linked participants
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

    // update the responses of all participants in the course
    const createdCorrection = await ctx.prisma.$transaction(
      async (tx) => {
        // create point correction entry
        const correction = await tx.pointCorrection.create({
          data: {
            basePoints: awardBasePoints
              ? true
              : deductBasePoints
                ? false
                : null,
            correctnessPoints: awardCorrectnessPoints
              ? true
              : deductCorrectnessPoints
                ? false
                : null,
            bonusPoints: awardBonusPoints
              ? true
              : deductBonusPoints
                ? false
                : null,
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
          include: { correctedBy: true, participants: true, liveQuiz: true },
        })

        // initialize the audit log entries that should be executed
        const logEntries: { message: { info: string } }[] = []

        // loop over all instances and participants to upsert all relevant responses
        await Promise.all(
          liveQuiz.blocks.map(async (block) => {
            await Promise.all(
              block.elements.map(async (instance) => {
                const {
                  availableBasePoints,
                  availableCorrectnessPoints,
                  availableBonusPoints,
                } = availablePoints[instance.id]!

                await Promise.all(
                  participations.map(async (participation) => {
                    const pId = participation.participantId
                    const response = await tx.liveQuizResponse.findUnique({
                      where: {
                        instanceId_elementBlockExecution_participantId: {
                          instanceId: instance.id,
                          elementBlockExecution: block.execution,
                          participantId: pId,
                        },
                      },
                    })

                    const logEntry = await upsertResponseAppliedCorrection(
                      {
                        correctionId: correction.id,
                        instance: { ...instance, elementBlock: block },
                        response,
                        participantId: pId,
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

                    // push the log object to the list of log entries
                    logEntries.push(logEntry)
                  })
                )
              })
            )
          })
        )

        // create the collected audit log entries
        await ctx.tasks.createAuditLogEntry.runNoWait(logEntries)

        return correction
      },
      { timeout: 300000 } // 5 min timeout to ensure success for the moment -> until asynchronous execution is available
    )

    return createdCorrection
  }

  // fallback case if no correct scope was defined
  return null
}

export async function getPreviousPointCorrections(
  {
    courseId,
    liveQuizId,
    instanceId,
    preferredAffiliation = 'uzh',
  }: {
    courseId?: string | null
    liveQuizId?: string | null
    instanceId?: number | null
    preferredAffiliation?: string
  },
  ctx: ContextWithUser
) {
  // if neither a live quiz id nor an instance id is provided, return early
  if (
    (courseId === null || typeof courseId === 'undefined' || courseId === '') &&
    (liveQuizId === null ||
      typeof liveQuizId === 'undefined' ||
      liveQuizId === '') &&
    (instanceId === null || typeof instanceId === 'undefined')
  ) {
    return []
  }

  // get the previous corrections applied to the selected live quiz or a specific instance only
  if (instanceId !== null && typeof instanceId !== 'undefined') {
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
                    in: [DB.PermissionLevel.OWNER, DB.PermissionLevel.ADMIN],
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
            participant: {
              include: {
                accounts: { where: { ssoType: preferredAffiliation } },
              },
            },
            participants: {
              include: {
                accounts: { where: { ssoType: preferredAffiliation } },
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    })

    return instance?.corrections
      ? instance.corrections.map((correction) => {
          let participant = correction.participant
          let participants = correction.participants
          if (!participant && !participants) return correction

          if (participant) {
            participant['email'] =
              correction.participant?.accounts[0]?.ssoEmail ??
              correction.participant?.email ??
              null
          } else if (participants) {
            participants = correction.participants.map((p) => {
              p['email'] = p.accounts[0]?.ssoEmail ?? p.email ?? null
              return p
            })
          }

          return { ...correction, participant, participants, instance }
        })
      : []
  } else if (liveQuizId !== null && typeof liveQuizId !== 'undefined') {
    const liveQuiz = await ctx.prisma.liveQuiz.findUnique({
      where: {
        id: liveQuizId!,
        isAssessmentEnabled: true,
        course: {
          isAssessmentEnabled: true,
          permissions: {
            some: {
              userId: ctx.user.sub,
              permissionLevel: {
                in: [DB.PermissionLevel.OWNER, DB.PermissionLevel.ADMIN],
              },
            },
          },
        },
      },
      include: {
        corrections: {
          include: {
            correctedBy: true,
            participant: {
              include: {
                accounts: { where: { ssoType: preferredAffiliation } },
              },
            },
            participants: {
              include: {
                accounts: { where: { ssoType: preferredAffiliation } },
              },
            },
          },
        },
        // include the corrections of all instances as well
        blocks: {
          include: {
            elements: {
              include: {
                corrections: {
                  include: {
                    correctedBy: true,
                    participant: {
                      include: {
                        accounts: { where: { ssoType: preferredAffiliation } },
                      },
                    },
                    participants: {
                      include: {
                        accounts: { where: { ssoType: preferredAffiliation } },
                      },
                    },
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

    const instanceCorrections = liveQuiz?.blocks.flatMap((block) =>
      block.elements.flatMap((element) =>
        element.corrections.map((correction) => {
          let participant = correction.participant
          let participants = correction.participants
          if (!participant && !participants)
            return { ...correction, instance: element }

          if (participant) {
            participant['email'] =
              correction.participant?.accounts[0]?.ssoEmail ??
              correction.participant?.email ??
              null
          } else if (participants) {
            participants = correction.participants.map((p) => {
              p['email'] = p.accounts[0]?.ssoEmail ?? p.email ?? null
              return p
            })
          }

          return {
            ...correction,
            instance: element,
            participant,
            participants,
          }
        })
      )
    )

    const quizCorrections = liveQuiz?.corrections.map((correction) => {
      let participant = correction.participant
      let participants = correction.participants
      if (!participant && !participants) return correction

      if (participant) {
        participant['email'] =
          correction.participant?.accounts[0]?.ssoEmail ??
          correction.participant?.email ??
          null
      } else if (participants) {
        participants = correction.participants.map((p) => {
          p['email'] = p.accounts[0]?.ssoEmail ?? p.email ?? null
          return p
        })
      }

      return { ...correction, participant, participants }
    })

    // return both the quiz- and instance-level corrections
    const corrections = [
      ...(quizCorrections ?? []),
      ...(instanceCorrections ?? []),
    ]
    return sortBy(corrections, [prop('createdAt'), 'desc'])
  }

  // fetch the course and include all live quiz and instance corrections
  const course = await ctx.prisma.course.findUnique({
    where: { id: courseId! },
    include: {
      liveQuizzes: {
        include: {
          corrections: {
            include: {
              correctedBy: true,
              participant: {
                include: {
                  accounts: { where: { ssoType: preferredAffiliation } },
                },
              },
            },
          },
          blocks: {
            include: {
              elements: {
                include: {
                  corrections: {
                    include: {
                      correctedBy: true,
                      participant: {
                        include: {
                          accounts: {
                            where: { ssoType: preferredAffiliation },
                          },
                        },
                      },
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

  const instanceCorrections = course?.liveQuizzes.flatMap((lq) =>
    lq.blocks.flatMap((block) =>
      block.elements.flatMap((element) =>
        element.corrections.map((correction) => {
          let participant = correction.participant
          if (!participant) return { ...correction, instance: element }

          participant['email'] =
            correction.participant?.accounts[0]?.ssoEmail ??
            correction.participant?.email ??
            null

          return {
            ...correction,
            instance: element,
            participant,
          }
        })
      )
    )
  )

  const quizCorrections = course?.liveQuizzes.flatMap((lq) =>
    lq.corrections.map((correction) => {
      let participant = correction.participant
      if (!participant) return correction

      participant['email'] =
        correction.participant?.accounts[0]?.ssoEmail ??
        correction.participant?.email ??
        null

      return { ...correction, participant }
    })
  )

  // return both the quiz- and instance-level corrections
  const corrections = [
    ...(quizCorrections ?? []),
    ...(instanceCorrections ?? []),
  ]
  return sortBy(corrections, [prop('createdAt'), 'desc'])
}

async function computeRollingLeaderboardEntries(
  { courseId, days }: { courseId: string; days: number },
  ctx: ContextWithUser
) {
  const detailsEarliest = dayjs()
    .subtract(days - 1, 'days')
    .startOf('day')
    .toDate()
  const detailsLatest = dayjs().subtract(days, 'days').toDate()

  const course = await ctx.prisma.course.findUnique({
    where: { id: courseId },
    include: {
      // fetch live quizzes where the leaderboard entries are not part of the timeline entries
      liveQuizzes: {
        include: {
          leaderboard: true,
        },
        where: { finishedAt: { lte: detailsEarliest, gt: detailsLatest } },
      },
      practiceQuizzes: {
        include: {
          responseDetails: {
            where: { createdAt: { lte: detailsEarliest, gt: detailsLatest } },
          },
        },
      },
      microLearnings: {
        include: {
          responseDetails: {
            where: { createdAt: { lte: detailsEarliest, gt: detailsLatest } },
          },
        },
      },
      participations: {
        where: { isActive: true },
        include: { participant: true },
      },
      timelineEntries: {
        where: {
          type: DB.TimelineEntryType.DAILY,
          timestamp: { gt: dayjs().subtract(days, 'days').toDate() },
          participation: { isActive: true },
        },
        include: { participation: true },
      },
    },
  })

  if (!course) return { leaderboardEntries: [], count: 0, sum: 0 }

  // initialize the leaderboard entries form the active course participations
  const leaderboardScores = course?.participations.reduce<{
    [participantId: string]: {
      participantId: string
      username: string
      avatar: string | null
      score: number
      xp: number
      isSelf?: boolean
    }
  }>((acc, entry) => {
    acc[entry.participant.id] = {
      participantId: entry.participant.id,
      username: entry.participant.username,
      avatar: entry.participant.avatar,
      score: 0,
      xp: entry.participant.xp,
      isSelf: ctx.user?.sub === entry.participant.id,
    }

    return acc
  }, {})

  // loop through the timeline entries and update the leaderboard scores
  course?.timelineEntries.forEach((entry) => {
    if (leaderboardScores[entry.participation.participantId]) {
      leaderboardScores[entry.participation.participantId]!.score +=
        entry.collectedPoints
    }
  })

  // combine all details, loop through them and update the leaderboard scores
  course.practiceQuizzes.forEach((quiz) => {
    quiz.responseDetails.forEach((detail) => {
      if (leaderboardScores[detail.participantId]) {
        leaderboardScores[detail.participantId]!.score +=
          detail.pointsAwarded ?? 0
      }
    })
  })
  course.microLearnings.forEach((ml) => {
    ml.responseDetails.forEach((detail) => {
      if (leaderboardScores[detail.participantId]) {
        leaderboardScores[detail.participantId]!.score +=
          detail.pointsAwarded ?? 0
      }
    })
  })

  // loop over all live quiz leaderboard entries and update the leaderboard scores
  course.liveQuizzes.forEach((lq) => {
    lq.leaderboard.forEach((lbEntry) => {
      if (leaderboardScores[lbEntry.participantId]) {
        leaderboardScores[lbEntry.participantId]!.score += lbEntry.score
      }
    })
  })

  // sort the leaderboard entries and add rank, level, and compute statistics
  const sortedScores = computeRanks(
    sortBy(
      Object.values(leaderboardScores),
      [prop('score'), 'desc'],
      [prop('username'), 'asc']
    )
  )
  const { leaderboardEntries, count, sum } = sortedScores.reduce<{
    leaderboardEntries: {
      id: number
      participantId: string
      username: string
      avatar: string | null
      score: number
      rank: number
      isSelf?: boolean
      level?: number
    }[]
    count: number
    sum: number
  }>(
    (acc, scoreEntry) => {
      acc.leaderboardEntries.push({
        id: Math.floor(random(1000000000)),
        participantId: scoreEntry.participantId,
        username: scoreEntry.username,
        avatar: scoreEntry.avatar,
        score: scoreEntry.score,
        isSelf: scoreEntry.isSelf,
        rank: scoreEntry.rank,
        level: levelFromXp(scoreEntry.xp),
      })
      acc.count += 1
      acc.sum += scoreEntry.score

      return acc
    },
    { leaderboardEntries: [], count: 0, sum: 0 }
  )

  return { leaderboardEntries, count, sum }
}

export async function getStudentCourseLeaderboard(
  { courseId, mode }: { courseId: string; mode: string },
  ctx: Context
) {
  if (
    ctx.user?.sub &&
    ctx.user.role === DB.UserRole.PARTICIPANT &&
    mode === 'course'
  ) {
    const participation = await ctx.prisma.participation.findUnique({
      where: {
        courseId_participantId: { courseId, participantId: ctx.user.sub },
      },
      include: { participant: true },
    })

    const course = ctx.prisma.course.findUnique({
      where: { id: courseId },
    })

    const lbEntries =
      (await course.participations({
        where: {
          isActive: true,
        },
        include: {
          courseLeaderboard: true,
          participant: true,
        },
      })) ?? []

    if (participation) {
      const allEntries = lbEntries.reduce<{
        mapped: {
          id: number
          score: number
          username: string
          avatar: string | null
          participantId: string
          level: number
          isSelf: boolean
        }[]
        sum: number
        count: number
      }>(
        (acc, entry) => {
          return {
            mapped: [
              ...acc.mapped,
              {
                id: entry.id,
                score: entry.courseLeaderboard?.score ?? 0,
                username:
                  entry.participant.isProfilePublic &&
                  participation.participant.isProfilePublic
                    ? entry.participant.username
                    : 'Anonymous',
                avatar:
                  entry.participant.isProfilePublic &&
                  participation.participant.isProfilePublic
                    ? entry.participant.avatar
                    : null,
                participantId: entry.participant.id,
                level: levelFromXp(entry.participant.xp),
                isSelf: ctx.user?.sub === entry.participant.id,
              },
            ],
            sum: acc.sum + (entry.courseLeaderboard?.score ?? 0),
            count: acc.count + 1,
          }
        },
        {
          mapped: [],
          sum: 0,
          count: 0,
        }
      )

      const sortedEntries = computeRanks(
        sortBy(
          allEntries.mapped,
          [prop('score'), 'desc'],
          [prop('username'), 'asc']
        )
      )

      // keep the top 10 entries, plus the requesting participant's own entry
      const filteredEntries = sortedEntries.filter(
        (entry, ix) => ix < 10 || entry.participantId === ctx.user?.sub
      )

      return {
        leaderboard: filteredEntries,
        leaderboardStatistics: {
          participantCount: allEntries.count,
          averageScore:
            allEntries.count > 0 ? allEntries.sum / allEntries.count : 0,
        },
      }
    }
  } else if (
    ctx.user?.sub &&
    ctx.user.role === DB.UserRole.PARTICIPANT &&
    mode === 'biweekly'
  ) {
    const { leaderboardEntries, count, sum } =
      await computeRollingLeaderboardEntries(
        { courseId, days: 14 },
        ctx as ContextWithUser // user id and role have been validated in if statement
      )

    return {
      leaderboard: leaderboardEntries,
      leaderboardStatistics: {
        participantCount: count,
        averageScore: count > 0 ? sum / count : 0,
      },
    }
  }

  return {
    leaderboard: [],
    leaderboardStatistics: {
      participantCount: 0,
      averageScore: 0,
    },
  }
}

interface CreateCourseArgs {
  name: string
  displayName: string
  description?: string | null
  color?: string | null
  startDate: Date
  endDate: Date
  isGroupCreationEnabled?: boolean | null
  groupDeadlineDate?: Date | null
  maxGroupSize?: number | null
  preferredGroupSize?: number | null
  language: DB.Locale
  notificationEmail?: string | null
  isGamificationEnabled: boolean
  isLearningAnalyticsEnabled?: boolean | null
  isAssessmentEnabled?: boolean | null
}

export async function createCourse(
  {
    name,
    displayName,
    description,
    color,
    startDate,
    endDate,
    isGroupCreationEnabled,
    groupDeadlineDate,
    maxGroupSize,
    preferredGroupSize,
    language,
    notificationEmail,
    isGamificationEnabled,
    isLearningAnalyticsEnabled,
    isAssessmentEnabled,
  }: CreateCourseArgs,
  ctx: ContextWithUser
) {
  if (isLearningAnalyticsEnabled) {
    assertLearningAnalyticsRolloutEnabled()
  }

  // TODO: ensure that PINs are unique
  // Assessment courses don't get PINs - they use invitations instead
  const randomPin = isAssessmentEnabled
    ? null
    : Math.floor(Math.random() * 900000000 + 100000000)

  // convert times from local time to UTC
  // startDate.setHours(startDate.getHours() - startDate.getTimezoneOffset() / 60)
  // endDate.setHours(endDate.getHours() - endDate.getTimezoneOffset() / 60)

  const defaultMaxGroupSize = 5
  const defaultPreferredGroupSize = 3
  const course = await ctx.prisma.$transaction(
    async (prisma) => {
      const newCourse = await prisma.course.create({
        data: {
          name: name.trim(),
          displayName: displayName.trim(),
          description,
          language,
          color: color ?? '#CCD5ED',
          startDate: startDate,
          endDate: endDate,
          isGroupCreationEnabled: isGroupCreationEnabled ?? true,
          groupDeadlineDate: groupDeadlineDate ?? endDate,
          maxGroupSize: maxGroupSize ?? defaultMaxGroupSize,
          preferredGroupSize: preferredGroupSize ?? defaultPreferredGroupSize,
          notificationEmail: notificationEmail,
          isGamificationEnabled: isGamificationEnabled,
          isLearningAnalyticsEnabled: isLearningAnalyticsEnabled ?? false,
          isAssessmentEnabled: isAssessmentEnabled ?? false,
          pinCode: randomPin,
          owner: {
            connect: {
              id: ctx.user.sub,
            },
          },
        },
      })

      await recomputeDerivedPermissions(
        {
          courseId: newCourse.id,
          userId: ctx.user.sub,
        },
        prisma
      )

      return {
        ...newCourse,
        derivedAccess: false,
        numSharedUsers: 0,
        permissionLevel: DB.PermissionLevel.OWNER,
        isOwner: true,
        isManager: true,
        isEditor: true,
        isShared: false,
        isRemovable: false,
      }
    },
    { timeout: 60000 }
  )

  return course
}

export async function setCourseLearningAnalyticsEnabled(
  { courseId, isEnabled }: { courseId: string; isEnabled: boolean },
  ctx: ContextWithUser
) {
  if (isEnabled) {
    assertLearningAnalyticsRolloutEnabled()
  }

  return ctx.prisma.$transaction(
    async (prisma) => {
      await prisma.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${courseId}))::text`

      const course = await prisma.course.update({
        where: { id: courseId },
        data: {
          isLearningAnalyticsEnabled: isEnabled,
          areAnalyticsValid: false,
        },
      })

      if (isEnabled) {
        return course
      }

      await deleteDedicatedLearningAnalyticsForCourse(prisma, courseId)

      return course
    },
    {
      maxWait: 10000,
      timeout: 60000,
    }
  )
}

export async function toggleArchiveCourse(
  { id, isArchived }: { id: string; isArchived: boolean },
  ctx: ContextWithUser
) {
  const course = await ctx.prisma.course.update({
    where: { id, endDate: { lte: new Date() } },
    data: { isArchived },
  })

  return course
}

interface UpdateCourseSettingsArgs {
  id: string
  name?: string | null
  displayName?: string | null
  description?: string | null
  color?: string | null
  startDate?: Date | null
  endDate?: Date | null
  isGroupCreationEnabled?: boolean | null
  groupDeadlineDate?: Date | null
  language: DB.Locale
  notificationEmail?: string | null
  isGamificationEnabled?: boolean | null
  isAssessmentEnabled?: boolean | null
}

export async function updateCourseSettings(
  {
    id,
    name,
    displayName,
    description,
    color,
    startDate,
    endDate,
    isGroupCreationEnabled,
    groupDeadlineDate,
    language,
    notificationEmail,
    isGamificationEnabled,
    isAssessmentEnabled,
  }: UpdateCourseSettingsArgs,
  ctx: ContextWithUser
) {
  // verify that no past dates are modified or enabled gamification / group creation settings are disabled
  const course = await ctx.prisma.course.findUnique({
    where: { id },
    include: {
      _count: {
        select: {
          liveQuizzes: { where: { isDeleted: false } },
          practiceQuizzes: { where: { isDeleted: false } },
          microLearnings: { where: { isDeleted: false } },
          groupActivities: { where: { isDeleted: false } },
          participantGroups: true,
        },
      },
    },
  })

  if (!course) return null

  const currentStartDatePast = course.startDate < new Date()
  const newGroupDeadlinePast = groupDeadlineDate
    ? groupDeadlineDate < new Date()
    : false
  const containsActivities =
    course._count.liveQuizzes > 0 ||
    course._count.practiceQuizzes > 0 ||
    course._count.microLearnings > 0 ||
    course._count.groupActivities > 0
  const containsGroups = course._count.participantGroups > 0

  // check if the gamification and/or assessment settings were changed
  const newGamificationSetting =
    course.isGamificationEnabled !== isGamificationEnabled &&
    (isGamificationEnabled || (!containsActivities && !containsGroups))
      ? (isGamificationEnabled ?? false)
      : undefined
  const newAssessmentSetting =
    course.isAssessmentEnabled !== isAssessmentEnabled
      ? (isAssessmentEnabled ?? undefined)
      : undefined

  const updatedCourse = await ctx.prisma.course.update({
    where: { id },
    data: {
      name: name ?? undefined,
      displayName: displayName ?? undefined,
      description,
      language: language ?? DB.Locale.en,
      color: color ?? undefined,
      startDate: currentStartDatePast || !startDate ? undefined : startDate,
      endDate: endDate ?? undefined,
      // only enable group creation or disable it if there are no groups
      isGroupCreationEnabled:
        isGroupCreationEnabled || !containsGroups
          ? (isGroupCreationEnabled ?? false)
          : undefined,
      groupDeadlineDate: groupDeadlineDate ?? undefined,
      notificationEmail: notificationEmail ?? undefined,
      // only enable gamification or disable it if there are no activities or groups
      isGamificationEnabled: newGamificationSetting,
      // set assessment mode - if enabling, remove PIN
      isAssessmentEnabled: isAssessmentEnabled ?? undefined,
      pinCode: isAssessmentEnabled ? null : undefined,
      // reset the random assignment tracking if the group deadline is extended
      randomAssignmentFinalized: !newGroupDeadlinePast ? false : undefined,
      // if group creation is disabled and there are no groups, remove all participants from the random assignment pool
      groupAssignmentPoolEntries:
        !isGroupCreationEnabled && !containsGroups
          ? { deleteMany: {} }
          : undefined,
      // if the gamification or assessment setting was changed, update all activities assigned to the course
      ...(newGamificationSetting || newAssessmentSetting
        ? {
            liveQuizzes: {
              updateMany: {
                where: {
                  isDeleted: false,
                  status: {
                    in: [
                      DB.PublicationStatus.DRAFT,
                      DB.PublicationStatus.SCHEDULED,
                      DB.PublicationStatus.PUBLISHED,
                    ],
                  },
                },
                data: {
                  isGamificationEnabled: newGamificationSetting,
                  isAssessmentEnabled: newAssessmentSetting,
                },
              },
            },
            practiceQuizzes: {
              updateMany: {
                where: {
                  isDeleted: false,
                  status: {
                    in: [
                      DB.PublicationStatus.DRAFT,
                      DB.PublicationStatus.SCHEDULED,
                      DB.PublicationStatus.PUBLISHED,
                    ],
                  },
                },
                data: {
                  isGamificationEnabled: newGamificationSetting,
                  isAssessmentEnabled: newAssessmentSetting,
                },
              },
            },
            microLearnings: {
              updateMany: {
                where: {
                  isDeleted: false,
                  status: {
                    in: [
                      DB.PublicationStatus.DRAFT,
                      DB.PublicationStatus.SCHEDULED,
                      DB.PublicationStatus.PUBLISHED,
                    ],
                  },
                },
                data: {
                  isGamificationEnabled: newGamificationSetting,
                  isAssessmentEnabled: newAssessmentSetting,
                },
              },
            },
            groupActivities: {
              updateMany: {
                where: {
                  isDeleted: false,
                  status: {
                    in: [
                      DB.PublicationStatus.DRAFT,
                      DB.PublicationStatus.SCHEDULED,
                      DB.PublicationStatus.PUBLISHED,
                    ],
                  },
                },
                data: {
                  isGamificationEnabled: newGamificationSetting,
                  isAssessmentEnabled: newAssessmentSetting,
                },
              },
            },
          }
        : {}),
    },
  })

  return updatedCourse
}

export async function getUserCourses(ctx: ContextWithUser) {
  const userCourses = await ctx.prisma.user.findUnique({
    where: { id: ctx.user.sub },
    include: {
      objects: {
        where: { courseId: { not: null } },
        include: {
          directPermission: true,
          course: {
            include: {
              _count: {
                select: {
                  permissions: true,
                },
              },
            },
          },
        },
        orderBy: [{ course: { endDate: 'desc' } }],
      },
    },
  })

  // sort courses by archived or not
  const filteredCourses =
    userCourses?.objects
      .flatMap((object) =>
        object.course !== null
          ? {
              ...object.course,
              permissionLevel: object.permissionLevel,
              derivedAccess: object.derived,
              numSharedUsers: object.course._count.permissions - 1,
              isOwner: object.permissionLevel === DB.PermissionLevel.OWNER,
              isManager:
                object.permissionLevel === DB.PermissionLevel.OWNER ||
                object.permissionLevel === DB.PermissionLevel.ADMIN,
              isEditor:
                object.permissionLevel === DB.PermissionLevel.OWNER ||
                object.permissionLevel === DB.PermissionLevel.ADMIN ||
                object.permissionLevel === DB.PermissionLevel.WRITE,
              isShared: object.permissionLevel !== DB.PermissionLevel.OWNER,
              // object can be removed, if the object is shared and the permission is not derived / granted through a user group
              isRemovable:
                object.permissionLevel !== DB.PermissionLevel.OWNER &&
                !object.derived &&
                object.directPermission?.userGroupId === null,
            }
          : []
      )
      .sort((a, b) => {
        return a.isArchived === b.isArchived ? 0 : a.isArchived ? 1 : -1
      }) ?? []

  return filteredCourses
}

export async function getActiveUserCourses(
  {
    activityId,
    activityType,
  }: { activityId?: string | null; activityType?: ActivityType | null },
  ctx: ContextWithUser
) {
  const userCourses = await ctx.prisma.user.findUnique({
    where: { id: ctx.user.sub },
    include: {
      objects: {
        where: {
          courseId: { not: null },
          course: { endDate: { gte: new Date() }, isArchived: false },
        },
        include: { course: true },
        orderBy: [
          { course: { startDate: 'asc' } },
          { course: { name: 'asc' } },
        ],
      },
    },
  })

  const courses =
    userCourses?.objects?.map((object) => ({
      ...object.course!,
      isOwner: object.permissionLevel === DB.PermissionLevel.OWNER,
      isManager:
        object.permissionLevel === DB.PermissionLevel.OWNER ||
        object.permissionLevel === DB.PermissionLevel.ADMIN,
      isEditor:
        object.permissionLevel === DB.PermissionLevel.OWNER ||
        object.permissionLevel === DB.PermissionLevel.ADMIN ||
        object.permissionLevel === DB.PermissionLevel.WRITE,
      isShared: object.permissionLevel !== DB.PermissionLevel.OWNER,
    })) ?? []

  if (
    activityId &&
    activityType !== null &&
    typeof activityType !== 'undefined'
  ) {
    // verify that the user has sufficient access to the activity (at least WRITE permissions)
    const validAccess = await checkAccess(
      [
        ...(activityType === ActivityType.LIVE_QUIZ
          ? [
              {
                liveQuizId: activityId,
                minimumPermissionLevel: DB.PermissionLevel.WRITE,
              },
            ]
          : []),
        ...(activityType === ActivityType.PRACTICE_QUIZ
          ? [
              {
                practiceQuizId: activityId,
                minimumPermissionLevel: DB.PermissionLevel.WRITE,
              },
            ]
          : []),
        ...(activityType === ActivityType.MICRO_LEARNING
          ? [
              {
                microLearningId: activityId,
                minimumPermissionLevel: DB.PermissionLevel.WRITE,
              },
            ]
          : []),
        ...(activityType === ActivityType.GROUP_ACTIVITY
          ? [
              {
                groupActivityId: activityId,
                minimumPermissionLevel: DB.PermissionLevel.WRITE,
              },
            ]
          : []),
      ],
      ctx
    )

    if (!validAccess) {
      return courses
    }

    // fetch the course link to the corresponding acitivity
    let activityCourse: DB.Course | null = null
    if (activityType === ActivityType.LIVE_QUIZ) {
      const liveQuiz = await ctx.prisma.liveQuiz.findUnique({
        where: { id: activityId },
        include: { course: true },
      })

      activityCourse = liveQuiz!.course
    } else if (activityType === ActivityType.PRACTICE_QUIZ) {
      const practiceQuiz = await ctx.prisma.practiceQuiz.findUnique({
        where: { id: activityId },
        include: { course: true },
      })

      activityCourse = practiceQuiz!.course
    } else if (activityType === ActivityType.MICRO_LEARNING) {
      const microLearning = await ctx.prisma.microLearning.findUnique({
        where: { id: activityId },
        include: { course: true },
      })

      activityCourse = microLearning!.course
    } else if (activityType === ActivityType.GROUP_ACTIVITY) {
      const groupActivity = await ctx.prisma.groupActivity.findUnique({
        where: { id: activityId },
        include: { course: true },
      })

      activityCourse = groupActivity!.course
    }

    // deduplicate the course linked to the activity with the other user courses and sort it accordingly
    if (activityCourse) {
      const userHasActivityCourseAssess = courses.some(
        (course) => course.id === activityCourse.id
      )
      const augmentedCourses = userHasActivityCourseAssess
        ? courses
        : [
            ...courses,
            {
              ...activityCourse,
              isOwner: false,
              isManager: false,
              isEditor: false,
              isShared: false,
            },
          ]

      const sortedCourses = augmentedCourses.sort(
        (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
      )

      return sortedCourses
    } else {
      return courses
    }
  }

  return courses
}

export async function getCourseSummary(
  { courseId }: { courseId: string },
  ctx: ContextWithUser
) {
  const course = await ctx.prisma.course.findUnique({
    where: { id: courseId },
    include: {
      _count: {
        select: {
          liveQuizzes: { where: { isDeleted: false } },
          practiceQuizzes: { where: { isDeleted: false } },
          microLearnings: { where: { isDeleted: false } },
          groupActivities: { where: { isDeleted: false } },
          leaderboard: true,
          participantGroups: true,
          participations: true,
        },
      },
    },
  })

  if (!course) return null

  return {
    numOfParticipations: course._count.participations,
    numOfLiveQuizzes: course._count.liveQuizzes,
    numOfPracticeQuizzes: course._count.practiceQuizzes,
    numOfMicroLearnings: course._count.microLearnings,
    numOfGroupActivities: course._count.groupActivities,
    numOfLeaderboardEntries: course._count.leaderboard,
    numOfParticipantGroups: course._count.participantGroups,
  }
}

export async function deleteCourse(
  { id }: { id: string },
  ctx: ContextWithUser
) {
  // updates of derived permissions on the course and some cascaded objects are automatic (since course is hard-deleted)
  // live quizzes, which are only disconnected from the course need to be handled separately
  // elements that are contained in asynchronous activities (cascading delete) need to be updated manually
  const course = await ctx.prisma.course.findUnique({
    where: { id, isAssessmentEnabled: false },
    include: {
      liveQuizzes: true,
      practiceQuizzes: { include: { stacks: { include: { elements: true } } } },
      microLearnings: { include: { stacks: { include: { elements: true } } } },
      groupActivities: { include: { stacks: { include: { elements: true } } } },
    },
  })

  if (!course) {
    throw new Error('Course not found or permission denied')
  }

  const deletedCourse = await ctx.prisma.$transaction(
    async (prisma) => {
      // hard-delete the course -> cascading delete on practice quiz, microlearning, group activity and linked stacks
      // live quizzes are disconnected from the course on deletion
      const deleted = await prisma.course.delete({ where: { id } })

      // trigger a recomputation of all permissions related to the live quizzes of the course
      // this action should be executed sequentially to avoid race conditions (same element in multiple live quizzes)
      for (const liveQuiz of course.liveQuizzes) {
        await recomputeDerivedPermissions({ liveQuizId: liveQuiz.id }, prisma)
      }

      // trigger a recomputation of all permissions on element contained in the stacks of the deleted activities
      // this action should be executed sequentially to avoid race conditions (same resource in multiple elements)
      const elementIds = [
        ...new Set([
          ...course.practiceQuizzes.flatMap((quiz) =>
            quiz.stacks.flatMap((stack) =>
              stack.elements.map((instance) => instance.elementId)
            )
          ),
          ...course.microLearnings.flatMap((ml) =>
            ml.stacks.flatMap((stack) =>
              stack.elements.map((instance) => instance.elementId)
            )
          ),
          ...course.groupActivities.flatMap((ga) =>
            ga.stacks.flatMap((stack) =>
              stack.elements.map((instance) => instance.elementId)
            )
          ),
        ]),
      ]

      for (const elementId of elementIds) {
        await recomputeDerivedPermissions({ elementId }, prisma)
      }

      return deleted
    },
    { timeout: 60000 }
  )

  // cancel any remaining scheduled publication or ending hatchet jobs for the asynchronous activities of the course
  for (const pq of course.practiceQuizzes) {
    if (pq.scheduledPublicationTaskId) {
      try {
        await ctx.hatchet.scheduled.delete(pq.scheduledPublicationTaskId)
      } catch (e) {
        console.log(
          `Failed to delete scheduled publication hatchet job for practice quiz ${pq.id}`
        )
      }
    }
  }
  for (const ml of course.microLearnings) {
    if (ml.scheduledPublicationTaskId) {
      try {
        await ctx.hatchet.scheduled.delete(ml.scheduledPublicationTaskId)
      } catch (e) {
        console.log(
          `Failed to delete scheduled publication hatchet job for micro learning ${ml.id}`
        )
      }
    }
    if (ml.scheduledCompletionTaskId) {
      try {
        await ctx.hatchet.scheduled.delete(ml.scheduledCompletionTaskId)
      } catch (e) {
        console.log(
          `Failed to delete scheduled completion hatchet job for micro learning ${ml.id}`
        )
      }
    }
  }
  for (const ga of course.groupActivities) {
    if (ga.scheduledPublicationTaskId) {
      try {
        await ctx.hatchet.scheduled.delete(ga.scheduledPublicationTaskId)
      } catch (e) {
        console.log(
          `Failed to delete scheduled publication hatchet job for group activity ${ga.id}`
        )
      }
    }
    if (ga.scheduledCompletionTaskId) {
      try {
        await ctx.hatchet.scheduled.delete(ga.scheduledCompletionTaskId)
      } catch (e) {
        console.log(
          `Failed to delete scheduled completion hatchet job for group activity ${ga.id}`
        )
      }
    }
  }

  ctx.emitter.emit('invalidate', { typename: 'Course', id })
  return deletedCourse
}

export async function removeCourse(
  { id }: { id: string },
  ctx: ContextWithUser
) {
  // verify that the user has a direct permission on the specified course
  const course = await ctx.prisma.course.findUnique({
    where: { id, directPermissions: { some: { userId: ctx.user.sub } } },
  })

  if (!course) {
    return null
  }

  // remove direct permission and recompute derived permissions for this course and user
  await ctx.prisma.$transaction(
    async (prisma) => {
      // remove the direct permission of the user on the course
      await prisma.course.update({
        where: { id },
        data: { directPermissions: { deleteMany: { userId: ctx.user.sub } } },
      })

      // create an audit log entry for the removal
      await prisma.auditLogEntry.create({
        data: {
          type: DB.AuditLogType.PERMISSION_REMOVED,
          objectId: String(id),
          objectType: DB.ObjectType.COURSE,
          sourceUserId: ctx.user.sub,
          message: `User ${ctx.user.sub} removed own permission on ${DB.ObjectType.COURSE} (ID: ${id})`,
        },
      })

      // recompute derived permissions for the user on the course
      await recomputeDerivedPermissions(
        { courseId: id, userId: ctx.user.sub },
        prisma
      )
    },
    { timeout: 60000 }
  )

  ctx.emitter.emit('invalidate', {
    typename: 'Course',
    id,
  })

  return id
}

export async function getParticipantCourses(ctx: ContextWithUser) {
  const participantCourses = await ctx.prisma.participant.findUnique({
    where: { id: ctx.user.sub },
    include: { participations: { include: { course: true } } },
  })

  return participantCourses?.participations.map((p) => p.course) ?? []
}

export async function getControlCourses(ctx: ContextWithUser) {
  const user = await ctx.prisma.user.findUnique({
    where: { id: ctx.user.sub },
    include: { courses: { orderBy: { createdAt: 'desc' } } },
  })

  return user?.courses ?? []
}

function getPermissionBooleans({
  permission,
}: {
  permission: DB.DerivedPermission & { directPermission: DB.Permission | null }
}) {
  return {
    isOwner: permission.permissionLevel === DB.PermissionLevel.OWNER,
    isManager:
      permission.permissionLevel === DB.PermissionLevel.OWNER ||
      permission.permissionLevel === DB.PermissionLevel.ADMIN,
    isEditor:
      permission.permissionLevel === DB.PermissionLevel.OWNER ||
      permission.permissionLevel === DB.PermissionLevel.ADMIN ||
      permission.permissionLevel === DB.PermissionLevel.WRITE,
    isExecutor:
      permission.permissionLevel === DB.PermissionLevel.EXECUTE ||
      permission.permissionLevel === DB.PermissionLevel.WRITE ||
      permission.permissionLevel === DB.PermissionLevel.ADMIN ||
      permission.permissionLevel === DB.PermissionLevel.OWNER,
    isShared: permission.permissionLevel !== DB.PermissionLevel.OWNER,
    isRemovable:
      permission.permissionLevel !== DB.PermissionLevel.OWNER &&
      !permission.derived &&
      permission.directPermission?.userGroupId === null,
    sharingType:
      permission.permissionLevel === DB.PermissionLevel.OWNER
        ? SharingType.OWNED
        : permission.derived
          ? SharingType.DEPENDENCY
          : SharingType.SHARED,
  }
}

export async function getCourseData(
  { id }: { id: string },
  ctx: ContextWithUser
) {
  const course = await ctx.prisma.course.findUnique({
    where: { id },
    include: {
      _count: { select: { participantGroups: true, permissions: true } },
      permissions: {
        where: { userId: ctx.user.sub },
        include: { directPermission: true },
      },
      liveQuizzes: {
        where: { isDeleted: false },
        include: {
          blocks: {
            include: { _count: { select: { elements: true } } },
            orderBy: { order: 'asc' },
          },
          permissions: {
            where: { userId: ctx.user.sub },
            include: { directPermission: true },
          },
          templateInfo: true,
          _count: { select: { permissions: true } },
        },
        orderBy: { name: 'desc' },
      },
      practiceQuizzes: {
        where: { isDeleted: false },
        include: {
          stacks: {
            include: { _count: { select: { elements: true } } },
            orderBy: { order: 'asc' },
          },
          permissions: {
            where: { userId: ctx.user.sub },
            include: { directPermission: true },
          },
          templateInfo: true,
          _count: { select: { permissions: true } },
        },
        orderBy: { name: 'asc' },
      },
      groupActivities: {
        where: { isDeleted: false },
        include: {
          stacks: {
            include: { _count: { select: { elements: true } } },
            orderBy: { order: 'asc' },
          },
          permissions: {
            where: { userId: ctx.user.sub },
            include: { directPermission: true },
          },
          templateInfo: true,
          _count: { select: { permissions: true } },
        },
        orderBy: { scheduledStartAt: 'asc' },
      },
      microLearnings: {
        where: { isDeleted: false },
        include: {
          stacks: {
            include: { _count: { select: { elements: true } } },
            orderBy: { order: 'asc' },
          },
          permissions: {
            where: { userId: ctx.user.sub },
            include: { directPermission: true },
          },
          templateInfo: true,
          _count: { select: { permissions: true } },
        },
        orderBy: { scheduledStartAt: 'asc' },
      },
      leaderboard: {
        include: { participation: { include: { participant: true } } },
        orderBy: { score: 'desc' },
        where: { participation: { isActive: true } },
      },
      participations: true,
    },
  })

  if (!course) return null

  // if no derived permission was found, return null
  const coursePermission = course.permissions[0]
  if (!coursePermission) {
    return null
  }

  // check if the user is a course admin
  const isActivityReviewer =
    coursePermission.permissionLevel === DB.PermissionLevel.ADMIN ||
    coursePermission.permissionLevel === DB.PermissionLevel.OWNER

  const {
    isOwner: courseOwner,
    isManager: courseManager,
    isEditor: courseEditor,
    isExecutor: courseExecutor,
    isShared: courseShared,
    isRemovable: courseRemovable,
  } = getPermissionBooleans({
    permission: coursePermission,
  })

  const liveQuizzesInfo = course.liveQuizzes.flatMap((liveQuiz) => {
    const permission = liveQuiz.permissions[0]

    if (!permission) {
      return []
    }

    const {
      isOwner,
      isManager,
      isEditor,
      isExecutor,
      isShared,
      isRemovable,
      sharingType,
    } = getPermissionBooleans({
      permission,
    })

    return {
      id: liveQuiz.id,
      templateId: liveQuiz.templateInfo?.id ?? null,
      name: liveQuiz.name,
      displayName: liveQuiz.displayName,
      reviewStatus: liveQuiz.reviewStatus,
      isGamificationEnabled: liveQuiz.isGamificationEnabled,
      isAssessmentEnabled: liveQuiz.isAssessmentEnabled,
      type: ActivityType.LIVE_QUIZ,
      status: liveQuiz.status,
      courseId: course.id,
      courseName: course.name,
      courseStartDate: course.startDate,
      courseLanguage: course.language,
      numOfStacks: liveQuiz.blocks.length,
      numOfElements: liveQuiz.blocks.reduce(
        (acc, block) => acc + block._count.elements,
        0
      ),
      permissionLevel: permission.permissionLevel,
      derivedAccess: permission.derived,
      areInstancesOutdated: liveQuiz.areInstancesOutdated,
      numSharedUsers: liveQuiz._count.permissions - 1,
      pinCode: liveQuiz.pinCode,
      isOwner,
      isManager,
      isEditor,
      isExecutor,
      isShared,
      isRemovable,
      isActivityReviewer,
      sharingType,
      updatedAt: liveQuiz.updatedAt,
    }
  })

  const practiceQuizzesInfo = course.practiceQuizzes.flatMap((practiceQuiz) => {
    const permission = practiceQuiz.permissions[0]

    if (!permission) {
      return []
    }

    const {
      isOwner,
      isManager,
      isEditor,
      isExecutor,
      isShared,
      isRemovable,
      sharingType,
    } = getPermissionBooleans({
      permission,
    })

    return {
      id: practiceQuiz.id,
      templateId: practiceQuiz.templateInfo?.id ?? null,
      name: practiceQuiz.name,
      displayName: practiceQuiz.displayName,
      reviewStatus: practiceQuiz.reviewStatus,
      isGamificationEnabled: practiceQuiz.isGamificationEnabled,
      isAssessmentEnabled: practiceQuiz.isAssessmentEnabled,
      type: ActivityType.PRACTICE_QUIZ,
      status: practiceQuiz.status,
      courseId: course.id,
      courseName: course.name,
      courseStartDate: course.startDate,
      courseLanguage: course.language,
      numOfStacks: practiceQuiz.stacks.length,
      numOfElements: practiceQuiz.stacks.reduce(
        (acc, block) => acc + block._count.elements,
        0
      ),
      automaticPublicationAt: practiceQuiz.availableFrom,
      permissionLevel: permission.permissionLevel,
      derivedAccess: permission.derived,
      areInstancesOutdated: practiceQuiz.areInstancesOutdated,
      numSharedUsers: practiceQuiz._count.permissions - 1,
      isOwner,
      isManager,
      isEditor,
      isExecutor,
      isShared,
      isRemovable,
      isActivityReviewer,
      sharingType,
      updatedAt: practiceQuiz.updatedAt,
    }
  })

  const microLearningsInfo = course.microLearnings.flatMap((microLearning) => {
    const permission = microLearning.permissions[0]

    if (!permission) {
      return []
    }

    const {
      isOwner,
      isManager,
      isEditor,
      isExecutor,
      isShared,
      isRemovable,
      sharingType,
    } = getPermissionBooleans({
      permission,
    })

    return {
      id: microLearning.id,
      templateId: microLearning.templateInfo?.id ?? null,
      name: microLearning.name,
      displayName: microLearning.displayName,
      reviewStatus: microLearning.reviewStatus,
      isGamificationEnabled: microLearning.isGamificationEnabled,
      isAssessmentEnabled: microLearning.isAssessmentEnabled,
      type: ActivityType.MICRO_LEARNING,
      status: microLearning.status,
      courseId: course.id,
      courseName: course.name,
      courseStartDate: course.startDate,
      courseLanguage: course.language,
      numOfStacks: microLearning.stacks.length,
      numOfElements: microLearning.stacks.reduce(
        (acc, block) => acc + block._count.elements,
        0
      ),
      scheduledStartAt: microLearning.scheduledStartAt,
      scheduledEndAt: microLearning.scheduledEndAt,
      permissionLevel: permission.permissionLevel,
      derivedAccess: permission.derived,
      areInstancesOutdated: microLearning.areInstancesOutdated,
      numSharedUsers: microLearning._count.permissions - 1,
      isOwner,
      isManager,
      isEditor,
      isExecutor,
      isShared,
      isRemovable,
      isActivityReviewer,
      sharingType,
      updatedAt: microLearning.updatedAt,
    }
  })

  const groupActivitiesInfo = course.groupActivities.flatMap(
    (groupActivity) => {
      const permission = groupActivity.permissions[0]

      if (!permission) {
        return []
      }

      const {
        isOwner,
        isManager,
        isEditor,
        isExecutor,
        isShared,
        isRemovable,
        sharingType,
      } = getPermissionBooleans({
        permission,
      })

      return {
        id: groupActivity.id,
        templateId: groupActivity.templateInfo?.id ?? null,
        name: groupActivity.name,
        displayName: groupActivity.displayName,
        reviewStatus: groupActivity.reviewStatus,
        isGamificationEnabled: groupActivity.isGamificationEnabled,
        isAssessmentEnabled: groupActivity.isAssessmentEnabled,
        type: ActivityType.GROUP_ACTIVITY,
        status: groupActivity.status,
        courseId: course.id,
        courseName: course.name,
        courseStartDate: course.startDate,
        courseLanguage: course.language,
        numOfStacks: groupActivity.stacks.length,
        numOfElements: groupActivity.stacks.reduce(
          (acc, block) => acc + block._count.elements,
          0
        ),
        scheduledStartAt: groupActivity.scheduledStartAt,
        scheduledEndAt: groupActivity.scheduledEndAt,
        groupDeadlineDate: course.groupDeadlineDate,
        numOfParticipantGroups: course._count.participantGroups,
        permissionLevel: permission.permissionLevel,
        derivedAccess: permission.derived,
        areInstancesOutdated: groupActivity.areInstancesOutdated,
        numSharedUsers: groupActivity._count.permissions - 1,
        isOwner,
        isManager,
        isEditor,
        isExecutor,
        isShared,
        isRemovable,
        isActivityReviewer,
        sharingType,
        updatedAt: groupActivity.updatedAt,
      }
    }
  )

  return {
    ...course,
    permissionLevel: coursePermission.permissionLevel,
    derivedAccess: coursePermission.derived,
    numSharedUsers: course._count.permissions - 1,
    isOwner: courseOwner,
    isManager: courseManager,
    isEditor: courseEditor,
    isExecutor: courseExecutor,
    isShared: courseShared,
    isRemovable: courseRemovable,
    liveQuizzesInfo,
    practiceQuizzesInfo,
    microLearningsInfo,
    groupActivitiesInfo,
    numOfParticipants: course.participations.length,
    numOfParticipantGroups: course._count.participantGroups,
  }
}

export async function getCourseLeaderboard(
  {
    courseId,
    courseSelection,
    weeklySelection,
    rollingSelection,
    customSelection,
    startDate,
    endDate,
    days,
  }: {
    courseId: string
    courseSelection: boolean
    weeklySelection: boolean
    rollingSelection: boolean
    customSelection: boolean
    startDate?: string | null
    endDate?: string | null
    days?: number | null
  },
  ctx: ContextWithUser
) {
  if (courseSelection) {
    const course = await ctx.prisma.course.findUnique({
      where: { id: courseId },
      include: {
        leaderboard: {
          include: { participation: { include: { participant: true } } },
          orderBy: { score: 'desc' },
          where: { participation: { isActive: true } },
        },
      },
    })

    if (!course) return null

    const { activeLBEntries, activeSum, activeCount } =
      course?.leaderboard.reduce<{
        activeLBEntries: ILeaderboardEntry[]
        activeSum: number
        activeCount: number
      }>(
        (acc, entry) => {
          acc.activeSum += entry.score
          acc.activeCount += 1
          acc.activeLBEntries.push({
            id: entry.id,
            score: entry.score,
            rank: acc.activeCount,
            courseId: entry.courseId,
            level: levelFromXp(entry.participation!.participant.xp),
            email: entry.participation!.participant.email,
            username: entry.participation!.participant.username,
            avatar: entry.participation!.participant.avatar,
            participation: entry.participation!,
            type: DB.LeaderboardType.COURSE,
            participantId: entry.participantId,
            participant: entry.participation!.participant,
            sessionParticipationId: null,
            liveQuizId: null,
          })

          return acc
        },
        {
          activeLBEntries: [] as ILeaderboardEntry[],
          activeSum: 0,
          activeCount: 0,
        }
      ) ?? {}

    const averageActiveScore = activeCount > 0 ? activeSum / activeCount : 0

    return {
      numOfActiveParticipants: activeLBEntries.length,
      averageActiveScore,
      leaderboard: activeLBEntries,
    }
  } else if (rollingSelection) {
    // if no number of days is specified, return early
    if (!days) return null

    // aggregate daily timeline entires and question response details / live quiz leaderboards for remaining hours
    const { leaderboardEntries, count, sum } =
      await computeRollingLeaderboardEntries({ courseId, days }, ctx)

    return {
      numOfActiveParticipants: count,
      averageActiveScore: count > 0 ? sum / count : 0,
      computedAt: new Date(),
      leaderboard: leaderboardEntries,
    }
  } else {
    // verify that all required data is provided
    if (weeklySelection && !startDate) return null
    if (customSelection && (!startDate || !endDate)) return null

    // feth all timeline entries from the database
    const startDateUTC = convertDateToUTCDatetime(startDate)
    const endDateUTC = convertDateToUTCDatetime(endDate)
    const course = await ctx.prisma.course.findUnique({
      where: { id: courseId },
      include: {
        timelineEntries: {
          where: {
            type: DB.TimelineEntryType.WEEKLY,
            timestamp: weeklySelection
              ? startDateUTC
              : {
                  gte: startDateUTC!,
                  lte: endDateUTC!,
                },
            participation: {
              isActive: true,
            },
          },
          include: {
            participation: {
              include: {
                participant: true,
              },
            },
          },
          orderBy: {
            collectedPoints: 'desc',
          },
        },
      },
    })
    const dbTimelineEntries = course?.timelineEntries ?? []

    if (weeklySelection || (customSelection && startDate === endDate)) {
      // directly return the timeline entries as a leaderboard
      const { lbEntries, sum, count, lastUpdated } = dbTimelineEntries.reduce<{
        lbEntries: ILeaderboardEntry[]
        sum: number
        count: number
        lastUpdated?: Date
      }>(
        (acc, entry) => {
          acc.sum += entry.collectedPoints
          acc.count += 1
          acc.lbEntries.push({
            id: entry.id,
            score: entry.collectedPoints,
            rank: acc.count,
            email: entry.participation.participant.email,
            username: entry.participation.participant.username,
            avatar: entry.participation.participant.avatar,
            participantId: entry.participation.participantId,
          })

          // update last update timestamp if necessary
          if (!acc.lastUpdated || entry.computedAt > acc.lastUpdated) {
            acc.lastUpdated = entry.computedAt
          }

          return acc
        },
        {
          lbEntries: [] as ILeaderboardEntry[],
          sum: 0,
          count: 0,
          lastUpdated: undefined,
        }
      )

      return {
        numOfActiveParticipants: lbEntries.length,
        averageActiveScore: count > 0 ? sum / count : 0,
        computedAt: lastUpdated,
        leaderboard: lbEntries,
      }
    }

    // aggregate the timeline entries accross the participants
    const aggregatedTimelineEntries = dbTimelineEntries.reduce<{
      [participantId: string]: {
        id: number
        participantId: string
        email: string | null
        username: string
        avatar: string | null
        collectedPoints: number
        collectedXp: number
        lastUpdated: Date
      }
    }>((acc, entry) => {
      if (entry.collectedPoints === 0) {
        return acc
      }

      const key = entry.participation.participantId
      if (!acc[key]) {
        acc[key] = {
          id: entry.id,
          participantId: key,
          email: entry.participation.participant.email,
          username: entry.participation.participant.username,
          avatar: entry.participation.participant.avatar,
          collectedPoints: 0,
          collectedXp: 0,
          lastUpdated: entry.timestamp,
        }
      }
      acc[key].collectedPoints += entry.collectedPoints
      acc[key].collectedXp += entry.collectedXp

      if (entry.computedAt > acc[key].lastUpdated) {
        acc[key].lastUpdated = entry.computedAt
      }

      return acc
    }, {})

    const sortedTimelineEntries = Object.values(aggregatedTimelineEntries).sort(
      (a, b) => {
        if (b.collectedPoints !== a.collectedPoints) {
          return b.collectedPoints - a.collectedPoints
        }
        return a.username.localeCompare(b.username)
      }
    )

    const { leaderboardEntries, sum, count, lastUpdated } =
      sortedTimelineEntries.reduce<{
        leaderboardEntries: ILeaderboardEntry[]
        sum: number
        count: number
        lastUpdated
      }>(
        (acc, entry, index) => {
          acc.sum += entry.collectedPoints
          acc.count += 1
          acc.leaderboardEntries.push({
            id: entry.id,
            score: entry.collectedPoints,
            rank: index + 1,
            email: entry.email,
            username: entry.username,
            avatar: entry.avatar,
            participantId: entry.participantId,
          })

          // update last update timestamp if necessary
          if (!acc.lastUpdated || entry.lastUpdated > acc.lastUpdated) {
            acc.lastUpdated = entry.lastUpdated
          }

          return acc
        },
        {
          leaderboardEntries: [],
          sum: 0,
          count: 0,
          lastUpdated: undefined,
        }
      )

    return {
      numOfActiveParticipants: count,
      averageActiveScore: count > 0 ? sum / count : 0,
      computedAt: lastUpdated,
      leaderboard: leaderboardEntries,
    }
  }
}

export async function getControlCourse(
  { id }: { id: string },
  ctx: ContextWithUser
) {
  const course = await ctx.prisma.course.findUnique({
    where: { id },
    include: {
      liveQuizzes: {
        where: { isDeleted: false },
        include: {
          blocks: { include: { _count: { select: { elements: true } } } },
        },
        orderBy: { createdAt: 'desc' },
      },
    },
  })

  return course
    ? ({
        id: course?.id,
        name: course?.name,
        liveQuizzes: course?.liveQuizzes.map((quiz) => ({
          id: quiz.id,
          name: quiz.name,
          status: quiz.status,
        })),
      } as ICourse)
    : null
}

export async function checkValidCoursePin(
  { pin }: { pin: number },
  ctx: Context
) {
  const course = await ctx.prisma.course.findUnique({
    where: { pinCode: pin },
  })

  if (!course || course.pinCode !== pin) {
    return null
  }

  return course.id
}

export async function getCoursePracticeQuiz(
  { courseId }: { courseId: string },
  ctx: ContextWithUser
) {
  const course = await ctx.prisma.course.findUnique({
    where: { id: courseId },
    include: {
      elementStacks: {
        include: {
          elements: {
            include:
              ctx.user?.sub && ctx.user.role === DB.UserRole.PARTICIPANT
                ? {
                    responses: {
                      where: {
                        participantId: ctx.user.sub,
                      },
                    },
                  }
                : undefined,
            orderBy: {
              order: 'asc',
            },
          },
        },
        orderBy: {
          order: 'asc',
        },
      },
    },
  })

  if (!course) return null

  const orderedStacks = orderStacks(course.elementStacks)

  return {
    id: courseId,
    name: course.name,
    displayName: course.displayName,
    description: null,
    templateName: null,
    pointsMultiplier: 1,
    resetTimeDays: 6,
    orderType: DB.ElementOrderType.SPACED_REPETITION,
    status: DB.PublicationStatus.PUBLISHED,
    stacks: orderedStacks.slice(0, 25),
    numOfStacks: 25,
    availableFrom: null,
    areInstancesOutdated: false,
    course,
    courseId,
    isDeleted: false,
    ownerId: course.ownerId,
    createdAt: course.createdAt,
    updatedAt: course.updatedAt,
  }
}

export async function enableGamification(
  { courseId }: { courseId: string },
  ctx: ContextWithUser
) {
  const course = await ctx.prisma.course.update({
    where: { id: courseId },
    data: { isGamificationEnabled: true },
  })

  return course
}

export async function getCourseActivities(
  { courseId }: { courseId: string },
  ctx: ContextWithUser
) {
  const course = await ctx.prisma.course.findUnique({
    where: { id: courseId },
    include: {
      practiceQuizzes: {
        where: { isDeleted: false, status: DB.PublicationStatus.PUBLISHED },
        include: { _count: { select: { stacks: true } } },
        orderBy: { createdAt: 'desc' },
      },
      microLearnings: {
        where: {
          isDeleted: false,
          status: {
            in: [DB.PublicationStatus.PUBLISHED, DB.PublicationStatus.ENDED],
          },
        },
        include: { _count: { select: { stacks: true } } },
        orderBy: { scheduledStartAt: 'desc' },
      },
    },
  })

  return course
}

export async function getEndedLiveQuizzesCourse(
  { courseId }: { courseId: string },
  ctx: ContextWithUser
) {
  const course = await ctx.prisma.course.findUnique({
    where: { id: courseId },
    include: {
      liveQuizzes: {
        where: { isDeleted: false, status: DB.PublicationStatus.ENDED },
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

  return (
    course.liveQuizzes.map((quiz) => ({
      id: quiz.id,
      name: quiz.name,
      displayName: quiz.displayName,
      instances: quiz.blocks.flatMap((b) =>
        b.elements.map((e) => ({
          id: e.id.toString(),
          name: e.elementData.name,
        }))
      ),
    })) ?? []
  )
}

export async function getAssessmentCourseParticipants(
  {
    courseId,
    preferredAffiliation = 'uzh',
  }: { courseId: string; preferredAffiliation?: string },
  ctx: ContextWithUser
) {
  const course = await ctx.prisma.course.findUnique({
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

  return sortBy(
    course.participations.map((p) => ({
      id: p.participant.id,
      email:
        p.participant.accounts[0]?.ssoEmail ??
        p.participant.email ??
        'E-Mail Missing',
      username: p.participant.username,
    })),
    [prop('email'), 'asc']
  )
}

// Dispatch an admin-triggered learning-analytics recompute for a single
// course. Authorization (ADMIN on the target course) is enforced by the
// withPermission wrapper at the resolver layer; this function just pushes
// the Hatchet event.
//
// Mode must be explicit — the `full` option is accepted here but the
// analytics worker enforces `ANALYTICS_ALLOW_FULL=1` before running it, so a
// manage-UI trigger on `full` still has a server-side guard.
export type RecomputeAnalyticsMode = 'incremental' | 'finalize' | 'full'

export async function recomputeCourseAnalytics(
  { courseId, mode }: { courseId: string; mode: RecomputeAnalyticsMode },
  ctx: ContextWithUser
): Promise<boolean> {
  const course = await ctx.prisma.course.findUnique({
    where: { id: courseId },
    select: { id: true },
  })
  if (!course) return false

  const payload: RecomputeLearningAnalyticsInput = { mode, courseId }
  const event =
    mode === 'full'
      ? HATCHET_EVENTS.adminRecomputeAnalyticsFull
      : HATCHET_EVENTS.adminRecomputeAnalytics
  await ctx.hatchet.events.push(event, payload)
  return true
}

export async function getCourseAnalyticsStatus(
  { courseId }: { courseId: string },
  ctx: ContextWithUser
) {
  return ctx.prisma.course.findUnique({
    where: { id: courseId },
    select: {
      areAnalyticsValid: true,
      analyticsLastComputedAt: true,
      analyticsFinalizedAt: true,
      chatAnalyticsValidAt: true,
    },
  })
}
