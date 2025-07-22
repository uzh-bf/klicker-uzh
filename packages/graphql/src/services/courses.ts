import * as DB from '@klicker-uzh/prisma'
import { ActivityType, SharingType } from '@klicker-uzh/types'
import { levelFromXp, recomputeDerivedPermissions } from '@klicker-uzh/util'
import dayjs from 'dayjs'
import customParseFormat from 'dayjs/plugin/customParseFormat.js'
import { random } from 'mathjs'
import { prop, sortBy } from 'remeda'
import { ICourse, type ILeaderboardEntry } from 'src/schema/course.js'
import type { Context, ContextWithUser } from '../lib/context.js'
import convertDateToUTCDatetime from '../lib/convertDateToUTCDatetime.js'
import { orderStacks } from '../lib/util.js'
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
  { pin }: { pin: number },
  ctx: ContextWithUser
) {
  const course = await ctx.prisma.course.findUnique({
    where: { pinCode: pin },
  })

  if (
    !course ||
    course.pinCode !== pin ||
    ctx.user.role !== DB.UserRole.PARTICIPANT
  ) {
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

export async function joinCourseLeaderboard(
  {
    courseId,
  }: {
    courseId: string
  },
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

// leave a course leaderboard as a participant
// deletes the leaderboard entries related to the course and sets the participation to inactive
// meaning that no further points will be collected
export async function leaveCourseLeaderboard(
  {
    courseId,
  }: {
    courseId: string
  },
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
  ctx: ContextWithUser
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
      },
    })

    if (participation) {
      const allGroupEntries = participation.course.participantGroups.reduce<{
        mapped: (DB.ParticipantGroup & { score: number; isMember: boolean })[]
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

      const sortedGroupEntries = sortBy(
        allGroupEntries.mapped,
        [prop('score'), 'desc'],
        [prop('name'), 'asc']
      )

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
        where: {
          finishedAt: {
            lte: detailsEarliest,
            gt: detailsLatest,
          },
        },
      },
      practiceQuizzes: {
        include: {
          responseDetails: {
            where: {
              createdAt: {
                lte: detailsEarliest,
                gt: detailsLatest,
              },
            },
          },
        },
      },
      microLearnings: {
        include: {
          responseDetails: {
            where: {
              createdAt: {
                lte: detailsEarliest,
                gt: detailsLatest,
              },
            },
          },
        },
      },
      participations: {
        where: {
          isActive: true,
        },
        include: {
          participant: true,
        },
      },
      timelineEntries: {
        where: {
          type: DB.TimelineEntryType.DAILY,
          timestamp: {
            gt: dayjs().subtract(days, 'days').toDate(),
          },
          participation: {
            isActive: true,
          },
        },
        include: {
          participation: true,
        },
      },
    },
  })

  if (!course)
    return {
      leaderboardEntries: [],
      count: 0,
      sum: 0,
    }

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
  const sortedScores = sortBy(
    Object.values(leaderboardScores),
    [prop('score'), 'desc'],
    [prop('username'), 'asc']
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
    (acc, scoreEntry, ix) => {
      acc.leaderboardEntries.push({
        id: Math.floor(random(1000000000)),
        participantId: scoreEntry.participantId,
        username: scoreEntry.username,
        avatar: scoreEntry.avatar,
        score: scoreEntry.score,
        isSelf: scoreEntry.isSelf,
        rank: ix + 1,
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
  ctx: ContextWithUser
) {
  if (
    ctx.user?.sub &&
    ctx.user.role === DB.UserRole.PARTICIPANT &&
    mode === 'course'
  ) {
    const participation = await ctx.prisma.participation.findUnique({
      where: {
        courseId_participantId: {
          courseId,
          participantId: ctx.user.sub,
        },
      },
      include: {
        participant: true,
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

      const sortedEntries = sortBy(
        allEntries.mapped,
        [prop('score'), 'desc'],
        [prop('username'), 'asc']
      )

      const filteredEntries = sortedEntries.flatMap((entry, ix) => {
        if (ix < 10 || entry.participantId === ctx.user?.sub)
          return { ...entry, rank: ix + 1 }
        return []
      })

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
      await computeRollingLeaderboardEntries({ courseId, days: 14 }, ctx)

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
  const course = await ctx.prisma.$transaction(
    async (prisma) => {
      const newCourse = await prisma.course.create({
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

      await recomputeDerivedPermissions(
        {
          courseId: newCourse.id,
          userId: ctx.user.sub,
        },
        prisma
      )

      return newCourse
    },
    { timeout: 60000 }
  )

  return course
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
  const course = await ctx.prisma.course.findUnique({ where: { id } })

  if (!course) return null

  const currentStartDatePast = course.startDate < new Date()
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
      startDate: currentStartDatePast || !startDate ? undefined : startDate,
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
  const courses = userCourses?.courses ?? []

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
      const sortedCourses = [
        ...(activityCourse ? [activityCourse] : []),
        ...courses.filter((course) => course.id !== activityCourse.id),
      ].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())

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
    where: { id },
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
            include: { elements: { orderBy: { order: 'asc' } } },
            orderBy: { order: 'asc' },
          },
          permissions: {
            where: { userId: ctx.user.sub },
            include: { directPermission: true },
          },
          templateInfo: true,
          _count: { select: { permissions: true } },
        },
        orderBy: { updatedAt: 'desc' },
      },
      practiceQuizzes: {
        where: { isDeleted: false },
        include: {
          stacks: {
            include: { elements: { orderBy: { order: 'asc' } } },
            orderBy: { order: 'asc' },
          },
          permissions: {
            where: { userId: ctx.user.sub },
            include: { directPermission: true },
          },
          templateInfo: true,
          _count: { select: { permissions: true } },
        },
        orderBy: { updatedAt: 'desc' },
      },
      groupActivities: {
        where: { isDeleted: false },
        include: {
          stacks: {
            include: { elements: { orderBy: { order: 'asc' } } },
            orderBy: { order: 'asc' },
          },
          permissions: {
            where: { userId: ctx.user.sub },
            include: { directPermission: true },
          },
          templateInfo: true,
          _count: { select: { permissions: true } },
        },
        orderBy: { updatedAt: 'desc' },
      },
      microLearnings: {
        where: { isDeleted: false },
        include: {
          stacks: {
            include: { elements: { orderBy: { order: 'asc' } } },
            orderBy: { order: 'asc' },
          },
          permissions: {
            where: { userId: ctx.user.sub },
            include: { directPermission: true },
          },
          templateInfo: true,
          _count: { select: { permissions: true } },
        },
        orderBy: { scheduledStartAt: 'desc' },
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

    const stacks = liveQuiz.blocks.map((block) => ({
      id: block.id,
      numOfParticipants: block.elements[0]
        ? block.elements[0].results.total +
          block.elements[0].anonymousResults.total
        : 0,
      timeLimit: block.timeLimit,
      elements: block.elements.map((instance) => ({
        id: instance.id,
        name: instance.elementData.name,
        type: instance.elementType,
      })),
    }))

    return {
      id: liveQuiz.id,
      templateId: liveQuiz.templateInfo?.id ?? null,
      name: liveQuiz.name,
      displayName: liveQuiz.displayName,
      type: ActivityType.LIVE_QUIZ,
      status: liveQuiz.status,
      courseId: course.id,
      courseName: course.name,
      courseStartDate: course.startDate,
      numOfStacks: liveQuiz.blocks.length,
      numOfElements: liveQuiz.blocks.reduce(
        (acc, block) => acc + block.elements.length,
        0
      ),
      stacks,
      permissionLevel: permission.permissionLevel,
      derivedAccess: permission.derived,
      areInstancesOutdated: liveQuiz.areInstancesOutdated,
      numSharedUsers: liveQuiz._count.permissions - 1,
      isOwner,
      isManager,
      isEditor,
      isExecutor,
      isShared,
      isRemovable,
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

    const stacks = practiceQuiz.stacks.map((block) => ({
      id: block.id,
      numOfParticipants: block.elements[0]
        ? block.elements[0].results.total +
          block.elements[0].anonymousResults.total
        : 0,
      elements: block.elements.map((instance) => ({
        id: instance.id,
        name: instance.elementData.name,
        type: instance.elementType,
      })),
    }))

    return {
      id: practiceQuiz.id,
      templateId: practiceQuiz.templateInfo?.id ?? null,
      name: practiceQuiz.name,
      displayName: practiceQuiz.displayName,
      type: ActivityType.PRACTICE_QUIZ,
      status: practiceQuiz.status,
      courseId: course.id,
      courseName: course.name,
      courseStartDate: course.startDate,
      numOfStacks: practiceQuiz.stacks.length,
      numOfElements: practiceQuiz.stacks.reduce(
        (acc, block) => acc + block.elements.length,
        0
      ),
      automaticPublicationAt: practiceQuiz.availableFrom,
      stacks,
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

    const stacks = microLearning.stacks.map((block) => ({
      id: block.id,
      numOfParticipants: block.elements[0]
        ? block.elements[0].results.total +
          block.elements[0].anonymousResults.total
        : 0,
      elements: block.elements.map((instance) => ({
        id: instance.id,
        name: instance.elementData.name,
        type: instance.elementType,
      })),
    }))

    return {
      id: microLearning.id,
      templateId: microLearning.templateInfo?.id ?? null,
      name: microLearning.name,
      displayName: microLearning.displayName,
      type: ActivityType.MICRO_LEARNING,
      status: microLearning.status,
      courseId: course.id,
      courseName: course.name,
      courseStartDate: course.startDate,
      numOfStacks: microLearning.stacks.length,
      numOfElements: microLearning.stacks.reduce(
        (acc, block) => acc + block.elements.length,
        0
      ),
      scheduledStartAt: microLearning.scheduledStartAt,
      scheduledEndAt: microLearning.scheduledEndAt,
      stacks,
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

      const stacks = groupActivity.stacks.map((block) => ({
        id: block.id,
        numOfParticipants: block.elements[0]
          ? block.elements[0].results.total +
            block.elements[0].anonymousResults.total
          : 0,
        elements: block.elements.map((instance) => ({
          id: instance.id,
          name: instance.elementData.name,
          type: instance.elementType,
        })),
      }))

      return {
        id: groupActivity.id,
        templateId: groupActivity.templateInfo?.id ?? null,
        name: groupActivity.name,
        displayName: groupActivity.displayName,
        type: ActivityType.GROUP_ACTIVITY,
        status: groupActivity.status,
        courseId: course.id,
        courseName: course.name,
        courseStartDate: course.startDate,
        numOfStacks: groupActivity.stacks.length,
        numOfElements: groupActivity.stacks.reduce(
          (acc, block) => acc + block.elements.length,
          0
        ),
        scheduledStartAt: groupActivity.scheduledStartAt,
        scheduledEndAt: groupActivity.scheduledEndAt,
        groupDeadlineDate: course.groupDeadlineDate,
        numOfParticipantGroups: course._count.participantGroups,
        stacks,
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

// TODO: once all available activity endings have been migrated to scheduled tasks, remove this function and the associated cronjob
export async function endExpiredActivities(ctx: Context) {
  // // ! Set group activity status to ended for all published group activities that have ended
  // const groupActivitiesToEnd = await ctx.prisma.groupActivity.findMany({
  //   where: {
  //     status: DB.PublicationStatus.PUBLISHED,
  //     scheduledEndAt: {
  //       lte: new Date(),
  //     },
  //   },
  // })

  // const updatedGroupActivitiesToEnd = await Promise.all(
  //   groupActivitiesToEnd.map((group) =>
  //     ctx.prisma.groupActivity.update({
  //       where: {
  //         id: group.id,
  //       },
  //       data: {
  //         status: DB.PublicationStatus.ENDED,
  //       },
  //     })
  //   )
  // )

  // if (updatedGroupActivitiesToEnd.length !== 0) {
  //   await sendTeamsNotifications(
  //     'graphql/endGroupActivitiesCronjob',
  //     `Successfully ended ${updatedGroupActivitiesToEnd.length} group activities`
  //   )
  // }

  // updatedGroupActivitiesToEnd.forEach((activity) => {
  //   ctx.pubSub.publish('groupActivityEnded', activity)
  //   ctx.pubSub.publish('singleGroupActivityEnded', activity)
  //   ctx.emitter.emit('invalidate', {
  //     typename: 'GroupActivity',
  //     id: activity.id,
  //   })
  // })

  return true
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
