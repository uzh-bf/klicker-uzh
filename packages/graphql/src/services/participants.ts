import { MicroSessionStatus, SessionStatus, SSOType } from '@klicker-uzh/prisma'
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
                  status: MicroSessionStatus.PUBLISHED,
                },
              },
              sessions: {
                where: { status: SessionStatus.RUNNING },
              },
            },
          },
        },
      },
    },
  })

  if (!participant) return []

  return R.sort(
    R.ascend(R.prop<string>('course.displayName')),
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
  stackId: number
  courseId: string
  bookmarked: boolean
}

export async function bookmarkQuestion(
  { stackId, courseId, bookmarked }: BookmarkQuestionArgs,
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
      bookmarkedStacks: {
        [bookmarked ? 'connect' : 'disconnect']: {
          id: stackId,
        },
      },
    },
    include: {
      bookmarkedStacks: true,
    },
  })

  return participation.bookmarkedStacks
}

interface GetBookmarkedQuestionsArgs {
  courseId: string
}

export async function getBookmarkedQuestions(
  { courseId }: GetBookmarkedQuestionsArgs,
  ctx: ContextWithUser
) {
  const participation = await ctx.prisma.participation.findUnique({
    where: {
      courseId_participantId: {
        courseId,
        participantId: ctx.user.sub,
      },
    },
    include: {
      bookmarkedStacks: {
        include: {
          elements: {
            include: {
              questionInstance: true,
            },
          },
        },
      },
    },
  })

  return participation?.bookmarkedStacks ?? []
}

export async function flagQuestion(
  args: { questionInstanceId: number; content: string },
  ctx: ContextWithUser
) {
  const questionInstance = await ctx.prisma.questionInstance.findUnique({
    where: {
      id: args.questionInstanceId,
    },
    include: {
      learningElement: {
        include: {
          course: true,
        },
      },
      microSession: {
        include: {
          course: true,
        },
      },
    },
  })

  if (
    !questionInstance?.learningElement?.course?.notificationEmail &&
    !questionInstance?.microSession?.course?.notificationEmail
  )
    return null

  await fetch(process.env.NOTIFICATION_URL as string, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      elementType: questionInstance?.learningElement
        ? 'Learning Element'
        : 'Micro-Session',
      elementId:
        questionInstance?.learningElement?.id ||
        questionInstance?.microSession?.id,
      elementName:
        questionInstance?.learningElement?.name ||
        questionInstance?.microSession?.name,
      questionId: questionInstance.questionId,
      questionName: (
        questionInstance.questionData?.valueOf() as AllQuestionTypeData
      ).name,
      content: args.content,
      participantId: ctx.user.sub,
      secret: process.env.NOTIFICATION_SECRET,
      notificationEmail:
        questionInstance.learningElement?.course?.notificationEmail ||
        questionInstance.microSession?.course?.notificationEmail,
    }),
  })

  return 'OK'
}

export async function getParticipantDetails(
  args: { participantId: string },
  ctx: ContextWithUser
) {
  const participant = await ctx.prisma.participant.findUnique({
    where: { id: args.participantId },
    include: {
      levelData: {
        include: {
          nextLevel: true,
        },
      },
      achievements: {
        include: {
          achievement: true,
        },
      },
    },
  })

  return participant
}

export async function getParticipantWithAchievements(ctx: ContextWithUser) {
  const participant = await ctx.prisma.participant.findUnique({
    where: { id: ctx.user.sub },
    include: {
      levelData: {
        include: {
          nextLevel: true,
        },
      },
      achievements: {
        include: {
          achievement: true,
        },
      },
    },
  })
  if (!participant) return null

  const achievements = await ctx.prisma.achievement.findMany()

  return {
    participant,
    achievements,
  }
}
