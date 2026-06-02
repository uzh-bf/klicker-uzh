import { UserRole, type PrismaClient } from '@klicker-uzh/prisma/client'
import { levelFromXp } from '@klicker-uzh/util'
import { getPrisma } from '../context.js'
import {
  toParticipantCourse,
  toParticipantSelf,
  toPracticeCourse,
  toTemporaryParticipantSelf,
} from '../dto/participant.js'
import { publicProcedure, router } from '../init.js'
import { participantProcedure } from '../procedures.js'
import { participantSelfInput } from '../schemas/participant.js'

async function getLevelData(prisma: PrismaClient, xp: number | null) {
  return await prisma.level.findUnique({
    where: { index: levelFromXp(xp ?? 0) },
    include: { nextLevel: true },
  })
}

export const participantRouter = router({
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
})
