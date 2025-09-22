import { Context as HatchetContext } from '@hatchet-dev/typescript-sdk/index.js'
import * as DB from '@klicker-uzh/prisma/client'
import { HatchetHandlers } from '@klicker-uzh/types'
import { PrismaTransactionClient } from '@klicker-uzh/util'
import bcrypt from 'bcryptjs'
import dayjs from 'dayjs'
import isoWeek from 'dayjs/plugin/isoWeek.js'
import { prop, sortBy } from 'remeda'
import isEmail from 'validator/lib/isEmail.js'
import type { Context, ContextWithUser } from '../lib/context.js'

dayjs.extend(isoWeek)

export async function getSelf(
  { liveQuizId }: { liveQuizId?: string | null },
  ctx: Context
) {
  if (!ctx.user?.sub) return null

  // if the user is logged in as a participant, return the participant data
  if (ctx.user.role === DB.UserRole.PARTICIPANT) {
    // check if the live quiz is part of a course
    const liveQuiz = liveQuizId
      ? await ctx.prisma.liveQuiz.findUnique({
          where: { id: liveQuizId },
          include: { course: true },
        })
      : null

    const participantData = await ctx.prisma.participant.findUnique({
      where: { id: ctx.user.sub },
      include: {
        participations: liveQuiz?.courseId
          ? { where: { courseId: liveQuiz.courseId } }
          : { take: 0 }, // make sure that no participations are fetched if courseid is not set
        accounts: {
          where: { ssoType: 'uzh' },
          select: { ssoEmail: true },
          take: 1,
        },
      },
    })

    if (!participantData) return null

    const isCourseParticipant =
      !!liveQuiz?.courseId && participantData.participations.length > 0
    const isCourseParticipationActive =
      isCourseParticipant && participantData.participations[0]?.isActive

    return {
      role: DB.UserRole.PARTICIPANT,
      isCourseParticipant,
      isCourseParticipationActive,
      institutionalEmail: participantData.accounts[0]?.ssoEmail ?? null,
      ...participantData,
    }
  }

  // if the user is logged in as a temporary quiz participant, return the corresponding pseudonym
  if (ctx.user.role === DB.UserRole.TEMPORARY_PARTICIPANT) {
    // outside of live quizzes, temporary participants do not exist
    if (!liveQuizId) return null

    const temporaryParticipantData =
      await ctx.prisma.temporaryLeaderboardEntry.findUnique({
        where: { id_quizId: { id: ctx.user.sub, quizId: liveQuizId } },
      })

    if (!temporaryParticipantData) return null

    return {
      ...temporaryParticipantData,
      id: ctx.user.sub,
      role: DB.UserRole.TEMPORARY_PARTICIPANT,
      scopeQuizId: temporaryParticipantData.quizId,
      isCourseParticipant: false,
      isCourseParticipationActive: false,
      lastLoginAt: temporaryParticipantData.createdAt,
      isActive: true,
      isProfilePublic: true,
      isSSOAccount: false,
      email: null,
      isEmailValid: false,
      avatarSettings: null,
      xp: null,
      locale: null,
    }
  }

  return null
}

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
  if (ctx.user.role !== DB.UserRole.PARTICIPANT) {
    return null
  }

  if (typeof username === 'string') {
    if (username.length < 5 || username.length > 15) {
      return null
    }
  }

  if (typeof email === 'string') {
    // @ts-ignore - default export is not types correctly and otherwise leads to graphql package test failure
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
  {
    endpoint,
    assessmentOnly = false,
  }: { endpoint?: string | null; assessmentOnly?: boolean | null },
  ctx: ContextWithUser
) {
  const participant = await ctx.prisma.participant.findUnique({
    where: { id: ctx.user.sub },
    include: {
      participations: {
        where: assessmentOnly
          ? { course: { isAssessmentEnabled: true } }
          : undefined,
        include: {
          subscriptions: endpoint ? { where: { endpoint } } : undefined,
          course: {
            include: {
              microLearnings: {
                where: {
                  scheduledStartAt: { lt: new Date() },
                  scheduledEndAt: { gt: new Date() },
                  status: DB.PublicationStatus.PUBLISHED,
                  isDeleted: false,
                },
              },
              liveQuizzes: {
                where: {
                  status: DB.PublicationStatus.PUBLISHED,
                  isDeleted: false,
                },
              },
            },
          },
        },
        orderBy: { course: { displayName: 'asc' } },
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
  if (!ctx.user?.sub || ctx.user.role !== DB.UserRole.PARTICIPANT) {
    return null
  }

  const participation = await ctx.prisma.participation.findUnique({
    where: {
      courseId_participantId: { courseId, participantId: ctx.user.sub },
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

//     const jwt = await createParticipantToken(participant.participant.id)

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

//     const jwt = await createParticipantToken(existingParticipant.id)

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

//     const jwt = await createParticipantToken(participant.id)

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
      courseId_participantId: { courseId, participantId: ctx.user.sub },
    },
    data: {
      bookmarkedElementStacks: {
        [bookmarked ? 'connect' : 'disconnect']: { id: stackId },
      },
    },
    include: { bookmarkedElementStacks: true },
  })

  return participation.bookmarkedElementStacks.map((stack) => stack.id)
}

export async function getBookmarkedElementStacks(
  { courseId }: { courseId: string },
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
      },
    },
  })

  return participation?.bookmarkedElementStacks ?? []
}

export async function flagElement(
  {
    elementInstanceId,
    elementId,
    content,
  }: { elementInstanceId: number; elementId: number; content: string },
  ctx: ContextWithUser
) {
  const elementInstance = await ctx.prisma.elementInstance.findUnique({
    where: {
      id: elementInstanceId,
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
        elementInstanceId: elementInstanceId,
      },
    },
    create: {
      feedback: content,
      element: {
        connect: {
          id: elementId,
        },
      },
      elementInstance: {
        connect: {
          id: elementInstanceId,
        },
      },
      participant: {
        connect: {
          id: ctx.user.sub,
        },
      },
    },
    update: {
      feedback: content,
    },
  })

  if (
    !elementInstance?.elementStack!.practiceQuiz?.course?.notificationEmail &&
    !elementInstance?.elementStack!.microLearning?.course?.notificationEmail
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
      content: content,
      participantId:
        ctx.user.role === DB.UserRole.PARTICIPANT ? ctx.user?.sub : undefined,
      secret: process.env.NOTIFICATION_SECRET,
      notificationEmail:
        practiceQuiz?.course?.notificationEmail ||
        microLearning?.course?.notificationEmail,
    }),
  })

  return elementFeedback
}

export async function rateElement(
  {
    elementInstanceId,
    elementId,
    rating,
  }: { elementInstanceId: number; elementId: number; rating: number },
  ctx: ContextWithUser
) {
  if (rating !== 1 && rating !== -1) {
    return null
  }

  let elementFeedback: DB.ElementFeedback | null = null
  await ctx.prisma.$transaction(async (prisma) => {
    // fetch previous element feedback
    const prevFeedback = await ctx.prisma.elementFeedback.findUnique({
      where: {
        participantId_elementInstanceId: {
          participantId: ctx.user.sub,
          elementInstanceId: elementInstanceId,
        },
      },
    })

    if (prevFeedback) {
      // update existing element feedback
      elementFeedback = await prisma.elementFeedback.update({
        where: {
          participantId_elementInstanceId: {
            participantId: ctx.user.sub,
            elementInstanceId: elementInstanceId,
          },
        },
        data: { upvote: rating === 1, downvote: rating === -1 },
      })

      // update instance statistics (decrement by previous feedback first to only count last feedback)
      await prisma.instanceStatistics.update({
        where: { elementInstanceId: elementInstanceId },
        data: {
          upvoteCount: {
            increment: Number(rating === 1) - Number(prevFeedback.upvote),
          },
          downvoteCount: {
            increment: Number(rating === -1) - Number(prevFeedback.downvote),
          },
        },
      })
    } else {
      // create new element feedback
      elementFeedback = await prisma.elementFeedback.create({
        data: {
          upvote: rating === 1,
          downvote: rating === -1,
          elementInstance: { connect: { id: elementInstanceId } },
          element: { connect: { id: elementId } },
          participant: { connect: { id: ctx.user.sub } },
        },
      })

      // update instance statistics
      await prisma.instanceStatistics.update({
        where: { elementInstanceId: elementInstanceId },
        data: {
          upvoteCount: { increment: Number(rating === 1) },
          downvoteCount: { increment: Number(rating === -1) },
        },
      })
    }
  })

  return elementFeedback
}

export async function getStackElementFeedbacks(
  { elementInstanceIds }: { elementInstanceIds: number[] },
  ctx: ContextWithUser
) {
  const elementFeedbacks = await ctx.prisma.elementFeedback.findMany({
    where: {
      elementInstanceId: {
        in: elementInstanceIds,
      },
      participantId: ctx.user.sub,
    },
  })

  return elementFeedbacks
}

export async function getPublicParticipantProfile(
  { participantId }: { participantId: string },
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

  if (self?.id === participantId) {
    return { ...self, isSelf: true }
  }

  const participant = await ctx.prisma.participant.findUnique({
    where: { id: participantId },
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
  const participant = await ctx.prisma.participant.findUnique({
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
              status: DB.PublicationStatus.PUBLISHED,
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

// helper function to upsert daily timeline entry
export async function upsertDailyTimelineEntry({
  prisma,
  participantId,
  courseId,
  xpAwarded,
  pointsAwarded,
}: {
  prisma: PrismaTransactionClient
  participantId: string
  courseId: string
  xpAwarded?: number
  pointsAwarded?: number
}) {
  // find course participation of participant
  const participation = await prisma.participation.findUnique({
    where: {
      courseId_participantId: {
        courseId,
        participantId,
      },
    },
  })

  // return early if participation does not exist
  if (!participation) {
    return
  }

  await prisma.timelineEntry.upsert({
    where: {
      participationId_courseId_timestamp_type: {
        participationId: participation.id,
        courseId,
        timestamp: new Date(),
        type: DB.TimelineEntryType.DAILY,
      },
    },
    create: {
      type: DB.TimelineEntryType.DAILY,
      timestamp: new Date(),
      collectedPoints: participation.isActive ? pointsAwarded : 0,
      collectedXp: xpAwarded,
      computedAt: new Date(),
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
    },
    update: {
      collectedPoints:
        typeof pointsAwarded === 'number'
          ? { increment: pointsAwarded }
          : undefined,
      collectedXp:
        typeof xpAwarded === 'number' ? { increment: xpAwarded } : undefined,
      computedAt: new Date(),
    },
  })
}

// cronjob function to aggregate daily timeline entries into weekly ones once per day (for the ongoing and last week)
export const handleUpdateWeeklyTimelineEntries: HatchetHandlers['handleUpdateWeeklyTimelineEntries'] =
  async (_, globalCtx, executionCtx) => {
    executionCtx.logger.info(
      `[INFO] [UpdateWeeklyTimelineEntries] Starting update of weekly timeline entries`
    )

    // get all course ids
    const courses = await globalCtx.prisma.course.findMany({
      where: { endDate: { gt: new Date() } },
      select: { id: true, name: true },
    })

    // iterate over all courses and update weekly timeline entries
    for (const course of courses) {
      await updateWeeklyTimelineEntriesCourse(
        { courseId: course.id },
        globalCtx.prisma,
        executionCtx
      )

      executionCtx.logger.info(
        `[INFO] [UpdateWeeklyTimelineEntries] Successfully updated weekly timeline entries for course ${course.name} (ID: ${course.id})`
      )
    }

    // remove all daily timeline entries older than 2 weeks
    const deletedDailyEntries = await globalCtx.prisma.timelineEntry.deleteMany(
      {
        where: {
          type: DB.TimelineEntryType.DAILY,
          timestamp: {
            lt: dayjs().utc().subtract(30, 'days').toDate(),
          },
        },
      }
    )

    executionCtx.logger.info(
      `[INFO] [UpdateWeeklyTimelineEntries] Successfully removed ${deletedDailyEntries.count} daily timeline entries older than 30 days`
    )

    return true
  }

export async function updateWeeklyTimelineEntriesCourse(
  { courseId }: { courseId: string },
  prisma: DB.PrismaClient,
  executionCtx?: HatchetContext<unknown, {}>
) {
  // get start date of current week (monday) in UTC
  const startDateCurrentWeek = dayjs().utc().startOf('isoWeek').toDate()

  // get start date of previous week (monday) in UTC
  const startDateLastWeek = dayjs()
    .utc()
    .startOf('isoWeek')
    .subtract(7, 'days')
    .toDate()

  // fetch all timeline entries (weekly and daily) within the restrictions for the current course
  // if the function is not called from within a cronjob, make sure that the user is the owner of the course
  const courseTimelineLastWeek = await prisma.course.findUnique({
    where: { id: courseId },
    include: {
      timelineEntries: {
        where: {
          OR: [
            {
              type: DB.TimelineEntryType.DAILY,
              timestamp: { gte: startDateLastWeek, lt: startDateCurrentWeek },
            },
            { type: DB.TimelineEntryType.WEEKLY, timestamp: startDateLastWeek },
          ],
        },
        include: { participation: true },
      },
    },
  })

  const courseTimelineCurrentWeek = await prisma.course.findUnique({
    where: { id: courseId },
    include: {
      timelineEntries: {
        where: {
          OR: [
            {
              type: DB.TimelineEntryType.DAILY,
              timestamp: { gte: startDateCurrentWeek, lte: new Date() },
            },
            {
              type: DB.TimelineEntryType.WEEKLY,
              timestamp: startDateCurrentWeek,
            },
          ],
        },
        include: { participation: true },
      },
    },
  })

  // if no course was found, return early
  if (!courseTimelineLastWeek || !courseTimelineCurrentWeek) {
    executionCtx?.logger.info(
      `[ERROR] [UpdateWeeklyTimelineEntries] Course with id ${courseId} not found`
    )

    return false
  }

  // collect all timeline entry updates to be executed in transaction
  const updates: any[] = []
  let numUpdatesLastWeek = 0
  let numUpdatesCurrentWeek = 0
  const lastWeekDailys = courseTimelineLastWeek.timelineEntries.filter(
    (entry) => entry.type === DB.TimelineEntryType.DAILY
  )
  const currentWeekDailys = courseTimelineCurrentWeek.timelineEntries.filter(
    (entry) => entry.type === DB.TimelineEntryType.DAILY
  )

  // update last weeks timeline entries, if the aggregated values are not correct
  if (lastWeekDailys.length > 0) {
    const lastWeekUpdates = await updateWeeklyTimelineEntriesFromDailys({
      entries: courseTimelineLastWeek.timelineEntries,
      dailyEntries: lastWeekDailys,
      timestamp: startDateLastWeek,
      courseId,
    })

    if (lastWeekUpdates.length > 0) {
      updates.push(...lastWeekUpdates)
      numUpdatesLastWeek = lastWeekUpdates.length
    }
  }

  // update current weeks timeline entries, if the aggregated values are different from the stored ones
  if (currentWeekDailys.length > 0) {
    const currentWeekUpdates = await updateWeeklyTimelineEntriesFromDailys({
      entries: courseTimelineCurrentWeek.timelineEntries,
      dailyEntries: currentWeekDailys,
      timestamp: startDateCurrentWeek,
      courseId,
    })

    if (currentWeekUpdates.length > 0) {
      updates.push(...currentWeekUpdates)
      numUpdatesCurrentWeek = currentWeekUpdates.length
    }
  }

  // execute all weekly timeline updates in a single transaction and log the number of updateså
  if (updates.length > 0) {
    await prisma.$transaction(async (prisma) => {
      for (const update of updates) {
        await prisma.timelineEntry.upsert(update)
      }
    })

    executionCtx?.logger.info(
      `[INFO] [UpdateWeeklyTimelineEntries] Successfully updated ${updates.length} weekly timeline entries for course ${courseTimelineLastWeek.name} (${numUpdatesLastWeek} for last week with start date ${startDateLastWeek} and ${lastWeekDailys.length} daily entries, ${numUpdatesCurrentWeek} for the current week with start date ${startDateCurrentWeek} and ${currentWeekDailys.length} daily entries).`
    )
  }

  return true
}

async function updateWeeklyTimelineEntriesFromDailys({
  entries,
  dailyEntries,
  timestamp,
  courseId,
}: {
  entries: (DB.TimelineEntry & { participation?: DB.Participation })[]
  dailyEntries: (DB.TimelineEntry & { participation?: DB.Participation })[]
  timestamp: Date
  courseId: string
}) {
  // aggreagte the daily timeline entries into a single entry for each participant
  const reducedDailyEntries = dailyEntries.reduce<{
    [participationId: string]: { collectedPoints: number; collectedXp: number }
  }>((acc, entry) => {
    if (
      entry.participationId === null ||
      typeof entry.participationId === 'undefined'
    ) {
      return acc
    }

    const participationId = String(entry.participationId)
    if (!acc[participationId]) {
      acc[participationId] = {
        collectedPoints: 0,
        collectedXp: 0,
      }
    }

    acc[participationId]!.collectedPoints += entry.participation?.isActive
      ? entry.collectedPoints
      : 0
    acc[participationId]!.collectedXp += entry.collectedXp

    return acc
  }, {})

  if (Object.keys(reducedDailyEntries).length === 0) {
    return []
  }

  // loop over all entries and check if the aggregated values are different from the stored ones
  return Object.entries(reducedDailyEntries).flatMap(
    ([participationId, values]) => {
      const pId = parseInt(participationId)
      const storedEntry = entries.find(
        (entry) =>
          entry.type === DB.TimelineEntryType.WEEKLY &&
          entry.timestamp.getTime() === timestamp.getTime() &&
          entry.participationId === pId
      )

      if (
        !storedEntry ||
        storedEntry.collectedPoints !== values.collectedPoints ||
        storedEntry.collectedXp !== values.collectedXp
      ) {
        return {
          where: {
            participationId_courseId_timestamp_type: {
              participationId: pId,
              courseId,
              timestamp: timestamp,
              type: DB.TimelineEntryType.WEEKLY,
            },
          },
          create: {
            type: DB.TimelineEntryType.WEEKLY,
            timestamp: timestamp,
            collectedPoints: values.collectedPoints,
            collectedXp: values.collectedXp,
            computedAt: new Date(),
            course: {
              connect: {
                id: courseId,
              },
            },
            participation: {
              connect: {
                id: pId,
              },
            },
          },
          update: {
            collectedPoints: values.collectedPoints,
            collectedXp: values.collectedXp,
            computedAt: new Date(),
          },
        }
      } else {
        return []
      }
    }
  )
}

export async function getCourseStudentTimelines(ctx: ContextWithUser) {
  const participant = await ctx.prisma.participant.findUnique({
    where: {
      id: ctx.user.sub,
    },
    include: {
      participations: {
        include: {
          timelineEntries: {
            where: {
              OR: [
                {
                  type: DB.TimelineEntryType.WEEKLY,
                  timestamp: { lt: dayjs().subtract(14, 'days').toDate() },
                },
                {
                  type: DB.TimelineEntryType.DAILY,
                  timestamp: { gte: dayjs().subtract(14, 'days').toDate() },
                },
              ],
            },
          },
          course: {
            select: {
              id: true,
              displayName: true,
              isGamificationEnabled: true,
              startDate: true,
              endDate: true,
            },
          },
        },
      },
    },
  })

  // if no participant or no courses were found, return null
  if (!participant || participant.participations.length === 0) {
    return []
  }

  // reduce the course data and timeline entries to the required information
  const courses = participant.participations.map((participation) => {
    const course = participation.course

    if (course.isGamificationEnabled) {
      // sort timeline entries by timestamp and map to include points when gamified
      const { timelineEntries } = participation.timelineEntries
        .sort((a, b) => (a.timestamp > b.timestamp ? 1 : -1))
        .reduce<{
          timelineEntries: {
            timestamp: Date
            collectedPoints: number
            collectedXp: number
            totalPoints: number
            totalXp: number
          }[]
          totalPoints: number
          totalXp: number
        }>(
          (acc, entry) => {
            acc.totalPoints += entry.collectedPoints
            acc.totalXp += entry.collectedXp
            acc.timelineEntries.push({
              timestamp: entry.timestamp,
              collectedPoints: entry.collectedPoints,
              collectedXp: entry.collectedXp,
              totalPoints: acc.totalPoints,
              totalXp: acc.totalXp,
            })

            return acc
          },
          { timelineEntries: [], totalPoints: 0, totalXp: 0 }
        )

      return {
        courseId: course.id,
        courseName: course.displayName,
        courseGamified: true,
        courseStart: course.startDate,
        courseEnd: course.endDate,
        timelineEntries,
      }
    } else {
      // for non-gamified courses, only include xp values
      const { timelineEntries } = participation.timelineEntries
        .sort((a, b) => (a.timestamp > b.timestamp ? 1 : -1))
        .reduce<{
          timelineEntries: {
            timestamp: Date
            collectedXp: number
            totalXp: number
          }[]
          totalXp: number
        }>(
          (acc, entry) => {
            acc.totalXp += entry.collectedXp
            acc.timelineEntries.push({
              timestamp: entry.timestamp,
              collectedXp: entry.collectedXp,
              totalXp: acc.totalXp,
            })

            return acc
          },
          { timelineEntries: [], totalXp: 0 }
        )

      return {
        courseId: course.id,
        courseName: course.displayName,
        courseGamified: false,
        courseStart: course.startDate,
        courseEnd: course.endDate,
        timelineEntries,
      }
    }
  })

  const sortedCourses = sortBy(courses, [prop('courseEnd'), 'desc'])
  return sortedCourses
}
