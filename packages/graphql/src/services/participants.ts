import { MicroSessionStatus, SessionStatus } from '@klicker-uzh/prisma'
import bcrypt from 'bcryptjs'
import * as R from 'ramda'
import isEmail from 'validator/lib/isEmail'
import { Context, ContextWithUser } from '../lib/context'

interface UpdateParticipantProfileArgs {
  password: string | null
  username: string | null
  email: string | null
  isProfilePublic: boolean | null
}

export async function updateParticipantProfile(
  { password, username, email, isProfilePublic }: UpdateParticipantProfileArgs,
  ctx: ContextWithUser
) {
  if (typeof username === 'string') {
    if (username.length < 5 || username.length > 15) {
      return null
    }
  }

  if (typeof email === 'string') {
    if (!isEmail(email)) {
      return null
    }
  }

  // check that username corresponds to no other participant
  if (username) {
    const existingParticipant = await ctx.prisma.participant.findUnique({
      where: { username },
    })

    if (existingParticipant && existingParticipant.id !== ctx.user.sub) {
      return null
    }
  }

  if (typeof password === 'string') {
    if (password.length >= 8) {
      const hashedPassword = await bcrypt.hash(password, 12)
      return ctx.prisma.participant.update({
        where: { id: ctx.user.sub },
        data: {
          isProfilePublic:
            typeof isProfilePublic === 'boolean' ? isProfilePublic : undefined,
          email,
          password: hashedPassword,
          username: username ?? undefined,
        },
      })
    } else {
      // TODO: return error
    }
  }

  const participant = await ctx.prisma.participant.update({
    where: { id: ctx.user.sub },
    data: {
      isProfilePublic:
        typeof isProfilePublic === 'boolean' ? isProfilePublic : undefined,
      email: email ?? undefined,
      username: username ?? undefined,
    },
  })

  return participant
}

interface UpdateParticipantAvatarArgs {
  avatar: string | null
  avatarSettings: any
}

export async function updateParticipantAvatar(
  { avatar, avatarSettings }: UpdateParticipantAvatarArgs,
  ctx: ContextWithUser
) {
  const participant = await ctx.prisma.participant.update({
    where: { id: ctx.user.sub },
    data: {
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

export async function getParticipation(
  { courseId }: { courseId: string },
  ctx: Context
) {
  if (!ctx.user?.sub) {
    return null
  }

  const participation = await ctx.prisma.participation.findUnique({
    where: {
      courseId_participantId: {
        courseId,
        participantId: ctx.user.sub,
      },
    },
  })

  return participation
}

// interface RegisterParticipantFromLTIArgs {
//   courseId: string
//   participantId: string
//   email: string
// }

// // TODO: rework this so it only logs in users if the account already exists
// export async function registerParticipantFromLTI(
//   { courseId, participantId, email }: RegisterParticipantFromLTIArgs,
//   ctx: Context
// ) {
//   console.log('args', courseId, participantId)

//   if (!courseId) return null

//   if (!isEmail(email)) return null

//   try {
//     let participant = await ctx.prisma.participantAccount.findUnique({
//       where: {
//         ssoId: participantId,
//       },
//       include: {
//         participant: true,
//       },
//     })

//     let participation = null

//     // if there is no participant matching the SSO id from LTI
//     // create a new participant and participant account
//     if (!participant) {
//       let username
//       let password
//       // generate a random username that can be changed later on
//       username = generatePassword.generate({
//         length: 8,
//         uppercase: true,
//         symbols: false,
//         numbers: true,
//       })
//       // generate a random password that can be changed later on
//       password = generatePassword.generate({
//         length: 16,
//         uppercase: true,
//         symbols: true,
//         numbers: true,
//       })

//       const hash = await bcrypt.hash(password, 12)

//       participant = await ctx.prisma.participantAccount.create({
//         data: {
//           ssoId: participantId,
//           participant: {
//             create: {
//               password: hash,
//               username,
//               email,
//               isEmailValid: true,
//               participations: {
//                 create: {
//                   isActive: false,
//                   course: {
//                     connect: { id: courseId },
//                   },
//                 },
//               },
//             },
//           },
//         },
//         include: {
//           participant: true,
//         },
//       })
//     } else {
//       participation = await ctx.prisma.participation.upsert({
//         where: {
//           courseId_participantId: {
//             courseId,
//             participantId: participant.participantId,
//           },
//         },
//         create: {
//           isActive: false,
//           course: {
//             connect: {
//               id: courseId,
//             },
//           },
//           participant: {
//             connect: {
//               id: participant.participantId,
//             },
//           },
//         },
//         update: {},
//         include: {
//           participant: true,
//         },
//       })

//       console.log('new participation', participation)
//     }

//     const jwt = createParticipantToken(participant.participant.id)

//     return {
//       id: `${courseId}-${participant.participant.id}`,
//       participantToken: jwt,
//       participant: participant.participant ?? participation?.participant,
//       participation,
//       course: null,
//     }
//   } catch (e) {
//     console.error(e)
//     return null
//   }
// }

// interface CreateParticipantAndJoinCourseArgs {
//   username: string
//   password: string
//   courseId: string
//   pin: number
// }

// export async function createParticipantAndJoinCourse(
//   { username, password, courseId, pin }: CreateParticipantAndJoinCourseArgs,
//   ctx: Context
// ) {
//   if (typeof username === 'string') {
//     if (username.length < 5 || username.length > 10) {
//       return null
//     }
//   }

//   const existingParticipant = await ctx.prisma.participant.findUnique({
//     where: { username },
//   })
//   const isLoginValid = await bcrypt.compare(
//     password,
//     existingParticipant?.password || ''
//   )

//   // if the participant already exists, but the login is incorrect, abort this function call
//   if (existingParticipant && !isLoginValid) {
//     return null
//   }

//   // fetch the course and compare the provided pin with the correct value
//   const course = await ctx.prisma.course.findUnique({
//     where: { id: courseId },
//   })

//   // if the provided pin is wrong for this course, return null
//   if (!course || course.pinCode !== pin) return null

//   if (existingParticipant) {
//     // link the participant to the course by creating a new participation
//     await ctx.prisma.participation.upsert({
//       where: {
//         courseId_participantId: {
//           courseId,
//           participantId: existingParticipant.id,
//         },
//       },
//       create: {
//         course: {
//           connect: {
//             id: courseId,
//           },
//         },
//         participant: {
//           connect: {
//             id: existingParticipant.id,
//           },
//         },
//       },
//       update: {},
//     })

//     const jwt = createParticipantToken(existingParticipant.id)

//     ctx.res.cookie('participant_token', jwt, {
//       domain: process.env.COOKIE_DOMAIN ?? process.env.API_DOMAIN,
//       path: '/',
//       httpOnly: true,
//       maxAge: 1000 * 60 * 60 * 24 * 13,
//       secure:
//         process.env.NODE_ENV === 'production' &&
//         process.env.COOKIE_DOMAIN !== '127.0.0.1',
//       sameSite:
//         process.env.NODE_ENV === 'development' ||
//         process.env.COOKIE_DOMAIN === '127.0.0.1'
//           ? 'lax'
//           : 'none',
//     })

//     return existingParticipant
//   } else {
//     const hashedPassword = await bcrypt.hash(password, 12)
//     // create new participant with the provided username and password, and link the participant to the course by creating a new participation
//     const participant = await ctx.prisma.participant.create({
//       data: {
//         username,
//         password: hashedPassword,
//         participations: {
//           create: {
//             course: {
//               connect: {
//                 id: courseId,
//               },
//             },
//           },
//         },
//       },
//       include: {
//         participations: true,
//       },
//     })

//     const jwt = createParticipantToken(participant.id)

//     ctx.res.cookie('participant_token', jwt, {
//       domain: process.env.COOKIE_DOMAIN ?? process.env.API_DOMAIN,
//       path: '/',
//       httpOnly: true,
//       maxAge: 1000 * 60 * 60 * 24 * 13,
//       secure:
//         process.env.NODE_ENV === 'production' &&
//         process.env.COOKIE_DOMAIN !== '127.0.0.1',
//       sameSite:
//         process.env.NODE_ENV === 'development' ||
//         process.env.COOKIE_DOMAIN === '127.0.0.1'
//           ? 'lax'
//           : 'none',
//     })

//     return participant
//   }
// }

interface BookmarkQuestionArgs {
  stackId: number
  courseId: string
  bookmarked: boolean
}

export async function bookmarkQuestion(
  { stackId, courseId, bookmarked }: BookmarkQuestionArgs,
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
      stackElement: {
        include: {
          stack: {
            include: {
              learningElement: {
                include: {
                  course: true,
                },
              },
            },
          },
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
    !questionInstance?.stackElement?.stack?.learningElement?.course
      ?.notificationEmail &&
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
      elementType: questionInstance?.stackElement?.stack.learningElement
        ? 'Learning Element'
        : 'Micro-Session',
      elementId:
        questionInstance?.stackElement?.stack?.learningElement?.id ||
        questionInstance?.microSession?.id,
      elementName:
        questionInstance?.stackElement?.stack?.learningElement?.name ||
        questionInstance?.microSession?.name,
      questionId: questionInstance.questionId,
      questionName: questionInstance.questionData.name,
      content: args.content,
      participantId: ctx.user?.sub,
      secret: process.env.NOTIFICATION_SECRET,
      notificationEmail:
        questionInstance.stackElement?.stack?.learningElement?.course
          ?.notificationEmail ||
        questionInstance.microSession?.course?.notificationEmail,
    }),
  })

  return 'OK'
}

export async function getPublicParticipantProfile(
  args: { participantId: string },
  ctx: ContextWithUser
) {
  const self = await ctx.prisma.participant.findUnique({
    where: { id: ctx.user.sub },
    include: {
      achievements: {
        include: {
          achievement: true,
        },
      },
    },
  })

  if (self?.id === args.participantId) {
    return { ...self, isSelf: true }
  }

  const participant = await ctx.prisma.participant.findUnique({
    where: { id: args.participantId },
    include: {
      achievements: {
        include: {
          achievement: true,
        },
      },
    },
  })

  if (participant === null) {
    return participant
  } else if (participant?.isProfilePublic && self?.isProfilePublic) {
    return participant
  }

  return {
    ...participant,
    username: 'Anonymous',
    avatar: null,
  }
}

export async function getParticipantWithAchievements(ctx: ContextWithUser) {
  let participant = await ctx.prisma.participant.findUnique({
    where: { id: ctx.user.sub },
    include: {
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
    participant: { ...participant, isSelf: true },
    achievements,
  }
}
