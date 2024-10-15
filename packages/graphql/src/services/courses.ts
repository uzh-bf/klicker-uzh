import {
  ElementOrderType,
  GroupActivityStatus,
  LeaderboardType,
  ParticipantGroup,
  PublicationStatus,
  UserRole,
} from '@klicker-uzh/prisma'
import { levelFromXp } from '@klicker-uzh/util/dist/pure.js'
import { prop, sortBy } from 'remeda'
import { ILeaderboardEntry } from 'src/schema/course.js'
import { Context, ContextWithUser } from '../lib/context.js'
import { orderStacks, sendTeamsNotifications } from '../lib/util.js'

export async function getBasicCourseInformation(
  { courseId }: { courseId: string },
  ctx: Context
) {
  const course = await ctx.prisma.course.findUnique({
    where: { id: courseId },
    include: {
      owner: true,
    },
  })

  if (!course) {
    return null
  }

  return course
}

export async function joinCourseWithPin(
  { pin }: { pin: number },
  ctx: ContextWithUser
) {
  const course = await ctx.prisma.course.findUnique({
    where: { pinCode: pin },
  })

  if (!course || course.pinCode !== pin) {
    return null
  }

  // update the participants participations and set the newest one to be active
  const updatedParticipant = await ctx.prisma.participant.update({
    where: { id: ctx.user.sub },
    data: {
      participations: {
        connectOrCreate: {
          where: {
            courseId_participantId: {
              courseId: course.id,
              participantId: ctx.user.sub,
            },
          },
          create: { course: { connect: { id: course.id } } },
        },
      },
    },
  })

  ctx.emitter.emit('invalidate', {
    typename: 'Participant',
    id: updatedParticipant.id,
  })

  return updatedParticipant
}

// join a course leaderboard as a participant
// creates a participation and a leaderboard entry
interface JoinCourseArgs {
  courseId: string
}
export async function joinCourse(
  { courseId }: JoinCourseArgs,
  ctx: ContextWithUser
) {
  const participation = await ctx.prisma.participation.upsert({
    where: {
      courseId_participantId: {
        courseId,
        participantId: ctx.user.sub,
      },
    },
    create: {
      isActive: true,
      course: {
        connect: {
          id: courseId,
        },
      },
      participant: {
        connect: {
          id: ctx.user.sub,
        },
      },
    },
    update: {
      isActive: true,
    },
  })

  if (!participation) return null

  const lbEntry = await ctx.prisma.leaderboardEntry.create({
    data: {
      type: 'COURSE',
      participant: {
        connect: {
          id: ctx.user.sub,
        },
      },
      course: {
        connect: {
          id: courseId,
        },
      },
      participation: {
        connect: {
          id: participation.id,
        },
      },
      score: 0,
    },
  })

  return {
    id: `${courseId}-${ctx.user.sub}`,
    participation,
    lbEntry,
  }
}

// leave a course leaderboard as a participant
// deletes the leaderboard entries related to the course and sets the participation to inactive
// meaning that no further points will be collected
interface LeaveCourseArgs {
  courseId: string
}
export async function leaveCourse(
  { courseId }: LeaveCourseArgs,
  ctx: ContextWithUser
) {
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

  await ctx.prisma.leaderboardEntry.deleteMany({
    where: { participation: { id: participation.id } },
  })

  // TODO:: reset collected points and points dates on questionresponse and questionresponsedetail

  if (!participation) return null

  return {
    id: `${courseId}-${ctx.user.sub}`,
    participation,
  }
}

export async function getCourseOverviewData(
  { courseId }: { courseId: string },
  ctx: ContextWithUser
) {
  // TODO: a lot of fetching seems to be duplicated with the large joins here - optimize where possible
  if (ctx.user?.sub) {
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
              include: {
                participant: true,
                participantGroup: true,
              },
              orderBy: {
                order: 'asc',
              },
            },
          },
        },
        participant: {
          include: {
            participantGroups: true,
          },
        },
        courseLeaderboard: true,
      },
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

      const allGroupEntries = participation.course.participantGroups.reduce<{
        mapped: (ParticipantGroup & { score: number; isMember: boolean })[]
        sum: number
        count: number
      }>(
        (acc, group, ix) => {
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
        {
          mapped: [],
          count: 0,
          sum: 0,
        }
      )

      const sortedEntries = sortBy(
        allEntries.mapped,
        [prop('score'), 'desc'],
        [prop('username'), 'asc']
      )
      const sortedGroupEntries = sortBy(
        allGroupEntries.mapped,
        [prop('score'), 'desc'],
        [prop('name'), 'asc']
      )

      const filteredEntries = sortedEntries.flatMap((entry, ix) => {
        if (ix < 10 || entry.participantId === ctx.user?.sub)
          return { ...entry, rank: ix + 1 }
        return []
      })
      const filteredGroupEntries = sortedGroupEntries.flatMap((entry, ix) => {
        return { ...entry, rank: ix + 1 }
      })

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
        leaderboard: filteredEntries,
        leaderboardStatistics: {
          participantCount: allEntries.count,
          averageScore:
            allEntries.count > 0 ? allEntries.sum / allEntries.count : 0,
        },
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
      awards: {
        include: {
          participant: true,
          participantGroup: true,
        },
      },
    },
  })

  if (!course) return null

  let participant = null
  if (ctx.user?.sub) {
    participant = await ctx.prisma.participant.findUnique({
      where: { id: ctx.user.sub },
    })
  }

  return {
    id: `${courseId}-${participant?.id}`,
    course,
    participant,
    participation: null,
    leaderboard: [],
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
  notificationEmail?: string | null
  isGamificationEnabled: boolean
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
    notificationEmail,
    isGamificationEnabled,
  }: CreateCourseArgs,
  ctx: ContextWithUser
) {
  // TODO: ensure that PINs are unique
  const randomPin = Math.floor(Math.random() * 900000000 + 100000000)

  // convert times from local time to UTC
  // startDate.setHours(startDate.getHours() - startDate.getTimezoneOffset() / 60)
  // endDate.setHours(endDate.getHours() - endDate.getTimezoneOffset() / 60)

  const defaultMaxGroupSize = 5
  const defaultPreferredGroupSize = 3
  const course = await ctx.prisma.course.create({
    data: {
      name: name.trim(),
      displayName: displayName.trim(),
      description: description,
      color: color ?? '#CCD5ED',
      startDate: startDate,
      endDate: endDate,
      isGroupCreationEnabled: isGroupCreationEnabled ?? true,
      groupDeadlineDate: groupDeadlineDate ?? endDate,
      maxGroupSize: maxGroupSize ?? defaultMaxGroupSize,
      preferredGroupSize: preferredGroupSize ?? defaultPreferredGroupSize,
      notificationEmail: notificationEmail,
      isGamificationEnabled: isGamificationEnabled,
      pinCode: randomPin,
      owner: {
        connect: {
          id: ctx.user.sub,
        },
      },
    },
  })

  return course
}

interface ToggleArchiveCourseProps {
  id: string
  isArchived: boolean
}

export async function toggleArchiveCourse(
  { id, isArchived }: ToggleArchiveCourseProps,
  ctx: ContextWithUser
) {
  const course = await ctx.prisma.course.update({
    where: {
      id,
      ownerId: ctx.user.sub,
      endDate: {
        lte: new Date(),
      },
    },
    data: {
      isArchived,
    },
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
  notificationEmail?: string | null
  isGamificationEnabled?: boolean | null
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
    notificationEmail,
    isGamificationEnabled,
  }: UpdateCourseSettingsArgs,
  ctx: ContextWithUser
) {
  // verify that no past dates are modified or enabled gamification / group creation settings are disabled
  const course = await ctx.prisma.course.findUnique({
    where: {
      id,
    },
  })

  if (!course) return null

  const currentStartDatePast = course.startDate < new Date()
  const newStartDatePast = startDate ? startDate < new Date() : false
  const newGroupDeadlinePast = groupDeadlineDate
    ? groupDeadlineDate < new Date()
    : false

  const updatedCourse = await ctx.prisma.course.update({
    where: {
      id,
    },
    data: {
      name: name ?? undefined,
      displayName: displayName ?? undefined,
      description: description ?? undefined,
      color: color ?? undefined,
      startDate:
        currentStartDatePast || newStartDatePast || !startDate
          ? undefined
          : startDate,
      endDate: endDate ?? undefined,
      isGroupCreationEnabled:
        course.isGroupCreationEnabled || !isGroupCreationEnabled
          ? undefined
          : isGroupCreationEnabled,
      groupDeadlineDate: groupDeadlineDate ?? undefined,
      notificationEmail: notificationEmail ?? undefined,
      isGamificationEnabled:
        course.isGamificationEnabled || !isGamificationEnabled
          ? undefined
          : isGamificationEnabled,
      // reset the random assignment tracking if the group deadline is extended
      randomAssignmentFinalized: !newGroupDeadlinePast ? false : undefined,
    },
  })

  return updatedCourse
}

export async function getUserCourses(ctx: ContextWithUser) {
  const userCourses = await ctx.prisma.user.findUnique({
    where: {
      id: ctx.user.sub,
    },
    include: {
      courses: {
        orderBy: {
          createdAt: 'desc',
        },
      },
    },
  })

  // sort courses by archived or not
  const archivedSortedCourses =
    userCourses?.courses.sort((a, b) => {
      return a.isArchived === b.isArchived ? 0 : a.isArchived ? 1 : -1
    }) ?? []

  // sort courses by start date descending
  const startDateSortedCourses = archivedSortedCourses.sort((a, b) => {
    return a.startDate > b.startDate ? -1 : a.startDate < b.startDate ? 1 : 0
  })

  return startDateSortedCourses
}

export async function getActiveUserCourses(ctx: ContextWithUser) {
  const userCourses = await ctx.prisma.user.findUnique({
    where: {
      id: ctx.user.sub,
    },
    include: {
      courses: {
        where: {
          endDate: {
            gte: new Date(),
          },
          isArchived: false,
        },
        orderBy: {
          createdAt: 'desc',
        },
      },
    },
  })

  return userCourses?.courses ?? []
}

export async function getCourseSummary(
  { courseId }: { courseId: string },
  ctx: ContextWithUser
) {
  const course = await ctx.prisma.course.findUnique({
    where: {
      id: courseId,
      ownerId: ctx.user.sub,
    },
    include: {
      _count: {
        select: {
          sessions: true,
          practiceQuizzes: {
            where: {
              isDeleted: false,
            },
          },
          microLearnings: {
            where: {
              isDeleted: false,
            },
          },
          groupActivities: {
            where: {
              isDeleted: false,
            },
          },
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
    numOfLiveQuizzes: course._count.sessions,
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
  const deletedCourse = await ctx.prisma.course.delete({
    where: {
      id,
      ownerId: ctx.user.sub,
    },
  })

  ctx.emitter.emit('invalidate', {
    typename: 'Course',
    id,
  })

  return deletedCourse
}

export async function getParticipantCourses(ctx: ContextWithUser) {
  const participantCourses = await ctx.prisma.participant.findUnique({
    where: {
      id: ctx.user.sub,
    },
    include: {
      participations: {
        include: {
          course: true,
        },
      },
    },
  })

  return participantCourses?.participations.map((p) => p.course) ?? []
}

export async function getControlCourses(ctx: ContextWithUser) {
  const user = await ctx.prisma.user.findUnique({
    where: {
      id: ctx.user.sub,
    },
    include: {
      courses: {
        orderBy: {
          createdAt: 'desc',
        },
      },
    },
  })

  return user?.courses ?? []
}

export async function getCourseData(
  { id }: { id: string },
  ctx: ContextWithUser
) {
  const course = await ctx.prisma.course.findUnique({
    where: { id, ownerId: ctx.user.sub },
    include: {
      _count: {
        select: { participantGroups: true },
      },
      sessions: {
        where: {
          isDeleted: false,
        },
        include: {
          blocks: {
            include: {
              _count: {
                select: { instances: true },
              },
            },
          },
        },
        orderBy: {
          updatedAt: 'desc',
        },
      },
      practiceQuizzes: {
        where: {
          isDeleted: false,
        },
        include: {
          _count: {
            select: { stacks: true },
          },
        },
        orderBy: {
          updatedAt: 'desc',
        },
      },
      groupActivities: {
        where: {
          isDeleted: false,
        },
        include: {
          stacks: {
            include: {
              elements: true,
            },
          },
        },
        orderBy: {
          updatedAt: 'desc',
        },
      },
      microLearnings: {
        where: {
          isDeleted: false,
        },
        include: {
          _count: {
            select: { stacks: true },
          },
        },
        orderBy: {
          scheduledStartAt: 'desc',
        },
      },
      leaderboard: {
        include: {
          participation: {
            include: {
              participant: true,
            },
          },
        },
        orderBy: {
          score: 'desc',
        },
        where: {
          participation: {
            isActive: true,
          },
        },
      },
      participations: true,
    },
  })

  if (!course) return null

  const reducedSessions = course?.sessions.map((session) => {
    return {
      ...session,
      numOfBlocks: session.blocks.length,
      numOfQuestions: session.blocks.reduce(
        (acc, block) => acc + block._count.instances,
        0
      ),
    }
  })

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
          type: LeaderboardType.COURSE,
          participantId: entry.participantId,
          participant: entry.participation!.participant,
          sessionParticipationId: null,
          sessionId: null,
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

  const reducedPracticeQuizzes = course?.practiceQuizzes.map((quiz) => {
    return {
      ...quiz,
      numOfStacks: quiz._count.stacks,
    }
  })

  const reducedMicroLearnings = course?.microLearnings.map((microLearning) => {
    return {
      ...microLearning,
      numOfStacks: microLearning._count.stacks,
    }
  })

  const reducedGroupActivities = course?.groupActivities.map(
    (groupActivity) => {
      return {
        ...groupActivity,
        numOfQuestions: groupActivity.stacks[0]!.elements.length,
      }
    }
  )

  return {
    ...course,
    sessions: reducedSessions,
    practiceQuizzes: reducedPracticeQuizzes,
    groupActivities: reducedGroupActivities,
    microLearnings: reducedMicroLearnings,
    numOfParticipants: course?.participations.length,
    numOfActiveParticipants: activeLBEntries.length,
    numOfParticipantGroups: course._count.participantGroups,
    leaderboard: activeLBEntries,
    averageActiveScore,
  }
}

export async function getControlCourse(
  { id }: { id: string },
  ctx: ContextWithUser
) {
  const course = await ctx.prisma.course.findUnique({
    where: { id, ownerId: ctx.user.sub },
    include: {
      sessions: {
        where: {
          isDeleted: false,
        },
        include: {
          blocks: {
            include: {
              _count: {
                select: { instances: true },
              },
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      },
    },
  })

  return course
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
              ctx.user?.sub && ctx.user.role === UserRole.PARTICIPANT
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
    pointsMultiplier: 1,
    resetTimeDays: 6,
    orderType: ElementOrderType.SPACED_REPETITION,
    status: PublicationStatus.PUBLISHED,
    stacks: orderedStacks.slice(0, 25),
    numOfStacks: 25,
    availableFrom: null,
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
    where: {
      id: courseId,
      ownerId: ctx.user.sub,
    },
    data: {
      isGamificationEnabled: true,
    },
  })

  return course
}

export async function publishScheduledActivities(ctx: Context) {
  // ! Publish scheduled practice quizzes
  const quizzesToPublish = await ctx.prisma.practiceQuiz.findMany({
    where: {
      status: PublicationStatus.SCHEDULED,
      availableFrom: {
        lte: new Date(),
      },
    },
  })

  const updatedQuizzes = await Promise.all(
    quizzesToPublish.map((quiz) =>
      ctx.prisma.practiceQuiz.update({
        where: {
          id: quiz.id,
        },
        data: {
          status: PublicationStatus.PUBLISHED,
        },
        include: {
          stacks: true,
        },
      })
    )
  )

  await Promise.all(
    updatedQuizzes.map((quiz) =>
      ctx.prisma.course.update({
        where: {
          id: quiz.courseId,
        },
        data: {
          elementStacks: {
            connect: quiz.stacks.map((stack) => ({ id: stack.id })),
          },
        },
      })
    )
  )

  if (updatedQuizzes.length !== 0) {
    await sendTeamsNotifications(
      'graphql/publishScheduledPracticeQuizzes',
      `Successfully published ${updatedQuizzes.length} scheduled practice quizzes`
    )
  }

  updatedQuizzes.forEach((quiz) => {
    ctx.emitter.emit('invalidate', {
      typename: 'PracticeQuiz',
      id: quiz.id,
    })
  })

  // ! Publish scheduled microlearnings
  const microlearningsToPublish = await ctx.prisma.microLearning.findMany({
    where: {
      status: PublicationStatus.SCHEDULED,
      scheduledStartAt: {
        lte: new Date(),
      },
    },
  })

  const updatedMicroLearnings = await Promise.all(
    microlearningsToPublish.map((micro) =>
      ctx.prisma.microLearning.update({
        where: {
          id: micro.id,
        },
        data: {
          status: PublicationStatus.PUBLISHED,
        },
      })
    )
  )

  if (updatedMicroLearnings.length !== 0) {
    await sendTeamsNotifications(
      'graphql/publishScheduledMicroLearnings',
      `Successfully published ${updatedMicroLearnings.length} scheduled microlearnings`
    )
  }

  updatedMicroLearnings.forEach((micro) => {
    ctx.emitter.emit('invalidate', {
      typename: 'MicroLearning',
      id: micro.id,
    })
  })

  // ! Publish scheduled group activities
  const groupActivitiesToPublish = await ctx.prisma.groupActivity.findMany({
    where: {
      status: PublicationStatus.SCHEDULED,
      scheduledStartAt: {
        lte: new Date(),
      },
    },
  })

  const updatedGroupActivities = await Promise.all(
    groupActivitiesToPublish.map((group) =>
      ctx.prisma.groupActivity.update({
        where: {
          id: group.id,
        },
        data: {
          status: PublicationStatus.PUBLISHED,
        },
      })
    )
  )

  if (updatedGroupActivities.length !== 0) {
    await sendTeamsNotifications(
      'graphql/publishScheduledGroupActivities',
      `Successfully published ${updatedGroupActivities.length} scheduled group activities`
    )
  }

  updatedGroupActivities.forEach((group) => {
    ctx.emitter.emit('invalidate', {
      typename: 'GroupActivity',
      id: group.id,
    })
  })

  // ! Set group activity status to ended for all published group activities that have ended
  const groupActivitiesToEnd = await ctx.prisma.groupActivity.findMany({
    where: {
      status: GroupActivityStatus.PUBLISHED,
      scheduledEndAt: {
        lte: new Date(),
      },
    },
  })

  const updatedGroupActivitiesToEnd = await Promise.all(
    groupActivitiesToEnd.map((group) =>
      ctx.prisma.groupActivity.update({
        where: {
          id: group.id,
        },
        data: {
          status: GroupActivityStatus.ENDED,
        },
      })
    )
  )

  if (updatedGroupActivitiesToEnd.length !== 0) {
    await sendTeamsNotifications(
      'graphql/endGroupActivities',
      `Successfully ended ${updatedGroupActivitiesToEnd.length} group activities`
    )
  }

  updatedGroupActivitiesToEnd.forEach((group) => {
    ctx.emitter.emit('invalidate', {
      typename: 'GroupActivity',
      id: group.id,
    })
  })

  return true
}
