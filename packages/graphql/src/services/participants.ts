import { LeaderboardType, SSOType } from '@klicker-uzh/prisma'
import bcrypt from 'bcryptjs'
import generatePassword from 'generate-password'
import { descend, prop, sort } from 'ramda'
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

  return participant.participations
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
    // leaderboard: [
    //   ...top3Entries
    //     .filter((entry) => entry.participantId !== ctx.user!.sub)
    //     .map(mapper),
    //   ...followedEntries.map(mapper),
    //   participation.isActive &&
    //     participation.courseLeaderboard?.id && {
    //       id: participation.courseLeaderboard?.id,
    //       score: participation.courseLeaderboard?.score,
    //       username: participation.participant.username,
    //       avatar: participation.participant.avatar,
    //       isSelf: true,
    //     },
    // ].filter(Boolean),
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
        course: true,
        participant: true,
        courseLeaderboard: true,
      },
    })

    const course = ctx.prisma.course.findUnique({
      where: {
        id: courseId,
      },
    })

    const top10Entries = await course.leaderboard({
      where: {
        participation: {
          isActive: true,
        },
      },
      include: {
        participant: true,
      },
      orderBy: {
        score: 'desc',
      },
      take: 10,
    })

    const mapper = (entry) => ({
      id: entry.id,
      score: entry.score,
      username: entry.participant.username,
      avatar: entry.participant.avatar,
      participantId: entry.participant.id,
    })

    if (participation) {
      const allEntries = [
        ...top10Entries
          .filter((entry) => entry.participantId !== ctx.user!.sub)
          .map(mapper),
        participation?.isActive &&
          participation.courseLeaderboard?.id && {
            participantId: participation.participant.id,
            id: participation.courseLeaderboard?.id,
            score: participation.courseLeaderboard?.score,
            username: participation.participant.username,
            avatar: participation.participant.avatar,
            isSelf: true,
          },
      ].filter(Boolean)

      return {
        id: `${courseId}-${participation.participant.id}`,
        course: participation.course,
        participant: participation.participant,
        participation,
        leaderboard: sort(descend(prop('score')), allEntries),
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
                    connect: {
                      id: courseId,
                    },
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

interface CreateParticipantGroupArgs {
  courseId: string
  name: string
}

export async function createParticipantGroup(
  { courseId, name }: CreateParticipantGroupArgs,
  ctx: ContextWithUser
) {
  const code = 100000 + Math.floor(Math.random() * 900000)

  const participantGroup = await ctx.prisma.participantGroup.create({
    data: {
      name,
      code: code,
      course: {
        connect: {
          id: courseId,
        },
      },
      participants: {
        connect: {
          id: ctx.user.sub,
        },
      },
    },
    include: {
      participants: true,
      course: true,
    },
  })

  // invalidate graphql response cache
  ctx.emitter.emit('invalidate', {
    typename: 'ParticipantGroup',
    id: participantGroup.id,
  })

  return participantGroup
}

interface JoinParticipantGroupArgs {
  courseId: string
  code: number
}

export async function joinParticipantGroup(
  { courseId, code }: JoinParticipantGroupArgs,
  ctx: ContextWithUser
) {
  // find participantgroup with code
  const participantGroup = await ctx.prisma.participantGroup.findUnique({
    where: {
      courseId_code: {
        courseId,
        code,
      },
    },
    include: {
      course: true,
    },
  })

  // if no participant group with the provided id exists in this course or at all, return null
  if (!participantGroup || participantGroup.course.id !== courseId) return null

  // otherwise update the participant group with the current participant and return it
  const updatedParticipantGroup = await ctx.prisma.participantGroup.update({
    where: {
      courseId_code: {
        courseId,
        code,
      },
    },
    data: {
      participants: {
        connect: {
          id: ctx.user.sub,
        },
      },
    },
    include: {
      participants: true,
      course: true,
    },
  })

  return updatedParticipantGroup
}

interface LeaveParticipantGroupArgs {
  groupId: string
  courseId: string
}

export async function leaveParticipantGroup(
  { groupId, courseId }: LeaveParticipantGroupArgs,
  ctx: ContextWithUser
) {
  // find participantgroup with corresponding id
  const participantGroup = await ctx.prisma.participantGroup.findUnique({
    where: {
      id: groupId,
    },
    include: {
      participants: true,
    },
  })

  // if no participant group with the provided id exists in this course or at all, return null
  if (!participantGroup) return null

  // if the participant is the only one in the group, delete the group
  if (participantGroup.participants.length === 1) {
    await ctx.prisma.participantGroup.delete({
      where: {
        id: groupId,
      },
    })

    // invalidate graphql response cache
    ctx.emitter.emit('invalidate', {
      typename: 'ParticipantGroup',
      id: groupId,
    })

    return null
  }

  // otherwise update the participant group with the current participant and return it
  const updatedParticipantGroup = await ctx.prisma.participantGroup.update({
    where: {
      id: groupId,
    },
    data: {
      participants: {
        disconnect: {
          id: ctx.user.sub,
        },
      },
    },
    include: {
      participants: true,
      course: true,
    },
  })

  return updatedParticipantGroup
}

interface GetParticipantGroupsArgs {
  courseId: string
}

export async function getParticipantGroups(
  { courseId }: GetParticipantGroupsArgs,
  ctx: ContextWithUser
) {
  // find participant with correspoinding id ctx.user.sub and return all his participant groups with correct id
  const participant = await ctx.prisma.participant.findUnique({
    where: {
      id: ctx.user.sub,
    },
    include: {
      participantGroups: {
        where: {
          course: {
            id: courseId,
          },
        },
        include: {
          participants: {
            include: {
              leaderboards: {
                where: {
                  courseId,
                  type: LeaderboardType.COURSE,
                },
              },
            },
          },
        },
      },
    },
  })

  return (
    participant?.participantGroups.map((group) => ({
      ...group,
      participants: sort(
        descend(prop('score')),
        group.participants.map((participant) => ({
          ...participant,
          score: participant.leaderboards[0]?.score ?? 0,
          isSelf: participant.id === ctx.user.sub,
        }))
      ),
    })) ?? []
  )
}
