import {
  ElementOrderType,
  GroupActivityStatus,
  LeaderboardEntry,
  PublicationStatus,
  UserRole,
} from '@klicker-uzh/prisma'
import { levelFromXp } from '@klicker-uzh/util/dist/pure'
import * as R from 'ramda'
import { GroupLeaderboardEntry } from 'src/ops'
import { Context, ContextWithUser } from '../lib/context'
import { orderStacks } from '../lib/util'

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
            groupActivities: {
              where: {
                status: GroupActivityStatus.PUBLISHED,
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

    const groupActivityInstances = ctx.prisma.groupActivityInstance.findMany({
      where: {
        groupId: {
          in:
            participation?.participant.participantGroups.map((g) => g.id) ?? [],
        },
      },
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
        mapped: Partial<LeaderboardEntry>[]
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
        mapped: Partial<GroupLeaderboardEntry>[]
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

      const sortByScoreAndUsername = R.curry(R.sortWith)([
        R.descend(R.prop<number>('score')),
        R.ascend(R.prop<string>('username')),
      ])

      const sortedEntries: typeof allEntries.mapped = sortByScoreAndUsername(
        allEntries.mapped
      )
      const sortedGroupEntries: typeof allGroupEntries.mapped =
        sortByScoreAndUsername(allGroupEntries.mapped)

      const filteredEntries = sortedEntries.flatMap((entry, ix) => {
        if (ix < 10 || entry.participantId === ctx.user?.sub)
          return { ...entry, rank: ix + 1 }
        return []
      })
      const filteredGroupEntries = sortedGroupEntries.flatMap((entry, ix) => {
        return { ...entry, rank: ix + 1 }
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
        groupActivityInstances,
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
  groupDeadlineDate?: Date | null
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
    groupDeadlineDate,
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

  const course = await ctx.prisma.course.create({
    data: {
      name: name,
      displayName: displayName,
      description: description,
      color: color ?? '#CCD5ED',
      startDate: startDate,
      endDate: endDate,
      groupDeadlineDate: groupDeadlineDate ?? endDate,
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

  return userCourses?.courses ?? []
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
      sessions: {
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
        include: {
          instances: true,
        },
        orderBy: {
          updatedAt: 'desc',
        },
      },
      microLearnings: {
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

  // FIXME: rework typing on this reduce
  const { activeLBEntries, activeSum, activeCount } =
    course?.leaderboard.reduce(
      (acc, entry) => {
        return {
          ...acc,
          activeLBEntries: [
            ...acc.activeLBEntries,
            {
              id: entry.id,
              score: entry.score,
              rank: acc.activeCount + 1,
              email: entry.participation?.participant.email,
              username: entry.participation?.participant.username,
              avatar: entry.participation?.participant.avatar,
              participation: entry.participation,
            },
          ],
          activeSum: acc.activeSum + entry.score,
          activeCount: acc.activeCount + 1,
        }
      },
      {
        activeLBEntries: [] as Partial<typeof course.leaderboard>,
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

  return {
    ...course,
    sessions: reducedSessions,
    practiceQuizzes: reducedPracticeQuizzes,
    groupActivities: course?.groupActivities,
    microLearnings: reducedMicroLearnings,
    numOfParticipants: course?.participations.length,
    numOfActiveParticipants: activeLBEntries.length,
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

export async function changeCourseDescription(
  { courseId, input }: { courseId: string; input: string },
  ctx: ContextWithUser
) {
  const course = await ctx.prisma.course.update({
    where: {
      id: courseId,
      ownerId: ctx.user.sub,
    },
    data: {
      description: input,
    },
  })

  return course
}

export async function changeCourseColor(
  { courseId, color }: { courseId: string; color: string },
  ctx: ContextWithUser
) {
  const course = await ctx.prisma.course.update({
    where: {
      id: courseId,
      ownerId: ctx.user.sub,
    },
    data: {
      color,
    },
  })

  return course
}

interface ChangeCourseDates {
  courseId: string
  startDate?: Date | null
  endDate?: Date | null
}

export async function changeCourseDates(
  { courseId, startDate, endDate }: ChangeCourseDates,
  ctx: ContextWithUser
) {
  const course = await ctx.prisma.course.update({
    where: {
      id: courseId,
      ownerId: ctx.user.sub,
    },
    data: {
      ...(startDate && { startDate }),
      ...(endDate && { endDate }),
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
    description: 'Practice Pool for ' + course.displayName,
    pointsMultiplier: 1,
    resetTimeDays: 6,
    orderType: ElementOrderType.SPACED_REPETITION,
    status: PublicationStatus.PUBLISHED,
    stacks: orderedStacks.slice(0, 25),
    course,
    courseId,
    ownerId: course.ownerId,
    createdAt: course.createdAt,
    updatedAt: course.updatedAt,
  }
}
