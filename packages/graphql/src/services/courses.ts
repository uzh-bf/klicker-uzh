import * as R from 'ramda'
import { ContextWithOptionalUser, ContextWithUser } from '../lib/context'

export async function getBasicCourseInformation(
  { courseId }: { courseId: string },
  ctx: ContextWithOptionalUser
) {
  const course = await ctx.prisma.course.findUnique({
    where: { id: courseId },
  })

  if (!course) {
    return null
  }
  return R.pick(['id', 'name', 'displayName', 'description', 'color'], course)
}

export async function joinCourseWithPin(
  { courseId, pin }: { courseId: string; pin: number },
  ctx: ContextWithUser
) {
  const course = await ctx.prisma.course.findUnique({
    where: { id: courseId },
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
            courseId_participantId: { courseId, participantId: ctx.user.sub },
          },
          create: { course: { connect: { id: courseId } }, isActive: true },
        },
      },
    },
  })

  return updatedParticipant
}

interface JoinCourseArgs {
  courseId: string
}

export async function joinCourse(
  { courseId }: JoinCourseArgs,
  ctx: ContextWithUser
) {
  const participation = ctx.prisma.participation.upsert({
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

  return {
    id: `${courseId}-${ctx.user.sub}`,
    participation,
  }
}

interface LeaveCourseArgs {
  courseId: string
}

export async function leaveCourse(
  { courseId }: LeaveCourseArgs,
  ctx: ContextWithUser
) {
  const participation = ctx.prisma.participation.update({
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

  return {
    id: `${courseId}-${ctx.user.sub}`,
    participation,
  }
}

interface GetCourseOverviewDataArgs {
  courseId: string
}

export async function getCourseOverviewData(
  { courseId }: GetCourseOverviewDataArgs,
  ctx: ContextWithOptionalUser
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
          },
        },
        participant: true,
        courseLeaderboard: true,
      },
    })

    const course = ctx.prisma.course.findUnique({
      where: { id: courseId },
    })

    const lbEntries = await course.leaderboard({
      where: {
        participation: { isActive: true },
      },
      include: {
        participant: true,
      },
    })

    if (participation) {
      const allEntries = lbEntries.reduce(
        (acc, entry) => {
          return {
            mapped: [
              ...acc.mapped,
              {
                id: entry.id,
                score: entry.score,
                username: entry.participant.username,
                avatar: entry.participant.avatar,
                participantId: entry.participant.id,
                isSelf: ctx.user?.sub === entry.participant.id,
              },
            ],
            sum: acc.sum + entry.score ?? 0,
            count: acc.count + 1,
          }
        },
        {
          mapped: [],
          sum: 0,
          count: 0,
        }
      )

      const allGroupEntries = participation.course.participantGroups.reduce(
        (acc, group, ix) => {
          const score = group.averageMemberScore + group.groupActivityScore
          return {
            mapped: [
              ...acc.mapped,
              {
                ...group,
                score,
                rank: ix + 1,
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
        R.descend(R.prop('score')),
        R.ascend(R.prop('username')),
      ])

      const sortedEntries = sortByScoreAndUsername(allEntries.mapped)
      const sortedGroupEntries = sortByScoreAndUsername(allGroupEntries.mapped)

      const filteredEntries = sortedEntries.flatMap((entry, ix) => {
        if (ix < 10 || entry.participantId === ctx.user?.sub)
          return { ...entry, rank: ix + 1 }
        return []
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
        groupLeaderboard: sortedGroupEntries,
        groupLeaderboardStatistics: {
          participantCount: allGroupEntries.count,
          averageScore:
            allGroupEntries.count > 0
              ? allGroupEntries.sum / allGroupEntries.count
              : 0,
        },
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
  displayName?: string
  color?: string
}

export async function createCourse(
  { name, displayName, color }: CreateCourseArgs,
  ctx: ContextWithUser
) {
  // TODO: ensure that PINs are unique
  const randomPin = Math.floor(Math.random() * 900000000 + 100000000)

  return ctx.prisma.course.create({
    data: {
      name,
      pinCode: randomPin,
      displayName: displayName ?? name,
      color,
      owner: {
        connect: { id: ctx.user.sub },
      },
    },
  })
}

export async function getUserCourses(
  { userId }: { userId: string },
  ctx: ContextWithOptionalUser
) {
  const userCourses = await ctx.prisma.user.findUnique({
    where: {
      id: userId,
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

export async function getUserLearningElements(ctx: ContextWithUser) {
  const participantCoursesWithLearningElements =
    await ctx.prisma.participant.findUnique({
      where: { id: ctx.user.sub },
      include: {
        participations: {
          include: {
            course: {
              include: {
                learningElements: {
                  orderBy: {
                    displayName: 'asc',
                  },
                },
              },
            },
          },
        },
      },
    })

  if (!participantCoursesWithLearningElements) return []

  return participantCoursesWithLearningElements.participations.flatMap(
    (participation) => participation.course.learningElements
  )
}

export async function getCourseData(
  { id }: { id: string },
  ctx: ContextWithUser
) {
  const course = await ctx.prisma.course.findUnique({
    where: { id },
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
      learningElements: {
        include: {
          _count: {
            select: { instances: true },
          },
        },
      },
      microSessions: {
        include: {
          _count: {
            select: { instances: true },
          },
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
      },
    },
  })

  const leaderboard = course?.leaderboard
    .filter((entry) => entry.participation?.isActive)
    .map((entry, ix) => ({
      id: entry?.id,
      score: entry?.score,
      rank: ix + 1,
      username: entry.participation?.participant.username,
      avatar: entry.participation?.participant.avatar,
    }))

  const reducedSessions = course?.sessions
    .map((session) => {
      return {
        ...session,
        numOfBlocks: session.blocks.length,
        numOfQuestions: session.blocks.reduce(
          (acc, block) => acc + block._count.instances,
          0
        ),
      }
    })
    .map(
      R.pick([
        'id',
        'name',
        'displayName',
        'pinCode',
        'status',
        'createdAt',
        'isGamificationEnabled',
        'accessMode',
        'numOfBlocks',
        'numOfQuestions',
      ])
    )

  const reducedLearningElements = course?.learningElements
    .map((learningElement) => {
      return {
        ...learningElement,
        numOfInstances: learningElement._count.instances,
      }
    })
    .map(R.pick(['id', 'name', 'displayName', 'numOfInstances']))

  const reducedMicroSessions = course?.microSessions
    .map((microSession) => {
      return {
        ...microSession,
        numOfInstances: microSession._count.instances,
      }
    })
    .map(
      R.pick([
        'id',
        'name',
        'displayName',
        'scheduledStartAt',
        'scheduledEndAt',
        'numOfInstances',
      ])
    )

  return {
    ...course,
    sessions: reducedSessions,
    learningElements: reducedLearningElements,
    microSessions: reducedMicroSessions,
    numOfParticipants: course?.leaderboard.length,
    leaderboard: leaderboard,
  }
}

export async function changeCourseDescription(
  { courseId, input }: { courseId: string; input: string },
  ctx: ContextWithUser
) {
  const course = await ctx.prisma.course.update({
    where: { id: courseId },
    data: {
      description: input,
    },
  })

  return course
}
