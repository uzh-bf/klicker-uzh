import {
  PermissionLevel,
  PublicationStatus,
  TimelineEntryType,
  type Prisma,
  type PrismaClient,
} from '@klicker-uzh/prisma/client'
import { ActivityType } from '@klicker-uzh/types'
import { levelFromXp, recomputeDerivedPermissions } from '@klicker-uzh/util'
import dayjs from 'dayjs'
import type { EventEmitter } from 'node:events'
import {
  adjectives,
  animals,
  colors,
  uniqueNamesGenerator,
} from 'unique-names-generator'
import { updateWeeklyTimelineEntriesCourse } from '../../services/hatchetHandlers.js'
import {
  randomNineDigitCode,
  randomSixDigitCode,
  stableNumericId,
} from '../../services/responseIdentifiers.js'
import { getPrisma, type TRPCContextWithUser } from '../context.js'
import {
  toActiveUserCourse,
  toActiveUserCourseWithoutPermissions,
  toBasicCourseInformation,
  toControlCourse,
  toControlCourseListItem,
  toCourseActivities,
  toCourseDetail,
  toCourseGroups,
  toCourseParticipantGroups,
  toCourseSummary,
  toManageCourseListItem,
} from '../dto/course.js'
import { publicProcedure, router } from '../init.js'
import { hasActivityPermission, hasCoursePermission } from '../permissions.js'
import { userFullAccessProcedure, userProcedure } from '../procedures.js'
import {
  activeUserCoursesInput,
  basicCourseInformationInput,
  controlCourseInput,
  courseActivitiesInput,
  courseActivityIdsInput,
  courseDetailInput,
  courseGroupsInput,
  courseLeaderboardInput,
  courseSummaryInput,
  createCourseInput,
  deleteCourseInput,
  toggleArchiveCourseInput,
  updateCourseSettingsInput,
  type UpdateCourseSettingsInput,
} from '../schemas/course.js'

const courseExecutePermissionLevels = [
  PermissionLevel.EXECUTE,
  PermissionLevel.WRITE,
  PermissionLevel.ADMIN,
  PermissionLevel.OWNER,
]

const activeUserCourseSelect = {
  id: true,
  name: true,
  displayName: true,
  color: true,
  pinCode: true,
  isArchived: true,
  isGamificationEnabled: true,
  isAssessmentEnabled: true,
  isGroupCreationEnabled: true,
  description: true,
  startDate: true,
  endDate: true,
  groupDeadlineDate: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.CourseSelect

const courseSettingsSelect = {
  id: true,
  name: true,
  displayName: true,
  description: true,
  color: true,
  startDate: true,
  endDate: true,
  groupDeadlineDate: true,
  maxGroupSize: true,
  preferredGroupSize: true,
  language: true,
  notificationEmail: true,
  isArchived: true,
  isGamificationEnabled: true,
  isAssessmentEnabled: true,
  isGroupCreationEnabled: true,
  randomAssignmentFinalized: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.CourseSelect

const courseGroupParticipantSelect = {
  id: true,
  username: true,
  email: true,
  avatar: true,
} satisfies Prisma.ParticipantSelect

const courseParticipantGroupSelect = {
  id: true,
  name: true,
  code: true,
  averageMemberScore: true,
  groupActivityScore: true,
  participants: {
    select: courseGroupParticipantSelect,
  },
} satisfies Prisma.ParticipantGroupSelect

const singleParticipantGroupSelect = {
  id: true,
  participants: {
    select: {
      id: true,
    },
  },
} satisfies Prisma.ParticipantGroupSelect

type CourseWithSingleParticipantGroups = Prisma.CourseGetPayload<{
  include: {
    participantGroups: {
      select: typeof singleParticipantGroupSelect
    }
  }
}>

interface RandomGroupAssignmentArgs {
  participantIds: string[]
  preferredGroupSize: number
}

type ManageCourseLeaderboardEntry = {
  id: number
  participantId?: string
  username: string
  email?: string | null
  avatar?: string | null
  score: number
  rank: number
  level?: number
  isSelf?: boolean
}

type ManageCourseLeaderboard = {
  numOfActiveParticipants: number
  averageActiveScore: number
  computedAt?: Date
  leaderboard: ManageCourseLeaderboardEntry[]
}

type ScheduledHatchetClient = {
  scheduled: {
    delete: (taskId: string) => Promise<unknown>
  }
}

function convertDateToUTCDatetime(dateString?: string | null) {
  if (!dateString) return undefined

  const [day, month, year] = dateString.split('.').map(Number)
  return new Date(Date.UTC(year!, month! - 1, day))
}

async function getRollingCourseLeaderboard({
  courseId,
  days,
  prisma,
}: {
  courseId: string
  days: number
  prisma: PrismaClient
}): Promise<ManageCourseLeaderboard> {
  const detailsEarliest = dayjs()
    .subtract(days - 1, 'days')
    .startOf('day')
    .toDate()
  const detailsLatest = dayjs().subtract(days, 'days').toDate()

  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: {
      liveQuizzes: {
        where: { finishedAt: { lte: detailsEarliest, gt: detailsLatest } },
        select: {
          leaderboard: {
            select: { participantId: true, score: true },
          },
        },
      },
      practiceQuizzes: {
        select: {
          responseDetails: {
            where: { createdAt: { lte: detailsEarliest, gt: detailsLatest } },
            select: { participantId: true, pointsAwarded: true },
          },
        },
      },
      microLearnings: {
        select: {
          responseDetails: {
            where: { createdAt: { lte: detailsEarliest, gt: detailsLatest } },
            select: { participantId: true, pointsAwarded: true },
          },
        },
      },
      participations: {
        where: { isActive: true },
        select: {
          participant: {
            select: {
              id: true,
              username: true,
              email: true,
              avatar: true,
              xp: true,
            },
          },
        },
      },
      timelineEntries: {
        where: {
          type: TimelineEntryType.DAILY,
          timestamp: { gt: dayjs().subtract(days, 'days').toDate() },
          participation: { isActive: true },
        },
        select: {
          collectedPoints: true,
          participation: {
            select: {
              participantId: true,
            },
          },
        },
      },
    },
  })

  if (!course) {
    return {
      numOfActiveParticipants: 0,
      averageActiveScore: 0,
      computedAt: new Date(),
      leaderboard: [],
    }
  }

  const leaderboardScores = course.participations.reduce<
    Record<
      string,
      {
        participantId: string
        username: string
        email: string | null
        avatar: string | null
        score: number
        xp: number
      }
    >
  >((acc, entry) => {
    acc[entry.participant.id] = {
      participantId: entry.participant.id,
      username: entry.participant.username,
      email: entry.participant.email,
      avatar: entry.participant.avatar,
      score: 0,
      xp: entry.participant.xp,
    }

    return acc
  }, {})

  course.timelineEntries.forEach((entry) => {
    const participantId = entry.participation.participantId
    if (leaderboardScores[participantId]) {
      leaderboardScores[participantId]!.score += entry.collectedPoints
    }
  })

  course.practiceQuizzes.forEach((quiz) => {
    quiz.responseDetails.forEach((detail) => {
      if (leaderboardScores[detail.participantId]) {
        leaderboardScores[detail.participantId]!.score +=
          detail.pointsAwarded ?? 0
      }
    })
  })

  course.microLearnings.forEach((microLearning) => {
    microLearning.responseDetails.forEach((detail) => {
      if (leaderboardScores[detail.participantId]) {
        leaderboardScores[detail.participantId]!.score +=
          detail.pointsAwarded ?? 0
      }
    })
  })

  course.liveQuizzes.forEach((liveQuiz) => {
    liveQuiz.leaderboard.forEach((entry) => {
      if (leaderboardScores[entry.participantId]) {
        leaderboardScores[entry.participantId]!.score += entry.score
      }
    })
  })

  const sortedScores = Object.values(leaderboardScores).sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score
    return a.username.localeCompare(b.username)
  })
  const sum = sortedScores.reduce((acc, entry) => acc + entry.score, 0)

  return {
    numOfActiveParticipants: sortedScores.length,
    averageActiveScore: sortedScores.length > 0 ? sum / sortedScores.length : 0,
    computedAt: new Date(),
    leaderboard: sortedScores.map((entry, ix) => ({
      id: stableNumericId(entry.participantId),
      participantId: entry.participantId,
      username: entry.username,
      email: entry.email,
      avatar: entry.avatar,
      score: entry.score,
      rank: ix + 1,
      level: levelFromXp(entry.xp),
    })),
  }
}

async function getCourseLeaderboard({
  prisma,
  input,
}: {
  prisma: PrismaClient
  input: {
    courseId: string
    leaderboardType: 'course' | 'weekly' | '7rolling' | '14rolling' | 'custom'
    weeklyStartDate?: string | null
    customStartDate?: string | null
    customEndDate?: string | null
  }
}): Promise<ManageCourseLeaderboard | null> {
  if (input.leaderboardType === 'course') {
    const course = await prisma.course.findUnique({
      where: { id: input.courseId },
      select: {
        leaderboard: {
          where: { participation: { isActive: true } },
          orderBy: { score: 'desc' },
          select: {
            id: true,
            participantId: true,
            score: true,
            participation: {
              select: {
                participant: {
                  select: {
                    email: true,
                    username: true,
                    avatar: true,
                  },
                },
              },
            },
          },
        },
      },
    })

    if (!course) return null

    const sum = course.leaderboard.reduce((acc, entry) => acc + entry.score, 0)

    return {
      numOfActiveParticipants: course.leaderboard.length,
      averageActiveScore:
        course.leaderboard.length > 0 ? sum / course.leaderboard.length : 0,
      leaderboard: course.leaderboard.map((entry, ix) => ({
        id: entry.id,
        participantId: entry.participantId,
        username: entry.participation?.participant.username ?? '',
        email: entry.participation?.participant.email ?? null,
        avatar: entry.participation?.participant.avatar ?? null,
        score: entry.score,
        rank: ix + 1,
      })),
    }
  }

  if (
    input.leaderboardType === '7rolling' ||
    input.leaderboardType === '14rolling'
  ) {
    return await getRollingCourseLeaderboard({
      courseId: input.courseId,
      days: input.leaderboardType === '7rolling' ? 7 : 14,
      prisma,
    })
  }

  const startDate =
    input.leaderboardType === 'weekly'
      ? input.weeklyStartDate
      : input.customStartDate
  const endDate = input.customEndDate

  if (input.leaderboardType === 'weekly' && !startDate) return null
  if (input.leaderboardType === 'custom' && (!startDate || !endDate)) {
    return null
  }

  const startDateUTC = convertDateToUTCDatetime(startDate)
  const endDateUTC = convertDateToUTCDatetime(endDate)
  const course = await prisma.course.findUnique({
    where: { id: input.courseId },
    select: {
      timelineEntries: {
        where: {
          type: TimelineEntryType.WEEKLY,
          timestamp:
            input.leaderboardType === 'weekly'
              ? startDateUTC
              : {
                  gte: startDateUTC!,
                  lte: endDateUTC!,
                },
          participation: {
            isActive: true,
          },
        },
        select: {
          id: true,
          collectedPoints: true,
          collectedXp: true,
          timestamp: true,
          computedAt: true,
          participation: {
            select: {
              participantId: true,
              participant: {
                select: {
                  email: true,
                  username: true,
                  avatar: true,
                },
              },
            },
          },
        },
        orderBy: { collectedPoints: 'desc' },
      },
    },
  })
  const timelineEntries = course?.timelineEntries ?? []

  if (
    input.leaderboardType === 'weekly' ||
    (input.leaderboardType === 'custom' && startDate === endDate)
  ) {
    let sum = 0
    let lastUpdated: Date | undefined
    const leaderboard = timelineEntries.map((entry, ix) => {
      sum += entry.collectedPoints
      if (!lastUpdated || entry.computedAt > lastUpdated) {
        lastUpdated = entry.computedAt
      }

      return {
        id: entry.id,
        participantId: entry.participation.participantId,
        username: entry.participation.participant.username,
        email: entry.participation.participant.email,
        avatar: entry.participation.participant.avatar,
        score: entry.collectedPoints,
        rank: ix + 1,
      }
    })

    return {
      numOfActiveParticipants: leaderboard.length,
      averageActiveScore: leaderboard.length > 0 ? sum / leaderboard.length : 0,
      computedAt: lastUpdated,
      leaderboard,
    }
  }

  const aggregatedTimelineEntries = timelineEntries.reduce<
    Record<
      string,
      {
        id: number
        participantId: string
        email: string | null
        username: string
        avatar: string | null
        collectedPoints: number
        lastUpdated: Date
      }
    >
  >((acc, entry) => {
    if (entry.collectedPoints === 0) return acc

    const key = entry.participation.participantId
    if (!acc[key]) {
      acc[key] = {
        id: entry.id,
        participantId: key,
        email: entry.participation.participant.email,
        username: entry.participation.participant.username,
        avatar: entry.participation.participant.avatar,
        collectedPoints: 0,
        lastUpdated: entry.timestamp,
      }
    }
    acc[key].collectedPoints += entry.collectedPoints

    if (entry.computedAt > acc[key].lastUpdated) {
      acc[key].lastUpdated = entry.computedAt
    }

    return acc
  }, {})

  const sortedEntries = Object.values(aggregatedTimelineEntries).sort(
    (a, b) => {
      if (b.collectedPoints !== a.collectedPoints) {
        return b.collectedPoints - a.collectedPoints
      }
      return a.username.localeCompare(b.username)
    }
  )
  let sum = 0
  let lastUpdated: Date | undefined
  const leaderboard = sortedEntries.map((entry, ix) => {
    sum += entry.collectedPoints
    if (!lastUpdated || entry.lastUpdated > lastUpdated) {
      lastUpdated = entry.lastUpdated
    }

    return {
      id: entry.id,
      participantId: entry.participantId,
      username: entry.username,
      email: entry.email,
      avatar: entry.avatar,
      score: entry.collectedPoints,
      rank: ix + 1,
    }
  })

  return {
    numOfActiveParticipants: leaderboard.length,
    averageActiveScore: leaderboard.length > 0 ? sum / leaderboard.length : 0,
    computedAt: lastUpdated,
    leaderboard,
  }
}

async function sendTeamsNotification({
  scope,
  text,
}: {
  scope: string
  text: string
}) {
  if (!process.env.TEAMS_WEBHOOK_URL) return null

  try {
    return await fetch(process.env.TEAMS_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        '@context': 'https://schema.org/extensions',
        '@type': 'MessageCard',
        themeColor: '0076D7',
        title: scope,
        text: `[${process.env.NODE_ENV}:${scope}] ${text}`,
      }),
    })
  } catch (error) {
    console.error('Failed to send Teams notification:', error)
    return null
  }
}

function splitGroupsFinal({
  participantIds,
  preferredGroupSize,
}: RandomGroupAssignmentArgs) {
  if (participantIds.length === 1) {
    return []
  }

  const participantIdsCopy = [...participantIds]
  let studentsInPool = participantIdsCopy.length
  if (studentsInPool % preferredGroupSize === 0) {
    const groups: string[][] = []
    while (studentsInPool > 0) {
      const group = participantIdsCopy.splice(0, preferredGroupSize)
      groups.push(group)
      studentsInPool -= preferredGroupSize
    }

    return groups
  }

  const numOfGroups = Math.floor((studentsInPool - 2) / preferredGroupSize) + 1
  const groups: string[][] = Array.from({ length: numOfGroups }, () => [])

  let groupIx = 0
  for (const participantId of participantIdsCopy) {
    groups[groupIx]!.push(participantId)
    groupIx = (groupIx + 1) % numOfGroups
  }

  return groups
}

async function resolveSingleParticipantGroups({
  course,
  prisma,
  emitter,
}: {
  course: CourseWithSingleParticipantGroups
  prisma: PrismaClient
  emitter?: EventEmitter
}) {
  const singleParticipantGroups = course.participantGroups
    .filter((group) => group.participants.length === 1)
    .map((group) => ({
      groupId: group.id,
      participantId: group.participants[0]!.id,
    }))

  const courseExtendedPool = await prisma.course.update({
    where: { id: course.id },
    data: {
      groupAssignmentPoolEntries: {
        create: singleParticipantGroups.map(({ participantId }) => ({
          participant: {
            connect: { id: participantId },
          },
        })),
      },
      participantGroups: {
        deleteMany: {
          id: {
            in: singleParticipantGroups.map(({ groupId }) => groupId),
          },
        },
      },
    },
    include: {
      groupAssignmentPoolEntries: {
        orderBy: {
          createdAt: 'asc',
        },
      },
    },
  })

  singleParticipantGroups.forEach(({ groupId }) => {
    emitter?.emit('invalidate', {
      typename: 'ParticipantGroup',
      id: groupId,
    })
  })

  return courseExtendedPool
}

async function manualRandomGroupAssignmentsByCourseId(
  ctx: TRPCContextWithUser,
  courseId: string
) {
  const prisma = getPrisma(ctx)
  const course = await prisma.course.findUnique({
    where: {
      id: courseId,
      randomAssignmentFinalized: false,
      isGroupCreationEnabled: true,
    },
    include: {
      groupAssignmentPoolEntries: { orderBy: { createdAt: 'asc' } },
      participantGroups: {
        select: singleParticipantGroupSelect,
      },
    },
  })

  if (!course) return null

  try {
    const courseExtendedPool = await resolveSingleParticipantGroups({
      course,
      prisma,
      emitter: ctx.emitter,
    })

    await sendTeamsNotification({
      scope: 'trpc/manualRandomGroupAssignments',
      text: `Resolved all single participant groups for course ${course.name} (id: ${course.id}).`,
    })

    if (courseExtendedPool.groupAssignmentPoolEntries.length === 0) {
      await prisma.course.update({
        where: { id: courseId },
        data: { randomAssignmentFinalized: true },
      })

      return []
    }

    if (courseExtendedPool.groupAssignmentPoolEntries.length === 1) return null

    const groupParticipantIds = splitGroupsFinal({
      participantIds: courseExtendedPool.groupAssignmentPoolEntries.map(
        (entry) => entry.participantId
      ),
      preferredGroupSize: course.preferredGroupSize,
    })

    const newGroups = groupParticipantIds.map((group) => ({
      randomlyAssigned: true,
      name:
        uniqueNamesGenerator({
          dictionaries: [colors, adjectives, animals],
          separator: ' ',
          style: 'capital',
        }) + 's',
      code: randomSixDigitCode(),
      participants: { connect: group.map((id) => ({ id })) },
    }))

    const updatedCourse = await prisma.course.update({
      where: { id: courseId },
      data: {
        groupDeadlineDate: new Date(),
        randomAssignmentFinalized: true,
        participantGroups: { create: newGroups },
        groupAssignmentPoolEntries: { deleteMany: {} },
      },
      select: {
        participantGroups: {
          select: courseParticipantGroupSelect,
        },
      },
    })

    ctx.emitter?.emit('invalidate', { typename: 'Course', id: courseId })
    courseExtendedPool.groupAssignmentPoolEntries.forEach((entry) => {
      ctx.emitter?.emit('invalidate', {
        typename: 'GroupAssignmentPoolEntry',
        id: entry.id,
      })
    })

    await sendTeamsNotification({
      scope: 'trpc/manualRandomGroupAssignments',
      text: `Successfully completed random group assignment for course ${course.name} (id: ${course.id}) with ${newGroups.length} new groups.`,
    })

    return updatedCourse.participantGroups
  } catch (error) {
    console.error(error)
    await sendTeamsNotification({
      scope: 'trpc/manualRandomGroupAssignments',
      text: `Random group creation failed for course ${course.name} (id: ${course.id}) with error: ${
        error || 'missing'
      }`,
    })

    return null
  }
}

async function deleteScheduledHatchetTask({
  ctx,
  taskId,
  failureMessage,
}: {
  ctx: TRPCContextWithUser
  taskId: string
  failureMessage: string
}) {
  const hatchet = ctx.hatchet as ScheduledHatchetClient | undefined

  if (!hatchet?.scheduled?.delete) {
    throw new Error('Hatchet client unavailable')
  }

  try {
    await hatchet.scheduled.delete(taskId)
  } catch {
    console.log(failureMessage)
  }
}

async function deleteCourseById(ctx: TRPCContextWithUser, id: string) {
  const prisma = getPrisma(ctx)
  const course = await prisma.course.findUnique({
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

  const deletedCourse = await prisma.$transaction(
    async (tx) => {
      const deleted = await tx.course.delete({ where: { id } })

      for (const liveQuiz of course.liveQuizzes) {
        await recomputeDerivedPermissions({ liveQuizId: liveQuiz.id }, tx)
      }

      const elementIds = [
        ...new Set([
          ...course.practiceQuizzes.flatMap((quiz) =>
            quiz.stacks.flatMap((stack) =>
              stack.elements.map((instance) => instance.elementId)
            )
          ),
          ...course.microLearnings.flatMap((microLearning) =>
            microLearning.stacks.flatMap((stack) =>
              stack.elements.map((instance) => instance.elementId)
            )
          ),
          ...course.groupActivities.flatMap((groupActivity) =>
            groupActivity.stacks.flatMap((stack) =>
              stack.elements.map((instance) => instance.elementId)
            )
          ),
        ]),
      ]

      for (const elementId of elementIds) {
        await recomputeDerivedPermissions({ elementId }, tx)
      }

      return deleted
    },
    { timeout: 60000 }
  )

  for (const practiceQuiz of course.practiceQuizzes) {
    if (practiceQuiz.scheduledPublicationTaskId) {
      await deleteScheduledHatchetTask({
        ctx,
        taskId: practiceQuiz.scheduledPublicationTaskId,
        failureMessage: `Failed to delete scheduled publication hatchet job for practice quiz ${practiceQuiz.id}`,
      })
    }
  }

  for (const microLearning of course.microLearnings) {
    if (microLearning.scheduledPublicationTaskId) {
      await deleteScheduledHatchetTask({
        ctx,
        taskId: microLearning.scheduledPublicationTaskId,
        failureMessage: `Failed to delete scheduled publication hatchet job for micro learning ${microLearning.id}`,
      })
    }

    if (microLearning.scheduledCompletionTaskId) {
      await deleteScheduledHatchetTask({
        ctx,
        taskId: microLearning.scheduledCompletionTaskId,
        failureMessage: `Failed to delete scheduled completion hatchet job for micro learning ${microLearning.id}`,
      })
    }
  }

  for (const groupActivity of course.groupActivities) {
    if (groupActivity.scheduledPublicationTaskId) {
      await deleteScheduledHatchetTask({
        ctx,
        taskId: groupActivity.scheduledPublicationTaskId,
        failureMessage: `Failed to delete scheduled publication hatchet job for group activity ${groupActivity.id}`,
      })
    }

    if (groupActivity.scheduledCompletionTaskId) {
      await deleteScheduledHatchetTask({
        ctx,
        taskId: groupActivity.scheduledCompletionTaskId,
        failureMessage: `Failed to delete scheduled completion hatchet job for group activity ${groupActivity.id}`,
      })
    }
  }

  ctx.emitter?.emit('invalidate', { typename: 'Course', id })
  return deletedCourse
}

async function updateCourseSettingsById(
  ctx: TRPCContextWithUser,
  input: UpdateCourseSettingsInput
) {
  const prisma = getPrisma(ctx)
  const course = await prisma.course.findUnique({
    where: { id: input.id },
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
  const newGroupDeadlinePast = input.groupDeadlineDate
    ? input.groupDeadlineDate < new Date()
    : false
  const containsActivities =
    course._count.liveQuizzes > 0 ||
    course._count.practiceQuizzes > 0 ||
    course._count.microLearnings > 0 ||
    course._count.groupActivities > 0
  const containsGroups = course._count.participantGroups > 0

  const newGamificationSetting =
    course.isGamificationEnabled !== input.isGamificationEnabled &&
    (input.isGamificationEnabled || (!containsActivities && !containsGroups))
      ? (input.isGamificationEnabled ?? false)
      : undefined
  const newAssessmentSetting =
    course.isAssessmentEnabled !== input.isAssessmentEnabled
      ? (input.isAssessmentEnabled ?? undefined)
      : undefined

  return prisma.course.update({
    where: { id: input.id },
    data: {
      name: input.name ?? undefined,
      displayName: input.displayName ?? undefined,
      description: input.description,
      language: input.language,
      color: input.color ?? undefined,
      startDate:
        currentStartDatePast || !input.startDate ? undefined : input.startDate,
      endDate: input.endDate ?? undefined,
      isGroupCreationEnabled:
        input.isGroupCreationEnabled || !containsGroups
          ? (input.isGroupCreationEnabled ?? false)
          : undefined,
      groupDeadlineDate: input.groupDeadlineDate ?? undefined,
      notificationEmail: input.notificationEmail ?? undefined,
      isGamificationEnabled: newGamificationSetting,
      isAssessmentEnabled: input.isAssessmentEnabled ?? undefined,
      pinCode: input.isAssessmentEnabled ? null : undefined,
      randomAssignmentFinalized: !newGroupDeadlinePast ? false : undefined,
      groupAssignmentPoolEntries:
        !input.isGroupCreationEnabled && !containsGroups
          ? { deleteMany: {} }
          : undefined,
      ...(newGamificationSetting || newAssessmentSetting
        ? {
            liveQuizzes: {
              updateMany: {
                where: {
                  isDeleted: false,
                  status: {
                    in: [
                      PublicationStatus.DRAFT,
                      PublicationStatus.SCHEDULED,
                      PublicationStatus.PUBLISHED,
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
                      PublicationStatus.DRAFT,
                      PublicationStatus.SCHEDULED,
                      PublicationStatus.PUBLISHED,
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
                      PublicationStatus.DRAFT,
                      PublicationStatus.SCHEDULED,
                      PublicationStatus.PUBLISHED,
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
                      PublicationStatus.DRAFT,
                      PublicationStatus.SCHEDULED,
                      PublicationStatus.PUBLISHED,
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
    select: courseSettingsSelect,
  })
}

async function getActivityCourse(
  prisma: TRPCContextWithUser['prisma'],
  {
    activityId,
    activityType,
  }: {
    activityId: string
    activityType: ActivityType
  }
) {
  switch (activityType) {
    case ActivityType.LIVE_QUIZ: {
      const liveQuiz = await prisma.liveQuiz.findUnique({
        where: { id: activityId },
        select: { course: { select: activeUserCourseSelect } },
      })

      return liveQuiz?.course ?? null
    }
    case ActivityType.PRACTICE_QUIZ: {
      const practiceQuiz = await prisma.practiceQuiz.findUnique({
        where: { id: activityId },
        select: { course: { select: activeUserCourseSelect } },
      })

      return practiceQuiz?.course ?? null
    }
    case ActivityType.MICRO_LEARNING: {
      const microLearning = await prisma.microLearning.findUnique({
        where: { id: activityId },
        select: { course: { select: activeUserCourseSelect } },
      })

      return microLearning?.course ?? null
    }
    case ActivityType.GROUP_ACTIVITY: {
      const groupActivity = await prisma.groupActivity.findUnique({
        where: { id: activityId },
        select: { course: { select: activeUserCourseSelect } },
      })

      return groupActivity?.course ?? null
    }
  }

  return null
}

export const courseRouter = router({
  basicCourseInformation: publicProcedure
    .input(basicCourseInformationInput)
    .query(async ({ ctx, input }) => {
      const prisma = getPrisma(ctx)
      const course = await prisma.course.findUnique({
        where: { id: input.courseId },
        select: {
          id: true,
          displayName: true,
          description: true,
          color: true,
          owner: {
            select: {
              shortname: true,
            },
          },
        },
      })

      return {
        basicCourseInformation: toBasicCourseInformation(course),
      }
    }),

  controlCourses: userProcedure.query(async ({ ctx }) => {
    const prisma = getPrisma(ctx)
    const user = await prisma.user.findUnique({
      where: { id: ctx.user.sub },
      include: { courses: { orderBy: { createdAt: 'desc' } } },
    })

    return {
      controlCourses: user?.courses.map(toControlCourseListItem) ?? [],
    }
  }),

  userCourses: userProcedure.query(async ({ ctx }) => {
    const prisma = getPrisma(ctx)
    const user = await prisma.user.findUnique({
      where: { id: ctx.user.sub },
      select: {
        objects: {
          where: { courseId: { not: null } },
          select: {
            course: {
              select: {
                id: true,
                name: true,
                displayName: true,
                color: true,
                isArchived: true,
                isGamificationEnabled: true,
                isAssessmentEnabled: true,
                isGroupCreationEnabled: true,
                description: true,
                startDate: true,
                endDate: true,
                createdAt: true,
                updatedAt: true,
                _count: {
                  select: {
                    permissions: true,
                  },
                },
              },
            },
            derived: true,
            directPermission: {
              select: {
                userGroupId: true,
              },
            },
            permissionLevel: true,
          },
          orderBy: [{ course: { endDate: 'desc' } }],
        },
      },
    })

    return {
      userCourses:
        user?.objects
          .flatMap((object) => {
            const course = toManageCourseListItem(object)
            return course ? [course] : []
          })
          .sort((a, b) => {
            return a.isArchived === b.isArchived ? 0 : a.isArchived ? 1 : -1
          }) ?? [],
    }
  }),

  create: userFullAccessProcedure
    .input(createCourseInput)
    .mutation(async ({ ctx, input }) => {
      const prisma = getPrisma(ctx)
      const randomPin = randomNineDigitCode()

      const course = await prisma.$transaction(
        async (tx) => {
          const newCourse = await tx.course.create({
            data: {
              name: input.name.trim(),
              displayName: input.displayName.trim(),
              description: input.description,
              language: input.language,
              color: input.color ?? '#CCD5ED',
              startDate: input.startDate,
              endDate: input.endDate,
              isGroupCreationEnabled: input.isGroupCreationEnabled,
              groupDeadlineDate: input.groupDeadlineDate,
              maxGroupSize: input.maxGroupSize,
              preferredGroupSize: input.preferredGroupSize,
              notificationEmail: input.notificationEmail,
              isGamificationEnabled: input.isGamificationEnabled,
              isAssessmentEnabled: false,
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
            tx
          )

          return newCourse
        },
        { timeout: 60000 }
      )

      return {
        course: toManageCourseListItem({
          course: {
            ...course,
            _count: {
              permissions: 1,
            },
          },
          derived: false,
          directPermission: null,
          permissionLevel: PermissionLevel.OWNER,
        }),
      }
    }),

  toggleArchive: userProcedure
    .input(toggleArchiveCourseInput)
    .mutation(async ({ ctx, input }) => {
      if (
        !(await hasCoursePermission(
          ctx as TRPCContextWithUser,
          input.id,
          PermissionLevel.ADMIN
        ))
      ) {
        return { course: null }
      }

      const prisma = getPrisma(ctx)
      const course = await prisma.course.update({
        where: { id: input.id, endDate: { lte: new Date() } },
        data: { isArchived: input.isArchived },
        select: {
          id: true,
          isArchived: true,
        },
      })

      return { course }
    }),

  delete: userProcedure
    .input(deleteCourseInput)
    .mutation(async ({ ctx, input }) => {
      if (
        !(await hasCoursePermission(
          ctx as TRPCContextWithUser,
          input.id,
          PermissionLevel.ADMIN
        ))
      ) {
        return { course: null }
      }

      const course = await deleteCourseById(
        ctx as TRPCContextWithUser,
        input.id
      )

      return { course: { id: course.id } }
    }),

  updateSettings: userFullAccessProcedure
    .input(updateCourseSettingsInput)
    .mutation(async ({ ctx, input }) => {
      if (
        !(await hasCoursePermission(
          ctx as TRPCContextWithUser,
          input.id,
          PermissionLevel.WRITE
        ))
      ) {
        return { course: null }
      }

      return {
        course: await updateCourseSettingsById(
          ctx as TRPCContextWithUser,
          input
        ),
      }
    }),

  detail: userProcedure
    .input(courseDetailInput)
    .query(async ({ ctx, input }) => {
      if (
        !(await hasCoursePermission(
          ctx as TRPCContextWithUser,
          input.courseId,
          PermissionLevel.READ
        ))
      ) {
        return { course: null }
      }

      const prisma = getPrisma(ctx)
      const userId = ctx.user.sub
      const activityPermissionInclude = {
        where: { userId },
        include: { directPermission: true },
      }

      const course = await prisma.course.findUnique({
        where: { id: input.courseId },
        include: {
          _count: {
            select: {
              participantGroups: true,
              participations: true,
              permissions: true,
            },
          },
          permissions: {
            where: { userId },
            include: { directPermission: true },
          },
          liveQuizzes: {
            where: { isDeleted: false },
            include: {
              blocks: {
                include: { _count: { select: { elements: true } } },
                orderBy: { order: 'asc' },
              },
              permissions: activityPermissionInclude,
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
              permissions: activityPermissionInclude,
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
              permissions: activityPermissionInclude,
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
              permissions: activityPermissionInclude,
              templateInfo: true,
              _count: { select: { permissions: true } },
            },
            orderBy: { scheduledStartAt: 'asc' },
          },
        },
      })

      return {
        course: toCourseDetail(course),
      }
    }),

  groups: userProcedure
    .input(courseGroupsInput)
    .query(async ({ ctx, input }) => {
      if (
        !(await hasCoursePermission(
          ctx as TRPCContextWithUser,
          input.courseId,
          PermissionLevel.READ
        ))
      ) {
        return { courseGroups: null }
      }

      const prisma = getPrisma(ctx)
      const course = await prisma.course.findUnique({
        where: { id: input.courseId },
        select: {
          participantGroups: {
            select: courseParticipantGroupSelect,
          },
          groupAssignmentPoolEntries: {
            select: {
              id: true,
              participant: {
                select: courseGroupParticipantSelect,
              },
            },
          },
        },
      })

      return {
        courseGroups: toCourseGroups(course),
      }
    }),

  leaderboard: userProcedure
    .input(courseLeaderboardInput)
    .query(async ({ ctx, input }) => {
      if (
        !(await hasCoursePermission(
          ctx as TRPCContextWithUser,
          input.courseId,
          PermissionLevel.READ
        ))
      ) {
        return { courseLeaderboard: null }
      }

      return {
        courseLeaderboard: await getCourseLeaderboard({
          prisma: getPrisma(ctx),
          input,
        }),
      }
    }),

  updateWeeklyTimelineEntries: userFullAccessProcedure
    .input(courseGroupsInput)
    .mutation(async ({ ctx, input }) => {
      if (
        !(await hasCoursePermission(
          ctx as TRPCContextWithUser,
          input.courseId,
          PermissionLevel.READ
        ))
      ) {
        return { updateWeeklyTimelineEntriesCourse: null }
      }

      return {
        updateWeeklyTimelineEntriesCourse:
          await updateWeeklyTimelineEntriesCourse(
            { courseId: input.courseId },
            getPrisma(ctx)
          ),
      }
    }),

  manualRandomGroupAssignments: userProcedure
    .input(courseGroupsInput)
    .mutation(async ({ ctx, input }) => {
      if (
        !(await hasCoursePermission(
          ctx as TRPCContextWithUser,
          input.courseId,
          PermissionLevel.WRITE
        ))
      ) {
        return { participantGroups: null }
      }

      return {
        participantGroups: toCourseParticipantGroups(
          await manualRandomGroupAssignmentsByCourseId(
            ctx as TRPCContextWithUser,
            input.courseId
          )
        ),
      }
    }),

  activeUserCourses: userProcedure
    .input(activeUserCoursesInput)
    .query(async ({ ctx, input }) => {
      const prisma = getPrisma(ctx)
      const user = await prisma.user.findUnique({
        where: { id: ctx.user.sub },
        select: {
          objects: {
            where: {
              courseId: { not: null },
              course: {
                endDate: { gte: new Date() },
                isArchived: false,
              },
            },
            select: {
              course: {
                select: activeUserCourseSelect,
              },
              permissionLevel: true,
            },
            orderBy: [
              { course: { startDate: 'asc' } },
              { course: { name: 'asc' } },
            ],
          },
        },
      })

      const activeUserCourses =
        user?.objects.flatMap((object) => {
          const course = toActiveUserCourse(object)
          return course ? [course] : []
        }) ?? []

      if (!input?.activityId || input.activityType == null) {
        return { activeUserCourses }
      }

      const hasAccess = await hasActivityPermission(
        ctx as TRPCContextWithUser,
        {
          activityId: input.activityId,
          activityType: input.activityType,
        },
        PermissionLevel.WRITE
      )

      if (!hasAccess) return { activeUserCourses }

      const activityCourse = toActiveUserCourseWithoutPermissions(
        await getActivityCourse(prisma, {
          activityId: input.activityId,
          activityType: input.activityType,
        })
      )

      if (!activityCourse) return { activeUserCourses }

      const augmentedCourses = activeUserCourses.some(
        (course) => course.id === activityCourse.id
      )
        ? activeUserCourses
        : [...activeUserCourses, activityCourse]

      return {
        activeUserCourses: [...augmentedCourses].sort(
          (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
        ),
      }
    }),

  activityIds: userProcedure
    .input(courseActivityIdsInput)
    .query(async ({ ctx, input }) => {
      const prisma = getPrisma(ctx)
      const user = await prisma.user.findUnique({
        where: { id: ctx.user.sub },
        include: {
          objects: {
            where: {
              OR: [
                {
                  liveQuiz: {
                    isDeleted: false,
                    courseId: input.courseId ?? null,
                  },
                },
                ...(input.courseId
                  ? [
                      {
                        practiceQuiz: {
                          isDeleted: false,
                          courseId: input.courseId,
                        },
                      },
                    ]
                  : []),
                ...(input.courseId
                  ? [
                      {
                        microLearning: {
                          isDeleted: false,
                          courseId: input.courseId,
                        },
                      },
                    ]
                  : []),
                ...(input.courseId
                  ? [
                      {
                        groupActivity: {
                          isDeleted: false,
                          courseId: input.courseId,
                        },
                      },
                    ]
                  : []),
              ],
            },
            include: {
              liveQuiz: { select: { id: true, name: true } },
              practiceQuiz: { select: { id: true, name: true } },
              microLearning: { select: { id: true, name: true } },
              groupActivity: { select: { id: true, name: true } },
            },
          },
        },
      })

      if (!user) return { courseActivityIds: null }

      return {
        courseActivityIds: user.objects.reduce<{
          liveQuizzes: { id: string; name: string }[]
          practiceQuizzes: { id: string; name: string }[]
          microLearnings: { id: string; name: string }[]
          groupActivities: { id: string; name: string }[]
        }>(
          (acc, object) => {
            if (object.liveQuiz) {
              acc.liveQuizzes.push({
                id: object.liveQuiz.id,
                name: object.liveQuiz.name,
              })
            } else if (object.practiceQuiz) {
              acc.practiceQuizzes.push({
                id: object.practiceQuiz.id,
                name: object.practiceQuiz.name,
              })
            } else if (object.microLearning) {
              acc.microLearnings.push({
                id: object.microLearning.id,
                name: object.microLearning.name,
              })
            } else if (object.groupActivity) {
              acc.groupActivities.push({
                id: object.groupActivity.id,
                name: object.groupActivity.name,
              })
            }

            return acc
          },
          {
            liveQuizzes: [],
            practiceQuizzes: [],
            microLearnings: [],
            groupActivities: [],
          }
        ),
      }
    }),

  activities: userProcedure
    .input(courseActivitiesInput)
    .query(async ({ ctx, input }) => {
      if (
        !(await hasCoursePermission(
          ctx as TRPCContextWithUser,
          input.courseId,
          PermissionLevel.READ
        ))
      ) {
        return { courseActivities: null }
      }

      const prisma = getPrisma(ctx)
      const course = await prisma.course.findUnique({
        where: { id: input.courseId },
        select: {
          id: true,
          name: true,
          practiceQuizzes: {
            where: {
              isDeleted: false,
              status: PublicationStatus.PUBLISHED,
            },
            select: {
              id: true,
              name: true,
              status: true,
            },
            orderBy: { createdAt: 'desc' },
          },
          microLearnings: {
            where: {
              isDeleted: false,
              status: {
                in: [PublicationStatus.PUBLISHED, PublicationStatus.ENDED],
              },
            },
            select: {
              id: true,
              name: true,
              status: true,
            },
            orderBy: { scheduledStartAt: 'desc' },
          },
        },
      })

      return {
        courseActivities: toCourseActivities(course),
      }
    }),

  summary: userProcedure
    .input(courseSummaryInput)
    .query(async ({ ctx, input }) => {
      if (
        !(await hasCoursePermission(
          ctx as TRPCContextWithUser,
          input.courseId,
          PermissionLevel.READ
        ))
      ) {
        return { courseSummary: null }
      }

      const prisma = getPrisma(ctx)
      const course = await prisma.course.findUnique({
        where: { id: input.courseId },
        select: {
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

      return {
        courseSummary: toCourseSummary(course),
      }
    }),

  controlCourse: userProcedure
    .input(controlCourseInput)
    .query(async ({ ctx, input }) => {
      const prisma = getPrisma(ctx)
      const permission = await prisma.derivedPermission.findFirst({
        where: {
          courseId: input.courseId,
          userId: ctx.user.sub,
          permissionLevel: {
            in: courseExecutePermissionLevels,
          },
        },
      })

      if (!permission) {
        return { controlCourse: null }
      }

      const course = await prisma.course.findUnique({
        where: { id: input.courseId },
        include: {
          liveQuizzes: {
            where: { isDeleted: false },
            select: {
              id: true,
              name: true,
              status: true,
            },
            orderBy: { createdAt: 'desc' },
          },
        },
      })

      return {
        controlCourse: toControlCourse(course),
      }
    }),
})
