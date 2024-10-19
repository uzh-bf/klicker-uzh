import {
  PublicationStatus,
  SessionStatus,
  UserRole,
  type ElementFeedback,
} from '@klicker-uzh/prisma'
import bcrypt from 'bcryptjs'
import isEmail from 'validator/lib/isEmail.js'
import type { Context, ContextWithUser } from '../lib/context.js'

interface UpdateParticipantProfileArgs {
  password?: string | null
  username: string | null
  email: string | null
  isProfilePublic?: boolean | null
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
    if (!isEmail.default(email)) {
      return null
    }
  }

  // check that username corresponds to no other participant
  if (username) {
    const existingParticipant = await ctx.prisma.participant.findUnique({
      where: { username: username.trim() },
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
          email: email?.toLowerCase(),
          password: hashedPassword,
          username: username?.trim() ?? undefined,
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
      email: email?.toLowerCase(),
      username: username?.trim(),
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
              microLearnings: {
                where: {
                  scheduledStartAt: {
                    lt: new Date(),
                  },
                  scheduledEndAt: {
                    gt: new Date(),
                  },
                  status: PublicationStatus.PUBLISHED,
                  isDeleted: false,
                },
              },
              sessions: {
                where: { status: SessionStatus.RUNNING },
              },
            },
          },
        },
        orderBy: {
          course: {
            displayName: 'asc',
          },
        },
      },
    },
  })

  if (!participant) return []

  return participant.participations
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

interface BookmarkElementStackArgs {
  stackId: number
  courseId: string
  bookmarked: boolean
}

export async function bookmarkElementStack(
  { stackId, courseId, bookmarked }: BookmarkElementStackArgs,
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
      bookmarkedElementStacks: {
        [bookmarked ? 'connect' : 'disconnect']: {
          id: stackId,
        },
      },
    },
    include: {
      bookmarkedElementStacks: true,
    },
  })

  return participation.bookmarkedElementStacks.map((stack) => stack.id)
}

interface GetBookmarkedElementStacksArgs {
  courseId: string
}

export async function getBookmarkedElementStacks(
  { courseId }: GetBookmarkedElementStacksArgs,
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
      bookmarkedElementStacks: {
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
      },
    },
  })

  return participation?.bookmarkedElementStacks ?? []
}

export async function flagElement(
  args: { elementInstanceId: number; elementId: number; content: string },
  ctx: ContextWithUser
) {
  const elementInstance = await ctx.prisma.elementInstance.findUnique({
    where: {
      id: args.elementInstanceId,
    },
    include: {
      elementStack: {
        include: {
          practiceQuiz: {
            include: {
              course: true,
            },
          },
          microLearning: {
            include: {
              course: true,
            },
          },
        },
      },
    },
  })

  const elementFeedback = await ctx.prisma.elementFeedback.upsert({
    where: {
      participantId_elementInstanceId: {
        participantId: ctx.user.sub,
        elementInstanceId: args.elementInstanceId,
      },
    },
    create: {
      feedback: args.content,
      element: {
        connect: {
          id: args.elementId,
        },
      },
      elementInstance: {
        connect: {
          id: args.elementInstanceId,
        },
      },
      participant: {
        connect: {
          id: ctx.user.sub,
        },
      },
    },
    update: {
      feedback: args.content,
    },
  })

  if (
    !elementInstance?.elementStack.practiceQuiz?.course?.notificationEmail &&
    !elementInstance?.elementStack.microLearning?.course?.notificationEmail
  ) {
    // return early if no notification email has been specified -> only set database entry
    return elementFeedback
  }

  const practiceQuiz = elementInstance.elementStack.practiceQuiz
  const microLearning = elementInstance.elementStack.microLearning

  await fetch(process.env.NOTIFICATION_URL as string, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      elementType: practiceQuiz !== null ? 'Practice Quiz' : 'Micro-Learning',
      elementId: practiceQuiz?.id || microLearning?.id,
      elementName: practiceQuiz?.name || microLearning?.name,
      questionId: elementInstance.elementId,
      questionName: elementInstance.elementData.name,
      content: args.content,
      participantId: ctx.user?.sub,
      secret: process.env.NOTIFICATION_SECRET,
      notificationEmail:
        practiceQuiz?.course?.notificationEmail ||
        microLearning?.course?.notificationEmail,
    }),
  })

  return elementFeedback
}

export async function rateElement(
  args: { elementInstanceId: number; elementId: number; rating: number },
  ctx: ContextWithUser
) {
  if (args.rating !== 1 && args.rating !== -1) {
    return null
  }

  let elementFeedback: ElementFeedback | null = null
  await ctx.prisma.$transaction(async (prisma) => {
    // fetch previous element feedback
    const prevFeedback = await ctx.prisma.elementFeedback.findUnique({
      where: {
        participantId_elementInstanceId: {
          participantId: ctx.user.sub,
          elementInstanceId: args.elementInstanceId,
        },
      },
    })

    if (prevFeedback) {
      // update existing element feedback
      elementFeedback = await prisma.elementFeedback.update({
        where: {
          participantId_elementInstanceId: {
            participantId: ctx.user.sub,
            elementInstanceId: args.elementInstanceId,
          },
        },
        data: {
          upvote: args.rating === 1,
          downvote: args.rating === -1,
        },
      })

      // update instance statistics (decrement by previous feedback first to only count last feedback)
      await prisma.instanceStatistics.update({
        where: {
          elementInstanceId: args.elementInstanceId,
        },
        data: {
          upvoteCount: {
            increment: Number(args.rating === 1) - Number(prevFeedback.upvote),
          },
          downvoteCount: {
            increment:
              Number(args.rating === -1) - Number(prevFeedback.downvote),
          },
        },
      })
    } else {
      // create new element feedback
      elementFeedback = await prisma.elementFeedback.create({
        data: {
          upvote: args.rating === 1,
          downvote: args.rating === -1,
          elementInstance: {
            connect: {
              id: args.elementInstanceId,
            },
          },
          element: {
            connect: {
              id: args.elementId,
            },
          },
          participant: {
            connect: {
              id: ctx.user.sub,
            },
          },
        },
      })

      // update instance statistics
      await prisma.instanceStatistics.update({
        where: {
          elementInstanceId: args.elementInstanceId,
        },
        data: {
          upvoteCount: {
            increment: Number(args.rating === 1),
          },
          downvoteCount: {
            increment: Number(args.rating === -1),
          },
        },
      })
    }
  })

  return elementFeedback
}

export async function getStackElementFeedbacks(
  args: { elementInstanceIds: number[] },
  ctx: ContextWithUser
) {
  const elementFeedbacks = await ctx.prisma.elementFeedback.findMany({
    where: {
      elementInstanceId: {
        in: args.elementInstanceIds,
      },
      participantId: ctx.user.sub,
    },
  })

  return elementFeedbacks
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

export async function getPracticeCourses(ctx: ContextWithUser) {
  // fetch participations including courses
  const participations = await ctx.prisma.participation.findMany({
    where: {
      participantId: ctx.user.sub,
    },
    include: {
      course: {
        include: {
          elementStacks: true,
        },
      },
    },
  })

  if (participations.length === 0) return []

  // sort courses by end date descending
  const courses = participations
    .map((p) => p.course)
    .filter((c) => c.elementStacks.length > 0)
    .sort((a, b) => (a.endDate > b.endDate ? -1 : 1))

  return courses
}

export async function getPracticeQuizList(ctx: ContextWithUser) {
  const participations = await ctx.prisma.participation.findMany({
    where: {
      participantId: ctx.user.sub,
    },
    include: {
      course: {
        include: {
          practiceQuizzes: {
            where: {
              status: PublicationStatus.PUBLISHED,
              isDeleted: false,
            },
          },
        },
      },
    },
  })

  if (!participations || participations.length === 0) return []

  const courses = participations
    .map((p) => p.course)
    .sort((a, b) => (a.endDate > b.endDate ? -1 : 1))
    .filter((course) => course.practiceQuizzes.length !== 0)

  return courses
}
