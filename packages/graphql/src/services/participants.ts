import { SSOType } from '@klicker-uzh/prisma'
import bcrypt from 'bcryptjs'
import generatePassword from 'generate-password'
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
  const participant = await ctx.prisma.participant.findUnique({
    where: { id },
    select: { id: true, avatar: true, username: true },
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
        where: { isActive: true },
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
                },
              },
              sessions: {
                where: { status: 'RUNNING' },
                select: {
                  id: true,
                  displayName: true,
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
  return ctx.prisma.participation.upsert({
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
}

interface LeaveCourseArgs {
  courseId: string
}

export async function leaveCourse(
  { courseId }: LeaveCourseArgs,
  ctx: ContextWithUser
) {
  return ctx.prisma.participation.update({
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
      },
    })

    if (participation) {
      return {
        id: `${courseId}-${participation.participant.id}`,
        course: participation.course,
        participant: participation.participant,
        participation,
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
  const course = await ctx.prisma.course.findUnique({ where: { id: courseId } })

  if (!course) return null

  let participant = await ctx.prisma.participantAccount.findFirst({
    where: {
      ssoType: SSOType.LTI,
      ssoId: participantId,
    },
    include: {
      participant: true,
    },
  })

  let participation = null

  // if there is no participant matching the SSO id from LTI
  // create a new participant and participant account
  if (!participant) {
    let username
    let password
    if (process.env.NODE_ENV === 'development') {
      username = 'tester'
      password = 'abcd'
    } else {
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
    }

    const hash = await bcrypt.hash(password, 12)

    participant = await ctx.prisma.participantAccount.create({
      data: {
        ssoType: SSOType.LTI,
        ssoId: participantId,
        participant: {
          create: {
            password: hash,
            username,
          },
        },
      },
      include: {
        participant: true,
      },
    })
  } else {
    participation = await ctx.prisma.participation.findFirst({
      where: {
        courseId,
        participantId: participant.participantId,
      },
    })
  }

  const jwt = createParticipantToken(participant.participant.id)

  return {
    id: `${courseId}-${participant.participant.id}`,
    participantToken: jwt,
    participant: participant.participant,
    participation,
    course,
  }
}
