import { PermissionLevel, PublicationStatus } from '@klicker-uzh/prisma/client'
import { getPrisma, type TRPCContext } from '../context.js'
import {
  toControlLiveQuiz,
  toControlLiveQuizListItem,
  toLiveQuizEmbeddingInfo,
} from '../dto/liveQuiz.js'
import { router } from '../init.js'
import { userProcedure } from '../procedures.js'
import { liveQuizIdInput } from '../schemas/liveQuiz.js'

const liveQuizReadPermissionLevels = [
  PermissionLevel.READ,
  PermissionLevel.EXECUTE,
  PermissionLevel.WRITE,
  PermissionLevel.ADMIN,
  PermissionLevel.OWNER,
]

async function hasLiveQuizReadPermission(
  ctx: TRPCContext & { user: { sub: string } },
  liveQuizId: string
) {
  const prisma = getPrisma(ctx)
  const permission = await prisma.derivedPermission.findFirst({
    where: {
      liveQuizId,
      userId: ctx.user.sub,
      permissionLevel: {
        in: liveQuizReadPermissionLevels,
      },
    },
  })

  return Boolean(permission)
}

export const liveQuizRouter = router({
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
      if (!(await hasLiveQuizReadPermission(ctx, input.id))) {
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

  embeddingInfo: userProcedure
    .input(liveQuizIdInput)
    .query(async ({ ctx, input }) => {
      if (!(await hasLiveQuizReadPermission(ctx, input.id))) {
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
})
