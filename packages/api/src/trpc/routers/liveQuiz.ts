import { PermissionLevel, PublicationStatus } from '@klicker-uzh/prisma/client'
import { TRPCError } from '@trpc/server'
import {
  activateLiveQuizBlock,
  cancelLiveQuiz,
  deactivateLiveQuizBlock,
  endLiveQuiz,
  startLiveQuiz,
  type LiveQuizExecutionContext,
} from '../../services/liveQuizExecution.js'
import { getLecturerViewLiveQuiz } from '../../services/manageLiveQuizLecturerView.js'
import { getPrisma, type TRPCContextWithUser } from '../context.js'
import {
  toActivatedLiveQuiz,
  toControlLiveQuiz,
  toControlLiveQuizListItem,
  toLiveQuizEmbeddingInfo,
  toLiveQuizMeta,
  toLiveQuizStatus,
  toRunningLiveQuizListItem,
} from '../dto/liveQuiz.js'
import { router } from '../init.js'
import {
  hasLiveQuizPermission,
  requireLiveQuizPermission,
} from '../permissions.js'
import { userProcedure, userSessionExecProcedure } from '../procedures.js'
import { liveQuizBlockInput, liveQuizIdInput } from '../schemas/liveQuiz.js'

function getExecutionContext(ctx: TRPCContextWithUser) {
  if (
    !ctx.redisExec ||
    !ctx.redisAssessmentExec ||
    !ctx.pubSub ||
    !ctx.emitter ||
    !ctx.hatchet ||
    !ctx.tasks
  ) {
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Live quiz execution context unavailable',
    })
  }

  return ctx as unknown as LiveQuizExecutionContext
}

export const liveQuizRouter = router({
  running: userProcedure.query(async ({ ctx }) => {
    const prisma = getPrisma(ctx)
    const user = await prisma.user.findUnique({
      where: { id: ctx.user.sub },
      select: {
        objects: {
          where: {
            liveQuizId: { not: null },
            permissionLevel: {
              in: [
                PermissionLevel.EXECUTE,
                PermissionLevel.WRITE,
                PermissionLevel.ADMIN,
                PermissionLevel.OWNER,
              ],
            },
            liveQuiz: { status: PublicationStatus.PUBLISHED },
          },
          select: {
            liveQuiz: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    })

    return {
      liveQuizzes:
        user?.objects
          .map((object) => object.liveQuiz)
          .filter((quiz): quiz is NonNullable<typeof quiz> => quiz !== null)
          .map(toRunningLiveQuizListItem) ?? [],
    }
  }),

  unassigned: userProcedure.query(async ({ ctx }) => {
    const prisma = getPrisma(ctx)
    const user = await prisma.user.findUnique({
      where: {
        id: ctx.user.sub,
      },
      include: {
        liveQuizzes: {
          where: {
            courseId: null,
            status: {
              in: [
                PublicationStatus.PUBLISHED,
                PublicationStatus.SCHEDULED,
                PublicationStatus.DRAFT,
              ],
            },
          },
          select: {
            id: true,
            name: true,
            status: true,
          },
          orderBy: [{ startedAt: 'desc' }, { createdAt: 'desc' }],
        },
      },
    })

    return {
      liveQuizzes: user?.liveQuizzes.map(toControlLiveQuizListItem) ?? [],
    }
  }),

  control: userProcedure
    .input(liveQuizIdInput)
    .query(async ({ ctx, input }) => {
      if (
        !(await hasLiveQuizPermission(
          ctx as TRPCContextWithUser,
          input.id,
          PermissionLevel.READ
        ))
      ) {
        return { controlLiveQuiz: null }
      }

      const prisma = getPrisma(ctx)
      const quiz = await prisma.liveQuiz.findUnique({
        where: { id: input.id, status: PublicationStatus.PUBLISHED },
        include: {
          activeBlock: {
            select: {
              id: true,
              order: true,
            },
          },
          course: {
            select: {
              id: true,
              displayName: true,
            },
          },
          blocks: {
            include: {
              elements: {
                select: {
                  id: true,
                  elementData: true,
                },
                orderBy: {
                  order: 'asc',
                },
              },
            },
            orderBy: {
              order: 'asc',
            },
          },
        },
      })

      return {
        controlLiveQuiz: toControlLiveQuiz(quiz),
      }
    }),

  lecturerView: userProcedure
    .input(liveQuizIdInput)
    .query(async ({ ctx, input }) => {
      if (
        !(await hasLiveQuizPermission(
          ctx as TRPCContextWithUser,
          input.id,
          PermissionLevel.READ
        ))
      ) {
        return { lecturerViewLiveQuiz: null }
      }

      return {
        lecturerViewLiveQuiz: await getLecturerViewLiveQuiz({
          id: input.id,
          prisma: getPrisma(ctx),
        }),
      }
    }),

  embeddingInfo: userProcedure
    .input(liveQuizIdInput)
    .query(async ({ ctx, input }) => {
      if (
        !(await hasLiveQuizPermission(
          ctx as TRPCContextWithUser,
          input.id,
          PermissionLevel.READ
        ))
      ) {
        return { embeddingInfo: null }
      }

      const prisma = getPrisma(ctx)
      const quiz = await prisma.liveQuiz.findUnique({
        where: { id: input.id },
        select: {
          id: true,
          namespace: true,
          blocks: {
            select: {
              elements: {
                select: {
                  id: true,
                  elementData: true,
                },
                orderBy: {
                  order: 'asc',
                },
              },
            },
            orderBy: {
              order: 'asc',
            },
          },
        },
      })

      return {
        embeddingInfo: toLiveQuizEmbeddingInfo(
          quiz,
          process.env.APP_SECRET as string
        ),
      }
    }),

  start: userSessionExecProcedure
    .input(liveQuizIdInput)
    .mutation(async ({ ctx, input }) => {
      await requireLiveQuizPermission(
        ctx as TRPCContextWithUser,
        input.id,
        PermissionLevel.EXECUTE
      )

      const quiz = await startLiveQuiz(
        input,
        getExecutionContext(ctx as TRPCContextWithUser)
      )

      return { liveQuiz: toLiveQuizMeta(quiz) }
    }),

  activateBlock: userSessionExecProcedure
    .input(liveQuizBlockInput)
    .mutation(async ({ ctx, input }) => {
      await requireLiveQuizPermission(
        ctx as TRPCContextWithUser,
        input.quizId,
        PermissionLevel.EXECUTE
      )

      const quiz = await activateLiveQuizBlock(
        input,
        getExecutionContext(ctx as TRPCContextWithUser)
      )

      return { liveQuiz: toActivatedLiveQuiz(quiz) }
    }),

  deactivateBlock: userSessionExecProcedure
    .input(liveQuizBlockInput)
    .mutation(async ({ ctx, input }) => {
      await requireLiveQuizPermission(
        ctx as TRPCContextWithUser,
        input.quizId,
        PermissionLevel.EXECUTE
      )

      const deactivated = await deactivateLiveQuizBlock(
        input,
        getExecutionContext(ctx as TRPCContextWithUser)
      )

      return { deactivated }
    }),

  end: userSessionExecProcedure
    .input(liveQuizIdInput)
    .mutation(async ({ ctx, input }) => {
      await requireLiveQuizPermission(
        ctx as TRPCContextWithUser,
        input.id,
        PermissionLevel.EXECUTE
      )

      const quiz = await endLiveQuiz(
        input,
        getExecutionContext(ctx as TRPCContextWithUser)
      )

      return { liveQuiz: toLiveQuizStatus(quiz) }
    }),

  cancel: userSessionExecProcedure
    .input(liveQuizIdInput)
    .mutation(async ({ ctx, input }) => {
      await requireLiveQuizPermission(
        ctx as TRPCContextWithUser,
        input.id,
        PermissionLevel.EXECUTE
      )

      const quiz = await cancelLiveQuiz(
        input,
        getExecutionContext(ctx as TRPCContextWithUser)
      )

      return { liveQuiz: toLiveQuizStatus(quiz) }
    }),
})
