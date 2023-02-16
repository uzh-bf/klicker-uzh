import { SSOType } from '@klicker-uzh/prisma'
import bcrypt from 'bcryptjs'
import generatePassword from 'generate-password'
import * as R from 'ramda'
import { Context, ContextWithUser } from '../lib/context'
import { createParticipantToken } from './accounts'

interface UpdateParticipantProfileArgs {
  password?: string | null
  username?: string | null
  avatar?: string | null
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
        data: {
          password: hashedPassword,
          username: username ?? undefined,
          avatar: avatar ?? undefined,
          avatarSettings: avatarSettings ?? undefined,
        },
      })
    } else {
      // TODO: return error
    }
  }

  const participant = await ctx.prisma.participant.update({
    where: { id: ctx.user.sub },
    data: {
      username: username ?? undefined,
      avatar: avatar ?? undefined,
      avatarSettings: avatarSettings ?? undefined,
    },
  })

  return participant
}

export async function getParticipations(
  { endpoint }: { endpoint?: string | null },
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

interface CreateParticipantAndJoinCourseArgs {
  username: string
  password: string
  courseId: string
  pin: number
}

export async function createParticipantAndJoinCourse(
  { username, password, courseId, pin }: CreateParticipantAndJoinCourseArgs,
  ctx: Context
) {
  if (typeof username === 'string') {
    if (username.length < 5 || username.length > 10) {
      return null
    }
  }

  const existingParticipant = await ctx.prisma.participant.findUnique({
    where: { username },
  })
  const isLoginValid = await bcrypt.compare(
    password,
    existingParticipant?.password || ''
  )

  // if the participant already exists, but the login is incorrect, abort this function call
  if (existingParticipant && !isLoginValid) {
    return null
  }

  // fetch the course and compare the provided pin with the correct value
  const course = await ctx.prisma.course.findUnique({
    where: { id: courseId },
  })

  // if the provided pin is wrong for this course, return null
  if (!course || course.pinCode !== pin) return null

  if (existingParticipant) {
    // link the participant to the course by creating a new participation
    await ctx.prisma.participation.upsert({
      where: {
        courseId_participantId: {
          courseId,
          participantId: existingParticipant.id,
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
            id: existingParticipant.id,
          },
        },
      },
      update: {},
    })

    const jwt = createParticipantToken(existingParticipant.id)

    ctx.res.cookie('participant_token', jwt, {
      domain: process.env.COOKIE_DOMAIN ?? process.env.API_DOMAIN,
      path: '/',
      httpOnly: true,
      maxAge: 1000 * 60 * 60 * 24 * 13,
      secure:
        process.env.NODE_ENV === 'production' &&
        process.env.COOKIE_DOMAIN !== '127.0.0.1',
      sameSite:
        process.env.NODE_ENV === 'development' ||
        process.env.COOKIE_DOMAIN === '127.0.0.1'
          ? 'lax'
          : 'none',
    })

    return existingParticipant
  } else {
    const hashedPassword = await bcrypt.hash(password, 12)
    // create new participant with the provided username and password, and link the participant to the course by creating a new participation
    const participant = await ctx.prisma.participant.create({
      data: {
        username,
        password: hashedPassword,
        participations: {
          create: {
            isActive: true,
            course: {
              connect: {
                id: courseId,
              },
            },
          },
        },
      },
      include: {
        participations: true,
      },
    })

    const jwt = createParticipantToken(participant.id)

    ctx.res.cookie('participant_token', jwt, {
      domain: process.env.COOKIE_DOMAIN ?? process.env.API_DOMAIN,
      path: '/',
      httpOnly: true,
      maxAge: 1000 * 60 * 60 * 24 * 13,
      secure:
        process.env.NODE_ENV === 'production' &&
        process.env.COOKIE_DOMAIN !== '127.0.0.1',
      sameSite:
        process.env.NODE_ENV === 'development' ||
        process.env.COOKIE_DOMAIN === '127.0.0.1'
          ? 'lax'
          : 'none',
    })

    return participant
  }
}

interface BookmarkQuestionArgs {
  instanceId: number
  courseId: string
}

export async function bookmarkQuestion(
  { instanceId, courseId }: BookmarkQuestionArgs,
  ctx: Context
) {
  const participation = await ctx.prisma.participation.update({
    where: {
      courseId_participantId: {
        courseId,
        participantId: ctx.user!.sub,
      },
    },
    data: {
      bookmarkedQuestions: {
        connect: {
          id: instanceId,
        },
      },
    },
    include: {
      bookmarkedQuestions: true,
    },
  })

  return participation
}

interface GetBookmarkedQuestionsArgs {
  courseId: string
}

export async function getBookmarkedQuestions(
  { courseId }: GetBookmarkedQuestionsArgs,
  ctx: Context
) {
  const participation = await ctx.prisma.participation.findUnique({
    where: {
      courseId_participantId: {
        courseId,
        participantId: ctx.user!.sub,
      },
    },
    include: {
      bookmarkedQuestions: true,
    },
  })

  return participation?.bookmarkedQuestions ?? []
}
