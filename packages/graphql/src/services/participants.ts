import { SSOType } from '@klicker-uzh/prisma'
import bcrypt from 'bcryptjs'
import generatePassword from 'generate-password'
import * as R from 'ramda'
import {
  Context,
  ContextWithOptionalUser,
  ContextWithUser,
} from '../lib/context'
import { createParticipantToken } from './accounts'

interface GetParticipantProfileArgs {
  id: string
}

export async function getParticipantProfile(
  { id }: GetParticipantProfileArgs,
  ctx: ContextWithOptionalUser
) {
  if (!ctx.user?.sub) return null

  const participant = await ctx.prisma.participant.findUnique({
    where: { id },
    select: { id: true, avatar: true, avatarSettings: true, username: true },
  })

  return participant
}

interface UpdateParticipantProfileArgs {
  password?: string
  username?: string
  avatar?: string
  avatarSettings?: any
}

export async function updateParticipantProfile(
  { password, username, avatar, avatarSettings }: UpdateParticipantProfileArgs,
  ctx: ContextWithUser
) {
  if (typeof username === 'string') {
    if (username.length < 5 || username.length > 10) {
      return null
    }
  }

  if (typeof password === 'string') {
    if (password.length >= 8) {
      const hashedPassword = await bcrypt.hash(password, 12)
      return ctx.prisma.participant.update({
        where: { id: ctx.user.sub },
        data: { password: hashedPassword, username, avatar, avatarSettings },
        select: {
          id: true,
          avatar: true,
          avatarSettings: true,
          username: true,
        },
      })
    } else {
      // TODO: return error
    }
  }

  const participant = await ctx.prisma.participant.update({
    where: { id: ctx.user.sub },
    data: { username, avatar, avatarSettings },
    select: {
      id: true,
      avatar: true,
      avatarSettings: true,
      username: true,
    },
  })

  return participant
}

interface GetParticipationsArgs {
  endpoint?: string
}

export async function getParticipations(
  { endpoint }: GetParticipationsArgs,
  ctx: ContextWithUser
) {
  const participant = await ctx.prisma.participant.findUnique({
    where: { id: ctx.user.sub },
    include: {
      participations: {
        include: {
          subscriptions: endpoint
            ? {
                where: { endpoint },
              }
            : undefined,
          course: {
            include: {
              microSessions: {
                where: {
                  scheduledStartAt: {
                    lt: new Date(),
                  },
                  scheduledEndAt: {
                    gt: new Date(),
                  },
                },
                select: {
                  id: true,
                  displayName: true,
                  scheduledStartAt: true,
                  scheduledEndAt: true,
                },
              },
              sessions: {
                where: { status: 'RUNNING' },
                select: {
                  id: true,
                  displayName: true,
                  linkTo: true,
                },
              },
            },
          },
        },
      },
    },
  })

  if (!participant) return []

  return R.sort(
    R.ascend(R.prop('course.displayName')),
    participant.participations
  )
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
          return {
            mapped: [
              ...acc.mapped,
              {
                ...group,
                score: group.averageMemberScore + group.groupActivityScore,
                rank: ix + 1,
              },
            ],
            count: acc.count + 1,
            sum: acc.sum + group.averageMemberScore + group.groupActivityScore,
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

interface RegisterParticipantFromLTIArgs {
  courseId: string
  participantId: string
}

export async function registerParticipantFromLTI(
  { courseId, participantId }: RegisterParticipantFromLTIArgs,
  ctx: Context
) {
  console.log('args', courseId, participantId)

  if (!courseId) return null

  try {
    let participant = await ctx.prisma.participantAccount.findUnique({
      where: {
        ssoType_ssoId: {
          ssoType: SSOType.LTI,
          ssoId: participantId,
        },
      },
      include: {
        participant: true,
      },
    })

    console.log('participant', participant)

    let participation = null

    // if there is no participant matching the SSO id from LTI
    // create a new participant and participant account
    if (!participant) {
      let username
      let password
      // generate a random username that can be changed later on
      username = generatePassword.generate({
        length: 8,
        uppercase: true,
        symbols: false,
        numbers: true,
      })
      // generate a random password that can be changed later on
      password = generatePassword.generate({
        length: 16,
        uppercase: true,
        symbols: true,
        numbers: true,
      })

      console.log('login', username, password)

      const hash = await bcrypt.hash(password, 12)

      participant = await ctx.prisma.participantAccount.create({
        data: {
          ssoType: SSOType.LTI,
          ssoId: participantId,
          participant: {
            create: {
              password: hash,
              username,
              participations: {
                create: {
                  isActive: false,
                  course: {
                    connect: { id: courseId },
                  },
                },
              },
            },
          },
        },
        include: {
          participant: true,
        },
      })

      console.log('new participant', participant)
    } else {
      participation = await ctx.prisma.participation.upsert({
        where: {
          courseId_participantId: {
            courseId,
            participantId: participant.participantId,
          },
        },
        create: {
          isActive: false,
          course: {
            connect: {
              id: courseId,
            },
          },
          participant: {
            connect: {
              id: participant.participantId,
            },
          },
        },
        update: {},
        include: {
          participant: true,
        },
      })

      console.log('new participation', participation)
    }

    const jwt = createParticipantToken(participant.participant.id)

    return {
      id: `${courseId}-${participant.participant.id}`,
      participantToken: jwt,
      participant: participant.participant ?? participation?.participant,
      participation,
      course: null,
    }
  } catch (e) {
    console.error(e)
    return null
  }
}
