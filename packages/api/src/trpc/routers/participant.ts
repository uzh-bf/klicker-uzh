import {
  LeaderboardType,
  PublicationStatus,
  TimelineEntryType,
  UserRole,
  type PrismaClient,
} from '@klicker-uzh/prisma/client'
import { levelFromXp } from '@klicker-uzh/util'
import dayjs from 'dayjs'
import {
  activateParticipantAccount,
  changeParticipantLocale,
  createParticipantAccount,
  deleteParticipantAccount,
  loginParticipant,
  loginParticipantWithLti,
  loginTemporaryParticipant,
  loginWithMagicLink,
  logoutParticipant,
  logoutTemporaryParticipant,
  sendMagicLink,
} from '../../services/participantAuth.js'
import {
  bookmarkElementStack,
  getBookmarksPageData,
  getPracticeQuizBookmarks,
} from '../../services/participantBookmarks.js'
import {
  checkValidCoursePin,
  joinCourseWithPin,
} from '../../services/participantCourseJoin.js'
import {
  getStackElementFeedbacks,
  rateElement,
} from '../../services/participantElementFeedbacks.js'
import {
  addMessageToGroup as addMessageToGroupService,
  createParticipantGroup as createParticipantGroupService,
  joinParticipantGroup as joinParticipantGroupService,
  joinRandomCourseGroupPool as joinRandomCourseGroupPoolService,
  leaveParticipantGroup as leaveParticipantGroupService,
  leaveRandomCourseGroupPool as leaveRandomCourseGroupPoolService,
  renameParticipantGroup as renameParticipantGroupService,
} from '../../services/participantGroups.js'
import { getPracticeQuizDetail } from '../../services/participantPracticeQuizzes.js'
import {
  checkParticipantNameAvailable,
  updateParticipantAvatar,
  updateParticipantProfile,
} from '../../services/participantProfile.js'
import { getPrisma } from '../context.js'
import {
  toCourseGroupActivity,
  toCourseLeaderboard,
  toCourseOverview,
  toGroupActivityInstance,
  toParticipantCourse,
  toParticipantGroup,
  toParticipantParticipation,
  toParticipantSelf,
  toPracticeCourse,
  toPublicParticipantProfile,
  toPublishedPracticeQuiz,
  toTemporaryParticipantSelf,
} from '../dto/participant.js'
import { publicProcedure, router } from '../init.js'
import {
  participantProcedure,
  temporaryParticipantProcedure,
} from '../procedures.js'
import {
  participantActivateAccountInput,
  participantBookmarkElementStackInput,
  participantChangeLocaleInput,
  participantCheckNameAvailableInput,
  participantCourseInput,
  participantCourseLeaderboardInput,
  participantCoursePinInput,
  participantCreateAccountInput,
  participantCreateGroupInput,
  participantGroupActivityInstancesInput,
  participantGroupMessageInput,
  participantJoinGroupInput,
  participantLeaveGroupInput,
  participantLoginInput,
  participantLoginTemporaryInput,
  participantLoginWithLtiInput,
  participantLoginWithMagicLinkInput,
  participantLogoutTemporaryInput,
  participantParticipationsInput,
  participantPracticeQuizBookmarksInput,
  participantPracticeQuizInput,
  participantPublicProfileInput,
  participantRateElementInput,
  participantRenameGroupInput,
  participantSelfInput,
  participantSendMagicLinkInput,
  participantStackElementFeedbacksInput,
  participantSubscribeToPushInput,
  participantUnsubscribeFromPushInput,
  participantUpdateAvatarInput,
  participantUpdateProfileInput,
} from '../schemas/participant.js'

async function getLevelData(prisma: PrismaClient, xp: number | null) {
  return await prisma.level.findUnique({
    where: { index: levelFromXp(xp ?? 0) },
    include: { nextLevel: true },
  })
}

function emptyCourseLeaderboard() {
  return {
    leaderboard: [],
    leaderboardStatistics: {
      participantCount: 0,
      averageScore: 0,
    },
  }
}

const publicParticipantProfileSelect = {
  id: true,
  username: true,
  avatar: true,
  avatarSettings: true,
  isProfilePublic: true,
  xp: true,
  achievements: {
    select: {
      id: true,
      achievedAt: true,
      achievedCount: true,
      achievement: {
        select: {
          id: true,
          nameDE: true,
          nameEN: true,
          descriptionDE: true,
          descriptionEN: true,
          icon: true,
          iconColor: true,
        },
      },
    },
  },
}

async function getRollingCourseLeaderboard({
  courseId,
  days,
  prisma,
  participantId,
}: {
  courseId: string
  days: number
  prisma: PrismaClient
  participantId: string
}) {
  const detailsEarliest = dayjs()
    .subtract(days - 1, 'days')
    .startOf('day')
    .toDate()
  const detailsLatest = dayjs().subtract(days, 'days').toDate()

  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: {
      liveQuizzes: {
        where: { finishedAt: { lte: detailsEarliest, gt: detailsLatest } },
        select: {
          leaderboard: {
            select: { participantId: true, score: true },
          },
        },
      },
      practiceQuizzes: {
        select: {
          responseDetails: {
            where: { createdAt: { lte: detailsEarliest, gt: detailsLatest } },
            select: { participantId: true, pointsAwarded: true },
          },
        },
      },
      microLearnings: {
        select: {
          responseDetails: {
            where: { createdAt: { lte: detailsEarliest, gt: detailsLatest } },
            select: { participantId: true, pointsAwarded: true },
          },
        },
      },
      participations: {
        where: { isActive: true },
        select: {
          participant: {
            select: { id: true, username: true, avatar: true, xp: true },
          },
        },
      },
      timelineEntries: {
        where: {
          type: TimelineEntryType.DAILY,
          timestamp: { gt: dayjs().subtract(days, 'days').toDate() },
          participation: { isActive: true },
        },
        select: {
          collectedPoints: true,
          participation: {
            select: { participantId: true },
          },
        },
      },
    },
  })

  if (!course) return emptyCourseLeaderboard()

  const leaderboardScores = course.participations.reduce<
    Record<
      string,
      {
        avatar: string | null
        isSelf?: boolean
        participantId: string
        score: number
        username: string
        xp: number
      }
    >
  >((acc, entry) => {
    acc[entry.participant.id] = {
      participantId: entry.participant.id,
      username: entry.participant.username,
      avatar: entry.participant.avatar,
      score: 0,
      xp: entry.participant.xp,
      isSelf: participantId === entry.participant.id,
    }

    return acc
  }, {})

  course.timelineEntries.forEach((entry) => {
    const participantScore =
      leaderboardScores[entry.participation.participantId]
    if (participantScore) {
      participantScore.score += entry.collectedPoints
    }
  })

  course.practiceQuizzes.forEach((quiz) => {
    quiz.responseDetails.forEach((detail) => {
      const participantScore = leaderboardScores[detail.participantId]
      if (participantScore) {
        participantScore.score += detail.pointsAwarded ?? 0
      }
    })
  })

  course.microLearnings.forEach((microLearning) => {
    microLearning.responseDetails.forEach((detail) => {
      const participantScore = leaderboardScores[detail.participantId]
      if (participantScore) {
        participantScore.score += detail.pointsAwarded ?? 0
      }
    })
  })

  course.liveQuizzes.forEach((liveQuiz) => {
    liveQuiz.leaderboard.forEach((entry) => {
      const participantScore = leaderboardScores[entry.participantId]
      if (participantScore) {
        participantScore.score += entry.score
      }
    })
  })

  const sortedScores = Object.values(leaderboardScores).sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score
    return a.username.localeCompare(b.username)
  })

  const leaderboard = sortedScores.map((entry, ix) => ({
    id: Math.floor(Math.random() * 1000000000),
    participantId: entry.participantId,
    username: entry.username,
    avatar: entry.avatar,
    score: entry.score,
    isSelf: entry.isSelf,
    rank: ix + 1,
    level: levelFromXp(entry.xp),
  }))
  const sum = sortedScores.reduce((acc, entry) => acc + entry.score, 0)

  return {
    leaderboard,
    leaderboardStatistics: {
      participantCount: sortedScores.length,
      averageScore: sortedScores.length > 0 ? sum / sortedScores.length : 0,
    },
  }
}

export const participantRouter = router({
  activateAccount: publicProcedure
    .input(participantActivateAccountInput)
    .mutation(async ({ ctx, input }) => {
      const prisma = getPrisma(ctx)

      return activateParticipantAccount({
        prisma,
        res: ctx.res,
        token: input.token,
      })
    }),

  login: publicProcedure
    .input(participantLoginInput)
    .mutation(async ({ ctx, input }) => {
      const prisma = getPrisma(ctx)

      return loginParticipant({
        prisma,
        res: ctx.res,
        usernameOrEmail: input.usernameOrEmail,
        password: input.password,
      })
    }),

  createAccount: publicProcedure
    .input(participantCreateAccountInput)
    .mutation(async ({ ctx, input }) => {
      const prisma = getPrisma(ctx)

      return createParticipantAccount({
        courseId: input.courseId,
        email: input.email,
        isProfilePublic: input.isProfilePublic,
        password: input.password,
        prisma,
        res: ctx.res,
        signedLtiData: input.signedLtiData,
        username: input.username,
      })
    }),

  changeLocale: participantProcedure
    .input(participantChangeLocaleInput)
    .mutation(async ({ ctx, input }) => {
      const prisma = getPrisma(ctx)

      return changeParticipantLocale({
        locale: input.locale,
        participantId: ctx.user.sub,
        prisma,
        res: ctx.res,
      })
    }),

  loginWithLti: publicProcedure
    .input(participantLoginWithLtiInput)
    .mutation(async ({ ctx, input }) => {
      const prisma = getPrisma(ctx)

      return loginParticipantWithLti({
        courseId: input.courseId,
        prisma,
        res: ctx.res,
        signedLtiData: input.signedLtiData,
      })
    }),

  loginWithMagicLink: publicProcedure
    .input(participantLoginWithMagicLinkInput)
    .mutation(async ({ ctx, input }) => {
      const prisma = getPrisma(ctx)

      return loginWithMagicLink({
        prisma,
        res: ctx.res,
        token: input.token,
      })
    }),

  checkValidCoursePin: publicProcedure
    .input(participantCoursePinInput)
    .query(async ({ ctx, input }) => {
      const prisma = getPrisma(ctx)

      return checkValidCoursePin({
        pin: input.pin,
        prisma,
      })
    }),

  checkNameAvailable: publicProcedure
    .input(participantCheckNameAvailableInput)
    .query(async ({ ctx, input }) => {
      const prisma = getPrisma(ctx)

      return checkParticipantNameAvailable({
        participantId:
          ctx.user?.role === UserRole.PARTICIPANT ? ctx.user.sub : undefined,
        prisma,
        username: input.username,
      })
    }),

  loginTemporary: publicProcedure
    .input(participantLoginTemporaryInput)
    .mutation(async ({ ctx, input }) => {
      const prisma = getPrisma(ctx)

      return loginTemporaryParticipant({
        avatar: input.avatar,
        liveQuizId: input.liveQuizId,
        prisma,
        pseudonym: input.pseudonym,
        res: ctx.res,
      })
    }),

  logout: participantProcedure.mutation(async ({ ctx }) => {
    return logoutParticipant({
      participantId: ctx.user.sub,
      res: ctx.res,
    })
  }),

  deleteAccount: participantProcedure.mutation(async ({ ctx }) => {
    const prisma = getPrisma(ctx)

    return deleteParticipantAccount({
      participantId: ctx.user.sub,
      prisma,
      res: ctx.res,
    })
  }),

  logoutTemporary: temporaryParticipantProcedure
    .input(participantLogoutTemporaryInput)
    .mutation(async ({ ctx, input }) => {
      const prisma = getPrisma(ctx)

      return logoutTemporaryParticipant({
        liveQuizId: input.liveQuizId,
        participantId: ctx.user.sub,
        prisma,
        res: ctx.res,
      })
    }),

  joinCourseWithPin: participantProcedure
    .input(participantCoursePinInput)
    .mutation(async ({ ctx, input }) => {
      const prisma = getPrisma(ctx)

      return joinCourseWithPin({
        emitter: ctx.emitter,
        participantId: ctx.user.sub,
        pin: input.pin,
        prisma,
      })
    }),

  joinCourseLeaderboard: participantProcedure
    .input(participantCourseInput)
    .mutation(async ({ ctx, input }) => {
      const prisma = getPrisma(ctx)
      const participation = await prisma.participation.upsert({
        where: {
          courseId_participantId: {
            courseId: input.courseId,
            participantId: ctx.user.sub,
          },
        },
        create: {
          isActive: true,
          course: { connect: { id: input.courseId } },
          participant: { connect: { id: ctx.user.sub } },
        },
        update: { isActive: true },
        select: {
          id: true,
          isActive: true,
        },
      })

      const leaderboardEntry = await prisma.leaderboardEntry.upsert({
        where: {
          type_participantId_courseId: {
            type: LeaderboardType.COURSE,
            participantId: ctx.user.sub,
            courseId: input.courseId,
          },
        },
        create: {
          type: LeaderboardType.COURSE,
          participant: { connect: { id: ctx.user.sub } },
          course: { connect: { id: input.courseId } },
          participation: { connect: { id: participation.id } },
          score: 0,
        },
        update: {},
        select: { id: true },
      })

      ctx.emitter?.emit('invalidate', {
        typename: 'Participation',
        id: participation.id,
      })
      ctx.emitter?.emit('invalidate', {
        typename: 'LeaderboardEntry',
        id: leaderboardEntry.id,
      })

      return {
        learningData: {
          id: `${input.courseId}-${ctx.user.sub}`,
          participation,
        },
      }
    }),

  leaveCourseLeaderboard: participantProcedure
    .input(participantCourseInput)
    .mutation(async ({ ctx, input }) => {
      const prisma = getPrisma(ctx)
      const participation = await prisma.participation.update({
        where: {
          courseId_participantId: {
            courseId: input.courseId,
            participantId: ctx.user.sub,
          },
        },
        data: {
          isActive: false,
        },
        select: {
          id: true,
          isActive: true,
        },
      })

      await prisma.leaderboardEntry.delete({
        where: {
          type_participantId_courseId: {
            type: LeaderboardType.COURSE,
            participantId: ctx.user.sub,
            courseId: input.courseId,
          },
        },
      })
      await prisma.leaderboardEntry.deleteMany({
        where: { participation: { id: participation.id } },
      })
      await prisma.leaderboardEntry.deleteMany({
        where: { sessionParticipationId: participation.id },
      })
      await prisma.timelineEntry.updateMany({
        where: { participationId: participation.id },
        data: {
          collectedPoints: 0,
        },
      })

      return {
        leaveCourseParticipation: {
          id: `${input.courseId}-${ctx.user.sub}`,
          participation,
        },
      }
    }),

  bookmarkElementStack: participantProcedure
    .input(participantBookmarkElementStackInput)
    .mutation(async ({ ctx, input }) => {
      const prisma = getPrisma(ctx)

      return bookmarkElementStack({
        bookmarked: input.bookmarked,
        courseId: input.courseId,
        participantId: ctx.user.sub,
        prisma,
        stackId: input.stackId,
      })
    }),

  stackElementFeedbacks: participantProcedure
    .input(participantStackElementFeedbacksInput)
    .query(async ({ ctx, input }) => {
      const prisma = getPrisma(ctx)

      return getStackElementFeedbacks({
        instanceIds: input.instanceIds,
        participantId: ctx.user.sub,
        prisma,
      })
    }),

  rateElement: participantProcedure
    .input(participantRateElementInput)
    .mutation(async ({ ctx, input }) => {
      const prisma = getPrisma(ctx)

      return rateElement({
        elementId: input.elementId,
        elementInstanceId: input.elementInstanceId,
        participantId: ctx.user.sub,
        prisma,
        rating: input.rating,
      })
    }),

  bookmarksPageData: participantProcedure
    .input(participantCourseInput)
    .query(async ({ ctx, input }) => {
      const prisma = getPrisma(ctx)

      return getBookmarksPageData({
        courseId: input.courseId,
        participantId: ctx.user.sub,
        prisma,
      })
    }),

  practiceQuiz: publicProcedure
    .input(participantPracticeQuizInput)
    .query(async ({ ctx, input }) => {
      const prisma = getPrisma(ctx)

      return getPracticeQuizDetail({
        id: input.id,
        prisma,
        user: ctx.user,
      })
    }),

  createParticipantGroup: participantProcedure
    .input(participantCreateGroupInput)
    .mutation(async ({ ctx, input }) => {
      const prisma = getPrisma(ctx)

      return createParticipantGroupService({
        courseId: input.courseId,
        emitter: ctx.emitter,
        name: input.name,
        participantId: ctx.user.sub,
        prisma,
      })
    }),

  joinParticipantGroup: participantProcedure
    .input(participantJoinGroupInput)
    .mutation(async ({ ctx, input }) => {
      const prisma = getPrisma(ctx)

      return joinParticipantGroupService({
        code: input.code,
        courseId: input.courseId,
        participantId: ctx.user.sub,
        prisma,
      })
    }),

  joinRandomCourseGroupPool: participantProcedure
    .input(participantCourseInput)
    .mutation(async ({ ctx, input }) => {
      const prisma = getPrisma(ctx)

      return joinRandomCourseGroupPoolService({
        courseId: input.courseId,
        participantId: ctx.user.sub,
        prisma,
      })
    }),

  leaveRandomCourseGroupPool: participantProcedure
    .input(participantCourseInput)
    .mutation(async ({ ctx, input }) => {
      const prisma = getPrisma(ctx)

      return leaveRandomCourseGroupPoolService({
        courseId: input.courseId,
        participantId: ctx.user.sub,
        prisma,
      })
    }),

  leaveParticipantGroup: participantProcedure
    .input(participantLeaveGroupInput)
    .mutation(async ({ ctx, input }) => {
      const prisma = getPrisma(ctx)

      return leaveParticipantGroupService({
        courseId: input.courseId,
        emitter: ctx.emitter,
        groupId: input.groupId,
        participantId: ctx.user.sub,
        prisma,
      })
    }),

  renameParticipantGroup: participantProcedure
    .input(participantRenameGroupInput)
    .mutation(async ({ ctx, input }) => {
      const prisma = getPrisma(ctx)

      return renameParticipantGroupService({
        emitter: ctx.emitter,
        groupId: input.groupId,
        name: input.name,
        prisma,
      })
    }),

  addMessageToGroup: participantProcedure
    .input(participantGroupMessageInput)
    .mutation(async ({ ctx, input }) => {
      const prisma = getPrisma(ctx)

      return addMessageToGroupService({
        content: input.content,
        groupId: input.groupId,
        participantId: ctx.user.sub,
        prisma,
      })
    }),

  updateProfile: participantProcedure
    .input(participantUpdateProfileInput)
    .mutation(async ({ ctx, input }) => {
      const prisma = getPrisma(ctx)

      return updateParticipantProfile({
        email: input.email,
        isProfilePublic: input.isProfilePublic,
        participantId: ctx.user.sub,
        password: input.password,
        prisma,
        username: input.username,
      })
    }),

  updateAvatar: participantProcedure
    .input(participantUpdateAvatarInput)
    .mutation(async ({ ctx, input }) => {
      const prisma = getPrisma(ctx)

      return updateParticipantAvatar({
        avatar: input.avatar,
        avatarSettings: input.avatarSettings,
        participantId: ctx.user.sub,
        prisma,
      })
    }),

  sendMagicLink: publicProcedure
    .input(participantSendMagicLinkInput)
    .mutation(async ({ ctx, input }) => {
      const prisma = getPrisma(ctx)

      return sendMagicLink({
        prisma,
        usernameOrEmail: input.usernameOrEmail,
      })
    }),

  self: publicProcedure
    .input(participantSelfInput)
    .query(async ({ ctx, input }) => {
      if (!ctx.user?.sub) return { self: null }

      const prisma = getPrisma(ctx)
      const liveQuizId = input?.liveQuizId

      if (ctx.user.role === UserRole.PARTICIPANT) {
        const liveQuiz = liveQuizId
          ? await prisma.liveQuiz.findUnique({
              where: { id: liveQuizId },
              select: { courseId: true },
            })
          : null

        const participant = await prisma.participant.findUnique({
          where: { id: ctx.user.sub },
          select: {
            id: true,
            email: true,
            username: true,
            locale: true,
            avatar: true,
            avatarSettings: true,
            isActive: true,
            isProfilePublic: true,
            xp: true,
            participations: liveQuiz?.courseId
              ? {
                  where: { courseId: liveQuiz.courseId },
                  select: { isActive: true },
                }
              : { take: 0, select: { isActive: true } },
            accounts: {
              where: { ssoType: 'uzh' },
              select: { ssoEmail: true },
              take: 1,
            },
          },
        })

        if (!participant) return { self: null }

        const isCourseParticipant =
          !!liveQuiz?.courseId && participant.participations.length > 0
        const isCourseParticipationActive =
          isCourseParticipant && !!participant.participations[0]?.isActive
        const levelData = await getLevelData(prisma, participant.xp)

        return {
          self: toParticipantSelf(participant, {
            institutionalEmail: participant.accounts[0]?.ssoEmail ?? null,
            isCourseParticipant,
            isCourseParticipationActive,
            levelData,
          }),
        }
      }

      if (ctx.user.role === UserRole.TEMPORARY_PARTICIPANT) {
        if (!liveQuizId) return { self: null }

        const temporaryParticipant =
          await prisma.temporaryLeaderboardEntry.findUnique({
            where: { id_quizId: { id: ctx.user.sub, quizId: liveQuizId } },
            select: {
              avatar: true,
              quizId: true,
              username: true,
            },
          })

        if (!temporaryParticipant) return { self: null }

        const levelData = await getLevelData(prisma, null)

        return {
          self: toTemporaryParticipantSelf(temporaryParticipant, {
            id: ctx.user.sub,
            levelData,
          }),
        }
      }

      return { self: null }
    }),

  publicProfile: participantProcedure
    .input(participantPublicProfileInput)
    .query(async ({ ctx, input }) => {
      const prisma = getPrisma(ctx)
      const self = await prisma.participant.findUnique({
        where: { id: ctx.user.sub },
        select: publicParticipantProfileSelect,
      })

      if (self?.id === input.participantId) {
        const levelData = await getLevelData(prisma, self.xp)

        return {
          publicParticipantProfile: toPublicParticipantProfile(
            { ...self, isSelf: true },
            { levelData }
          ),
        }
      }

      const participant = await prisma.participant.findUnique({
        where: { id: input.participantId },
        select: publicParticipantProfileSelect,
      })

      if (!participant) return { publicParticipantProfile: null }

      const visible = participant.isProfilePublic && self?.isProfilePublic
      const publicParticipantProfile = visible
        ? participant
        : { ...participant, username: 'Anonymous', avatar: null }
      const levelData = await getLevelData(prisma, publicParticipantProfile.xp)

      return {
        publicParticipantProfile: toPublicParticipantProfile(
          publicParticipantProfile,
          { levelData }
        ),
      }
    }),

  courses: participantProcedure.query(async ({ ctx }) => {
    const prisma = getPrisma(ctx)
    const participantCourses = await prisma.participant.findUnique({
      where: { id: ctx.user.sub },
      select: {
        participations: {
          select: {
            course: {
              select: {
                id: true,
                isArchived: true,
                displayName: true,
                description: true,
              },
            },
          },
        },
      },
    })

    return {
      participantCourses:
        participantCourses?.participations.map((participation) =>
          toParticipantCourse(participation.course)
        ) ?? [],
    }
  }),

  participations: participantProcedure
    .input(participantParticipationsInput)
    .query(async ({ ctx, input }) => {
      const prisma = getPrisma(ctx)
      const now = new Date()
      const endpoint = input?.endpoint ?? undefined
      const assessmentOnly = input?.assessmentOnly ?? false

      const participant = await prisma.participant.findUnique({
        where: { id: ctx.user.sub },
        select: {
          participations: {
            where: assessmentOnly
              ? { course: { isAssessmentEnabled: true } }
              : undefined,
            select: {
              id: true,
              completedMicroLearnings: true,
              subscriptions: endpoint
                ? {
                    where: { endpoint },
                    select: { id: true, endpoint: true },
                  }
                : { select: { id: true, endpoint: true } },
              course: {
                select: {
                  id: true,
                  displayName: true,
                  startDate: true,
                  endDate: true,
                  description: true,
                  isGamificationEnabled: true,
                  microLearnings: {
                    where: {
                      scheduledStartAt: { lt: now },
                      scheduledEndAt: { gt: now },
                      status: PublicationStatus.PUBLISHED,
                      isDeleted: false,
                    },
                    select: {
                      id: true,
                      displayName: true,
                      scheduledStartAt: true,
                      scheduledEndAt: true,
                    },
                  },
                  liveQuizzes: {
                    where: {
                      status: PublicationStatus.PUBLISHED,
                      isDeleted: false,
                    },
                    select: {
                      id: true,
                      displayName: true,
                    },
                  },
                },
              },
            },
            orderBy: { course: { displayName: 'asc' } },
          },
        },
      })

      return {
        participations:
          participant?.participations.map(toParticipantParticipation) ?? [],
      }
    }),

  courseOverview: publicProcedure
    .input(participantCourseInput)
    .query(async ({ ctx, input }) => {
      const prisma = getPrisma(ctx)
      const participantId =
        ctx.user?.role === UserRole.PARTICIPANT ? ctx.user.sub : undefined

      const participantGroups = participantId
        ? await prisma.participant.findUnique({
            where: { id: participantId },
            select: {
              participantGroups: {
                where: { courseId: input.courseId },
                select: {
                  id: true,
                  name: true,
                  code: true,
                  averageMemberScore: true,
                  groupActivityScore: true,
                  messages: {
                    orderBy: { createdAt: 'desc' },
                    select: {
                      id: true,
                      content: true,
                      createdAt: true,
                      updatedAt: true,
                      participant: {
                        select: {
                          id: true,
                          username: true,
                          avatar: true,
                        },
                      },
                    },
                  },
                  participants: {
                    select: {
                      id: true,
                      username: true,
                      avatar: true,
                      xp: true,
                      leaderboards: {
                        where: {
                          courseId: input.courseId,
                          type: LeaderboardType.COURSE,
                        },
                        select: { score: true },
                      },
                    },
                  },
                },
              },
            },
          })
        : null

      const mappedParticipantGroups =
        participantGroups?.participantGroups.map((group) => {
          const participants = group.participants
            .map((participant) => ({
              id: participant.id,
              username: participant.username,
              avatar: participant.avatar,
              xp: participant.xp,
              score: participant.leaderboards[0]?.score ?? 0,
              isSelf: participant.id === participantId,
            }))
            .sort((a, b) => {
              if (b.score !== a.score) return b.score - a.score
              return a.username.localeCompare(b.username)
            })
            .map((participant, ix) => ({ ...participant, rank: ix + 1 }))

          return {
            ...group,
            score: group.averageMemberScore + group.groupActivityScore,
            participants,
          }
        }) ?? []

      if (participantId) {
        const participation = await prisma.participation.findUnique({
          where: {
            courseId_participantId: {
              courseId: input.courseId,
              participantId,
            },
          },
          select: {
            id: true,
            isActive: true,
            course: {
              select: {
                id: true,
                displayName: true,
                color: true,
                description: true,
                isGamificationEnabled: true,
                isAssessmentEnabled: true,
                groupDeadlineDate: true,
                isGroupCreationEnabled: true,
                maxGroupSize: true,
                preferredGroupSize: true,
                participantGroups: {
                  select: {
                    id: true,
                    name: true,
                    averageMemberScore: true,
                    groupActivityScore: true,
                  },
                },
                awards: {
                  orderBy: { order: 'asc' },
                  select: {
                    id: true,
                    order: true,
                    type: true,
                    displayName: true,
                    description: true,
                    participant: {
                      select: {
                        id: true,
                        username: true,
                        avatar: true,
                      },
                    },
                    participantGroup: {
                      select: {
                        id: true,
                        name: true,
                      },
                    },
                  },
                },
              },
            },
            participant: {
              select: {
                id: true,
                avatar: true,
                username: true,
                xp: true,
                participantGroups: { select: { id: true } },
              },
            },
          },
        })

        if (participation) {
          const allGroupEntries =
            participation.course.participantGroups.reduce<{
              count: number
              mapped: {
                id: string
                isMember: boolean
                name: string
                rank: number
                score: number
              }[]
              sum: number
            }>(
              (acc, group) => {
                const score =
                  group.averageMemberScore + group.groupActivityScore
                acc.mapped.push({
                  id: group.id,
                  name: group.name,
                  score,
                  rank: 0,
                  isMember: participation.participant.participantGroups.some(
                    (participantGroup) => participantGroup.id === group.id
                  ),
                })
                acc.count += 1
                acc.sum += score
                return acc
              },
              { mapped: [], count: 0, sum: 0 }
            )

          const groupLeaderboard = allGroupEntries.mapped
            .sort((a, b) => {
              if (b.score !== a.score) return b.score - a.score
              return a.name.localeCompare(b.name)
            })
            .map((group, ix) => ({ ...group, rank: ix + 1 }))

          const groupCreationPoolEntry =
            await prisma.groupAssignmentPoolEntry.findUnique({
              where: {
                courseId_participantId: {
                  courseId: input.courseId,
                  participantId,
                },
              },
              select: { id: true },
            })

          return {
            courseOverview: toCourseOverview({
              id: `${input.courseId}-${participation.participant.id}`,
              course: participation.course,
              participant: participation.participant,
              participation,
              groupLeaderboard,
              groupLeaderboardStatistics: {
                participantCount: allGroupEntries.count,
                averageScore:
                  allGroupEntries.count > 0
                    ? allGroupEntries.sum / allGroupEntries.count
                    : 0,
              },
              inRandomGroupPool: groupCreationPoolEntry !== null,
            }),
            participantGroups: mappedParticipantGroups.map(toParticipantGroup),
          }
        }
      }

      const course = await prisma.course.findUnique({
        where: { id: input.courseId },
        select: {
          id: true,
          displayName: true,
          color: true,
          description: true,
          isGamificationEnabled: true,
          isAssessmentEnabled: true,
          groupDeadlineDate: true,
          isGroupCreationEnabled: true,
          maxGroupSize: true,
          preferredGroupSize: true,
          awards: {
            orderBy: { order: 'asc' },
            select: {
              id: true,
              order: true,
              type: true,
              displayName: true,
              description: true,
              participant: {
                select: {
                  id: true,
                  username: true,
                  avatar: true,
                },
              },
              participantGroup: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
      })

      if (!course) {
        return { courseOverview: null, participantGroups: [] }
      }

      const participant = participantId
        ? await prisma.participant.findUnique({
            where: { id: participantId },
            select: {
              id: true,
              avatar: true,
              username: true,
              xp: true,
            },
          })
        : null

      return {
        courseOverview: toCourseOverview({
          id: `${input.courseId}-${participant?.id}`,
          course,
          participant,
          participation: null,
        }),
        participantGroups: mappedParticipantGroups.map(toParticipantGroup),
      }
    }),

  courseLeaderboard: publicProcedure
    .input(participantCourseLeaderboardInput)
    .query(async ({ ctx, input }) => {
      if (!ctx.user?.sub || ctx.user.role !== UserRole.PARTICIPANT) {
        return toCourseLeaderboard(emptyCourseLeaderboard())
      }

      const prisma = getPrisma(ctx)

      if (input.mode === 'biweekly') {
        return toCourseLeaderboard(
          await getRollingCourseLeaderboard({
            courseId: input.courseId,
            days: 14,
            prisma,
            participantId: ctx.user.sub,
          })
        )
      }

      const participation = await prisma.participation.findUnique({
        where: {
          courseId_participantId: {
            courseId: input.courseId,
            participantId: ctx.user.sub,
          },
        },
        select: {
          participant: {
            select: { isProfilePublic: true },
          },
        },
      })

      if (!participation) {
        return toCourseLeaderboard(emptyCourseLeaderboard())
      }

      const leaderboardEntries = await prisma.participation.findMany({
        where: { courseId: input.courseId, isActive: true },
        select: {
          id: true,
          courseLeaderboard: {
            select: { score: true },
          },
          participant: {
            select: {
              id: true,
              username: true,
              avatar: true,
              isProfilePublic: true,
              xp: true,
            },
          },
        },
      })

      const mappedEntries = leaderboardEntries.map((entry) => ({
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
      }))

      const sortedEntries = mappedEntries.sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score
        return a.username.localeCompare(b.username)
      })
      const leaderboard = sortedEntries.flatMap((entry, ix) => {
        if (ix < 10 || entry.participantId === ctx.user?.sub) {
          return { ...entry, rank: ix + 1 }
        }
        return []
      })
      const sum = mappedEntries.reduce((acc, entry) => acc + entry.score, 0)

      return toCourseLeaderboard({
        leaderboard,
        leaderboardStatistics: {
          participantCount: mappedEntries.length,
          averageScore:
            mappedEntries.length > 0 ? sum / mappedEntries.length : 0,
        },
      })
    }),

  practiceQuizBookmarks: participantProcedure
    .input(participantPracticeQuizBookmarksInput)
    .query(async ({ ctx, input }) => {
      const prisma = getPrisma(ctx)

      return getPracticeQuizBookmarks({
        courseId: input.courseId,
        participantId: ctx.user.sub,
        prisma,
        quizId: input.quizId,
      })
    }),

  courseGroupActivities: participantProcedure
    .input(participantCourseInput)
    .query(async ({ ctx, input }) => {
      const prisma = getPrisma(ctx)
      const course = await prisma.course.findUnique({
        where: {
          id: input.courseId,
          participations: { some: { participantId: ctx.user.sub } },
        },
        select: {
          groupActivities: {
            where: {
              status: {
                in: [
                  PublicationStatus.SCHEDULED,
                  PublicationStatus.PUBLISHED,
                  PublicationStatus.ENDED,
                  PublicationStatus.GRADED,
                ],
              },
              isDeleted: false,
            },
            orderBy: {
              scheduledStartAt: 'desc',
            },
            select: {
              id: true,
              displayName: true,
              status: true,
              description: true,
              scheduledStartAt: true,
              scheduledEndAt: true,
            },
          },
        },
      })

      return {
        groupActivities:
          course?.groupActivities.map(toCourseGroupActivity) ?? [],
      }
    }),

  groupActivityInstances: participantProcedure
    .input(participantGroupActivityInstancesInput)
    .query(async ({ ctx, input }) => {
      const prisma = getPrisma(ctx)
      const instances = await prisma.groupActivityInstance.findMany({
        where: {
          groupActivity: {
            course: {
              id: input.courseId,
            },
          },
          group: {
            id: input.groupId,
            courseId: input.courseId,
            participants: {
              some: {
                id: ctx.user.sub,
              },
            },
          },
        },
        select: {
          id: true,
          decisionsSubmittedAt: true,
          resultsComputedAt: true,
          results: true,
          groupActivityId: true,
        },
      })

      return {
        groupActivityInstances: instances.map(toGroupActivityInstance),
      }
    }),

  subscribeToPush: participantProcedure
    .input(participantSubscribeToPushInput)
    .mutation(async ({ ctx, input }) => {
      const prisma = getPrisma(ctx)
      const participation = await prisma.participation.update({
        where: {
          courseId_participantId: {
            courseId: input.courseId,
            participantId: ctx.user.sub,
          },
        },
        data: {
          subscriptions: {
            upsert: {
              where: {
                participantId_courseId_endpoint: {
                  participantId: ctx.user.sub,
                  courseId: input.courseId,
                  endpoint: input.subscriptionObject.endpoint,
                },
              },
              create: {
                endpoint: input.subscriptionObject.endpoint,
                expirationTime: input.subscriptionObject.expirationTime ?? null,
                p256dh: input.subscriptionObject.keys.p256dh,
                auth: input.subscriptionObject.keys.auth,
                course: { connect: { id: input.courseId } },
                participant: { connect: { id: ctx.user.sub } },
              },
              update: {},
            },
          },
        },
        select: {
          id: true,
          subscriptions: {
            select: {
              id: true,
              endpoint: true,
            },
          },
        },
      })

      return {
        participation: {
          id: participation.id,
          subscriptions: participation.subscriptions.map((subscription) => ({
            id: subscription.id,
            endpoint: subscription.endpoint,
          })),
        },
      }
    }),

  unsubscribeFromPush: participantProcedure
    .input(participantUnsubscribeFromPushInput)
    .mutation(async ({ ctx, input }) => {
      const prisma = getPrisma(ctx)

      try {
        await prisma.pushSubscription.delete({
          where: {
            participantId_courseId_endpoint: {
              participantId: ctx.user.sub,
              courseId: input.courseId,
              endpoint: input.endpoint,
            },
          },
        })

        return true
      } catch (error) {
        console.error(
          'An error occured while trying to unsubscribe from push notifications: ',
          error
        )
        return false
      }
    }),

  practiceCourses: participantProcedure.query(async ({ ctx }) => {
    const prisma = getPrisma(ctx)
    const participations = await prisma.participation.findMany({
      where: {
        participantId: ctx.user.sub,
      },
      select: {
        course: {
          select: {
            id: true,
            displayName: true,
            endDate: true,
            elementStacks: {
              select: { id: true },
            },
          },
        },
      },
    })

    const practiceCourses = participations
      .map((participation) => participation.course)
      .filter((course) => course.elementStacks.length > 0)
      .sort((a, b) => b.endDate.getTime() - a.endDate.getTime())
      .map(toPracticeCourse)

    return { practiceCourses }
  }),

  coursePublishedPracticeQuizzes: publicProcedure
    .input(participantCourseInput)
    .query(async ({ ctx, input }) => {
      const prisma = getPrisma(ctx)
      const course = await prisma.course.findUnique({
        where: { id: input.courseId },
        select: {
          id: true,
          displayName: true,
          practiceQuizzes: {
            where: {
              status: PublicationStatus.PUBLISHED,
              isDeleted: false,
            },
            orderBy: { createdAt: 'asc' },
            select: {
              id: true,
              name: true,
              displayName: true,
            },
          },
        },
      })

      if (!course) return { practiceQuizzes: [] }

      const courseSummary = {
        id: course.id,
        displayName: course.displayName,
      }

      return {
        practiceQuizzes: course.practiceQuizzes.map((quiz) =>
          toPublishedPracticeQuiz({
            ...quiz,
            course: courseSummary,
          })
        ),
      }
    }),
})
